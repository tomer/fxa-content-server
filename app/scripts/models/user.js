/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This module represents a user of the fxa-content-server site.
// It persists accounts the user has logged in with and potentially
// other state about the user that might be useful.
//
// i.e. User hasMany Accounts.

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const Account = require('models/account');
  const AuthErrors = require('lib/auth-errors');
  const Backbone = require('backbone');
  const Cocktail = require('cocktail');
  const Constants = require('lib/constants');
  const MarketingEmailErrors = require('lib/marketing-email-errors');
  const p = require('lib/promise');
  const ResumeTokenMixin = require('models/mixins/resume-token');
  const SearchParamMixin = require('models/mixins/search-param');
  const Storage = require('lib/storage');
  const vat = require('lib/vat');

  var User = Backbone.Model.extend({
    initialize (options = {}) {
      this._oAuthClientId = options.oAuthClientId;
      this._oAuthClient = options.oAuthClient;
      this._profileClient = options.profileClient;
      this._fxaClient = options.fxaClient;
      this._marketingEmailClient = options.marketingEmailClient;
      this._metrics = options.metrics;
      this._assertion = options.assertion;
      this._notifier = options.notifier;
      this._storage = options.storage || Storage.factory();

      this.sentryMetrics = options.sentryMetrics;

      // For now, the uniqueUserId is passed in from app-start instead of
      // being initialized from the resume token or localStorage.
      this.set('uniqueUserId', options.uniqueUserId);

      // We cache the signed-in account instance to share across
      // consumers so that they don't have to refetch the account's
      // ephemeral data, e.g. OAuth access tokens.
      this._cachedSignedInAccount = null;

      this.window = options.window || window;
      this.fetch();
    },

    defaults: {
      // uniqueUserId is a stable identifier for this User on this computer.
      uniqueUserId: null
    },

    resumeTokenFields: ['uniqueUserId'],

    resumeTokenSchema: {
      uniqueUserId: vat.uuid()
    },

    // Hydrate the model. Returns a promise.
    fetch () {
      return p().then(() => {
        this.populateFromStringifiedResumeToken(this.getSearchParam('resume'));
      });
    },

    /**
     * Log the number of stored accounts
     */
    logNumStoredAccounts () {
      const numAccounts = Object.keys(this._accounts()).length;
      this._metrics.logEventOnce(`num.accounts.${numAccounts}`);
    },

    _accounts () {
      return this._storage.get('accounts') || {};
    },

    _getAccount (uid) {
      if (! uid) {
        return null;
      } else {
        return this._accounts()[uid] || null;
      }
    },

    _setSignedInAccountUid (uid) {
      this._storage.set('currentAccountUid', uid);
      // Clear the in-memory cache if the uid has changed
      if (this._cachedSignedInAccount && this._cachedSignedInAccount.get('uid') !== uid) {
        this._cachedSignedInAccount = null;
      }
    },

    clearSignedInAccountUid () {
      this._storage.remove('currentAccountUid');
      this._cachedSignedInAccount = null;
    },

    _getSignedInAccountData () {
      return this._getAccount(this._storage.get('currentAccountUid'));
    },

    // persists account data
    _persistAccount (accountData) {
      var account = this.initAccount(accountData);

      var accounts = this._accounts();
      accounts[account.get('uid')] = account.toPersistentJSON();

      this._storage.set('accounts', accounts);
    },

    // A convenience method that initializes an account instance from
    // raw account data.
    initAccount (accountData) {
      if (accountData instanceof Account) {
        // we already have an account instance
        return accountData;
      }

      return new Account(accountData, {
        assertion: this._assertion,
        fxaClient: this._fxaClient,
        marketingEmailClient: this._marketingEmailClient,
        metrics: this._metrics,
        oAuthClient: this._oAuthClient,
        oAuthClientId: this._oAuthClientId,
        profileClient: this._profileClient
      });
    },

    isSyncAccount (account) {
      return this.initAccount(account).isFromSync();
    },

    /**
     * Check the session status of the currently signed in user.
     *
     * @param {Object} [account] - account to check session status. If not provided,
     *  the currently signed in account is used.
     * @returns {Promise} resolves to signed in Account.
     *  If no user is signed in, rejects with an `INVALID_TOKEN` error.
     */
    sessionStatus (account = this.getSignedInAccount()) {
      return account.sessionStatus()
        .then(() => {
          // The session info may have changed since when it was last stored.
          // The Account model has already updated itself, now store the server's
          // view of the world. This will store the canonicalized email for everyone
          // that fetches the account afterwards.
          this.setAccount(account);
          return account;
        }, (err) => {
          // an account that was previously signed in is no longer considered signed in,
          // it's sessionToken field will have been updated. Store the account.
          if (AuthErrors.is(err, 'INVALID_TOKEN') && ! account.isDefault()) {
            this.setAccount(account);
          }
          throw err;
        });
    },

    getSignedInAccount () {
      if (! this._cachedSignedInAccount) {
        this._cachedSignedInAccount = this.initAccount(this._getSignedInAccountData());
      }

      return this._cachedSignedInAccount;
    },

    isSignedInAccount (account) {
      return account.get('uid') === this.getSignedInAccount().get('uid');
    },

    setSignedInAccountByUid (uid) {
      if (this._accounts()[uid]) {
        this._setSignedInAccountUid(uid);
      }
    },

    getAccountByUid (uid) {
      var account = this._accounts()[uid];
      return this.initAccount(account);
    },

    getAccountByEmail (email) {
      // Reverse the list so newest accounts are first
      var uids = Object.keys(this._accounts()).reverse();
      var accounts = this._accounts();

      var uid = _.find(uids, function (uid) {
        return accounts[uid].email === email;
      });

      return this.initAccount(accounts[uid]);
    },

    // Return the account selected in the account chooser.
    // Defaults to the last logged in account unless a desktop session
    // has been stored.
    getChooserAccount () {
      var account = _.find(this._accounts(), (account) => {
        return this.isSyncAccount(account);
      }) || this.getSignedInAccount();

      return this.initAccount(account);
    },

    // Used to clear the current account, but keeps the account details
    clearSignedInAccount () {
      var uid = this.getSignedInAccount().get('uid');
      this.clearSignedInAccountUid();
      this._notifier.triggerRemote(this._notifier.COMMANDS.SIGNED_OUT, {
        uid: uid
      });
    },

    removeAllAccounts () {
      this.clearSignedInAccountUid();
      this._storage.remove('accounts');
    },

    /**
     * Remove the account from storage. If account is the "signed in account",
     * the signed in account field will be cleared.
     *
     * @param {Object} accountData - Account model or object representing
     *   account data.
     */
    removeAccount (accountData) {
      var account = this.initAccount(accountData);

      if (this.isSignedInAccount(account)) {
        this.clearSignedInAccount();
      }

      var accounts = this._accounts();
      var uid = account.get('uid');
      delete accounts[uid];
      this._storage.set('accounts', accounts);
    },

    /**
     * Delete the account from the server, notify all interested parties,
     * delete the account from storage.
     *
     * @param {Object} accountData
     * @param {String} password - the user's password
     * @return {Promise} - resolves when complete
     */
    deleteAccount (accountData, password) {
      var account = this.initAccount(accountData);

      return account.destroy(password)
        .then(() => {
          this.removeAccount(account);
          this._notifier.triggerAll(this._notifier.COMMANDS.DELETE, {
            uid: account.get('uid')
          });
        });
    },

    // Stores a new account and sets it as the current account.
    setSignedInAccount (accountData) {
      var account = this.initAccount(accountData);
      account.set('lastLogin', Date.now());

      return this.setAccount(account)
        .then((account) => {
          this._cachedSignedInAccount = account;
          this._setSignedInAccountUid(account.get('uid'));
          return account;
        });
    },

    // Hydrate the account then persist it
    setAccount (accountData) {
      var account = this.initAccount(accountData);
      return account.fetch()
        .then(() => {
          this._persistAccount(account);
          return account;
        });
    },

    // Old sessions store two accounts: The last account the
    // user logged in to FxA with, and the account they logged in to
    // Sync with. If they are different accounts, we'll save both accounts.
    upgradeFromSession (Session, fxaClient) {
      return p().then(() => {
        if (! this.getSignedInAccount().isDefault()) {
          // We've already upgraded the session
          return;
        }

        var promise = p();

        // add cached Sync account credentials if available
        if (Session.cachedCredentials) {
          promise = this.setSignedInAccount({
            email: Session.cachedCredentials.email,
            sessionToken: Session.cachedCredentials.sessionToken,
            sessionTokenContext: Session.cachedCredentials.sessionTokenContext,
            uid: Session.cachedCredentials.uid
          });
          Session.clear('cachedCredentials');
        }

        if (this._shouldAddOldSessionAccount(Session)) {
          promise = promise
            // The uid was not persisted in localStorage so get it from the auth server
            .then(_.bind(fxaClient.sessionStatus, fxaClient, Session.sessionToken))
            .then((result) => {
              return this.setSignedInAccount({
                email: Session.email,
                sessionToken: Session.sessionToken,
                sessionTokenContext: Session.sessionTokenContext,
                uid: result.uid
              })
              .then(() => {
                Session.clear('email');
                Session.clear('sessionToken');
                Session.clear('sessionTokenContext');
              });
            }, function () {
              // if there's an error, just ignore the account
            }); /* HACK: See eslint/eslint#1801 */ // eslint-disable-line indent
        }

        return promise;
      });
    },

    // Before a13f05f2 (18 Dec 2014), all kinds of extra
    // data was written to the Account. This extra data hung
    // arround even if the user signed in again. After d4321990
    // (12 Jan 2016), only allowed fields are allowed to be
    // set on an account, unexpected fields cause an error.
    // Update any accounts with unexpected data.
    upgradeFromUnfilteredAccountData () {
      return p().then(() => {
        var accountData = this._accounts();
        for (var userid in accountData) {
          var unfiltered = accountData[userid];
          var filtered = _.pick(unfiltered, Account.ALLOWED_KEYS);

          if (! _.isEqual(unfiltered, filtered)) {
            this._persistAccount(filtered);
          }
        }
      });
    },

    // Add the last signed in account (if it's different from the
    // Sync account). If the email is the same we assume it's the
    // same account since users can't change email yet.
    _shouldAddOldSessionAccount (Session) {
      return (Session.email && Session.sessionToken &&
        (! Session.cachedCredentials ||
        Session.cachedCredentials.email !== Session.email));
    },

    /**
     * Sign in an account. Notifies other tabs of signin on success.
     *
     * @param {Object} account - account to sign in
     * @param {String} password - the user's password
     * @param {Object} relier - relier being signed in to
     * @param {Object} [options] - options
     *   @param {String} [options.unblockCode] - unblock code
     * @returns {Promise} - resolves when complete
     */
    signInAccount (account, password, relier, options) {
      return account.signIn(password, relier, options)
        .then(() => {
          // If there's an account with the same uid in localStorage we merge
          // its attributes with the new account instance to retain state
          // used across sign-ins, such as granted permissions.
          var oldAccount = this.getAccountByUid(account.get('uid'));
          if (! oldAccount.isDefault()) {
            // allow new account attributes to override old ones
            oldAccount.set(_.omit(account.attributes, function (val) {
              return typeof val === 'undefined';
            }));
            account = oldAccount;
          }

          this._notifyOfAccountSignIn(account);
          return this.setSignedInAccount(account);
        });
    },

    /**
     * Sign up a new account
     *
     * @param {Object} account - account to sign up
     * @param {String} password - the user's password
     * @param {Object} relier - relier being signed in to
     * @param {Object} [options] - options
     * @returns {Promise} - resolves when complete
     */
    signUpAccount (account, password, relier, options) {
      return account.signUp(password, relier, options)
        .then(() => this.setSignedInAccount(account));
    },

    signOutAccount (account) {
      return account.signOut()
        .fin(() => {
          // Clear the session, even on failure. Everything is A-OK.
          // See issue #616
          if (this.isSignedInAccount(account)) {
            this.clearSignedInAccount();
          }
        });
    },

    /**
     * Complete signup for the account. Notifies other tabs of signin
     * if the account has a sessionToken and verification successfully
     * completes.
     *
     * @param {Object} account - account to verify
     * @param {String} code - verification code
     * @param {Object} [options]
     * @param {Object} [options.service] - the service issuing signup request
     * @returns {Promise} - resolves with the account when complete
     */
    completeAccountSignUp (account, code, options) {
      // The original tab may no longer be open to notify other
      // windows the user is signed in. If the account has a `sessionToken`,
      // the user verified in the same browser. Notify any tabs that care.
      const notifyIfSignedIn = (account) => {
        if (account.has('sessionToken')) {
          this._notifyOfAccountSignIn(account);
        }
      };

      return account.verifySignUp(code, options)
        .fail(function (err) {
          if (MarketingEmailErrors.created(err)) {
            // A MarketingEmailError doesn't prevent a user from
            // completing the signup. If we receive a MarketingEmailError,
            // notify other tabs of the sign in, and re-throw the error
            // so it can be logged at a higher level.
            notifyIfSignedIn(account);
          }
          throw err;
        })
        .then(function () {
          notifyIfSignedIn(account);

          return account;
        });
    },

    /**
     * Change the account password
     *
     * @param {Object} account - account to change the password for.
     * @param {String} oldPassword - the old password
     * @param {String} newPassword - the new password
     * @param {Object} relier - the relier used to open settings
     * @return {Object} promise - resolves with the updated account
     * when complete.
     */
    changeAccountPassword (account, oldPassword, newPassword, relier) {
      return account.changePassword(oldPassword, newPassword, relier)
        .then(() => {
          return this.setSignedInAccount(account);
        })
        .then(() => {
          // Notify the browser whenever the password has changed
          const notifier = this._notifier;
          const changePasswordCommand = notifier.COMMANDS.CHANGE_PASSWORD;

          const loginData = account.pick(
              Object.keys(notifier.SCHEMATA[changePasswordCommand]));
          loginData.verified = !! loginData.verified;

          notifier.triggerRemote(
            changePasswordCommand,
            loginData
          );

          return account;
        });
    },

    /**
     * Notify other tabs of account sign in
     *
     * @private
     * @param {Object} account
     */
    _notifyOfAccountSignIn (account) {
      // Other tabs only need to know the account `uid` to load any
      // necessary info from localStorage
      this._notifier.triggerRemote(
        this._notifier.COMMANDS.SIGNED_IN, account.pick('uid', 'unwrapBKey', 'keyFetchToken'));
    },

    /**
     * Complete a password reset for the account. Notifies other tabs
     * of signin on success.
     *
     * @param {Object} account - account to sign up
     * @param {String} password - the user's new password
     * @param {String} token - email verification token
     * @param {String} code - email verification code
     * @param {Object} relier - relier being signed in to
     * @returns {Promise} - resolves when complete
     */
    completeAccountPasswordReset (account, password, token, code, relier) {
      return account.completePasswordReset(password, token, code, relier)
        .then(() => {
          this._notifyOfAccountSignIn(account);
          return this.setSignedInAccount(account);
        });
    },

    /**
     *
     * @param {Object} account - account object
     * @param {Object} client - an attached client
     * @returns {Promise}
     */
    destroyAccountClient (account, client) {
      if (client.get('clientType') === Constants.CLIENT_TYPE_DEVICE) {
        return this.destroyAccountDevice(account, client);
      } else if (client.get('clientType') === Constants.CLIENT_TYPE_OAUTH_APP) {
        return this.destroyAccountApp(account, client);
      }
    },

    /**
     * Fetch the devices for the given account, populated the passed in
     * Devices collection.
     *
     * @param {Object} account - account for which device list is requested
     * @param {Object} devices - Devices collection used to store list.
     * @returns {Promise} resolves when the action completes
     */
    fetchAccountDevices (account, devices) {
      return account.fetchDevices(devices);
    },

    /**
     * Fetch the OAuthApps for the given account, populated into the passed
     * collection.
     *
     * @param {Object} account - account for which device list is requested
     * @param {Object} oAuthApps - oAuthApps collection used to store list.
     * @returns {Promise} resolves when the action completes
     */
    fetchAccountOAuthApps (account, oAuthApps) {
      return account.fetchOAuthApps(oAuthApps);
    },

    /**
     * Destroy a device on the given account. If the current device
     * is destroyed, sign out the user.
     *
     * @param {Object} account - account with the device
     * @param {Object} device - device to destroy
     * @returns {Promise} resolves when the action completes
     */
    destroyAccountDevice (account, device) {
      return account.destroyDevice(device)
        .then(() => {
          if (this.isSignedInAccount(account) && device.get('isCurrentDevice')) {
            this.clearSignedInAccount();
          }
        });
    },

    /**
     * Destroy the OAuth app on the given account.
     *
     * @param {Object} account - account with the connected app
     * @param {Object} oAuthApp - OAuth App to disconnect
     * @returns {Promise} resolves when the action completes
     */
    destroyAccountApp (account, oAuthApp) {
      return account.destroyOAuthApp(oAuthApp);
    },

    /**
     * Check whether an Account's `uid` is registered. Removes the account
     * from storage if account no longer exists on the server.
     *
     * @param {Object} account - account to check
     * @returns {Promise} resolves to `true` if an account exists, `false` otw.
     */
    checkAccountUidExists (account) {
      return account.checkUidExists()
        .then((exists) => {
          if (! exists) {
            this.removeAccount(account);
          }
          return exists;
        });
    },

    /**
     * Check whether an Account's `email` is registered. Removes the account
     * from storage if account no longer exists on the server.
     *
     * @param {Object} account - account to check
     * @returns {Promise} resolves to `true` if an account exists, `false` otw.
     */
    checkAccountEmailExists (account) {
      return account.checkEmailExists()
        .then((exists) => {
          if (! exists) {
            this.removeAccount(account);
          }
          return exists;
        });
    },

    /**
     * Reject the unblockCode for the given account. This invalidates
     * the unblock code and logs the signin attempt as suspicious.
     *
     * @param {Object} account
     * @param {String} unblockCode
     * @returns {Promise}
     */
    rejectAccountUnblockCode(account, unblockCode) {
      return account.rejectUnblockCode(unblockCode);
    }
  });

  Cocktail.mixin(
    User,
    ResumeTokenMixin,
    SearchParamMixin
  );

  module.exports = User;
});
