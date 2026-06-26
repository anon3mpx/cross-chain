const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '../../../node_modules/empx-swap-sdk-beta');
const targetDir = path.join(packageRoot, 'affiliate');
const targetFile = path.join(targetDir, 'chains.js');

if (!fs.existsSync(packageRoot)) {
  process.exit(0);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

if (!fs.existsSync(targetFile)) {
  fs.writeFileSync(
    targetFile,
    [
      'function applyAffiliateChainOverrides(chainConfig) {',
      '  return chainConfig;',
      '}',
      '',
      'module.exports = {',
      '  applyAffiliateChainOverrides,',
      '};',
      '',
    ].join('\n'),
    'utf8',
  );
}
