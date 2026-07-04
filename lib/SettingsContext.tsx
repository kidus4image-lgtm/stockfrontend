'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api';

export interface AppSettings {
  withholdPercent: number;
  creditGraceDays: number;
  cashGraceDays: number;
  expiryNotificationDays: number;
  expiryDisplayType: string;
  blockDirectInvoice: boolean;
  companyName: string;
  companyLogo: string;
  companyAddress: string;
  companyPhone: string;
  registrationNumber: string;
  reportAccentColor: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showTin: boolean;
  orientation: 'portrait' | 'landscape';
  footerText: string;
  isDefault: boolean;
}

// Per-component UI color slots — stored in localStorage, applied via CSS variables
export interface UITheme {
  primary: string;     // --ui-primary  → .btn-primary bg, .stat-card::before
  secondary: string;   // --ui-secondary → .btn-secondary border + text
  nav: string;         // --ui-nav       → .nav-item.active color + indicator
  badge: string;       // --ui-badge     → badge/chip backgrounds
  tabIndicator: string;// --ui-tab       → active tab underline
}

export const DEFAULT_UI_THEME: UITheme = {
  primary: '#174f49',
  secondary: '#475569',
  nav: '#38bdf8',
  badge: '#174f49',
  tabIndicator: '#174f49',
};

const UI_THEME_KEY = 'astinka_ui_theme';
const TEMPLATES_KEY = 'astinka_doc_templates';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T;
    return typeof parsed === 'object' && parsed !== null ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const DEFAULT_SETTINGS: AppSettings = {
  withholdPercent: 2.0,
  creditGraceDays: 30,
  cashGraceDays: 3,
  expiryNotificationDays: 60,
  expiryDisplayType: 'long',
  blockDirectInvoice: false,
  companyName: 'Nexlify',
  companyLogo: '',
  companyAddress: '',
  companyPhone: '',
  registrationNumber: '',
  reportAccentColor: '#174f49',
};

interface SettingsContextType {
  settings: AppSettings;
  isLoaded: boolean;
  refreshSettings: () => Promise<void>;
  uiTheme: UITheme;
  updateUITheme: (patch: Partial<UITheme>) => void;
  resetUITheme: (color: string) => void;
  templates: DocumentTemplate[];
  saveTemplate: (t: DocumentTemplate) => void;
  deleteTemplate: (id: string) => void;
  setDefaultTemplate: (id: string) => void;
  getDefaultTemplate: () => DocumentTemplate | null;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  isLoaded: false,
  refreshSettings: async () => {},
  uiTheme: DEFAULT_UI_THEME,
  updateUITheme: () => {},
  resetUITheme: () => {},
  templates: [],
  saveTemplate: () => {},
  deleteTemplate: () => {},
  setDefaultTemplate: () => {},
  getDefaultTemplate: () => null,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [uiTheme, setUITheme] = useState<UITheme>(DEFAULT_UI_THEME);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);

  useEffect(() => {
    setUITheme(loadFromStorage<UITheme>(UI_THEME_KEY, DEFAULT_UI_THEME));
    setTemplates(loadFromStorage<DocumentTemplate[]>(TEMPLATES_KEY, []));
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:5000/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          withholdPercent: data.withholdPercent ?? 2.0,
          creditGraceDays: data.creditGraceDays ?? 30,
          cashGraceDays: data.cashGraceDays ?? 3,
          expiryNotificationDays: data.expiryNotificationDays ?? 60,
          expiryDisplayType: data.expiryDisplayType ?? 'long',
          blockDirectInvoice: data.blockDirectInvoice ?? false,
          companyName: data.companyName || 'Nexlify',
          companyLogo: data.companyLogo || '',
          companyAddress: data.companyAddress || '',
          companyPhone: data.companyPhone || '',
          registrationNumber: data.registrationNumber || '',
          reportAccentColor: data.reportAccentColor || '#174f49',
        });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  const updateUITheme = useCallback((patch: Partial<UITheme>) => {
    setUITheme(prev => {
      const next = { ...prev, ...patch };
      saveToStorage(UI_THEME_KEY, next);
      return next;
    });
  }, []);

  const resetUITheme = useCallback((color: string) => {
    const next: UITheme = { primary: color, secondary: DEFAULT_UI_THEME.secondary, nav: color, badge: color, tabIndicator: color };
    setUITheme(next);
    saveToStorage(UI_THEME_KEY, next);
  }, []);

  const saveTemplate = useCallback((t: DocumentTemplate) => {
    setTemplates(prev => {
      const idx = prev.findIndex(x => x.id === t.id);
      const updated = idx >= 0 ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
      saveToStorage(TEMPLATES_KEY, updated);
      return updated;
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(x => x.id !== id);
      saveToStorage(TEMPLATES_KEY, updated);
      return updated;
    });
  }, []);

  const setDefaultTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.map(x => ({ ...x, isDefault: x.id === id }));
      saveToStorage(TEMPLATES_KEY, updated);
      return updated;
    });
  }, []);

  const getDefaultTemplate = useCallback((): DocumentTemplate | null => {
    return templates.find(t => t.isDefault) ?? templates[0] ?? null;
  }, [templates]);

  return (
    <SettingsContext.Provider value={{
      settings, isLoaded, refreshSettings,
      uiTheme, updateUITheme, resetUITheme,
      templates, saveTemplate, deleteTemplate, setDefaultTemplate, getDefaultTemplate,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
