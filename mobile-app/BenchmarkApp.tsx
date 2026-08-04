import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, View } from 'react-native';
import { BenchmarkDevScreen } from './src/screens/benchmark/BenchmarkDevScreen';

export default function BenchmarkApp() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={{ flex: 1, backgroundColor: '#ffffff', paddingTop: 40 }}>
        <BenchmarkDevScreen />
      </View>
    </SafeAreaProvider>
  );
}
