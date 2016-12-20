/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// test the metrics library

define(function (require, exports, module) {
  'use strict';

  const $ = require('jquery');
  const { assert } = require('chai');
  const mailcheck = require('lib/mailcheck');
  const p = require('lib/promise');
  const sinon = require('sinon');
  const Translator = require('lib/translator');

  const BAD_EMAIL = 'something@gnail.com';
  const CORRECTED_EMAIL = 'something@gmail.com';
  const MAILCHECK_ID = 'mailcheck-test';
  const MAILCHECK_SELECTOR = '#' + MAILCHECK_ID;
  const RESULT_TEXT = 'Did you mean gmail.com?✕';
  const TOOLTIP_SELECTOR = '.tooltip-suggest';

  describe('lib/mailcheck', function () {
    let mockView;
    let translator;

    beforeEach(function () {
      translator = new Translator();
      translator._clearTranslationValues();

      mockView = {
        isInExperimentGroup () {
          return true;
        },
        notifier: {
          trigger: sinon.spy(function () {})
        },
        unsafeTranslate(msg, params) {
          return translator.get(msg, params);
        }
      };
      $('body').append('<div class="input-row test-input"><input type=text id="' + MAILCHECK_ID + '"/></div>');
    });

    afterEach(function () {
      $('.test-input').remove();
    });

    it('skips mailcheck if element cannot be found', function (done) {
      var MAILCHECK_SELECTOR = $('.bad-selector-that-does-not-exist');
      assert.doesNotThrow(function () {
        mailcheck(MAILCHECK_SELECTOR);
        done();
      });
    });

    it('works with attached elements and changes values', function () {
      $(MAILCHECK_SELECTOR).blur(function () {
        mailcheck(MAILCHECK_SELECTOR, mockView);
      });


      $(MAILCHECK_SELECTOR).val(BAD_EMAIL).blur();
      assert.isTrue(mockView.notifier.trigger.calledTwice, 'called trigger twice');

      return p()
        // wait for tooltip
        .delay(50)
        .then(() => {
          assert.equal($(TOOLTIP_SELECTOR).text(), RESULT_TEXT);
          $(TOOLTIP_SELECTOR).find('span').first().click();
          // email should be corrected
          assert.equal($(MAILCHECK_SELECTOR).val(), CORRECTED_EMAIL);
          assert.isTrue(mockView.notifier.trigger.calledThrice, 'called trigger thrice');
        });
    });

    it('works with attached elements and can be dismissed', function () {
      $(MAILCHECK_SELECTOR).blur(function () {
        mailcheck(MAILCHECK_SELECTOR, mockView);
      });

      $(MAILCHECK_SELECTOR).val(BAD_EMAIL).blur();
      assert.isTrue(mockView.notifier.trigger.calledTwice, 'called trigger twice');

      return p()
        // wait for tooltip
        .delay(50)
        .then(() => {
          assert.equal($(TOOLTIP_SELECTOR).text(), RESULT_TEXT);
          $(TOOLTIP_SELECTOR).find('span').eq(1).click();
          // email should NOT be corrected
          assert.equal($(MAILCHECK_SELECTOR).val(), BAD_EMAIL);
          assert.isFalse(mockView.notifier.trigger.calledThrice, 'called trigger thrice');
        });
    });

  });
});
