import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORIAL</Text>
      </View>

      <View style={styles.empty}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>📡</Text>
        <Text style={styles.emptyText}>Tus sesiones aparecerán aquí</Text>
        <Text style={styles.emptySub}>
          AutoPulse está preparando el historial y el análisis de sesiones. Cuando completes una sesión Live, podrás consultarla desde esta pantalla.
        </Text>

        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => navigation.navigate('Inicio')}
        >
          <Text style={styles.ctaText}>Iniciar sesión Live</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
  headerTitle: { color: '#00D1FF', fontSize: 14, fontWeight: '900', letterSpacing: 4, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 15, textAlign: 'center' },
  emptySub: { color: '#8E8E93', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  ctaButton: { backgroundColor: '#00D1FF', paddingVertical: 14, paddingHorizontal: 30, borderRadius: 25 },
  ctaText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
