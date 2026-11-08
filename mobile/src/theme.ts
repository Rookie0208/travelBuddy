export const colors = {
  bg: '#F8F9FA',
  card: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  line: '#E2E8F0',
  lineLight: '#F1F5F9',
  
  // Velto Signature Palette: Forest Green + Electric Volt
  primary: '#0D382A',        // Deep Velto Forest Green
  primaryDark: '#08251C',
  primaryLight: '#165B45',
  primarySoft: '#E8F5EF',
  
  volt: '#D4FF00',           // Electric Volt Accent
  voltDark: '#9EB800',
  voltSoft: '#F6FFD1',
  voltText: '#1A2902',
  
  forest: '#0A1813',         // Ultra-dark emerald/forest
  forestCard: '#132820',
  forestBorder: '#203E33',

  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerSoft: '#FEE2E2',
  good: '#10B981',
  goodSoft: '#D1FAE5',
  warn: '#F59E0B',
  warnSoft: '#FEF3C7',
  accent: '#3B82F6',
  accentSoft: '#EFF6FF',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 14, lg: 20, xl: 28, full: 999 };

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#091A14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  glow: {
    shadowColor: '#D4FF00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
};

export const type = {
  largeTitle: { fontSize: 32, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 },
  subheading: { fontSize: 15, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  caption: { fontSize: 11, color: colors.subtle, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};
