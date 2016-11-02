/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// View mixin to get a ResumeToken model in a consistent fashion.

define(function (require, exports, module) {
  'use strict';

  const _ = require('underscore');
  const ResumeToken = require('models/resume-token');

  module.exports = {
    /**
     * Get a ResumeToken model.
     *
     * @method getResumeToken
     * @param {Object} [account]
     * @returns {ResumeToken}
     */
    getResumeToken (account) {
      // there might not be any relier if the resume token is being fetched
      // for an account unlock request caused by changing the password.
      var accountInfo = account && account.pickResumeTokenInfo();
      var flowInfo = this.flow && this.flow.pickResumeTokenInfo();
      var relierInfo = this.relier && this.relier.pickResumeTokenInfo();
      var userInfo = this.user && this.user.pickResumeTokenInfo();

      var resumeTokenInfo = _.extend(
        {},
        flowInfo,
        relierInfo,
        userInfo,
        accountInfo
      );

      return new ResumeToken(resumeTokenInfo);
    },

    /**
     * Get a stringified ResumeToken that can be passed along in an email
     *
     * @method getStringifiedResumeToken
     * @param {Object} [account]
     * @returns {String}
     */
    getStringifiedResumeToken (account) {
      return this.getResumeToken(account).stringify();
    }
  };
});
