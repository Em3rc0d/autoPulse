const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let hasProhibitedImports = false;
let prohibitedCount = 0;

walkDir('c:/Users/eduar/Desktop/Farid/autopulse/autoPulse/mobile-app/src/domain', (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /import\s+.*?\s+from\s+['"](react|react-native|expo.*|sqlite.*|drizzle.*|@react-native-async-storage.*)['"]/g;
    const throwRegex = /throw\s+/g;
    const randomRegex = /Math\.random/g;
    const envRegex = /process\.env/g;
    const dateRegex = /Date\.now/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      console.log(`[PROHIBITED IMPORT] ${filePath}: ${match[0]}`);
      hasProhibitedImports = true;
      prohibitedCount++;
    }

    // Only fail on non-test files for throw/date
    if (!filePath.includes('__tests__') && !filePath.includes('shared\\timestamps.ts')) {
      if (dateRegex.test(content)) {
         console.log(`[DATE.NOW] ${filePath}`);
         hasProhibitedImports = true;
         prohibitedCount++;
      }
    }
  }
});

console.log(`Audit finished. Prohibited elements found: ${prohibitedCount}`);
process.exit(hasProhibitedImports ? 1 : 0);
