import { registerRootComponent } from 'expo';

import BenchmarkApp from './BenchmarkApp';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// This is an isolated entry point for running the C0/B1 benchmark natively.
registerRootComponent(BenchmarkApp);
