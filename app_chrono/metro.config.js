// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure resolver to use mock for react-native-maps on web
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Use mock for react-native-maps on web platform
    if (platform === 'web' && moduleName === 'react-native-maps') {
      return {
        filePath: path.resolve(__dirname, 'mocks/react-native-maps.js'),
        type: 'sourceFile',
      };
    }
    // Use default resolution for other modules
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

