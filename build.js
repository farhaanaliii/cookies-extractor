const esbuild      = require('esbuild');
const lightningcss = require('lightningcss');
const fs           = require('fs');
const path         = require('path');

const isDev   = process.argv.includes('--dev');
const pkg     = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const SRC        = path.join(__dirname, 'src');
const ICONS      = path.join(__dirname, 'icons');
const DIST       = path.join(__dirname, 'dist');
const DIST_SRC   = path.join(DIST, 'src');
const DIST_ICONS = path.join(DIST, 'icons');

function clean() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST_SRC,   { recursive: true });
  fs.mkdirSync(DIST_ICONS, { recursive: true });
}

function copyIcons() {
  fs.readdirSync(ICONS).forEach(file => {
    fs.copyFileSync(path.join(ICONS, file), path.join(DIST_ICONS, file));
  });
}

function copyManifest() {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  manifest.version = VERSION;
  fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function buildJS() {
  await esbuild.build({
    entryPoints: [
      path.join(SRC, 'highlighter.js'),
      path.join(SRC, 'popup.js'),
    ],
    outdir:    DIST_SRC,
    bundle:    false,
    minify:    !isDev,
    sourcemap: isDev ? 'inline' : false,
    target:    ['chrome120'],
    logLevel:  'info',
  });
}

function buildCSS() {
  const input = fs.readFileSync(path.join(SRC, 'popup.css'));

  if (isDev) {
    fs.writeFileSync(path.join(DIST_SRC, 'popup.css'), input);
    return;
  }

  const { code } = lightningcss.transform({
    filename:        'popup.css',
    code:            input,
    minify:          true,
    sourceMap:       false,
    targets:         lightningcss.browserslistToTargets(['chrome >= 120']),
  });

  fs.writeFileSync(path.join(DIST_SRC, 'popup.css'), code);
}

function buildHTML() {
  let html = fs.readFileSync(path.join(SRC, 'popup.html'), 'utf8');

  if (!isDev) {
    html = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\n\s*\n/g, '\n')
      .replace(/  +/g, ' ')
      .trim();
  }

  fs.writeFileSync(path.join(DIST_SRC, 'popup.html'), html);
}

async function build() {
  const start = Date.now();

  clean();
  copyManifest();
  copyIcons();

  await Promise.all([
    buildJS(),
    Promise.resolve(buildCSS()),
    Promise.resolve(buildHTML()),
  ]);

  const mode = isDev ? 'dev' : 'production';
  console.log(`\nBuild complete [${mode}] — ${Date.now() - start}ms`);
  console.log(`Output: ${DIST}`);

  const sizes = ['popup.html', 'popup.css', 'popup.js', 'highlighter.js'].map(f => {
    const p = path.join(DIST_SRC, f);
    if (!fs.existsSync(p)) return null;
    const bytes = fs.statSync(p).size;
    return `  ${f.padEnd(18)} ${(bytes / 1024).toFixed(1)} kB`;
  }).filter(Boolean);

  console.log('\n' + sizes.join('\n'));
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
