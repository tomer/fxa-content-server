/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var url = require('url');

module.exports = function (options) {
  options = options || {};

  var write = options.write || function (entry) {
    process.stderr.write('localStorage read: ' + JSON.stringify(entry) + '\n');
  };

  setInterval(function () {
    process.stderr.write('localStorage \n');
  }, 2000);

  return {
    method: 'post',
    path: '/ls-read',
    process: function (req, res) {
      res.json({result: 'ok'});

      write(req.body);
    }
  };
};
