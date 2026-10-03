const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pluginRoot = path.join(root, 'node_modules', '@react-native', 'gradle-plugin');
const candidates = [
  path.join(pluginRoot, 'build.gradle.kts'),
  path.join(pluginRoot, 'react-native-gradle-plugin', 'build.gradle.kts'),
].filter(fs.existsSync);

if (candidates.length === 0) {
  throw new Error(`REACT_NATIVE_GRADLE_PLUGIN_FILE_NOT_FOUND:${pluginRoot}`);
}

const importPattern = /^import org\.gradle\.configurationcache\.extensions\.serviceOf\r?\n/m;
const serviceBlockPattern = /\n\s*testRuntimeOnly\(\s*files\(\s*serviceOf<ModuleRegistry>\(\)\s*\.getModule\("gradle-tooling-api-builders"\)\s*\.classpath\s*\.asFiles\s*\.first\(\)\)\)\s*/m;

let patched = 0;
for (const target of candidates) {
  const original = fs.readFileSync(target, 'utf8');
  let next = original.replace(importPattern, '').replace(serviceBlockPattern, '\n');

  // RN 0.74's Gradle plugin defaults its own Kotlin warnings to errors.
  // Gradle 8.11 surfaces deprecations in the legacy plugin implementation, so
  // keep AutoPulse's compiler policy untouched and disable Werror only inside RNGP.
  next = next
    .replace(
      /project\.properties\["enableWarningsAsErrors"\]\?\.toString\(\)\?\.toBoolean\(\)\s*\?:\s*true/g,
      'project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false'
    )
    .replace(/\ballWarningsAsErrors\s*=\s*true\b/g, 'allWarningsAsErrors = false')
    .replace(/allWarningsAsErrors\.set\(true\)/g, 'allWarningsAsErrors.set(false)');

  if (next.includes('serviceOf<ModuleRegistry>()') || next.includes('configurationcache.extensions.serviceOf')) {
    throw new Error(`REACT_NATIVE_GRADLE_SERVICEOF_PATCH_INCOMPLETE:${target}`);
  }

  if (
    /project\.properties\["enableWarningsAsErrors"\]\?\.toString\(\)\?\.toBoolean\(\)\s*\?:\s*true/.test(next) ||
    /\ballWarningsAsErrors\s*=\s*true\b/.test(next) ||
    /allWarningsAsErrors\.set\(true\)/.test(next)
  ) {
    throw new Error(`REACT_NATIVE_GRADLE_WERROR_PATCH_INCOMPLETE:${target}`);
  }

  if (next !== original) {
    fs.writeFileSync(target, next, 'utf8');
    patched += 1;
    console.log(`Patched React Native Gradle serviceOf incompatibility: ${target}`);
  }
}

if (patched === 0) {
  console.log('React Native Gradle serviceOf patch already unnecessary/applied.');
}
