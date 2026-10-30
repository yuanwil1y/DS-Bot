// Account button -> settings sheet (Grok settings style).
import React, { useEffect, useState } from 'react';
import { clearLastError, loadLastError, type LastError } from '../errors';
import { Text } from 'react-native';
import { Group, Row, Sheet } from '../components/ui';
import { usePrefs } from '../prefs';
import { useStore } from '../store';
import { t } from '../i18n';
import type { Theme } from '../theme';

export const APP_VERSION = '0.6.0';

export function SettingsSheet({ theme, visible, onClose }: { theme: Theme; visible: boolean; onClose(): void }) {
  const { client, status, state, disconnect } = useStore();
  const prefs = usePrefs();
  const [lastErr, setLastErr] = useState<LastError | null>(null);
  useEffect(() => { if (visible) loadLastError().then(setLastErr); }, [visible]);
  const host = client?.conn.baseUrl.replace(/^https?:\/\//, '') ?? '';
  const cycle = <T extends string>(v: T, all: T[]) => all[(all.indexOf(v) + 1) % all.length];
  const label = (v: string) => (v === 'auto' ? t.auto : v === 'zh' ? '简体中文' : v === 'en' ? 'English' : v === 'dark' ? t.dark : t.light);
  return (
    <Sheet theme={theme} visible={visible} onClose={onClose}>
      <Group theme={theme} style={{ marginTop: 4 }}>
        <Row theme={theme} label={t.appName} caption={host} value={status === 'open' ? t.online : t.offline} />
        <Row theme={theme} label={t.plugin} value={client?.hello?.plugin?.version ?? '—'} />
        {state?.readOnly ? <Row theme={theme} label={t.readOnly} value="✓" /> : null}
      </Group>
      <Group theme={theme}>
        <Row theme={theme} label={t.language} value={label(prefs.lang)} onPress={() => prefs.set({ lang: cycle<typeof prefs.lang>(prefs.lang, ['auto', 'zh', 'en']) })} />
        <Row theme={theme} label={t.theme} value={label(prefs.theme)} onPress={() => prefs.set({ theme: cycle<typeof prefs.theme>(prefs.theme, ['dark', 'light', 'auto']) })} />
      </Group>
      <Group theme={theme}>
        <Row theme={theme} label={t.disconnect} danger chevron={false} onPress={() => { onClose(); disconnect(); }} />
      </Group>
      <Group theme={theme}>
        <Row theme={theme} label="最近一次错误" value={lastErr ? new Date(lastErr.time).toLocaleString() : '无'} chevron={false} onPress={lastErr ? () => { clearLastError(); setLastErr(null); } : undefined} />
        {lastErr ? <Text selectable style={{ color: '#ff6b6b', fontSize: 12, padding: 12 }}>{`[${lastErr.where}] ${lastErr.message}\n${lastErr.stack ?? ''}`.slice(0, 1200)}{'\n（点上面一行清除）'}</Text> : null}
      </Group>
      <Text style={{ color: theme.faint, textAlign: 'center', marginTop: 24 }}>{t.appVersion} {APP_VERSION}</Text>
    </Sheet>
  );
}
