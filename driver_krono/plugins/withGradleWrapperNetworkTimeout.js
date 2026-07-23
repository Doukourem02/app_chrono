/**
 * Le wrapper Gradle par défaut fixe networkTimeout=10000 ms ; sur EAS, le téléchargement
 * de distribution depuis services.gradle.org peut dépasser ce délai → SocketTimeoutException.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** 3 min — suffisant si le CDN Gradle ou le worker EAS est lent. */
const TIMEOUT_MS = 180000;

module.exports = function withGradleWrapperNetworkTimeout(config) {
  return withDangerousMod(config, [
    'android',
    (exported) => {
      const wrapperPath = path.join(
        exported.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );
      if (!fs.existsSync(wrapperPath)) return exported;

      let text = fs.readFileSync(wrapperPath, 'utf8');
      if (/^networkTimeout=\d+\s*$/m.test(text)) {
        text = text.replace(/^networkTimeout=\d+\s*$/m, `networkTimeout=${TIMEOUT_MS}`);
      } else {
        text = text.replace(
          /^(distributionUrl=.*)\r?\n/m,
          `$1\nnetworkTimeout=${TIMEOUT_MS}\n`
        );
      }
      fs.writeFileSync(wrapperPath, text);
      return exported;
    },
  ]);
};
