/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const FormView = require('views/form');
  const Template = require('stache!templates/entry');

  const View = FormView.extend({
    template: Template,

    initialize (options = {}) {
      this._formPrefill = options.formPrefill;
    },

    beforeRender () {
      const email = this.relier.get('email');
      if (email) {
        return this.checkEmail(email);
      } else if (this.user.getSignedInAccount().get('sessionToken')) {
        this.navigate('settings');
        return false;
      }
    },

    beforeDestroy () {
      this._formPrefill.set('email', this.getElementValue('.email'));
    },

    context () {
      return {
        serviceName: this.relier.get('serviceName'),
        showSyncSuggestion: this.relier.isDirectAccess()
      };
    },

    submit () {
      return this.checkEmail(this.getElementValue('.email'));
    },

    checkEmail (email) {
      const account = this.user.initAccount({ email });

      return this.user.checkAccountEmailExists(account)
        .then((emailExists) => {
          const target = emailExists ? 'signin' : 'signup';
          return this.navigate(this.broker.transformLink(target));
        });
    }
  });

  module.exports = View;
});
