/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Client to send an SMS message.
 */

var bluebird = require('bluebird');
var twilio = require('twilio');
var logger = require('mozlog')('server.routes');

module.exports = function (config) {
  var client = twilio(config.accountSid, config.authToken);
  /*
  var client = {
    message: {
      create: function (opts, done) {
        logger.error('sending to', opts);
        done(new Error('Could not send SMS'));
      }
    }
  };
  */

  return function (to, message) {
    return new Promise(function (resolve, reject) {
      client.sendMessage({
        body: message,
        to: '+1' + to,
        from: config.sendingNumber
      }, function (err, data) {
        if (err) {
          logger.error('error sending sms', err);
          return reject(err);
        }

        resolve(data);
      });
    });
  };
};
