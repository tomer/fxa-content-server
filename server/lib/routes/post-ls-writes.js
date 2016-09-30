/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var url = require('url');

module.exports = function (options) {
  options = options || {};

  var write = options.write || function (entry) {
    process.stderr.write('localStorage write: ' + JSON.stringify(entry) + '\n');
  };

  return {
    method: 'post',
    path: '/ls-write',
    process: function (req, res) {
      res.json({result: 'ok'});

      write(req.body);
    }
  };
};
