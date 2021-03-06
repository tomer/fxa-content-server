/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define(function (require, exports, module) {
  'use strict';

  const { assert } = require('chai');
  const AuthErrors = require('lib/auth-errors');
  const FormPrefill = require('models/form-prefill');
  const FxaClient = require('lib/fxa-client');
  const Metrics = require('lib/metrics');
  const Notifier = require('lib/channels/notifier');
  const OAuthBroker = require('models/auth_brokers/oauth');
  const OAuthRelier = require('models/reliers/oauth');
  const p = require('lib/promise');
  const Session = require('lib/session');
  const sinon = require('sinon');
  const TestHelpers = require('../../lib/helpers');
  const User = require('models/user');
  const View = require('views/sign_in');
  const WindowMock = require('../../mocks/window');

  describe('views/sign_in for /oauth/signin', function () {
    let broker;
    let email;
    let formPrefill;
    let fxaClient;
    let metrics;
    let notifier;
    let profileClientMock;
    let relier;
    let user;
    let view;
    let windowMock;

    const CLIENT_ID = 'dcdb5ae7add825d2';
    const CLIENT_NAME = '123Done';
    const SCOPE = 'profile:email';
    const STATE = '123';

    beforeEach(function () {
      email = TestHelpers.createEmail();
      windowMock = new WindowMock();
      windowMock.location.search = '?client_id=' + CLIENT_ID + '&state=' + STATE + '&scope=' + SCOPE;

      relier = new OAuthRelier();
      relier.set('serviceName', CLIENT_NAME);
      broker = new OAuthBroker({
        relier: relier,
        session: Session,
        window: windowMock
      });
      fxaClient = new FxaClient();
      user = new User({
        fxaClient: fxaClient,
        notifier: notifier
      });
      metrics = new Metrics();
      profileClientMock = TestHelpers.stubbedProfileClient();
      formPrefill = new FormPrefill();
      notifier = new Notifier();

      initView();
    });

    afterEach(function () {
      Session.clear();
      view.destroy();
    });

    function initView () {
      view = new View({
        broker: broker,
        formPrefill: formPrefill,
        fxaClient: fxaClient,
        metrics: metrics,
        notifier: notifier,
        profileClient: profileClientMock,
        relier: relier,
        user: user,
        viewName: 'oauth.signin',
        window: windowMock
      });
    }

    describe('render', function () {
      it('displays oAuth client name, does not display AMO help text by default', function () {
        sinon.stub(view, 'isAmoMigration', () => false);

        return view.render()
          .then(function () {
            assert.include(view.$('#fxa-signin-header').text(), CLIENT_NAME);
            // also make sure link is correct
            assert.equal(view.$('.sign-up').attr('href'), '/oauth/signup');
            assert.lengthOf(view.$('#amo-migration'), 0);
          });
      });

      it('button is enabled if prefills are valid', function () {
        formPrefill.set('email', 'testuser@testuser.com');
        formPrefill.set('password', 'prefilled password');

        initView();
        return view.render()
          .then(function () {
            assert.isFalse(view.$('button').hasClass('disabled'));
          });
      });

      describe('AMO migration', () => {
        it('displays AMO help text', () => {
          sinon.stub(view, 'isAmoMigration', () => true);
          return view.render()
            .then(() => {
              assert.lengthOf(view.$('#amo-migration'), 1);
            });
        });
      });
    });

    describe('submit', function () {
      beforeEach(() => view.render());

      it('notifies the broker when a verified user signs in', function () {
        sinon.spy(user, 'initAccount');
        sinon.stub(user, 'signInAccount', function (account) {
          account.set('verified', true);
          return p(account);
        });
        sinon.stub(relier, 'accountNeedsPermissions', function () {
          return false;
        });
        sinon.stub(broker, 'afterSignIn', function () {
          return p();
        });
        sinon.spy(view, 'navigate');

        const password = 'password';
        view.$('.email').val(email);
        view.$('[type=password]').val(password);

        return view.submit()
          .then(function () {
            const account = user.initAccount.returnValues[0];

            assert.isTrue(user.signInAccount.calledWith(account));
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'oauth.signin.success'));
            assert.isTrue(broker.afterSignIn.calledWith(account));
            assert.isTrue(view.navigate.calledWith('settings'));
          });
      });

      describe('with an unknown account', function () {
        beforeEach(() => {
          broker.setCapability('signup', true);
          sinon.stub(view, 'signIn', () => p.reject(AuthErrors.toError('UNKNOWN_ACCOUNT')));
          sinon.spy(view, 'unsafeDisplayError');
        });

        describe('AMO migration', () => {
          let $amoMigrationElement;
          beforeEach(() => {
            $amoMigrationElement = {
              hide: sinon.spy()
            };
            sinon.stub(view, 'isAmoMigration', () => true);
            const orig$ = view.$;
            sinon.stub(view, '$', (selector) => {
              if (selector === '#amo-migration') {
                return $amoMigrationElement;
              } else {
                return orig$.call(view, selector);
              }
            });
            return view.submit();
          });

          it('shows addons help text with link to the signup page, hides AMO migration text', () => {
            var err = view.unsafeDisplayError.args[0][0];
            assert.isTrue(AuthErrors.is(err, 'UNKNOWN_ACCOUNT'));
            assert.include(err.forceMessage, '/signup');
            assert.include(err.forceMessage, 'Add-ons');
            assert.isTrue($amoMigrationElement.hide.calledOnce);
          });
        });

        describe('not AMO migration', () => {
          beforeEach(() => {
            sinon.stub(view, 'isAmoMigration', () => false);
            return view.submit();
          });

          it('shows a link to the signup page', () => {
            var err = view.unsafeDisplayError.args[0][0];
            assert.isTrue(AuthErrors.is(err, 'UNKNOWN_ACCOUNT'));
            assert.include(err.forceMessage, '/signup');
            assert.notInclude(err.forceMessage, 'Add-ons');
          });
        });
      });
    });
  });
});
