const { withInfoPlist } = require('expo/config-plugins');

/**
 * Injecte MBXAccessToken dans Info.plist pour le SDK Mapbox (Directions, Navigation).
 * Sans ce token, Credentials.init() crash au lancement de MapboxNavigationView.
 */
function withMapboxToken(config) {
  return withInfoPlist(config, (config) => {
    const token =
      process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
      '';
    config.modResults.MBXAccessToken = token;
    // Navigation vocale + localisation en arrière-plan
    const modes = config.modResults.UIBackgroundModes || [];
    if (!modes.includes('audio')) modes.push('audio');
    if (!modes.includes('location')) modes.push('location');
    config.modResults.UIBackgroundModes = modes;
    return config;
  });
}

module.exports = withMapboxToken;
