/**
 * LivedPulse Color System
 * Ported from web index.css @theme variables
 */
export const colors = {
  // Dark palette
  dark900: '#0a0e1a',
  dark800: '#111827',
  dark700: '#1a2035',
  dark600: '#243049',
  dark500: '#374766',

  // Accent
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDim: '#4f46e5',

  // Semantic
  positive: '#22c55e',
  negative: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  // Slate
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  white: '#ffffff',

  // Glass panel equivalent
  glassBg: 'rgba(17,24,39,0.9)',
  glassBorder: 'rgba(55,71,102,0.5)',

  // Gradients (start, end)
  gradientAccent: ['#6366f1', '#7c3aed'] as const,
  gradientGold: ['#f59e0b', '#eab308'] as const,
  gradientPositive: ['#22c55e', '#16a34a'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  title: 28,
} as const;
