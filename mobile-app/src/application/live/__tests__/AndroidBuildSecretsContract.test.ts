import * as path from 'node:path';

const buildEnv = require(path.resolve(__dirname, '../../../..', 'scripts', 'security', 'validate-android-build-env.js')) as {
  hasConfiguredValue(value: unknown): boolean;
  findExposedGeminiSources(env: Record<string, string>, dotenvFiles: Array<{ name: string; content: string }>): string[];
};

describe('Android APK client-secret fail-closed policy', () => {
  it('rejects a configured credential from environment without exposing the value', () => {
    const sources = buildEnv.findExposedGeminiSources(
      { EXPO_PUBLIC_GEMINI_API_KEY: 'secret-example-never-log-this' }, [],
    );
    expect(sources).toEqual(['process environment']);
    expect(JSON.stringify(sources)).not.toContain('secret-example-never-log-this');
  });

  it('rejects nonempty Expo dotenv credentials, including quoted values', () => {
    const sources = buildEnv.findExposedGeminiSources({}, [
      { name: '.env', content: 'OTHER=ok\nEXPO_PUBLIC_GEMINI_API_KEY="candidate-key"\n' },
      { name: '.env.production', content: "export EXPO_PUBLIC_GEMINI_API_KEY='production-key' # do not leak" },
    ]);
    expect(sources).toEqual(['.env', '.env.production']);
    expect(JSON.stringify(sources)).not.toContain('candidate-key');
    expect(JSON.stringify(sources)).not.toContain('production-key');
  });

  it('allows absent, commented or empty variables in an offline QA build', () => {
    expect(buildEnv.findExposedGeminiSources({}, [
      { name: '.env', content: '# EXPO_PUBLIC_GEMINI_API_KEY=ignored\nEXPO_PUBLIC_GEMINI_API_KEY=""\n' },
    ])).toEqual([]);
    expect(buildEnv.hasConfiguredValue('  ')).toBe(false);
  });
});
