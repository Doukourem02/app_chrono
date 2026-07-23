const { withInfoPlist } = require('expo/config-plugins');

/** Force CFBundleDisplayName et localisation française pour Krono pro (Côte d'Ivoire) */
module.exports = function withDisplayName(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.CFBundleDisplayName = 'Krono pro';
    // Forcer le français pour l'interface (navigation Mapbox, feedback, etc.)
    config.modResults.CFBundleDevelopmentRegion = 'fr';
    config.modResults.CFBundleLocalizations = ['fr']; // Français uniquement pour Côte d'Ivoire
    return config;
  });
};
