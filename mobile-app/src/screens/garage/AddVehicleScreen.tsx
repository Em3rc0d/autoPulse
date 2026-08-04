import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCreateVehicle } from '../../infrastructure/hooks/useCreateVehicle';

export default function AddVehicleScreen() {
  const navigation = useNavigation<any>();
  const { createVehicle, loading, error } = useCreateVehicle();

  const [alias, setAlias] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');

  const isFormValid = alias.trim().length > 0;

  const handleSave = async () => {
    if (!isFormValid) return;

    try {
      const parsedYear = year ? parseInt(year, 10) : undefined;
      // Normalization: VIN uppercase
      const normalizedVin = vin ? vin.toUpperCase().trim() : undefined;

      await createVehicle({
        alias: alias.trim(),
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        year: parsedYear,
        vin: normalizedVin
      });

      // Go back to Garage on success
      navigation.goBack();
    } catch (err) {
      console.error('Failed to create vehicle', err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Vehicle</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alias (Required)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Project M3"
            placeholderTextColor="#666"
            value={alias}
            onChangeText={setAlias}
            autoFocus
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Make</Text>
            <TextInput
              style={styles.input}
              placeholder="BMW"
              placeholderTextColor="#666"
              value={make}
              onChangeText={setMake}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Model</Text>
            <TextInput
              style={styles.input}
              placeholder="M3 (F80)"
              placeholderTextColor="#666"
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Year</Text>
          <TextInput
            style={styles.input}
            placeholder="2017"
            placeholderTextColor="#666"
            value={year}
            onChangeText={setYear}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>VIN (Optional)</Text>
          <TextInput
            style={[styles.input, { fontFamily: 'SpaceMono_400Regular' }]}
            placeholder="WBS8M9C56H5A12345"
            placeholderTextColor="#666"
            value={vin}
            onChangeText={setVin}
            autoCapitalize="characters"
            maxLength={17}
          />
          <Text style={styles.helperText}>Used to auto-detect supported ECUs and capabilities.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, !isFormValid && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isFormValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={[styles.saveButtonText, !isFormValid && styles.saveButtonTextDisabled]}>SAVE VEHICLE</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E11',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
    backgroundColor: '#111518',
    borderBottomWidth: 1,
    borderBottomColor: '#2A3136',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFF',
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 18,
  },
  headerRight: {
    width: 32,
  },
  formContainer: {
    flex: 1,
    padding: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  errorText: {
    color: '#FF3B30',
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    color: '#8E8E93',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#161C20',
    borderWidth: 1,
    borderColor: '#2A3136',
    borderRadius: 8,
    color: '#FFF',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    padding: 14,
  },
  helperText: {
    color: '#666',
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 8,
  },
  footer: {
    padding: 24,
    paddingBottom: 48,
    backgroundColor: '#111518',
    borderTopWidth: 1,
    borderTopColor: '#2A3136',
  },
  saveButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#333',
  },
  saveButtonText: {
    color: '#000',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  saveButtonTextDisabled: {
    color: '#666',
  }
});
