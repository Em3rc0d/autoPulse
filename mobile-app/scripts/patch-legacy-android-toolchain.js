const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function patchExpoPermissions() {
  const target = path.join(
    root,
    'node_modules',
    'expo-modules-core',
    'android',
    'src',
    'main',
    'java',
    'expo',
    'modules',
    'adapters',
    'react',
    'permissions',
    'PermissionsService.kt'
  );
  if (!fs.existsSync(target)) throw new Error(`EXPO_PERMISSIONS_FILE_NOT_FOUND:${target}`);

  const original = fs.readFileSync(target, 'utf8');
  const unsafe = 'return requestedPermissions.contains(permission)';
  const safe = 'return requestedPermissions?.contains(permission) ?: false';
  let next = original;

  if (next.includes(unsafe)) next = next.replace(unsafe, safe);
  if (next.includes(unsafe)) throw new Error('EXPO_PERMISSIONS_NULL_SAFETY_PATCH_INCOMPLETE');
  if (!next.includes(safe)) throw new Error('EXPO_PERMISSIONS_EXPECTED_SITE_NOT_FOUND');

  if (next !== original) {
    fs.writeFileSync(target, next, 'utf8');
    console.log('Patched expo-modules-core PermissionsService requestedPermissions null-safety.');
  }
}

function patchImageSizeTextDecoder() {
  const target = path.join(root, 'node_modules', 'image-size', 'dist', 'cjs', 'types', 'utils.js');
  if (!fs.existsSync(target)) throw new Error(`IMAGE_SIZE_UTILS_FILE_NOT_FOUND:${target}`);

  const original = fs.readFileSync(target, 'utf8');
  let next = original;

  // image-size@2 receives Metro asset bytes that can be a plain numeric array.
  // Node TextDecoder accepts ArrayBuffer/ArrayBufferView, so normalize only at
  // this bridge without changing Metro asset semantics.
  next = next.replace(
    /\.decode\(([^)]+)\)/g,
    '.decode(ArrayBuffer.isView($1) ? $1 : ($1 instanceof ArrayBuffer ? new Uint8Array($1) : Uint8Array.from($1)))'
  );

  if (next === original) {
    if (!next.includes('Uint8Array.from')) {
      throw new Error('IMAGE_SIZE_TEXTDECODER_PATCH_SITE_NOT_FOUND');
    }
  } else {
    fs.writeFileSync(target, next, 'utf8');
    console.log('Patched image-size TextDecoder input normalization for Metro assets.');
  }
}

patchExpoPermissions();
patchImageSizeTextDecoder();
