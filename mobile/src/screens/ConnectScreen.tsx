import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { parseConnection } from '../api';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';

export function ConnectScreen({ theme }: { theme: Theme }) {
  const { connect } = useStore();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const input = { color: theme.text, backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginTop: 12 };

  async function go() {
    setErr(''); setBusy(true);
    try {
      const conn = parseConnection(url, token);
      if (!conn.token) throw new Error(t.token);
      await connect(conn);
    } catch (e: any) { setErr(String(e?.message ?? e)); } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '700' }}>{t.appName}</Text>
      <Text style={{ color: theme.text, fontSize: 18, marginTop: 20, fontWeight: '600' }}>{t.connectTitle}</Text>
      <Text style={{ color: theme.sub, fontSize: 14, marginTop: 6 }}>{t.connectHint}</Text>
      <TextInput style={input} value={url} onChangeText={setUrl} placeholder={t.server} placeholderTextColor={theme.sub} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <TextInput style={input} value={token} onChangeText={setToken} placeholder={t.token} placeholderTextColor={theme.sub} autoCapitalize="none" autoCorrect={false} secureTextEntry />
      {err ? <Text style={{ color: '#ef4444', marginTop: 10 }}>{err}</Text> : null}
      <Pressable onPress={go} disabled={busy || !url} style={{ marginTop: 20, backgroundColor: theme.accent, opacity: busy || !url ? 0.5 : 1, borderRadius: 26, paddingVertical: 15, alignItems: 'center' }}>
        {busy ? <View style={{ flexDirection: 'row', gap: 8 }}><ActivityIndicator color={theme.accentText} /><Text style={{ color: theme.accentText, fontWeight: '600' }}>{t.connecting}</Text></View> : <Text style={{ color: theme.accentText, fontSize: 16, fontWeight: '600' }}>{t.connect}</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
