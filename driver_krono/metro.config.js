// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure resolver to use mocks on web
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web') {
      if (moduleName === '@rnmapbox/maps') {
        return { filePath: path.resolve(__dirname, 'mocks/rnmapbox-maps.js'), type: 'sourceFile' };
      }
      if (moduleName === 'react-native-maps') {
        return { filePath: path.resolve(__dirname, 'mocks/react-native-maps.js'), type: 'sourceFile' };
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;

