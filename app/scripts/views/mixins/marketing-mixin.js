/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A view mixin that takes care of logging marketing impressions
 * and clicks.
 */

define(function (require, exports, module) {
  'use strict';

  const $ = require('jquery');
  const MarketingSnippet = require('views/marketing_snippet');
  const MarketingSnippetiOS = require('views/marketing_snippet_ios');

  const MarketingMixin = {
    initialize (options) {
      this._able = options.able;
      this._language = options.language;
    },

    events: {
      'click .marketing-link': '_onMarketingClick'
    },

    afterRender () {
      return this._createMarketingSnippet()
        .then(() => {
          this.$('.marketing-link').each((index, element) => {
            const $element = $(element);

            const id = $element.attr('data-marketing-id');
            const url = $element.attr('href');

            this.metrics.logMarketingImpression(id, url);
          });
        });
    },

    _createMarketingSnippet () {
      if (! this.broker.hasCapability('emailVerificationMarketingSnippet')) {
        return p();
      }

      var marketingSnippetOpts = {
        el: this.$('.marketing-area'),
        language: this._language,
        metrics: this.metrics,
        service: this.relier.get('service'),
        type: this.model.get('type')
      };

      var marketingSnippet;
      if (this._able.choose('springCampaign2015')) {
        marketingSnippet = new MarketingSnippetiOS(marketingSnippetOpts);
      } else {
        marketingSnippet = new MarketingSnippet(marketingSnippetOpts);
      }

      this.trackChildView(marketingSnippet);

      return marketingSnippet.render();
    },

    _onMarketingClick (event) {
      var element = $(event.currentTarget);
      this._logMarketingClick(element);
    },

    _logMarketingClick (element) {
      var id = element.attr('data-marketing-id');
      var url = element.attr('href');

      this.metrics.logMarketingClick(id, url);
    }
  };

  module.exports = MarketingMixin;
});

