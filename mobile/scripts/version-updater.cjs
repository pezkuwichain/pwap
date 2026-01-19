/**
 * Custom version updater for app.json
 * Used by standard-version to update Expo app.json version fields
 */

const fs = require('fs');
const path = require('path');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');

module.exports.readVersion = function (contents) {
  const appJson = JSON.parse(contents);
  return appJson.expo.version;
};

module.exports.writeVersion = function (contents, version) {
  const appJson = JSON.parse(contents);

  // Update expo.version
  appJson.expo.version = version;

  // Auto-increment build numbers for iOS and Android
  const versionParts = version.split('.');
  const buildNumber = parseInt(versionParts[0]) * 10000 +
                      parseInt(versionParts[1]) * 100 +
                      parseInt(versionParts[2]);

  // Update iOS buildNumber
  if (appJson.expo.ios) {
    appJson.expo.ios.buildNumber = String(buildNumber);
  }

  // Update Android versionCode
  if (appJson.expo.android) {
    appJson.expo.android.versionCode = buildNumber;
  }

  return JSON.stringify(appJson, null, 2) + '\n';
};
