const { withInfoPlist } = require("expo/config-plugins");

/**
 * Ajoute UIBackgroundModes sans écraser ceux injectés par Mapbox / Notifications.
 * Nécessaire pour la localisation en arrière-plan (suivi commande) + remote-notification.
 */
function withMergeBackgroundModes(config) {
  return withInfoPlist(config, (config) => {
    const existing = Array.isArray(config.modResults.UIBackgroundModes)
      ? config.modResults.UIBackgroundModes
      : [];
    const extra = ["location", "remote-notification"];
    config.modResults.UIBackgroundModes = [...new Set([...existing, ...extra])];
    return config;
  });
}

module.exports = withMergeBackgroundModes;
