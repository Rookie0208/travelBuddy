export const colors = {
  bg: '#F7F6F2',
  card: '#FFFFFF',
  ink: '#19212C',
  muted: '#667080',
  subtle: '#94A3B8',
  line: '#E7E4DC',
  lineLight: '#F1EFEB',
  primary: '#0D6858',
  primaryDark: '#08483D',
  primaryLight: '#148A76',
  primarySoft: '#E3F2EE',
  danger: '#B3261E',
  dangerDark: '#8F1D16',
  dangerSoft: '#FDECEB',
  good: '#0C7E4F',
  goodSoft: '#E1F6ED',
  warn: '#8A5800',
  warnSoft: '#FFF3DB',
  accent: '#2563EB',
  accentSoft: '#EFF6FF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 14, lg: 18, xl: 24, full: 999 };

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const type = {
  largeTitle: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  subheading: { fontSize: 15, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  caption: { fontSize: 11, color: colors.subtle, fontWeight: '600' as const, letterSpacing: 0.3 },
};
