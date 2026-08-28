import './src/runtime/installTextEncodingPolyfill';
import 'react-native-gesture-handler';
import './src/infrastructure/runtime/TextEncodingPolyfill';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/context/AuthContext';
import { initializeSpikeDatabase } from './src/infrastructure/database/migrator';
import { NavigationRoot } from './src/navigation/RootNavigator';
import { BleManagerProvider } from './src/infrastructure/ble/BleManagerProvider';

type SpikeFlag = 'DISABLED' | 'INTERNAL' | 'RELEASE_VALIDATION';
const DB_SPIKE_ENABLED: SpikeFlag = 'INTERNAL'; // Flag for testing in APC-02

import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0e1417' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0e1417" />
        <AuthProvider>
          <SpikeInitializer>
            <BleManagerProvider>
              <NavigationRoot />
            </BleManagerProvider>
          </SpikeInitializer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
function SpikeInitializer({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (DB_SPIKE_ENABLED !== 'DISABLED') {
      initializeSpikeDatabase().then(result => {
        console.log('[APC-02 Spike] Database initialization result:', result);
      }).catch(err => {
        console.error('[APC-02 Spike] Unexpected fatal error:', err);
      });
    }
  }, []);

  return <>{children}</>;
}
