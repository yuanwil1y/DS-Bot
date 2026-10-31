// 语音对话 — web voice.js VoiceMode as a full-screen sub-page.
// Listen (STT) → send → think → speak reply (TTS) → listen again.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import type { Bot } from '../api';
import { VOICE, plainSpeech } from '../api/voice';
import { useDictation } from '../hooks/useDictation';
import { Avatar } from '../components/Avatar';
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
  const sawStream = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const sessionId = bot.sessionId ?? bot.id;
  const dictationRef = useRef<{ stop(): void } | null>(null);

  const speakReply = (raw: string) => {
    const spoken = plainSpeech(raw);
    setSaid(spoken);
    setHeard('');
    waiting.current = false;
    sawStream.current = false;
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
    sawStream.current = false;
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
    }, 280);
    return () => clearTimeout(timer);
  }, [phase, dictation.listening]);

  useEffect(() => { if (phase !== 'listening') dictation.stop(); }, [phase]);

  // Track stream start/end for this bot after we submitted.
  useEffect(() => {
    if (phase !== 'thinking' || !waiting.current) return;
    if (streaming[bot.id]) sawStream.current = true;
  }, [phase, streaming[bot.id], bot.id]);

  useEffect(() => subscribe((e) => {
    if (!waiting.current) return;
    const d = e.data as any;
    if (e.event === 'stream' && d?.botId === bot.id) {
      if (d.phase !== 'end') sawStream.current = true;
      else if (sawStream.current && d.phase === 'end') {
        // Prefer the message event for text; if stream ends without it, fall through on next message.
      }
    }
    if (e.event === 'message' && d?.botId === bot.id && d?.item?.kind !== 'user' && d?.item?.text) {
      if (waiting.current) speakReply(String(d.item.text));
    }
  }), [bot.id, subscribe]);

  // Fallback: stream ended and we never got a message event — pull chat once.
  useEffect(() => {
    if (phase !== 'thinking' || !waiting.current || !client) return;
    if (streaming[bot.id] || !sawStream.current) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      client.chat(bot.id).then((p) => {
        if (cancelled || !waiting.current) return;
        const last = [...p.items].reverse().find((x: any) => x.kind !== 'user' && x.text);
        if (last?.text) speakReply(String(last.text));
      }).catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, streaming[bot.id], client, bot.id]);

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
          <Avatar bot={bot} size={112} ring={theme.bg} working={phase === 'thinking'} />
        </Animated.View>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 8 }}>{bot.name}</Text>
        <Text style={{ color: theme.sub, fontSize: 13, marginTop: 6, minHeight: 18 }}>{status}</Text>
        <Text numberOfLines={4} style={{ color: theme.text, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, minHeight: 44 }}>{caption}</Text>
        {shownNote ? <Text style={{ color: theme.danger, fontSize: 12, marginTop: 8 }}>{shownNote}</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 36 }}>
        <Pressable disabled={blocked} onPress={togglePause} accessibilityLabel={phase === 'paused' ? VOICE.resume : VOICE.pause}
          style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: phase === 'paused' ? theme.bubbleMe : theme.cardHi, alignItems: 'center', justifyContent: 'center', opacity: blocked ? 0.4 : 1 }}>
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
