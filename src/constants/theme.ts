import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Paper
    parchment: '#F5F0E3',
    agedPaper: '#EBE5D5',
    vellum: '#E0DAC8',
    ruledLine: '#C5BFA8',
    pencil: '#8A877E',
    graphite: '#6B6860',
    fadedInk: '#3D3D3A',
    ironGall: '#2C2A25',
    ink: '#1A1A18',
    white: '#FFFDF8',

    // Warm accents (wax seal)
    waxSeal: '#D4845A',
    sealDark: '#B56E45',
    sealLight: '#E8A87C',
    sealWash: '#FAE6D0',

    // Cool accents (saltwater)
    tide: '#2B7A9E',
    shallows: '#5BB5C9',
    mist: '#E0F4F7',
    deep: '#0F2942',

    // Signals
    connected: '#E8F5EE',
    connectedText: '#1A6B47',
    warning: '#FFF5ED',
    warningText: '#8B5A33',
    error: '#FDE8E8',
    errorText: '#791F1F',
    info: '#E0F4F7',
    infoText: '#0C447C',

    // Semantic aliases
    background: '#F5F0E3',
    backgroundCard: '#EBE5D5',
    backgroundSidebar: '#EBE5D5',
    border: '#C5BFA8',
    text: '#1A1A18',
    textBody: '#3D3D3A',
    textSecondary: '#6B6860',
    textMuted: '#8A877E',
    accent: '#2B7A9E',
    accentWarm: '#D4845A',

    // ── Backward-compat aliases (used by existing components) ──
    abyss: '#0A1628',
    ocean: '#1A4A6E',
    current: '#2B7A9E',
    foam: '#A8DDE6',
    copper: '#D4845A',
    sandstone: '#E8A87C',
    driftwood: '#F2C9A3',
    shell: '#FAE6D0',
    connectedLight: '#E8F5EE',
    warningLight: '#FFF5ED',
    errorLight: '#FDE8E8',
    infoLight: '#E6F1FB',
    sand: '#EBE5D5',
    stone: '#C5BFA8',
    slate: '#8A877E',
    charcoal: '#3D3D3A',
  },
  dark: {
    // Paper (lamplight)
    parchment: '#1C1A15',
    agedPaper: '#262219',
    vellum: '#302C24',
    ruledLine: '#3A3530',
    pencil: '#7A7468',
    graphite: '#8A8478',
    fadedInk: '#B5AE9E',
    ironGall: '#C5BEA8',
    ink: '#E5DFD0',
    white: '#E5DFD0',

    // Warm accents
    waxSeal: '#D4845A',
    sealDark: '#B56E45',
    sealLight: '#E8A87C',
    sealWash: '#3A2A1A',

    // Cool accents
    tide: '#5BB5C9',
    shallows: '#2B7A9E',
    mist: '#1A3040',
    deep: '#E0F4F7',

    // Signals
    connected: '#1A3828',
    connectedText: '#6FCF97',
    warning: '#3A2A1A',
    warningText: '#E8A87C',
    error: '#3A1A1A',
    errorText: '#E87C7C',
    info: '#1A3040',
    infoText: '#7CC5E8',

    // Semantic
    background: '#1C1A15',
    backgroundCard: '#262219',
    backgroundSidebar: '#1C1A15',
    border: '#3A3530',
    text: '#E5DFD0',
    textBody: '#B5AE9E',
    textSecondary: '#8A8478',
    textMuted: '#7A7468',
    accent: '#5BB5C9',
    accentWarm: '#D4845A',

    // Backward-compat aliases
    abyss: '#0A1628',
    ocean: '#1A4A6E',
    current: '#5BB5C9',
    foam: '#A8DDE6',
    copper: '#D4845A',
    sandstone: '#E8A87C',
    driftwood: '#F2C9A3',
    shell: '#FAE6D0',
    connectedLight: '#1A3828',
    warningLight: '#3A2A1A',
    errorLight: '#3A1A1A',
    infoLight: '#1A3040',
    sand: '#262219',
    stone: '#3A3530',
    slate: '#7A7468',
    charcoal: '#B5AE9E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    body: 'var(--font-body)',
    rounded: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 960;
