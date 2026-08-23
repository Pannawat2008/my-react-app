import { useState, useEffect, createContext, useContext } from 'react';

/**
 * Curated Luxury Theme Definitions for AeroBlade Pro.
 * Provides CSS custom properties for dark, light, cyber, glass, and industrial aesthetics.
 */
export const THEMES = {
  ocean: {
    id: 'ocean',
    label: '🌊 Ocean Studio',
    icon: '🌊',
    vars: {
      '--bg-app': '#f0f4f8',
      '--bg-sidebar': '#ffffff',
      '--bg-sidebar-header': 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      '--bg-card': '#f8fafc',
      '--bg-card-hover': '#f0f9ff',
      '--bg-canvas': 'linear-gradient(180deg, #eef2f7 0%, #e4ecf5 100%)',
      '--bg-charts': '#ffffff',
      '--3d-bg': '#eef2f7',
      '--panel-blur': 'none',

      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      '--text-subtle': '#94a3b8',

      '--accent': '#0284c7',
      '--accent-light': '#0ea5e9',
      '--accent-dark': '#0369a1',
      '--accent-bg': '#f0f9ff',
      '--accent-bg-hover': '#e0f2fe',
      '--accent-border': '#bae6fd',
      '--accent-border-light': '#7dd3fc',
      '--accent-gradient': 'linear-gradient(135deg, #0284c7, #0ea5e9)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #0369a1, #0284c7)',
      '--accent-shadow': 'rgba(2, 132, 199, 0.35)',
      '--accent-shadow-light': 'rgba(2, 132, 199, 0.12)',
      '--accent-shadow-strong': 'rgba(2, 132, 199, 0.4)',

      '--logo-gradient': 'linear-gradient(135deg, #0369a1, #0ea5e9)',
      '--logo-shadow': 'rgba(2, 132, 199, 0.3)',

      '--border': '#e2e8f0',
      '--border-light': '#f1f5f9',

      '--shadow-sidebar': '4px 0 24px rgba(15, 23, 42, 0.04)',
      '--shadow-card': '0 2px 8px rgba(0, 0, 0, 0.03)',
      '--shadow-power': '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)',

      '--glass-bg': 'rgba(255, 255, 255, 0.88)',
      '--glass-border': 'rgba(255, 255, 255, 0.6)',

      '--input-bg': '#ffffff',
      '--input-border': '#cbd5e1',
      '--slider-track': '#e2e8f0',
      '--slider-track-hover': '#cbd5e1',

      '--power-gradient-bar': 'linear-gradient(135deg, #0284c7, #06b6d4, #10b981)',
      '--power-stat-bg': 'rgba(248, 250, 252, 0.8)',
      '--power-stat-border': '#f1f5f9',

      '--info-bg': 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      '--info-border': '#bae6fd',
      '--info-text': '#0369a1',

      '--toggle-bg': '#f1f5f9',
      '--toggle-active-bg': '#ffffff',

      '--scrollbar-thumb': '#cbd5e1',
      '--scrollbar-hover': '#94a3b8',

      '--grid-section': '#cbd5e1',
      '--grid-cell': '#e2e8f0',

      '--chart-grid': '#e2e8f0',
      '--chart-tooltip-bg': 'rgba(255, 255, 255, 0.95)',
      '--chart-color-1': '#0284c7',
      '--chart-color-2': '#10b981',
      '--chart-color-3': '#f59e0b',
      '--chart-color-4': '#8b5cf6',

      '--warning-bg': 'rgba(255, 251, 235, 0.95)',
      '--warning-border': '#fbbf24',
      '--warning-border-accent': '#f59e0b',
      '--warning-text': '#92400e',
      '--stall-bg': 'rgba(254, 242, 242, 0.95)',
      '--stall-border': '#fca5a5',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#991b1b',

      '--optimize-gradient': 'linear-gradient(135deg, #0284c7, #06b6d4)',
      '--optimize-progress': 'linear-gradient(90deg, #0284c7, #06b6d4, #10b981)',
      '--overlay-bg': 'rgba(15, 23, 42, 0.35)',
    },
  },

  dark: {
    id: 'dark',
    label: '🌙 Cyber Midnight',
    icon: '🌙',
    vars: {
      '--bg-app': '#090d16',
      '--bg-sidebar': '#0f172a',
      '--bg-sidebar-header': 'linear-gradient(135deg, #0f172a 0%, #17233c 100%)',
      '--bg-card': '#162035',
      '--bg-card-hover': '#1e2c48',
      '--bg-canvas': 'linear-gradient(180deg, #090d16 0%, #0d1322 100%)',
      '--bg-charts': '#0f172a',
      '--3d-bg': '#090d16',
      '--panel-blur': 'none',

      '--text-primary': '#f8fafc',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#94a3b8',
      '--text-subtle': '#64748b',

      '--accent': '#38bdf8',
      '--accent-light': '#7dd3fc',
      '--accent-dark': '#0284c7',
      '--accent-bg': 'rgba(56, 189, 248, 0.12)',
      '--accent-bg-hover': 'rgba(56, 189, 248, 0.22)',
      '--accent-border': 'rgba(56, 189, 248, 0.3)',
      '--accent-border-light': 'rgba(56, 189, 248, 0.5)',
      '--accent-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #0284c7, #0ea5e9)',
      '--accent-shadow': 'rgba(56, 189, 248, 0.4)',
      '--accent-shadow-light': 'rgba(56, 189, 248, 0.15)',
      '--accent-shadow-strong': 'rgba(56, 189, 248, 0.5)',

      '--logo-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--logo-shadow': 'rgba(56, 189, 248, 0.3)',

      '--border': '#1e293b',
      '--border-light': '#334155',

      '--shadow-sidebar': '4px 0 24px rgba(0, 0, 0, 0.5)',
      '--shadow-card': '0 4px 12px rgba(0, 0, 0, 0.3)',
      '--shadow-power': '0 8px 32px rgba(0, 0, 0, 0.6)',

      '--glass-bg': 'rgba(15, 23, 42, 0.88)',
      '--glass-border': 'rgba(255, 255, 255, 0.12)',

      '--input-bg': '#162035',
      '--input-border': '#334155',
      '--slider-track': '#1e293b',
      '--slider-track-hover': '#334155',

      '--power-gradient-bar': 'linear-gradient(135deg, #38bdf8, #06b6d4, #34d399)',
      '--power-stat-bg': 'rgba(22, 32, 53, 0.85)',
      '--power-stat-border': '#1e293b',

      '--info-bg': 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(56, 189, 248, 0.05))',
      '--info-border': 'rgba(56, 189, 248, 0.25)',
      '--info-text': '#7dd3fc',

      '--toggle-bg': '#162035',
      '--toggle-active-bg': '#1e293b',

      '--scrollbar-thumb': '#334155',
      '--scrollbar-hover': '#475569',

      '--grid-section': '#1e293b',
      '--grid-cell': '#0f172a',

      '--chart-grid': '#1e293b',
      '--chart-tooltip-bg': 'rgba(15, 23, 42, 0.95)',
      '--chart-color-1': '#38bdf8',
      '--chart-color-2': '#34d399',
      '--chart-color-3': '#fbbf24',
      '--chart-color-4': '#a78bfa',

      '--warning-bg': 'rgba(120, 90, 20, 0.35)',
      '--warning-border': '#ca8a04',
      '--warning-border-accent': '#eab308',
      '--warning-text': '#fef08a',
      '--stall-bg': 'rgba(120, 30, 30, 0.35)',
      '--stall-border': '#dc2626',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#fca5a5',

      '--optimize-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--optimize-progress': 'linear-gradient(90deg, #0ea5e9, #38bdf8, #34d399)',
      '--overlay-bg': 'rgba(0, 0, 0, 0.7)',
    },
  },

  titanium: {
    id: 'titanium',
    label: '⚙️ Titanium CAD',
    icon: '⚙️',
    vars: {
      '--bg-app': '#1c1e24',
      '--bg-sidebar': '#242730',
      '--bg-sidebar-header': 'linear-gradient(135deg, #242730 0%, #2a2e38 100%)',
      '--bg-card': '#2b2f3a',
      '--bg-card-hover': '#343946',
      '--bg-canvas': 'linear-gradient(180deg, #1c1e24 0%, #20232a 100%)',
      '--bg-charts': '#242730',
      '--3d-bg': '#1c1e24',
      '--panel-blur': 'none',

      '--text-primary': '#f1f5f9',
      '--text-secondary': '#e2e8f0',
      '--text-muted': '#94a3b8',
      '--text-subtle': '#64748b',

      '--accent': '#f97316',
      '--accent-light': '#fb923c',
      '--accent-dark': '#ea580c',
      '--accent-bg': 'rgba(249, 115, 22, 0.15)',
      '--accent-bg-hover': 'rgba(249, 115, 22, 0.25)',
      '--accent-border': 'rgba(249, 115, 22, 0.35)',
      '--accent-border-light': 'rgba(249, 115, 22, 0.55)',
      '--accent-gradient': 'linear-gradient(135deg, #ea580c, #f97316)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #c2410c, #ea580c)',
      '--accent-shadow': 'rgba(249, 115, 22, 0.4)',
      '--accent-shadow-light': 'rgba(249, 115, 22, 0.15)',
      '--accent-shadow-strong': 'rgba(249, 115, 22, 0.5)',

      '--logo-gradient': 'linear-gradient(135deg, #ea580c, #fb923c)',
      '--logo-shadow': 'rgba(249, 115, 22, 0.35)',

      '--border': '#383d4c',
      '--border-light': '#444b5d',

      '--shadow-sidebar': '4px 0 24px rgba(0, 0, 0, 0.4)',
      '--shadow-card': '0 3px 10px rgba(0, 0, 0, 0.25)',
      '--shadow-power': '0 8px 32px rgba(0, 0, 0, 0.5)',

      '--glass-bg': 'rgba(36, 39, 48, 0.9)',
      '--glass-border': 'rgba(255, 255, 255, 0.1)',

      '--input-bg': '#2b2f3a',
      '--input-border': '#444b5d',
      '--slider-track': '#383d4c',
      '--slider-track-hover': '#444b5d',

      '--power-gradient-bar': 'linear-gradient(135deg, #f97316, #fbbf24, #10b981)',
      '--power-stat-bg': 'rgba(43, 47, 58, 0.85)',
      '--power-stat-border': '#383d4c',

      '--info-bg': 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(249, 115, 22, 0.05))',
      '--info-border': 'rgba(249, 115, 22, 0.25)',
      '--info-text': '#fdba74',

      '--toggle-bg': '#2b2f3a',
      '--toggle-active-bg': '#383d4c',

      '--scrollbar-thumb': '#444b5d',
      '--scrollbar-hover': '#586177',

      '--grid-section': '#383d4c',
      '--grid-cell': '#242730',

      '--chart-grid': '#383d4c',
      '--chart-tooltip-bg': 'rgba(36, 39, 48, 0.95)',
      '--chart-color-1': '#f97316',
      '--chart-color-2': '#38bdf8',
      '--chart-color-3': '#10b981',
      '--chart-color-4': '#fbbf24',

      '--warning-bg': 'rgba(120, 90, 20, 0.35)',
      '--warning-border': '#ca8a04',
      '--warning-border-accent': '#eab308',
      '--warning-text': '#fef08a',
      '--stall-bg': 'rgba(120, 30, 30, 0.35)',
      '--stall-border': '#dc2626',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#fca5a5',

      '--optimize-gradient': 'linear-gradient(135deg, #ea580c, #f97316)',
      '--optimize-progress': 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
      '--overlay-bg': 'rgba(0, 0, 0, 0.65)',
    },
  },

  sage: {
    id: 'sage',
    label: '🌿 Warm Sage',
    icon: '🌿',
    vars: {
      '--bg-app': '#e8e4dc',
      '--bg-sidebar': '#d5d0c4',
      '--bg-sidebar-header': 'linear-gradient(135deg, #d5d0c4 0%, #ccc7ba 100%)',
      '--bg-card': '#dddad1',
      '--bg-card-hover': '#d1cec3',
      '--bg-canvas': 'linear-gradient(180deg, #e5e1d8 0%, #ddd9cf 100%)',
      '--bg-charts': '#ded9cf',
      '--3d-bg': '#e5e1d8',
      '--panel-blur': 'none',

      '--text-primary': '#2d2a23',
      '--text-secondary': '#3d3930',
      '--text-muted': '#6b6558',
      '--text-subtle': '#8a8475',

      '--accent': '#6b7c4e',
      '--accent-light': '#819a5c',
      '--accent-dark': '#566440',
      '--accent-bg': '#e8ecd9',
      '--accent-bg-hover': '#dce2cc',
      '--accent-border': '#b5c394',
      '--accent-border-light': '#9bab78',
      '--accent-gradient': 'linear-gradient(135deg, #6b7c4e, #819a5c)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #566440, #6b7c4e)',
      '--accent-shadow': 'rgba(107, 124, 78, 0.35)',
      '--accent-shadow-light': 'rgba(107, 124, 78, 0.12)',
      '--accent-shadow-strong': 'rgba(107, 124, 78, 0.4)',

      '--logo-gradient': 'linear-gradient(135deg, #566440, #819a5c)',
      '--logo-shadow': 'rgba(107, 124, 78, 0.3)',

      '--border': '#c5c0b5',
      '--border-light': '#d5d0c6',

      '--shadow-sidebar': '4px 0 24px rgba(45, 42, 35, 0.06)',
      '--shadow-card': '0 2px 8px rgba(45, 42, 35, 0.04)',
      '--shadow-power': '0 8px 32px rgba(45, 42, 35, 0.1), 0 2px 8px rgba(45, 42, 35, 0.05)',

      '--glass-bg': 'rgba(222, 217, 207, 0.88)',
      '--glass-border': 'rgba(255, 255, 255, 0.35)',

      '--input-bg': '#e8e4da',
      '--input-border': '#b8b3a6',
      '--slider-track': '#c8c3b7',
      '--slider-track-hover': '#b8b3a6',

      '--power-gradient-bar': 'linear-gradient(135deg, #6b7c4e, #819a5c, #a3b87a)',
      '--power-stat-bg': 'rgba(213, 208, 196, 0.8)',
      '--power-stat-border': '#c5c0b5',

      '--info-bg': 'linear-gradient(135deg, #e8ecd9, #dce2cc)',
      '--info-border': '#b5c394',
      '--info-text': '#566440',

      '--toggle-bg': '#cac5b8',
      '--toggle-active-bg': '#e2ded5',

      '--scrollbar-thumb': '#b8b3a6',
      '--scrollbar-hover': '#9a957f',

      '--grid-section': '#c5c0b5',
      '--grid-cell': '#d5d0c4',

      '--chart-grid': '#c8c3b7',
      '--chart-tooltip-bg': 'rgba(222, 217, 207, 0.95)',
      '--chart-color-1': '#6b7c4e',
      '--chart-color-2': '#0284c7',
      '--chart-color-3': '#d97706',
      '--chart-color-4': '#7c3aed',

      '--warning-bg': 'rgba(255, 251, 235, 0.95)',
      '--warning-border': '#d4a843',
      '--warning-border-accent': '#c4962e',
      '--warning-text': '#7a5c14',
      '--stall-bg': 'rgba(254, 242, 242, 0.95)',
      '--stall-border': '#d4827a',
      '--stall-border-accent': '#c4574e',
      '--stall-text': '#7a1d15',

      '--optimize-gradient': 'linear-gradient(135deg, #6b7c4e, #819a5c)',
      '--optimize-progress': 'linear-gradient(90deg, #6b7c4e, #819a5c, #a3b87a)',
      '--overlay-bg': 'rgba(45, 42, 35, 0.3)',
    },
  },

  iosGlass: {
    id: 'iosGlass',
    label: '✨ Liquid Glass',
    icon: '✨',
    vars: {
      '--bg-app': 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
      '--bg-sidebar': 'rgba(255, 255, 255, 0.55)',
      '--bg-sidebar-header': 'rgba(255, 255, 255, 0.3)',
      '--bg-card': 'rgba(255, 255, 255, 0.6)',
      '--bg-card-hover': 'rgba(255, 255, 255, 0.8)',
      '--bg-canvas': 'transparent',
      '--bg-charts': 'rgba(255, 255, 255, 0.55)',
      '--3d-bg': '#e0c3fc',
      '--panel-blur': 'blur(28px)',

      '--text-primary': '#1e293b',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      '--text-subtle': '#94a3b8',

      '--accent': '#0284c7',
      '--accent-light': '#38bdf8',
      '--accent-dark': '#0369a1',
      '--accent-bg': 'rgba(2, 132, 199, 0.15)',
      '--accent-bg-hover': 'rgba(2, 132, 199, 0.25)',
      '--accent-border': 'rgba(2, 132, 199, 0.3)',
      '--accent-border-light': 'rgba(2, 132, 199, 0.5)',
      '--accent-gradient': 'linear-gradient(135deg, #0284c7, #38bdf8)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #0369a1, #0284c7)',
      '--accent-shadow': 'rgba(2, 132, 199, 0.35)',
      '--accent-shadow-light': 'rgba(2, 132, 199, 0.15)',
      '--accent-shadow-strong': 'rgba(2, 132, 199, 0.45)',

      '--logo-gradient': 'linear-gradient(135deg, #8b5cf6, #0284c7)',
      '--logo-shadow': 'rgba(139, 92, 246, 0.3)',

      '--border': 'rgba(255, 255, 255, 0.5)',
      '--border-light': 'rgba(255, 255, 255, 0.3)',

      '--shadow-sidebar': '0 8px 32px rgba(0, 0, 0, 0.08)',
      '--shadow-card': '0 4px 16px rgba(0, 0, 0, 0.04)',
      '--shadow-power': '0 8px 32px rgba(0, 0, 0, 0.1)',

      '--glass-bg': 'rgba(255, 255, 255, 0.55)',
      '--glass-border': 'rgba(255, 255, 255, 0.7)',

      '--input-bg': 'rgba(255, 255, 255, 0.7)',
      '--input-border': 'rgba(255, 255, 255, 0.85)',
      '--slider-track': 'rgba(0, 0, 0, 0.1)',
      '--slider-track-hover': 'rgba(0, 0, 0, 0.18)',

      '--power-gradient-bar': 'linear-gradient(135deg, #8b5cf6, #0284c7, #10b981)',
      '--power-stat-bg': 'rgba(255, 255, 255, 0.65)',
      '--power-stat-border': 'rgba(255, 255, 255, 0.5)',

      '--info-bg': 'rgba(2, 132, 199, 0.12)',
      '--info-border': 'rgba(2, 132, 199, 0.25)',
      '--info-text': '#0369a1',

      '--toggle-bg': 'rgba(0, 0, 0, 0.08)',
      '--toggle-active-bg': 'rgba(255, 255, 255, 0.9)',

      '--scrollbar-thumb': 'rgba(0, 0, 0, 0.2)',
      '--scrollbar-hover': 'rgba(0, 0, 0, 0.35)',

      '--grid-section': 'rgba(0, 0, 0, 0.15)',
      '--grid-cell': 'rgba(0, 0, 0, 0.05)',

      '--chart-grid': 'rgba(0, 0, 0, 0.1)',
      '--chart-tooltip-bg': 'rgba(255, 255, 255, 0.92)',
      '--chart-color-1': '#0284c7',
      '--chart-color-2': '#8b5cf6',
      '--chart-color-3': '#10b981',
      '--chart-color-4': '#f59e0b',

      '--warning-bg': 'rgba(255, 251, 235, 0.9)',
      '--warning-border': '#fbbf24',
      '--warning-border-accent': '#f59e0b',
      '--warning-text': '#92400e',
      '--stall-bg': 'rgba(254, 242, 242, 0.9)',
      '--stall-border': '#fca5a5',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#991b1b',

      '--optimize-gradient': 'linear-gradient(135deg, #0284c7, #8b5cf6)',
      '--optimize-progress': 'linear-gradient(90deg, #0284c7, #8b5cf6, #10b981)',
      '--overlay-bg': 'rgba(255, 255, 255, 0.4)',
    },
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('aeroblade-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const theme = THEMES[themeId] || THEMES.dark;
    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    try {
      localStorage.setItem('aeroblade-theme', themeId);
    } catch {
      /* ignore */
    }
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES, currentTheme: THEMES[themeId] || THEMES.dark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
