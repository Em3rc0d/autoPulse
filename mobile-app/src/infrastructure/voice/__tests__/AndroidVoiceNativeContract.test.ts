import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Android native TTS completion contract — source structural gate', () => {
  const native = readFileSync(
    resolve(__dirname, '../../../../android/app/src/main/java/com/em3rc0dth/autopulse/AutoPulseVoiceModule.kt'),
    'utf-8'
  );

  it('resolves actual onDone, onError and onStop, never enqueue-only success', () => {
    expect(native).toContain('UtteranceProgressListener');
    expect(native).toMatch(/override fun onDone\(.*\)/);
    expect(native).toMatch(/finishActive\(utteranceId, true\)/);
    expect(native).toMatch(/override fun onError\(.*\)/);
    expect(native).toMatch(/override fun onStop\(.*\)/);
    expect(native).not.toContain('promise.resolve(result == TextToSpeech.SUCCESS)');
  });

  it('has bounded timeouts, main-thread ownership and does not allow low priority over critical', () => {
    expect(native).toContain('Handler(Looper.getMainLooper())');
    expect(native).toContain('MAX_UTTERANCE_MS');
    expect(native).toContain('MAX_INITIALIZATION_MS');
    expect(native).toContain('initializationFailed = true');
    expect(native).toContain('handler.postDelayed(timeout, MAX_INITIALIZATION_MS)');
    expect(native).toContain('if ((active?.priority ?: -1) > request.priority)');
    expect(native).toContain('LANG_AVAILABLE');
    expect(native).toContain('fun speakAlert(text: String, languageTag: String, priority: Int, promise: Promise)');
    expect(native).toContain('finishActive(null, false)');
  });
});
