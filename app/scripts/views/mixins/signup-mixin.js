/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Shared implementation of `signUp` view method

define(function (require, exports, module) {
  'use strict';

  module.exports = {

    /*anchor tag present in both signin and signup views*/
    events: {
      'click #suggest-sync a': 'onSuggestSyncClick'
    },

    isSyncSuggestionEnabled () {
      if (! this.relier.get('service')) {
        this.logViewEvent('sync-suggest.visible');
        return true;
      }
      return false;
    },

    /**
     * Sign up a user
     *
     * @param {Object} account
     * @param {String} password
     * @return {Object} promise
     */
    signUp (account, password) {
      return this.invokeBrokerMethod('beforeSignIn', account)
        .then(() => {
          // Always pass `signup` for viewName regardless of the actual view
          // because we want to log the real action that is being performed.
          // This is important for the infamous signin-from-signup feature.
          this.logFlowEvent('attempt', 'signup');

          return this.user.signUpAccount(account, password, this.relier, {
            resume: this.getStringifiedResumeToken(account)
          });
        })
        .then((account) => {
          if (this._formPrefill) {
            this._formPrefill.clear();
          }

          var onSubmitComplete = this.onSignUpSuccess.bind(this);

          if (this.relier.accountNeedsPermissions(account)) {
            return this.navigate('signup_permissions', {
              account: account,
              // the permissions screen will call onSubmitComplete
              // with an updated account
              onSubmitComplete: onSubmitComplete
            });
          } else if (this.broker.hasCapability('chooseWhatToSyncWebV1')) {
            return this.navigate('choose_what_to_sync', {
              account: account,
              // choose_what_to_sync screen will call onSubmitComplete
              // with an updated account
              onSubmitComplete: onSubmitComplete
            });
          }

          return this.onSignUpSuccess(account);
        });
    },

    onSignUpSuccess (account) {
      this.logViewEvent('success');
      this.logViewEvent('signup.success');
      this.flow.clear();

      if (account.get('verified')) {
        // user was pre-verified.
        this.logViewEvent('preverified.success');
        return this.invokeBrokerMethod('afterSignIn', account)
          .then(() => {
            this.navigate('signup_confirmed');
          });
      }

      return this.invokeBrokerMethod('afterSignUp', account)
        .then(() => {
          this.navigate('confirm', {
            account: account,
            flow: this.flow
          });
        });
    },

    onSuggestSyncClick () {
      this.logViewEvent('sync-suggest.clicked');
    }
  };
});
