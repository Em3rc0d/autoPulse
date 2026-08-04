import { StyleSheet } from 'react-native';

export const COLORS = {
  background: '#0e1417',
  surface: '#1a2123',
  surfaceBright: '#242b2e',
  surfaceHighest: '#2f3639',
  primary: '#00d1ff',
  primaryDim: '#4cd6ff',
  primaryContainer: '#00566a',
  onSurface: '#dde3e7',
  onSurfaceVariant: '#bbc9cf',
  outline: '#3c494e',
  error: '#ffb4ab',
  errorContainer: '#93000a',
  warning: '#FF9F0A',
  success: '#32D74B',
  secondary: '#c2c6d3',
};

export const FONTS = {
  grotesk: 'SpaceGrotesk_700Bold', // Usar para encabezados grandes, telemetría
  groteskMedium: 'SpaceGrotesk_500Medium',
  mono: 'SpaceMono_400Regular', // Usar para códigos, etiquetas, unidades
  monoBold: 'SpaceMono_700Bold',
  inter: 'Inter_400Regular', // Cuerpo de texto
  interMedium: 'Inter_500Medium',
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  neonGlow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  textGlow: {
    textShadowColor: 'rgba(0, 209, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.outline,
    padding: 16,
  },
});
