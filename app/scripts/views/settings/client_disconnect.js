/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const Cocktail = require('cocktail');
  const FloatingPlaceholderMixin = require('views/mixins/floating-placeholder-mixin');
  const FormView = require('views/form');
  const ModalSettingsPanelMixin = require('views/mixins/modal-settings-panel-mixin');
  const SignedOutNotificationMixin = require('views/mixins/signed-out-notification-mixin');
  const t = require('views/base').t;
  const Template = require('stache!templates/settings/client_disconnect');

  const REASON_SELECTOR = '.disconnect-reasons';
  const REASON_HELP = {
    'lost': t('We\'re sorry to hear about this. You should change your Firefox Account password, and look for ' +
      'information from your device manufacturer about erasing your data remotely.'),
    'suspicious': t('We\'re sorry to hear about this. If this was a device you really don\'t trust, you should ' +
      'change your Firefox Account password, and change any passwords saved in Firefox.')
  };

  var View = FormView.extend({
    template: Template,
    className: 'clients-disconnect',
    viewName: 'settings.clients.disconnect',

    events: {
      'click': '_returnToClientListAfterDisconnect',
      'click .cancel-disconnect': FormView.preventDefaultThen('_returnToClientList'),
    },

    initialize () {
      // user is presented with an option to disconnect device
      this.hasDisconnected = false;
      this.on('modal-cancel', () => this._returnToClientList());
    },

    beforeRender () {
      // receive the device collection and the item to delete
      // if deleted the collection will be automatically updated in the settings panel.
      let clients = this.model.get('clients');
      let clientId = this.model.get('clientId');
      if (! clients || ! clientId) {
        return this._returnToClientList();
      }

      this.client = clients.get(clientId);
    },

    context () {
      var context = {
        hasDisconnected: this.hasDisconnected,
        reasonHelp: this.reasonHelp
      };

      if (! this.hasDisconnected) {
        context.deviceName = this.client.get('name');
      }

      return context;
    },

    /**
     * Called on option select.
     * If first option is selected then form is disabled using the logic in FormView.
     *
     * @returns {Boolean}
     */
    isValidStart () {
      return this.$(':selected').index() > 0;
    },

    submit () {
      const client = this.client;
      let selectedValue = this.$el.find(REASON_SELECTOR).find(':selected').val();
      this.logViewEvent('submit.' + selectedValue);

      return this.user.destroyAccountClient(this.user.getSignedInAccount(), client)
        .then(() => {
          // user has disconnect the device
          this.hasDisconnected = true;
          this.reasonHelp = REASON_HELP[selectedValue];
          if (client.get('isCurrentDevice')) {
            // if disconnected the current device, the user is automatically signed out
            this.navigateToSignIn();
          } else if (this.reasonHelp) {
            // if we can provide help for this disconnect reason
            this.render();
          } else {
            // close the modal if no reason help
            this._returnToClientListAfterDisconnect();
          }
        });
    },

    /**
     * Navigates to the client list if device was disconnected.
     */
    _returnToClientListAfterDisconnect () {
      if (this.hasDisconnected) {
        this._returnToClientList();
      }
    },

    _returnToClientList () {
      this.navigate('settings/clients');
    }
  });

  Cocktail.mixin(
    View,
    ModalSettingsPanelMixin,
    FloatingPlaceholderMixin,
    SignedOutNotificationMixin
  );

  module.exports = View;
});
