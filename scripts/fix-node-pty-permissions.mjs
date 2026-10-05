// node-pty's prebuilt `spawn-helper` is published without the executable bit, which makes
// every spawn fail with "posix_spawnp failed". Restore it after each install.
import { chmodSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(join(process.cwd(), 'apps/desktop/package.json'));
const packageRoot = dirname(require.resolve('node-pty/package.json'));
const prebuilds = join(packageRoot, 'prebuilds');

for (const platform of existsSync(prebuilds) ? readdirSync(prebuilds) : []) {
  const helper = join(prebuilds, platform, 'spawn-helper');
  if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) {
    chmodSync(helper, 0o755);
    console.log(`node-pty: made ${platform}/spawn-helper executable`);
  }
}
