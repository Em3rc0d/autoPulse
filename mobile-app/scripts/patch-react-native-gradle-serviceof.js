const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.join(
  root,
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'build.gradle.kts'
);

if (!fs.existsSync(target)) {
  throw new Error(`REACT_NATIVE_GRADLE_PLUGIN_FILE_NOT_FOUND:${target}`);
}

const original = fs.readFileSync(target, 'utf8');
let next = original;

const importLine = 'import org.gradle.configurationcache.extensions.serviceOf\n';
if (next.includes(importLine)) {
  next = next.replace(importLine, '');
}

const serviceBlock = `  testRuntimeOnly(
      files(
          serviceOf<ModuleRegistry>()
              .getModule("gradle-tooling-api-builders")
              .classpath
              .asFiles
              .first()))
`;

if (next.includes(serviceBlock)) {
  next = next.replace(serviceBlock, '');
}

if (next.includes('serviceOf<ModuleRegistry>()') || next.includes('configurationcache.extensions.serviceOf')) {
  throw new Error('REACT_NATIVE_GRADLE_SERVICEOF_PATCH_INCOMPLETE');
}

if (next === original) {
  console.log('React Native Gradle serviceOf patch already unnecessary/applied.');
  process.exit(0);
}

fs.writeFileSync(target, next, 'utf8');
console.log('Patched @react-native/gradle-plugin for Gradle 8.11+ compatibility.');
