const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');

const withNetworkSecurityConfig = (config) => {
  // 1. Copy the network_security_config.xml into android/app/src/main/res/xml/
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const destDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const srcFile = path.join(config.modRequest.projectRoot, 'assets/network_security_config.xml');
      const destFile = path.join(destDir, 'network_security_config.xml');

      fs.copyFileSync(srcFile, destFile);
      return config;
    },
  ]);

  // 2. Add android:networkSecurityConfig="@xml/network_security_config" to AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withNetworkSecurityConfig,
  'withNetworkSecurityConfig',
  pkg.version
);
