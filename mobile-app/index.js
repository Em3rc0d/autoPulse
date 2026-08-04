import { registerRootComponent } from 'expo';
import ReactNativeForegroundService from '@supersami/rn-foreground-service';

ReactNativeForegroundService.register({
  config: {
    alert: false,
    onServiceErrorCallBack: function () {
      console.warn('Foreground service failed to start.');
    },
  },
});

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
