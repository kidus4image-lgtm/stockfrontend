'use client';

import { useEffect } from 'react';
import { SettingsProvider, useSettings } from '../lib/SettingsContext';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

function lighten(hex: string, amount = 20): string {
  const [r, g, b] = hexToRgb(hex);
  const lr = Math.min(255, r + amount).toString(16).padStart(2, '0');
  const lg = Math.min(255, g + amount).toString(16).padStart(2, '0');
  const lb = Math.min(255, b + amount).toString(16).padStart(2, '0');
  return `#${lr}${lg}${lb}`;
}

function ThemeApplier() {
  const { uiTheme, settings } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    const isValidHex = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h);

    // ── Primary (btn-primary, stat-card, main brand) ──
    const primary = isValidHex(uiTheme.primary) ? uiTheme.primary : '#174f49';
    const [pr, pg, pb] = hexToRgb(primary);
    root.style.setProperty('--ui-primary', primary);
    root.style.setProperty('--accent-color', primary);   // backward compat
    root.style.setProperty('--accent', primary);          // backward compat
    root.style.setProperty('--accent-glow', `rgba(${pr},${pg},${pb},0.3)`);
    root.style.setProperty('--accent-hover', lighten(primary, 18));

    // ── Secondary (btn-secondary outline) ──
    const secondary = isValidHex(uiTheme.secondary) ? uiTheme.secondary : '#475569';
    const [sr, sg, sb] = hexToRgb(secondary);
    root.style.setProperty('--ui-secondary', secondary);
    root.style.setProperty('--ui-secondary-bg', `rgba(${sr},${sg},${sb},0.1)`);

    // ── Navigation active (sidebar) ──
    const nav = isValidHex(uiTheme.nav) ? uiTheme.nav : '#38bdf8';
    const [nr, ng, nb] = hexToRgb(nav);
    root.style.setProperty('--ui-nav', nav);
    root.style.setProperty('--ui-nav-bg', `rgba(${nr},${ng},${nb},0.08)`);
    root.style.setProperty('--ui-nav-border', `rgba(${nr},${ng},${nb},0.15)`);

    // ── Badge / chip ──
    const badge = isValidHex(uiTheme.badge) ? uiTheme.badge : primary;
    const [br, bg, bb] = hexToRgb(badge);
    root.style.setProperty('--ui-badge', badge);
    root.style.setProperty('--ui-badge-bg', `rgba(${br},${bg},${bb},0.15)`);

    // ── Tab indicator ──
    const tab = isValidHex(uiTheme.tabIndicator) ? uiTheme.tabIndicator : primary;
    root.style.setProperty('--ui-tab', tab);

    // ── Report export color stays in settings.reportAccentColor ──
    // (used by exportUtils — not a CSS var, injected into PDF directly)

  }, [uiTheme, settings.reportAccentColor]);

  return null;
}

export default function SettingsProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ThemeApplier />
      {children}
    </SettingsProvider>
  );
}
