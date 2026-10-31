// 语音对话 — web voice.js VoiceMode as a full-screen sub-page.
// Listen (STT) → send → think → speak reply (TTS) → listen again.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import type { Bot } from '../api';
import { VOICE, plainSpeech } from '../api/voice';
import { useDictation } from '../hooks/useDictation';
import { Mark } from '../components/Avatar';
import { lookOf, type Look } from '../avatar/mark';
import { Icon } from '../components/ui';
import { useStore } from '../store';
import type { Theme } from '../theme';

type Phase = 'listening' | 'thinking' | 'speaking' | 'paused' | 'unsupported' | 'starting';

export function VoiceModeScreen({ theme, bot, onBack }: { theme: Theme; bot: Bot; onBack(): void }) {
  const { client, streaming, subscribe } = useStore();
  const [phase, setPhase] = useState<Phase>('starting');
  const [heard, setHeard] = useState('');
  const [said, setSaid] = useState('');
  const [note, setNote] = useState('');
  const turn = useRef(0);
  const waiting = useRef(false);
  const sentAt = useRef(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const sessionId = bot.sessionId ?? bot.id;
  const dictationRef = useRef<{ stop(): void } | null>(null);

  const speakReply = (raw: string) => {
    const spoken = plainSpeech(raw);
    setSaid(spoken);
    setHeard('');
    waiting.current = false;
    if (!spoken) { setPhase('listening'); return; }
    setPhase('speaking');
    const own = turn.current;
    void Speech.stop();
    Speech.speak(spoken, {
      language: /[\u3400-\u9fff]/.test(spoken) ? 'zh-CN' : 'en-US',
      onDone: () => { if (turn.current === own) setPhase((p) => (p === 'speaking' ? 'listening' : p)); },
      onError: () => { if (turn.current === own) setPhase('listening'); },
    });
  };

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || !client) return;
    setHeard(t);
    setPhase('thinking');
    waiting.current = true;
    sentAt.current = replies.current;
    try { await client.send(sessionId, t); }
    catch { waiting.current = false; setPhase('listening'); }
  };

  const dictation = useDictation((text, final) => {
    setHeard(text);
    if (!final) return;
    dictationRef.current?.stop();
    void submit(text);
  });
  dictationRef.current = dictation;

  useEffect(() => {
    if (!dictation.available) { setPhase('unsupported'); return; }
    setPhase('listening');
  }, [dictation.available]);

  useEffect(() => {
    if (phase !== 'listening' || dictation.listening) return;
    const own = turn.current;
    const timer = setTimeout(() => {
      if (turn.current !== own) return;
      void dictation.start({ continuous: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [phase, dictation.listening]);

  useEffect(() => { if (phase !== 'listening') dictation.stop(); }, [phase]);

  // web voice.js: speak the last reply once the turn has a new answer and the Bot is
  // no longer running (turnOutline count changed && !running).
  const [reply, setReply] = useState<{ n: number; text: string } | null>(null);
  const replies = useRef(0);
  useEffect(() => subscribe((e) => {
    const d = e.data as any;
    if (e.event === 'message' && d?.botId === bot.id && d?.item?.kind !== 'user' && d?.item?.text) {
      replies.current += 1;
      setReply({ n: replies.current, text: String(d.item.text) });
    }
  }), [bot.id, subscribe]);
  const running = !!streaming[bot.id];
  useEffect(() => {
    if (phase !== 'thinking' || running || !waiting.current || !reply || reply.n <= sentAt.current || !reply.text.trim()) return;
    speakReply(reply.text);
  }, [phase, running, reply]);

  useEffect(() => () => { turn.current += 1; dictation.stop(); void Speech.stop(); }, []);

  useEffect(() => {
    if (!note && !dictation.note) return;
    const t = setTimeout(() => setNote(''), 2600);
    return () => clearTimeout(t);
  }, [note, dictation.note]);

  useEffect(() => {
    if (phase !== 'listening' && phase !== 'speaking' && phase !== 'thinking') {
      pulse.setValue(1); return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: phase === 'speaking' ? 1.18 : 1.08, duration: phase === 'speaking' ? 450 : 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: phase === 'speaking' ? 450 : 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase]);

  const close = () => { turn.current += 1; dictation.stop(); void Speech.stop(); onBack(); };
  const togglePause = () => {
    if (phase === 'paused') { setPhase('listening'); return; }
    turn.current += 1;
    dictation.stop();
    void Speech.stop();
    setPhase('paused');
  };
  const blocked = phase === 'unsupported' || phase === 'starting';
  const status =
    phase === 'thinking' ? VOICE.thinkingEllipsis
      : phase === 'listening' ? VOICE.listening
        : phase === 'speaking' ? VOICE.speaking
          : phase === 'paused' ? VOICE.paused
            : phase === 'unsupported' ? VOICE.unsupported
              : '';
  const caption = phase === 'speaking' ? said : heard;
  const shownNote = note || dictation.note;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }} accessibilityLabel={VOICE.withName(bot.name)}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <Animated.View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 8, transform: [{ scale: pulse }] }}>
          <View style={{ position: 'absolute', width: 168, height: 168, borderRadius: 84, backgroundColor: theme.cardHi, opacity: 0.7 }} />
          <View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1, borderColor: theme.fillBorder }} />
          <Mark look={lookOf(bot) as Look} size={112} live id={bot.id} state={phase === 'thinking' ? 'thinking' : phase === 'speaking' ? 'sending' : 'idle'} />
        </Animated.View>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 8 }}>{bot.name}</Text>
        <Text style={{ color: theme.sub, fontSize: 13, marginTop: 6, minHeight: 18 }}>{status}</Text>
        <Text numberOfLines={4} style={{ color: theme.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, minHeight: 44 }}>{caption}</Text>
        {shownNote ? <Text style={{ color: theme.danger, fontSize: 12, marginTop: 8 }}>{shownNote}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 36 }}>
        <Pressable disabled={blocked} onPress={togglePause} accessibilityLabel={phase === 'paused' ? VOICE.resume : VOICE.pause}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: phase === 'paused' ? theme.border : theme.cardHi, alignItems: 'center', justifyContent: 'center', opacity: blocked ? 0.4 : 1 }}>
          <Icon name="mic" color={theme.text} size={20} />
          {phase === 'paused' ? <View style={{ position: 'absolute', width: 28, height: 2, backgroundColor: theme.text, transform: [{ rotate: '-45deg' }] }} /> : null}
        </Pressable>
        <Pressable onPress={close} accessibilityLabel={VOICE.end}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ff3e51', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="close" color="#fff" size={18} />
        </Pressable>
      </View>
    </View>
  );
}
