const babel = require('@babel/core');

/**
 * Narrow Jest transformer for React Native / Expo JavaScript dependencies.
 *
 * The product TypeScript suite remains on ts-jest. React Native ships Flow
 * syntax (for example `import typeof`) that Node/Jest cannot execute directly,
 * so whitelisted RN/Expo JavaScript is normalized through the same Expo Babel
 * preset used by the application build.
 */
module.exports = {
  process(sourceText, sourcePath) {
    const result = babel.transformSync(sourceText, {
      filename: sourcePath,
      babelrc: false,
      configFile: false,
      sourceType: 'unambiguous',
      presets: ['babel-preset-expo'],
      plugins: [
        ['babel-plugin-inline-import', { extensions: ['.sql'] }]
      ],
      caller: {
        name: 'autopulse-jest-react-native-transformer',
        supportsStaticESM: false,
        supportsDynamicImport: false,
        supportsExportNamespaceFrom: false,
        supportsTopLevelAwait: false
      },
      sourceMaps: 'inline'
    });

    return {
      code: result && result.code ? result.code : sourceText
    };
  }
};
