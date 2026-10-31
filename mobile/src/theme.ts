import { useColorScheme } from 'react-native';
import { useMemo } from 'react';
import { usePrefs } from './prefs';
import { useTeamPrefs } from './teamPrefs';
import { useAppearanceTest } from './appearanceTest'; // TEST-ONLY
import { palette as build, inkFillHex } from './appearance';
export type Theme = ReturnType<typeof build>;
// ds-bot web themes (themes.js): team theme/accent from server prefs; light/dark is the
// device setting, as on the web where the DSH shell picks the mode.
export function useTheme(): Theme {
  const sys = useColorScheme();
  const { theme } = usePrefs();
  const team = useTeamPrefs();
  const test = useAppearanceTest(); // TEST-ONLY forced mode
  const dark = test.dark ?? (theme === 'auto' ? sys !== 'light' : theme === 'dark');
  return useMemo(() => build(team.prefs, dark), [team.prefs, dark]);
}
export function botColor(color: string | undefined, _seed: string, dark = true) {
  return inkFillHex(color, dark);
}
