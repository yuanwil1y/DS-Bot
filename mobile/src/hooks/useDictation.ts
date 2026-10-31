import { useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { VOICE, dictationErrorNote } from '../api/voice';

type Opts = { continuous?: boolean; onEnd?: () => void; lang?: string };

/** Browser SpeechRecognition stand-in via Android SpeechRecognizer. */
export function useDictation(onText: (text: string, final: boolean) => void) {
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const [available, setAvailable] = useState(true);
  const latest = useRef(onText);
  latest.current = onText;
  const onEndRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    try { setAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable()); }
    catch { setAvailable(false); }
    return () => { try { ExpoSpeechRecognitionModule.abort(); } catch {} };
  }, []);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 2600);
    return () => clearTimeout(t);
  }, [note]);

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const end = onEndRef.current; onEndRef.current = undefined; end?.();
  });
  useSpeechRecognitionEvent('result', (ev) => {
    const transcript = (ev.results?.[0]?.transcript ?? '').trim();
    if (!transcript) return;
    latest.current(transcript, !!ev.isFinal);
  });
  useSpeechRecognitionEvent('error', (ev) => {
    setListening(false);
    const n = dictationErrorNote(ev.error);
    if (n) setNote(n);
  });

  const start = async ({ continuous = true, onEnd, lang }: Opts = {}) => {
    if (!available) { setNote(VOICE.dictateUnsupported); return false; }
    onEndRef.current = onEnd;
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setNote(VOICE.micBlocked); return false; }
      ExpoSpeechRecognitionModule.start({
        lang: lang || 'zh-CN',
        interimResults: true,
        continuous,
        addsPunctuation: false,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: continuous ? 1500 : 1200,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: continuous ? 1000 : 800,
        },
      });
      setListening(true);
      return true;
    } catch {
      setNote(VOICE.couldntStart);
      return false;
    }
  };
  const stop = () => { try { ExpoSpeechRecognitionModule.stop(); } catch {} };

  return { listening, note, available, start, stop };
}
