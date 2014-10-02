/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';


define([
  'chai',
  'jquery',
  'sinon',
  'lib/promise',
  'views/sign_in',
  'lib/session',
  'lib/auth-errors',
  'lib/metrics',
  'lib/fxa-client',
  'models/reliers/relier',
  'models/auth_brokers/base',
  '../../mocks/window',
  '../../mocks/router',
  '../../lib/helpers'
],
function (chai, $, sinon, p, View, Session, AuthErrors, Metrics, FxaClient,
      Relier, Broker, WindowMock, RouterMock, TestHelpers) {
  var assert = chai.assert;
  var wrapAssertion = TestHelpers.wrapAssertion;

  describe('views/sign_in', function () {
    var view;
    var email;
    var routerMock;
    var metrics;
    var windowMock;
    var fxaClient;
    var relier;
<<<<<<< HEAD
    var broker;
=======
    var profileClientMock;
>>>>>>> fix(avatars): load profile image on settings and sign in pages if available

    beforeEach(function () {
      email = TestHelpers.createEmail();

      Session.clear();

      routerMock = new RouterMock();
      windowMock = new WindowMock();
      windowMock.location.pathname = 'signin';
      metrics = new Metrics();
      relier = new Relier();
      broker = new Broker();
      fxaClient = new FxaClient();
      profileClientMock = TestHelpers.stubbedProfileClient();

      view = new View({
        router: routerMock,
        metrics: metrics,
        window: windowMock,
        fxaClient: fxaClient,
<<<<<<< HEAD
        relier: relier,
        broker: broker
=======
        profileClient: profileClientMock,
        relier: relier
>>>>>>> fix(avatars): load profile image on settings and sign in pages if available
      });

      return view.render()
          .then(function () {
            $('#container').html(view.el);
          });
    });

    afterEach(function () {
      metrics.destroy();

      view.remove();
      view.destroy();

      view = metrics = null;
    });

    describe('render', function () {
      it('prefills email and password if stored in Session (user comes from signup with existing account)', function () {
        Session.set('prefillEmail', 'testuser@testuser.com');
        Session.set('prefillPassword', 'prefilled password');
        return view.render()
            .then(function () {
              assert.ok($('#fxa-signin-header').length);
              assert.equal(view.$('[type=email]').val(), 'testuser@testuser.com');
              assert.equal(view.$('[type=password]').val(), 'prefilled password');
            });
      });

      it('Shows serviceName from the relier', function () {
        relier.isSync = function () {
          return true;
        };
        var serviceName = 'another awesome service by Mozilla';
        relier.set('serviceName', serviceName);

        // initialize a new view to set the service name
        view = new View({
          router: routerMock,
          metrics: metrics,
          window: windowMock,
          profileClient: profileClientMock,
          relier: relier,
          broker: broker
        });
        return view.render()
            .then(function () {
              assert.include(view.$('#fxa-signin-header').text(), serviceName);
            });
      });
    });


    it('prefills email with email from search parameter if Session.prefillEmail is not set', function () {
      windowMock.location.search = '?email=' + encodeURIComponent('testuser@testuser.com');

      return view.render()
          .then(function () {
            assert.equal(view.$('[type=email]').val(), 'testuser@testuser.com');
          });
    });

    describe('updatePasswordVisibility', function () {
      it('pw field set to text when clicked', function () {
        $('.show-password').click();
        assert.equal($('.password').attr('type'), 'text');
      });

      it('pw field set to password when clicked again', function () {
        $('.show-password').click();
        $('.show-password').click();
        assert.equal($('.password').attr('type'), 'password');
      });
    });

    describe('isValid', function () {
      it('returns true if both email and password are valid', function () {
        view.$('[type=email]').val('testuser@testuser.com');
        view.$('[type=password]').val('password');
        assert.isTrue(view.isValid());
      });

      it('returns false if email is invalid', function () {
        view.$('[type=email]').val('testuser');
        view.$('[type=password]').val('password');
        assert.isFalse(view.isValid());
      });

      it('returns false if password is invalid', function () {
        view.$('[type=email]').val('testuser@testuser.com');
        view.$('[type=password]').val('passwor');
        assert.isFalse(view.isValid());
      });
    });

    describe('submit', function () {
      it('redirects unverified users to the confirm page on success', function () {
        sinon.stub(view.fxaClient, 'signIn', function () {
          return p({ verified: false });
        });

        sinon.stub(view.fxaClient, 'signUpResend', function () {
          return p();
        });

        var password = 'password';
        $('[type=email]').val(email);
        $('[type=password]').val(password);

        return view.submit()
          .then(function () {
            assert.equal(routerMock.page, 'confirm');
            assert.isTrue(view.fxaClient.signIn.calledWith(
                email, password, relier));
            assert.isTrue(view.fxaClient.signUpResend.calledWith(
                relier));
          });
      });

      it('notifies the broker when a verified user signs in', function () {
        sinon.stub(view.fxaClient, 'signIn', function () {
          return p({
            verified: true
          });
        });

        var password = 'password';
        $('[type=email]').val(email);
        $('[type=password]').val(password);
        sinon.stub(broker, 'afterSignIn', function () {
          return p();
        });

        return view.submit()
          .then(function () {
            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'signin.success'));
            assert.isTrue(broker.afterSignIn.calledWith());
          });
      });

      it('logs an error if user cancels login', function () {
        sinon.stub(broker, 'beforeSignIn', function () {
          return p.reject(AuthErrors.toError('USER_CANCELED_LOGIN'));
        });

        $('[type=email]').val(email);
        $('[type=password]').val('password');
        return view.submit()
          .then(function () {
            assert.isTrue(broker.beforeSignIn.calledWith(email));
            assert.isFalse(view.isErrorVisible());

            assert.isTrue(TestHelpers.isEventLogged(metrics,
                              'signin.canceled'));
          });
      });

      it('rejects promise with incorrect password message on incorrect password', function () {
        sinon.stub(view.fxaClient, 'signIn', function () {
          return p.reject(AuthErrors.toError('INCORRECT_PASSWORD'));
        });

        $('[type=email]').val(email);
        $('[type=password]').val('incorrect');
        return view.submit()
          .then(assert.fail, function (err) {
            assert.ok(err.message.indexOf('Incorrect') > -1);
          });
      });

      it('shows message allowing the user to sign up if user enters unknown account', function () {
        $('[type=email]').val(email);
        $('[type=password]').val('incorrect');

        return view.submit()
            .then(function (msg) {
              assert.ok(msg.indexOf('/signup') > -1);
            });
      });

      it('passes other errors along', function () {
        $('[type=email]').val(email);
        $('[type=password]').val('incorrect');

        view.fxaClient.signIn = function () {
          return p()
              .then(function () {
                throw AuthErrors.toError('INVALID_JSON');
              });
        };

        return view.submit()
                  .then(null, function (err) {
                    // The errorback will not be called if the submit
                    // succeeds, but the following callback always will
                    // be. To ensure the errorback was called, pass
                    // the error along and check its type.
                    return err;
                  })
                  .then(function (err) {
                    assert.isTrue(AuthErrors.is(err, 'INVALID_JSON'));
                  });
      });
    });

    describe('showValidationErrors', function () {
      it('shows an error if the email is invalid', function (done) {
        view.$('[type=email]').val('testuser');
        view.$('[type=password]').val('password');

        view.on('validation_error', function (which, msg) {
          wrapAssertion(function () {
            assert.ok(msg);
          }, done);
        });

        view.showValidationErrors();
      });

      it('shows an error if the password is invalid', function (done) {
        view.$('[type=email]').val('testuser@testuser.com');
        view.$('[type=password]').val('passwor');

        view.on('validation_error', function (which, msg) {
          wrapAssertion(function () {
            assert.ok(msg);
          }, done);
        });

        view.showValidationErrors();
      });
    });

    describe('resetPasswordIfKnownValidEmail', function () {
      it('goes to the reset_password screen if a blank email', function () {
        $('[type=email]').val('');
        return view.resetPasswordIfKnownValidEmail()
            .then(function () {
              assert.ok(routerMock.page, 'reset_password');
            });
      });

      it('goes to the reset_password screen if an invalid email', function () {
        $('[type=email]').val('partial');
        return view.resetPasswordIfKnownValidEmail()
            .then(function () {
              assert.ok(routerMock.page, 'reset_password');
            });
      });
    });

    describe('useLoggedInAccount', function () {
      it('shows an error if session is expired', function () {
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        return view.useLoggedInAccount()
          .then(function () {
            assert.isTrue(view._isErrorVisible);
            // do not show email input
            assert.notOk(view.$('#email').length);
            // show password input
            assert.ok(view.$('#password').length);
            assert.equal(view.$('.error').text(), 'Session expired. Sign in to continue.');
          });
      });

      it('signs in with a valid session', function () {
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        view.fxaClient.recoveryEmailStatus = function () {
          return p({verified: true});
        };

        return view.useLoggedInAccount()
          .then(function () {
            assert.notOk(view._isErrorVisible);
            assert.equal(view.$('.error').text(), '');
          });
      });
    });

    describe('useDifferentAccount', function () {
      it('can switch to signin with the useDifferentAccount button', function () {
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        return view.useLoggedInAccount()
          .then(function () {
            assert.ok($('.use-different').length, 'has use different button');
            return view.useDifferentAccount();
          })
          .then(function () {
            assert.ok($('.email').length, 'should show email input');
            assert.ok($('.password').length, 'should show password input');

            assert.equal($('.email').val(), '', 'should have an empty email input');
          });
      });
    });

    describe('_suggestedUser', function () {
      it('can suggest the user based on session variables', function () {
        assert.isNull(view._suggestedUser(), 'null when no session set');

        Session.set('cachedCredentials', {
          sessionToken: 'abc123'
        });
        assert.isNull(view._suggestedUser(), 'null when no email set');

        Session.clear();
        Session.set('cachedCredentials', {
          email: 'a@a.com'
        });
        assert.isNull(view._suggestedUser(), 'null when no session token set');

        Session.clear();
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        assert.equal(view._suggestedUser().email, 'a@a.com');
        assert.equal(view._suggestedUser().avatar, undefined);

        Session.clear();

        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          avatar: 'avatar.jpg',
          email: 'a@a.com'
        });
        assert.equal(view._suggestedUser().email, 'a@a.com');
        assert.equal(view._suggestedUser().avatar, 'avatar.jpg');

        Session.clear();
        Session.set('email', 'a@a.com');
        Session.set('sessionToken', 'abc123');

        assert.equal(view._suggestedUser().email, 'a@a.com');
      });

      it('does shows if there is the same email in query params', function (done) {
        windowMock.location.search = '?email=a@a.com';
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        return view.render()
          .then(function () {
            assert.ok($('.avatar-view').length, 'should show suggested avatar');
            assert.notOk($('.password').length, 'should not show password input');
            done();
          })
          .fail(done);
      });

      it('does not show if there is an email in query params that does not match', function (done) {
        windowMock.location.search = '?email=b@b.com';
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });

        return view.render()
          .then(function () {
            assert.equal($('.email')[0].type, 'email', 'should show email input');
            assert.ok($('.password').length, 'should show password input');
            done();
          })
          .fail(done);
      });
    });

    describe('_suggestedUserAskPassword', function () {
      it('asks for password right away if service is sync', function (done) {
        relier.isSync = function () {
          return true;
        };
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });
        relier.set('service', 'sync');

        return view.render()
          .then(function () {
            assert.equal($('.email')[0].type, 'hidden', 'should not show email input');
            assert.ok($('.password').length, 'should show password input');
            done();
          })
          .fail(done);
      });

      it('does not ask for password right away if service is not sync', function (done) {
        Session.set('cachedCredentials', {
          sessionToken: 'abc123',
          email: 'a@a.com'
        });
        relier.set('service', 'loop');

        return view.render()
          .then(function () {
            assert.ok($('.avatar-view').length, 'should show suggested avatar');
            assert.notOk($('.password').length, 'should show password input');
            done();
          })
          .fail(done);
      });
    });

  });
});
