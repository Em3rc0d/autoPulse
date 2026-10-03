const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function findPackageRoot(entryFile, expectedName) {
  let dir = path.dirname(entryFile);
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const meta = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (meta.name === expectedName) return dir;
      } catch {}
    }
    dir = path.dirname(dir);
  }
  throw new Error(`PACKAGE_ROOT_NOT_FOUND:${expectedName}:${entryFile}`);
}

const metroRoot = path.dirname(require.resolve('metro/package.json', { paths: [root] }));
const imageSizeRoot = findPackageRoot(require.resolve('image-size', { paths: [root] }), 'image-size');
const metroPackage = JSON.parse(fs.readFileSync(path.join(metroRoot, 'package.json'), 'utf8'));
const imageSizePackage = JSON.parse(fs.readFileSync(path.join(imageSizeRoot, 'package.json'), 'utf8'));

if (metroPackage.version !== '0.80.12') {
  throw new Error(`METRO_IMAGE_SIZE_PATCH_UNEXPECTED_METRO:${metroPackage.version}`);
}
if (imageSizePackage.version !== '2.0.4') {
  throw new Error(`METRO_IMAGE_SIZE_PATCH_UNEXPECTED_IMAGE_SIZE:${imageSizePackage.version}`);
}

const assetsPath = path.join(metroRoot, 'src', 'Assets.js');
let source = fs.readFileSync(assetsPath, 'utf8');

const patterns = [
  /const getImageSize = require\((['"])image-size\1\);/g,
  /var getImageSize = require\((['"])image-size\1\);/g,
];

let replacements = 0;
for (const pattern of patterns) {
  source = source.replace(pattern, match => {
    replacements += 1;
    const quote = match.includes('"image-size"') ? '"' : "'";
    const declaration = match.startsWith('var ') ? 'var ' : 'const ';
    return `${declaration}{imageSize: metroImageSizeV2} = require(${quote}image-size${quote});
${declaration}getImageSize = input => metroImageSizeV2(
  typeof input === 'string' ? require('fs').readFileSync(input) : input
);`;
  });
}

if (replacements !== 1) {
  const marker = source.indexOf('image-size');
  const context = marker >= 0
    ? source.slice(Math.max(0, marker - 240), Math.min(source.length, marker + 240))
    : 'image-size marker not found';
  throw new Error(`METRO_IMAGE_SIZE_PATCH_MATCH_COUNT:${replacements}\n${context}`);
}

fs.writeFileSync(assetsPath, source);
process.stdout.write('Patched metro@0.80.12 for image-size@2.0.4 named export + path-to-buffer compatibility.\n');
