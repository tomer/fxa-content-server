/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Populates the flow model and initialises flow event handlers.

define(function (require, exports, module) {
  'use strict';

  const $ = require('jquery');
  const Flow = require('models/flow');
  const KEYS = require('lib/key-codes');

  module.exports = {
    afterRender () {
      // If a user signs out then signs back in again, a flow model
      // will already exist. Don't create a new one in that case,
      // lest we emit events with a duplicate flow id.
      if (! this.flow) {
        this.flow = new Flow({
          sentryMetrics: this.sentryMetrics,
          window: this.window
        });
        this.metrics.setFlowModel(this.flow);
      }
    },

    events: {
      'click a': '_clickFlowEventsLink',
      'click input': '_engageFlowEventsForm',
      'input input': '_engageFlowEventsForm',
      'keyup input': '_keyupFlowEventsInput',
      'submit': '_submitFlowEventsForm'
    },

    _clickFlowEventsLink (event) {
      if (event && event.target) {
        const flowEvent = $(event.target).data('flowEvent');
        if (flowEvent) {
          this.logFlowEvent(flowEvent, this.viewName);
        }
      }
    },

    _engageFlowEventsForm () {
      this.logFlowEventOnce('engage', this.viewName);
    },

    _keyupFlowEventsInput (event) {
      if (event.which === KEYS.TAB && ! event.metaKey && ! event.ctrlKey && ! event.altKey) {
        this._engageFlowEventsForm();
      }
    },

    _submitFlowEventsForm () {
      if (this.isFormEnabled()) {
        this.logFlowEvent('submit', this.viewName);
      }
    }
  };
});
