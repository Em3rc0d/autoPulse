import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import LiveSessionScreen from './LiveSessionScreen';
import { DriverModeSelector } from './components/DriverModeSelector';
import { DriverModeProvider, useDriverMode } from './components/DriverModeContext';

function DriverModePanel() {
  const { selectedMode, setSelectedMode, availableSignals } = useDriverMode();

  return (
    <View style={styles.modePanel}>
      <DriverModeSelector
        selectedMode={selectedMode}
        availableSignals={availableSignals}
        onSelectMode={setSelectedMode}
      />
    </View>
  );
}

function DriverLiveSessionContent() {
  return (
    <View style={styles.container}>
      <DriverModePanel />
      <View style={styles.liveContainer}>
        <LiveSessionScreen />
      </View>
    </View>
  );
}

export default function DriverLiveSessionScreen() {
  const route = useRoute<any>();
  const supportedPids = route.params?.supportedPids || [];

  return (
    <DriverModeProvider supportedPids={supportedPids}>
      <DriverLiveSessionContent />
    </DriverModeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e1417',
  },
  modePanel: {
    backgroundColor: '#0e1417',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  liveContainer: {
    flex: 1,
  },
});
