// Renders apps/desktop/build/icon.svg to icon.png and icon.icns: `node scripts/build-icon.mjs`.
// Re-runs itself under Electron to rasterize the SVG with Chromium (keeps transparency).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const buildDir = resolve(import.meta.dirname, '../apps/desktop/build');
const svgPath = join(buildDir, 'icon.svg');
const pngPath = join(buildDir, 'icon.png');
const SIZE = 1024;

async function rasterize() {
  const { app, BrowserWindow } = await import('electron');
  app.dock?.hide();
  await app.whenReady();
  const window = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  const html = `<body style="margin:0;background:transparent">${readFileSync(svgPath, 'utf8')}</body>`;
  await window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  writeFileSync(pngPath, image.resize({ width: SIZE, height: SIZE }).toPNG());
  app.quit();
}

function packageIcns() {
  const iconset = join(mkdtempSync(join(tmpdir(), 'glaceon-icon-')), 'icon.iconset');
  execFileSync('mkdir', [iconset]);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const [scale, suffix] of [
      [1, ''],
      [2, '@2x'],
    ]) {
      const pixels = String(size * scale);
      const out = join(iconset, `icon_${size}x${size}${suffix}.png`);
      execFileSync('sips', ['-z', pixels, pixels, pngPath, '--out', out], { stdio: 'ignore' });
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')]);
  rmSync(resolve(iconset, '..'), { recursive: true, force: true });
}

if (process.versions.electron === undefined) {
  const require = createRequire(join(buildDir, '../package.json'));
  const electron = require('electron');
  execFileSync(electron, [import.meta.filename], { stdio: 'inherit' });
  packageIcns();
  console.log('wrote icon.png and icon.icns');
} else {
  // Not awaited: Electron holds back `ready` until the ESM entry finishes evaluating.
  void rasterize();
}
