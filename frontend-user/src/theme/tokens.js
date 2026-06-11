// v2 design tokens — mirror of the CSS variables in index.css.
//
// Use these for inline `style={{...}}` props in React components where you'd
// otherwise hard-code a hex. The CSS variables in index.css remain the source
// of truth — keep both files in sync. To retheme: edit index.css :root tokens
// AND this file.
//
// In JSX:
//   import { C } from '../theme/tokens';
//   <div style={{ background: C.surface, color: C.textPrimary }} />
//
// In CSS:
//   .foo { background: var(--v2-surface); color: var(--v2-text-primary); }

export const C = {
  // Surfaces
  bg:              '#f6f7fb',
  surface:         '#ffffff',
  surfaceHover:    '#f9fafc',
  border:          '#e3e7ed',
  borderStrong:    '#cfd5dd',

  // Text
  textPrimary:     '#1f2937',
  textSecondary:   '#4b5563',
  textMuted:       '#9ca3af',
  textInverse:     '#ffffff',

  // Brand accent (CTA blue)
  accent:          '#2563eb',
  accentHover:     '#1d4ed8',
  accentSoft:      '#dbeafe',
  accentSoft2:     '#eff6ff',

  // CTA red
  red:             '#dc2626',
  redHover:        '#b91c1c',
  redSoft:         '#fee2e2',

  // Status
  green:           '#16a34a',
  greenSoft:       '#dcfce7',
  orange:          '#f59e0b',
  orangeText:      '#b45309',
  orangeSoft:      '#fef3c7',
  yellowSoft:      '#fef9c3',
  purple:          '#7c3aed',
  purpleSoft:      '#ede9fe',
  indigo:          '#6366f1',
  indigoSoft:      '#e0e7ff',

  // Hero gradient
  gradBlue:        '#1e40af',
  gradIndigo:      '#6366f1',
  gradPink:        '#ec4899',
  gradHero:        'linear-gradient(120deg, #1e40af 0%, #6366f1 55%, #ec4899 100%)',

  // Dark card
  darkSurface:     '#0f172a',
  darkText:        '#ffffff',
  darkTextMuted:   'rgba(255, 255, 255, 0.6)',
  darkAccent:      '#a5b4fc',

  // Radii
  radiusSm:        6,
  radius:          10,
  radiusLg:        12,
  radiusXl:        14,
  radiusPill:      999,

  // Shadows
  shadowSm:        '0 1px 2px rgba(15, 23, 42, 0.05)',
  shadow:          '0 4px 12px rgba(15, 23, 42, 0.06)',
  shadowLg:        '0 12px 36px rgba(15, 23, 42, 0.12)',
  shadowCta:       '0 6px 14px rgba(220, 38, 38, 0.25)',

  // Spacing
  space1: 4, space2: 8, space3: 12, space4: 16, space5: 20, space6: 24, space8: 32,

  // Sidebar / topbar
  sidebarWidth:    240,
  topbarHeight:    68,

  // Motion
  transition:      'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
  transitionFast:  'all 0.12s ease',
};

// Breakpoints (matches index.css media queries — keep in sync)
export const BP = {
  mobile:  640,   // ≤640 = mobile
  tablet:  1024,  // 641-1024 = tablet
  // >1024 = desktop
};

// Font family used everywhere
export const FONT_STACK = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
