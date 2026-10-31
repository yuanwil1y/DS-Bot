// Copies assets/fonts/*.ttf into android/app/src/main/assets/fonts on prebuild.
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs'); const path = require('path');
module.exports = (config) => withDangerousMod(config, ['android', (c) => {
  const src = path.join(c.modRequest.projectRoot, 'assets/fonts');
  const dst = path.join(c.modRequest.platformProjectRoot, 'app/src/main/assets/fonts');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (f.endsWith('.ttf')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  return c;
}]);
