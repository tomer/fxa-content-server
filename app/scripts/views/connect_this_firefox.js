/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * If the user verifies their email in an instance of Firefox
 * that other than the one they used to sign up, suggest
 * that they sign in.
 */
define(function (require, exports, module) {
  'use strict';

  const FormView = require('views/form');
  const Template = require('stache!templates/connect_this_firefox');
  const Url = require('lib/url');

  const proto = FormView.prototype;

  const View = FormView.extend({
    template: Template,

    context () {
      return {
        email: this._getEmail(),
        escapedSignInUrl: this._getEscapedSignInUrl(),
        escapedSupportUrl: encodeURI(this._getSupportUrl())
      };
    },

    _getSupportUrl () {
      return 'https://support.mozilla.org';
    },

    _getEscapedSignInUrl () {
      const params = {
        // TODO - hard coding values is a hack for testing, should work
        // for both Fennec and Desktop
        context: 'fx_desktop_v3',
        service: 'sync'
      };

      const email = this._getEmail();
      if (email) {
        params.email = email;
      }

      // Url.objToSearchString escapes each of the query parameters.
      return this.window.document.location.origin + '/signin' + Url.objToSearchString(params);
    },

    _getEmail () {
      return this.model.get('email');
    }
  });

  module.exports = View;
});
