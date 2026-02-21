const { withInfoPlist } = require('expo/config-plugins');

/** Force CFBundleDisplayName to "Chrono Pro" for iOS home screen */
module.exports = function withDisplayName(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = 'Chrono Pro';
    return config;
  });
};
