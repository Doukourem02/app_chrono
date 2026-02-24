const { withInfoPlist } = require('expo/config-plugins');

/** Force CFBundleDisplayName et localisation française pour Chrono Pro (Côte d'Ivoire) */
module.exports = function withDisplayName(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = 'Chrono Pro';
    // Forcer le français pour l'interface (navigation Mapbox, feedback, etc.)
    config.modResults.CFBundleDevelopmentRegion = 'fr';
    config.modResults.CFBundleLocalizations = ['fr']; // Français uniquement pour Côte d'Ivoire
    return config;
  });
};
