import 'react-native-gesture-handler';
import './src/infrastructure/runtime/TextEncodingPolyfill';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/context/AuthContext';
import { NavigationRoot } from './src/navigation/RootNavigator';
import { BleManagerProvider } from './src/infrastructure/ble/BleManagerProvider';

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
          <BleManagerProvider>
            <NavigationRoot />
          </BleManagerProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
