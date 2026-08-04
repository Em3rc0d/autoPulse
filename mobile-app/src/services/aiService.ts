import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export const askMechanicAI = async (prompt: string, history: any[] = [], mediaUri?: string, mediaType?: 'image' | 'audio'): Promise<string> => {
  try {
    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      })),
      generationConfig: { maxOutputTokens: 600, temperature: 0.7 },
    });

    const contextPrompt = `Eres un mecánico experto automotriz, parte del sistema AutoPulse AI.
Tu única misión es diagnosticar autos, fallas, ruidos o códigos.
IMPORTANTE: RESPONDE SIEMPRE EN ESPAÑOL, NO USES INGLÉS BAJO NINGUNA CIRCUNSTANCIA.
Responde de forma clara, directa y técnica pero comprensible. Usa viñetas.
Mensaje del usuario: ${prompt}`;

    const parts: any[] = [{ text: contextPrompt }];

    if (mediaUri) {
      const base64Data = await FileSystem.readAsStringAsync(mediaUri, { encoding: FileSystem.EncodingType.Base64 });
      let mimeType = 'image/jpeg';

      if (mediaType === 'audio') {
        const extension = mediaUri.split('.').pop()?.toLowerCase();
        if (extension === 'm4a') mimeType = 'audio/mp4';
        else if (extension === 'wav') mimeType = 'audio/wav';
        else mimeType = 'audio/mp3'; // Fallback
      } else {
        const extension = mediaUri.split('.').pop()?.toLowerCase();
        if (extension === 'png') mimeType = 'image/png';
        else if (extension === 'webp') mimeType = 'image/webp';
      }

      parts.push({
        inlineData: { data: base64Data, mimeType }
      });
    }

    const result = await chat.sendMessage(parts);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error("No se pudo contactar al sistema experto. Revisa tu conexión a internet.");
  }
};
