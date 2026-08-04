import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import dtcDatabase from '../assets/dtc_database.json';
import { COLORS, FONTS, globalStyles } from '../styles/theme';
import { askMechanicAI } from '../services/aiService';

export default function MechanicChatScreen() {
  const [messages, setMessages] = useState<{id: string, role: string, text: string, time: string, mediaUri?: string, mediaType?: 'image' | 'audio'}[]>([
    { id: '1', role: 'ai', text: 'Sistema iniciado. Ingresa un código DTC o describe los síntomas para un análisis inmediato.', time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
    })();
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5, // Reducir calidad para acelerar el pase a Base64
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
    } catch (err) {
      console.error('Fallo al iniciar grabación', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(null);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (uri) {
      await sendMessage(uri, 'audio');
    }
  };

  const handleSendText = () => {
    if (selectedImage) {
      sendMessage(selectedImage, 'image');
      setSelectedImage(null);
    } else {
      sendMessage();
    }
  };

  const sendMessage = async (mediaUri?: string, mediaType?: 'image' | 'audio') => {
    if (!input.trim() && !mediaUri) return;

    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    const userText = input || (mediaType === 'audio' ? '🎤 Audio adjunto' : '📷 Foto adjunta');
    const userMsg = { id: Date.now().toString(), role: 'user', text: userText, time, mediaUri, mediaType };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      if (userMsg.text.toUpperCase().startsWith('P0') && !mediaUri) {
        const code = userMsg.text.toUpperCase().trim();
        const db = dtcDatabase as Record<string, any>;
        const result = db[code];

        if (result) {
          const aiMsg = {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            text: `🚨 Sistema: ${result.system}\n\nGravedad: ${result.severity}\n\n${result.explanation}\n\n💰 Estimado: ${result.cost_estimate_pen}`,
            time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
          };
          setMessages(prev => [...prev, aiMsg]);
        } else {
          const aiReply = await askMechanicAI(userMsg.text, messages.slice(1));
          setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'ai', text: aiReply, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
        }
      } else {
        const promptToSent = mediaType === 'audio' ? `Analiza este audio del motor. Descripción del usuario: ${input}` : userMsg.text;
        const aiReply = await askMechanicAI(promptToSent, messages.slice(1), mediaUri, mediaType);
        setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'ai', text: aiReply, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'ai', text: `⚠️ Error de red o IA: ${e.message}`, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.robotAvatar}>
             <Text style={{ fontSize: 24 }}>🤖</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Mecánico Virtual IA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>EN LÍNEA</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.chatContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={msg.role === 'user' ? styles.userBubbleContainer : styles.aiBubbleContainer}>
            <View style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
              {msg.mediaUri && msg.mediaType === 'image' && (
                <Image source={{ uri: msg.mediaUri }} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: 10 }} />
              )}
              {msg.mediaUri && msg.mediaType === 'audio' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>🔊</Text>
                  <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.monoBold, fontSize: 12 }}>Nota de Voz</Text>
                </View>
              )}
              <Text style={msg.role === 'user' ? styles.userBubbleText : styles.aiBubbleText}>{msg.text}</Text>
            </View>
            <Text style={styles.timeText}>
              {msg.role === 'ai' ? 'IA' : 'TÚ'} • {msg.time}
            </Text>
          </View>
        ))}
        {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 10, alignSelf: 'flex-start', marginLeft: 15 }} />}
      </ScrollView>

      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removePreviewBtn} onPress={() => setSelectedImage(null)}>
            <Text style={{ color: '#FFF', fontWeight: 'bold' }}>X</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.iconButton} onPress={pickImage}>
          <Text style={{ fontSize: 20 }}>🖼️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.iconButton, recording && { backgroundColor: '#FF453A22', borderColor: '#FF453A' }]}
          onPressIn={startRecording}
          onPressOut={stopRecording}
        >
          <Text style={{ fontSize: 20 }}>🎤</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={recording ? "Grabando... suelta para enviar" : "Ingresa síntoma o código..."}
          placeholderTextColor={COLORS.onSurfaceVariant}
          value={input}
          onChangeText={setInput}
          editable={!recording}
        />
        <TouchableOpacity style={[styles.sendButton, globalStyles.neonGlow]} onPress={handleSendText}>
          <Text style={styles.sendButtonText}>➔</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingTop: 50, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.outline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  robotAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: COLORS.outline, backgroundColor: COLORS.surfaceHighest, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  headerTitle: { color: COLORS.onSurface, fontSize: 18, fontFamily: FONTS.grotesk, letterSpacing: 0.5 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 5 },
  statusText: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  chatContainer: { padding: 15, paddingBottom: 30 },
  aiBubbleContainer: { alignItems: 'flex-start', maxWidth: '85%', marginBottom: 15 },
  userBubbleContainer: { alignItems: 'flex-end', alignSelf: 'flex-end', maxWidth: '85%', marginBottom: 15 },
  bubble: { padding: 16, shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  aiBubble: { backgroundColor: COLORS.surfaceHighest, borderWidth: 1, borderColor: COLORS.outline, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderBottomLeftRadius: 16 },
  userBubble: { backgroundColor: COLORS.primaryContainer, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  aiBubbleText: { color: COLORS.onSurface, fontSize: 15, fontFamily: FONTS.inter, lineHeight: 22 },
  userBubbleText: { color: COLORS.primaryDim, fontSize: 15, fontFamily: FONTS.monoBold, letterSpacing: 1 },
  timeText: { color: COLORS.onSurfaceVariant, fontSize: 10, fontFamily: FONTS.monoBold, letterSpacing: 1, marginTop: 5, paddingHorizontal: 5 },
  previewContainer: { padding: 10, backgroundColor: COLORS.surfaceHighest, flexDirection: 'row', alignItems: 'center' },
  previewImage: { width: 60, height: 60, borderRadius: 10, borderWidth: 1, borderColor: COLORS.outline },
  removePreviewBtn: { position: 'absolute', top: 0, right: 10, backgroundColor: COLORS.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  inputContainer: { flexDirection: 'row', padding: 15, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.outline, alignItems: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.outline },
  input: { flex: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.outline, borderRadius: 25, paddingHorizontal: 20, paddingVertical: 10, color: COLORS.onSurface, fontFamily: FONTS.inter, marginRight: 10 },
  sendButton: { backgroundColor: COLORS.primaryContainer, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: COLORS.primaryDim, fontWeight: '900', fontSize: 18 },
});
