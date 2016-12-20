/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var UA_OVERRIDE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:40.0) Gecko/20100101 Firefox/40.0 FxATester/1.0';

var FirefoxProfile = require('firefox-profile');
var myProfile = new FirefoxProfile();
var profile = null;

if (process.argv.length > 1) {
  try {
    profile = JSON.parse(process.argv[2]);
  } catch (e) {
    throw new Error('Failed to parse args');
  }
}

if (profile) {
  // remove blocking of HTTP request on HTTPS domains
  myProfile.setPreference('security.mixed_content.block_active_content', false);

  // Configuration for local sync development
  myProfile.setPreference('services.sync.log.appender.file.logOnSuccess', true);
  myProfile.setPreference('identity.fxaccounts.auth.uri', profile.fxaAuthRoot);
  myProfile.setPreference('identity.fxaccounts.remote.force_auth.uri', profile.fxaContentRoot + 'force_auth?service=sync&context=fx_desktop_v1');
  myProfile.setPreference('identity.fxaccounts.remote.signin.uri', profile.fxaContentRoot + 'signin?service=sync&context=fx_desktop_v1');
  myProfile.setPreference('identity.fxaccounts.remote.signup.uri', profile.fxaContentRoot + 'signup?service=sync&context=fx_desktop_v1');
  myProfile.setPreference('identity.fxaccounts.settings.uri', profile.fxaContentRoot + 'settings');
  myProfile.setPreference('services.sync.tokenServerURI', profile.fxaToken);
  myProfile.setPreference('app.update.enabled', false);
  myProfile.setPreference('app.update.auto', false);
  myProfile.setPreference('app.update.silent', false);

  // Disable getUserMedia permission check for avatar uploads.
  myProfile.setPreference('media.navigator.permission.disabled', true);
  // Better tab navigation for Sync preferences
  // see https://bugzilla.mozilla.org/show_bug.cgi?id=1055370
  myProfile.setPreference('accessibility.browsewithcaret', true);

  // add a string to the Firefox UA to signal that this is a test runner
  myProfile.setPreference('general.useragent.override', UA_OVERRIDE);

  // disable WebDriver extension compat check
  myProfile.setPreference('extensions.checkCompatibility.47.0', false);
  myProfile.setPreference('extensions.checkCompatibility.48.0', false);

  // disable e10s
  myProfile.setPreference('browser.tabs.remote.autostart', false);
  myProfile.setPreference('browser.tabs.remote.autostart.1', false);
  myProfile.setPreference('browser.tabs.remote.autostart.2', false);
  myProfile.setPreference('browser.tabs.remote.force-enable', false);

  // disable signed extensions
  myProfile.setPreference('xpinstall.signatures.required', false);
  myProfile.setPreference('xpinstall.whitelist.required', false);
  myProfile.setPreference('services.sync.prefs.sync.xpinstall.whitelist.required', false);
  myProfile.setPreference('extensions.checkCompatibility.nightly', false);

  // disable firefox a/b test experiments
  myProfile.setPreference('experiments.activeExperiment', false);
  myProfile.setPreference('experiments.enabled', false);
  myProfile.setPreference('experiments.supported', false);
  myProfile.setPreference('experiments.manifest.uri', '');
  myProfile.setPreference('network.allow-experiments', false);


  myProfile.updatePreferences();

  myProfile.encoded(function (encodedProfile) {
    // output the generated encoded profile as stdout
    // NOTE: if an error occurs with the encodedProfile then the default Firefox settings will be used in your tests
    process.stdout.write(encodedProfile);
  });
} else {
  process.stdout.write('');
}
