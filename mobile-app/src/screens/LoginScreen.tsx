import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { authAPI } from '../services/api';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Completa los campos');

    // Test bypass for local development without backend
    if (email === 'test@test.com' && password === '123456') {
      await login('mock_test_token_123');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      await login(res.token);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'No se pudo conectar al servidor. Usa test@test.com y 123456 para probar sin internet.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AUTOPULSE</Text>
      <Text style={styles.subtitle}>Inicia sesión para sincronizar la ECU</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>INGRESAR</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: 20 }} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A', justifyContent: 'center', padding: 30 },
  title: { color: '#00D1FF', fontSize: 32, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  subtitle: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#1C1C1E', borderRadius: 10, padding: 15, color: '#FFF', marginBottom: 20 },
  button: { backgroundColor: '#00D1FF', padding: 15, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  linkText: { color: '#00D1FF', textAlign: 'center', fontSize: 14 }
});
