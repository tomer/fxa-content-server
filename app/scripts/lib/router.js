/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const AvatarCameraView = require('../views/settings/avatar_camera');
  const AvatarChangeView = require('../views/settings/avatar_change');
  const AvatarCropView = require('../views/settings/avatar_crop');
  const AvatarGravatarView = require('../views/settings/avatar_gravatar');
  const Backbone = require('backbone');
  const CannotCreateAccountView = require('../views/cannot_create_account');
  const ChangePasswordView = require('../views/settings/change_password');
  const ChooseWhatToSyncView = require('../views/choose_what_to_sync');
  const ClearStorageView = require('../views/clear_storage');
  const ClientDisconnectView = require('../views/settings/client_disconnect');
  const ClientsView = require('../views/settings/clients');
  const CommunicationPreferencesView = require('../views/settings/communication_preferences');
  const CompleteResetPasswordView = require('../views/complete_reset_password');
  const CompleteSignUpView = require('../views/complete_sign_up');
  const ConfirmResetPasswordView = require('../views/confirm_reset_password');
  const ConfirmView = require('../views/confirm');
  const CookiesDisabledView = require('../views/cookies_disabled');
  const DeleteAccountView = require('../views/settings/delete_account');
  const DisplayNameView = require('../views/settings/display_name');
  const EntryView = require('../views/entry');
  const ForceAuthView = require('../views/force_auth');
  const GravatarPermissionsView = require('../views/settings/gravatar_permissions');
  const LegalView = require('../views/legal');
  const PermissionsView = require('../views/permissions');
  const PpView = require('../views/pp');
  const ReadyView = require('../views/ready');
  const ReportSignInView = require('views/report_sign_in');
  const ResetPasswordView = require('../views/reset_password');
  const SettingsView = require('../views/settings');
  const SignInReportedView = require('views/sign_in_reported');
  const SignInUnblockView = require('../views/sign_in_unblock');
  const SignInView = require('../views/sign_in');
  const SignUpView = require('../views/sign_up');
  const Storage = require('./storage');
  const TosView = require('../views/tos');
  const VerificationReasons = require('lib/verification-reasons');

  function createViewHandler(View, options) {
    return function () {
      return this.showView(View, options);
    };
  }

  function createChildViewHandler(ChildView, ParentView, options) {
    return function () {
      return this.showChildView(ChildView, ParentView, options);
    };
  }

  function createViewModel(data) {
    return new Backbone.Model(data || {});
  }

  const Router = Backbone.Router.extend({
    routes: {
      '(/)': createViewHandler(EntryView),
      'cannot_create_account(/)': createViewHandler(CannotCreateAccountView),
      'choose_what_to_sync(/)': createViewHandler(ChooseWhatToSyncView),
      'clear(/)': createViewHandler(ClearStorageView),
      'complete_reset_password(/)': createViewHandler(CompleteResetPasswordView),
      'complete_signin(/)': createViewHandler(CompleteSignUpView, { type: VerificationReasons.SIGN_IN }),
      'confirm(/)': createViewHandler(ConfirmView, { type: VerificationReasons.SIGN_UP }),
      'confirm_reset_password(/)': createViewHandler(ConfirmResetPasswordView),
      'confirm_signin(/)': createViewHandler(ConfirmView, { type: VerificationReasons.SIGN_IN }),
      'cookies_disabled(/)': createViewHandler(CookiesDisabledView),
      'force_auth(/)': createViewHandler(ForceAuthView),
      'legal(/)': createViewHandler(LegalView),
      'legal/privacy(/)': createViewHandler(PpView),
      'legal/terms(/)': createViewHandler(TosView),
      'oauth(/)': createViewHandler(EntryView),
      'oauth/force_auth(/)': createViewHandler(ForceAuthView),
      'oauth/signin(/)': createViewHandler(SignInView),
      'oauth/signup(/)': createViewHandler(SignUpView),
      'report_signin(/)': createViewHandler(ReportSignInView),
      'reset_password(/)': createViewHandler(ResetPasswordView),
      'reset_password_complete(/)': createViewHandler(ReadyView, { type: VerificationReasons.PASSWORD_RESET }),
      'settings(/)': createViewHandler(SettingsView),
      'settings/avatar/camera(/)': createChildViewHandler(AvatarCameraView, SettingsView),
      'settings/avatar/change(/)': createChildViewHandler(AvatarChangeView, SettingsView),
      'settings/avatar/crop(/)': createChildViewHandler(AvatarCropView, SettingsView),
      'settings/avatar/gravatar(/)': createChildViewHandler(AvatarGravatarView, SettingsView),
      'settings/avatar/gravatar_permissions(/)': createChildViewHandler(GravatarPermissionsView, SettingsView),
      'settings/change_password(/)': createChildViewHandler(ChangePasswordView, SettingsView),
      'settings/clients(/)': createChildViewHandler(ClientsView, SettingsView),
      'settings/clients/disconnect(/)': createChildViewHandler(ClientDisconnectView, SettingsView),
      'settings/communication_preferences(/)': createChildViewHandler(CommunicationPreferencesView, SettingsView),
      'settings/delete_account(/)': createChildViewHandler(DeleteAccountView, SettingsView),
      'settings/display_name(/)': createChildViewHandler(DisplayNameView, SettingsView),
      'signin(/)': createViewHandler(SignInView),
      'signin_complete(/)': createViewHandler(ReadyView, { type: VerificationReasons.SIGN_IN }),
      'signin_permissions(/)': createViewHandler(PermissionsView, { type: VerificationReasons.SIGN_IN }),
      'signin_reported(/)': createViewHandler(SignInReportedView),
      'signin_unblock(/)': createViewHandler(SignInUnblockView),
      'signup(/)': createViewHandler(SignUpView),
      'signup_complete(/)': createViewHandler(ReadyView, { type: VerificationReasons.SIGN_UP }),
      'signup_permissions(/)': createViewHandler(PermissionsView, { type: VerificationReasons.SIGN_UP }),
      'verify_email(/)': createViewHandler(CompleteSignUpView, { type: VerificationReasons.SIGN_UP })
    },

    initialize (options) {
      options = options || {};

      this.broker = options.broker;
      this.metrics = options.metrics;
      this.notifier = options.notifier;
      this.user = options.user;
      this.window = options.window || window;

      this.notifier.once('view-shown', this._afterFirstViewHasRendered.bind(this));
      this.notifier.on('navigate', this.onNavigate.bind(this));
      this.notifier.on('navigate-back', this.onNavigateBack.bind(this));

      this.storage = Storage.factory('sessionStorage', this.window);
    },

    onNavigate (event) {
      this._nextViewModel = createViewModel(event.nextViewData);
      this.navigate(event.url, event.routerOptions);
    },

    onNavigateBack (event) {
      this._nextViewModel = createViewModel(event.nextViewData);
      this.navigateBack();
    },

    navigate (url, options) {
      options = options || {};

      if (! options.hasOwnProperty('trigger')) {
        options.trigger = true;
      }

      // If the caller has not asked us to clear the query params
      // and the new URL does not contain query params, propagate
      // the current query params to the next view.
      if (! options.clearQueryParams && ! /\?/.test(url)) {
        url = url + this.window.location.search;
      }

      return Backbone.Router.prototype.navigate.call(this, url, options);
    },

    navigateBack () {
      this.window.history.back();
    },

    /**
     * Get the options to pass to a View constructor.
     *
     * @param {Object} options - additional options
     * @returns {Object}
     */
    getViewOptions (options) {
      // passed in options block can override
      // default options.
      return _.extend({
        canGoBack: this.canGoBack(),
        currentPage: this.getCurrentPage(),
        model: this._nextViewModel,
        viewName: this.getCurrentViewName()
      }, options);
    },

    canGoBack () {
      return !! this.storage.get('canGoBack');
    },

    /**
     * Get the pathname of the current page.
     *
     * @returns {String}
     */
    getCurrentPage () {
      const fragment = Backbone.history.fragment || '';
                // strip leading /
      return fragment.replace(/^\//, '')
                // strip trailing /
                .replace(/\/$/, '')
                // we only want the pathname
                .replace(/\?.*/, '');
    },

    getCurrentViewName () {
      return this.fragmentToViewName(this.getCurrentPage());
    },

    _afterFirstViewHasRendered () {
      // afterLoaded lets the relier know when the first screen has been
      // loaded. It does not expect a response, so no error handler
      // is attached and the promise is not returned.
      this.broker.afterLoaded();

      // `loaded` is used to determine how long until the
      // first screen is rendered and the user can interact
      // with FxA. Similar to window.onload, but FxA specific.
      this.metrics.logEvent('loaded');

      // back is enabled after the first view is rendered or
      // if the user re-starts the app.
      this.storage.set('canGoBack', true);
    },

    fragmentToViewName (fragment) {
      fragment = fragment || '';
      // strip leading /
      return fragment.replace(/^\//, '')
                // strip trailing /
                .replace(/\/$/, '')
                // any other slashes get converted to '.'
                .replace(/\//g, '.')
                // search params can contain sensitive info
                .replace(/\?.*/, '')
                // replace _ with -
                .replace(/_/g, '-');
    },

    /**
     * Notify the system a new View should be shown.
     *
     * @param {Function} View - view constructor
     * @param {Object} [options]
     */
    showView (View, options) {
      this.notifier.trigger(
          'show-view', View, this.getViewOptions(options));
    },

    /**
     * Notify the system a new ChildView should be shown.
     *
     * @param {Function} ChildView - view constructor
     * @param {Function} ParentView - view constructor,
     *     the parent of the ChildView
     * @param {Object} [options]
     */
    showChildView (ChildView, ParentView, options) {
      this.notifier.trigger(
          'show-child-view', ChildView, ParentView, this.getViewOptions(options));
    },

    /**
     * Create a route handler that is used to display a View
     *
     * @param {Function} View - constructor of view to show
     * @param {Object} [options] - options to pass to View constructor
     * @returns {Function} - a function that can be given to the router.
     */
    createViewHandler: createViewHandler,

    /**
     * Create a route handler that is used to display a ChildView inside of
     * a ParentView. Views will be created as needed.
     *
     * @param {Function} ChildView - constructor of ChildView to show
     * @param {Function} ParentView - constructor of ParentView to show
     * @param {Object} [options] - options to pass to ChildView &
     *     ParentView constructors
     * @returns {Function} - a function that can be given to the router.
     */
    createChildViewHandler: createChildViewHandler
  });

  module.exports = Router;
});
