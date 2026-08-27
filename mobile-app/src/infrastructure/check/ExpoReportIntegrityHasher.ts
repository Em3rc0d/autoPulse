// Compatibility export for the report UI. The SDK's expo-crypto typings on
// this release do not expose the digest API, so report integrity is computed
// by the Hermes-safe pure-JS SHA-256 implementation instead.
export { pureJsReportIntegrityHasher as expoReportIntegrityHasher } from './PureJsReportIntegrityHasher';
