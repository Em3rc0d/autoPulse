const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

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

if (!fs.existsSync(target)) {
  throw new Error(`EXPO_PERMISSIONS_FILE_NOT_FOUND:${target}`);
}

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
} else {
  console.log('Expo permissions null-safety patch already applied.');
}
