import { useState, useEffect, createContext, useContext } from 'react';

/**
 * Theme definitions for AeroBlade Pro.
 * Each theme maps CSS custom properties to values.
 */
export const THEMES = {
  ocean: {
    id: 'ocean',
    label: '🌊 Ocean Blue',
    icon: '🌊',
    vars: {
      /* ── Base ── */
      '--bg-app': '#f0f4f8',
      '--bg-sidebar': '#ffffff',
      '--bg-sidebar-header': 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      '--bg-card': '#f8fafc',
      '--bg-card-hover': '#f0f9ff',
      '--bg-canvas': 'linear-gradient(180deg, #eef2f7 0%, #e4ecf5 100%)',
      '--bg-charts': '#ffffff',
      '--3d-bg': '#eef2f7',

      /* ── Text ── */
      '--text-primary': '#0f172a',
      '--text-secondary': '#1e293b',
      '--text-muted': '#64748b',
      '--text-subtle': '#94a3b8',

      /* ── Accent ── */
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

      /* ── Logo ── */
      '--logo-gradient': 'linear-gradient(135deg, #0369a1, #0ea5e9)',
      '--logo-shadow': 'rgba(2, 132, 199, 0.3)',

      /* ── Borders ── */
      '--border': '#e2e8f0',
      '--border-light': '#f1f5f9',

      /* ── Shadows ── */
      '--shadow-sidebar': '4px 0 24px rgba(15, 23, 42, 0.04)',
      '--shadow-card': '0 2px 8px rgba(0, 0, 0, 0.03)',
      '--shadow-power': '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)',

      /* ── Glass ── */
      '--glass-bg': 'rgba(255, 255, 255, 0.82)',
      '--glass-border': 'rgba(255, 255, 255, 0.5)',

      /* ── Inputs ── */
      '--input-bg': '#ffffff',
      '--input-border': '#cbd5e1',
      '--slider-track': '#e2e8f0',
      '--slider-track-hover': '#cbd5e1',

      /* ── Power Card ── */
      '--power-gradient-bar': 'linear-gradient(135deg, #0284c7, #06b6d4, #10b981)',
      '--power-stat-bg': 'rgba(248, 250, 252, 0.8)',
      '--power-stat-border': '#f1f5f9',

      /* ── Info Box ── */
      '--info-bg': 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
      '--info-border': '#bae6fd',
      '--info-text': '#0369a1',

      /* ── Planform Toggle ── */
      '--toggle-bg': '#f1f5f9',
      '--toggle-active-bg': '#fff',

      /* ── Scrollbar ── */
      '--scrollbar-thumb': '#cbd5e1',
      '--scrollbar-hover': '#94a3b8',

      /* ── Grid ── */
      '--grid-section': '#cbd5e1',
      '--grid-cell': '#e2e8f0',

      /* ── Charts ── */
      '--chart-grid': '#e2e8f0',
      '--chart-tooltip-bg': 'rgba(255, 255, 255, 0.95)',

      /* ── Warning ── */
      '--warning-bg': 'rgba(255, 251, 235, 0.95)',
      '--warning-border': '#fbbf24',
      '--warning-border-accent': '#f59e0b',
      '--warning-text': '#92400e',
      '--stall-bg': 'rgba(254, 242, 242, 0.95)',
      '--stall-border': '#fca5a5',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#991b1b',

      /* ── Optimize ── */
      '--optimize-gradient': 'linear-gradient(135deg, #0284c7, #06b6d4)',
      '--optimize-progress': 'linear-gradient(90deg, #0284c7, #06b6d4, #10b981)',
      '--overlay-bg': 'rgba(15, 23, 42, 0.3)',
    },
  },

  sage: {
    id: 'sage',
    label: '🌿 Warm Sage',
    icon: '🌿',
    vars: {
      /* ── Base ── */
      '--bg-app': '#e8e4dc',
      '--bg-sidebar': '#d5d0c4',
      '--bg-sidebar-header': 'linear-gradient(135deg, #d5d0c4 0%, #ccc7ba 100%)',
      '--bg-card': '#dddad1',
      '--bg-card-hover': '#d1cec3',
      '--bg-canvas': 'linear-gradient(180deg, #e5e1d8 0%, #ddd9cf 100%)',
      '--bg-charts': '#ded9cf',
      '--3d-bg': '#e5e1d8',

      /* ── Text ── */
      '--text-primary': '#2d2a23',
      '--text-secondary': '#3d3930',
      '--text-muted': '#6b6558',
      '--text-subtle': '#8a8475',

      /* ── Accent ── */
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

      /* ── Logo ── */
      '--logo-gradient': 'linear-gradient(135deg, #566440, #819a5c)',
      '--logo-shadow': 'rgba(107, 124, 78, 0.3)',

      /* ── Borders ── */
      '--border': '#c5c0b5',
      '--border-light': '#d5d0c6',

      /* ── Shadows ── */
      '--shadow-sidebar': '4px 0 24px rgba(45, 42, 35, 0.06)',
      '--shadow-card': '0 2px 8px rgba(45, 42, 35, 0.04)',
      '--shadow-power': '0 8px 32px rgba(45, 42, 35, 0.1), 0 2px 8px rgba(45, 42, 35, 0.05)',

      /* ── Glass ── */
      '--glass-bg': 'rgba(222, 217, 207, 0.85)',
      '--glass-border': 'rgba(255, 255, 255, 0.35)',

      /* ── Inputs ── */
      '--input-bg': '#e8e4da',
      '--input-border': '#b8b3a6',
      '--slider-track': '#c8c3b7',
      '--slider-track-hover': '#b8b3a6',

      /* ── Power Card ── */
      '--power-gradient-bar': 'linear-gradient(135deg, #6b7c4e, #819a5c, #a3b87a)',
      '--power-stat-bg': 'rgba(213, 208, 196, 0.8)',
      '--power-stat-border': '#c5c0b5',

      /* ── Info Box ── */
      '--info-bg': 'linear-gradient(135deg, #e8ecd9, #dce2cc)',
      '--info-border': '#b5c394',
      '--info-text': '#566440',

      /* ── Planform Toggle ── */
      '--toggle-bg': '#cac5b8',
      '--toggle-active-bg': '#e2ded5',

      /* ── Scrollbar ── */
      '--scrollbar-thumb': '#b8b3a6',
      '--scrollbar-hover': '#9a957f',

      /* ── Grid ── */
      '--grid-section': '#c5c0b5',
      '--grid-cell': '#d5d0c4',

      /* ── Charts ── */
      '--chart-grid': '#c8c3b7',
      '--chart-tooltip-bg': 'rgba(222, 217, 207, 0.95)',

      /* ── Warning ── */
      '--warning-bg': 'rgba(255, 251, 235, 0.95)',
      '--warning-border': '#d4a843',
      '--warning-border-accent': '#c4962e',
      '--warning-text': '#7a5c14',
      '--stall-bg': 'rgba(254, 242, 242, 0.95)',
      '--stall-border': '#d4827a',
      '--stall-border-accent': '#c4574e',
      '--stall-text': '#7a1d15',

      /* ── Optimize ── */
      '--optimize-gradient': 'linear-gradient(135deg, #6b7c4e, #819a5c)',
      '--optimize-progress': 'linear-gradient(90deg, #6b7c4e, #819a5c, #a3b87a)',
      '--overlay-bg': 'rgba(45, 42, 35, 0.3)',
    },
  },

  dark: {
    id: 'dark',
    label: '🌙 Midnight Dark',
    icon: '🌙',
    vars: {
      /* ── Base ── */
      '--bg-app': '#0f1219',
      '--bg-sidebar': '#161b26',
      '--bg-sidebar-header': 'linear-gradient(135deg, #161b26 0%, #1a2030 100%)',
      '--bg-card': '#1a2030',
      '--bg-card-hover': '#212840',
      '--bg-canvas': 'linear-gradient(180deg, #0f1219 0%, #131824 100%)',
      '--bg-charts': '#161b26',
      '--3d-bg': '#0f1219',

      /* ── Text ── */
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#cbd5e1',
      '--text-muted': '#8892a4',
      '--text-subtle': '#64748b',

      /* ── Accent ── */
      '--accent': '#38bdf8',
      '--accent-light': '#7dd3fc',
      '--accent-dark': '#0ea5e9',
      '--accent-bg': 'rgba(56, 189, 248, 0.08)',
      '--accent-bg-hover': 'rgba(56, 189, 248, 0.14)',
      '--accent-border': 'rgba(56, 189, 248, 0.25)',
      '--accent-border-light': 'rgba(56, 189, 248, 0.4)',
      '--accent-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #0284c7, #0ea5e9)',
      '--accent-shadow': 'rgba(56, 189, 248, 0.3)',
      '--accent-shadow-light': 'rgba(56, 189, 248, 0.1)',
      '--accent-shadow-strong': 'rgba(56, 189, 248, 0.35)',

      /* ── Logo ── */
      '--logo-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--logo-shadow': 'rgba(56, 189, 248, 0.3)',

      /* ── Borders ── */
      '--border': '#252d3d',
      '--border-light': '#1e2636',

      /* ── Shadows ── */
      '--shadow-sidebar': '4px 0 24px rgba(0, 0, 0, 0.3)',
      '--shadow-card': '0 2px 8px rgba(0, 0, 0, 0.2)',
      '--shadow-power': '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)',

      /* ── Glass ── */
      '--glass-bg': 'rgba(22, 27, 38, 0.85)',
      '--glass-border': 'rgba(255, 255, 255, 0.08)',

      /* ── Inputs ── */
      '--input-bg': '#1a2030',
      '--input-border': '#2d3650',
      '--slider-track': '#252d3d',
      '--slider-track-hover': '#2d3650',

      /* ── Power Card ── */
      '--power-gradient-bar': 'linear-gradient(135deg, #0ea5e9, #06b6d4, #10b981)',
      '--power-stat-bg': 'rgba(26, 32, 48, 0.8)',
      '--power-stat-border': '#252d3d',

      /* ── Info Box ── */
      '--info-bg': 'linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(56, 189, 248, 0.04))',
      '--info-border': 'rgba(56, 189, 248, 0.2)',
      '--info-text': '#7dd3fc',

      /* ── Planform Toggle ── */
      '--toggle-bg': '#1a2030',
      '--toggle-active-bg': '#252d3d',

      /* ── Scrollbar ── */
      '--scrollbar-thumb': '#2d3650',
      '--scrollbar-hover': '#3d4a6a',

      /* ── Grid ── */
      '--grid-section': '#252d3d',
      '--grid-cell': '#1e2636',

      /* ── Charts ── */
      '--chart-grid': '#252d3d',
      '--chart-tooltip-bg': 'rgba(22, 27, 38, 0.95)',

      /* ── Warning ── */
      '--warning-bg': 'rgba(120, 90, 20, 0.2)',
      '--warning-border': '#ca8a04',
      '--warning-border-accent': '#eab308',
      '--warning-text': '#fde68a',
      '--stall-bg': 'rgba(120, 30, 30, 0.2)',
      '--stall-border': '#dc2626',
      '--stall-border-accent': '#ef4444',
      '--stall-text': '#fca5a5',

      /* ── Optimize ── */
      '--optimize-gradient': 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
      '--optimize-progress': 'linear-gradient(90deg, #0ea5e9, #38bdf8, #34d399)',
      '--overlay-bg': 'rgba(0, 0, 0, 0.5)',
    },
  },
  iosGlass: {
    id: 'iosGlass',
    label: '✨ Liquid Glass',
    icon: '✨',
    vars: {
      /* ── Base ── */
      '--bg-app': 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
      '--bg-sidebar': 'rgba(255, 255, 255, 0.45)',
      '--bg-sidebar-header': 'rgba(255, 255, 255, 0.2)',
      '--bg-card': 'rgba(255, 255, 255, 0.5)',
      '--bg-card-hover': 'rgba(255, 255, 255, 0.7)',
      '--bg-canvas': 'transparent',
      '--bg-charts': 'rgba(255, 255, 255, 0.45)',
      '--3d-bg': '#fbc2eb',
      '--panel-blur': 'blur(24px)',

      /* ── Text ── */
      '--text-primary': '#1d1d1f',
      '--text-secondary': '#333336',
      '--text-muted': '#55555a',
      '--text-subtle': '#86868b',

      /* ── Accent ── */
      '--accent': '#007aff',
      '--accent-light': '#5ac8fa',
      '--accent-dark': '#0058b0',
      '--accent-bg': 'rgba(0, 122, 255, 0.15)',
      '--accent-bg-hover': 'rgba(0, 122, 255, 0.25)',
      '--accent-border': 'rgba(0, 122, 255, 0.3)',
      '--accent-border-light': 'rgba(0, 122, 255, 0.5)',
      '--accent-gradient': 'linear-gradient(135deg, #007aff, #5ac8fa)',
      '--accent-gradient-dark': 'linear-gradient(135deg, #0058b0, #007aff)',
      '--accent-shadow': 'rgba(0, 122, 255, 0.35)',
      '--accent-shadow-light': 'rgba(0, 122, 255, 0.15)',
      '--accent-shadow-strong': 'rgba(0, 122, 255, 0.45)',

      /* ── Logo ── */
      '--logo-gradient': 'linear-gradient(135deg, #ff2d55, #007aff)',
      '--logo-shadow': 'rgba(255, 45, 85, 0.3)',

      /* ── Borders ── */
      '--border': 'rgba(255, 255, 255, 0.4)',
      '--border-light': 'rgba(255, 255, 255, 0.2)',

      /* ── Shadows ── */
      '--shadow-sidebar': '0 8px 32px rgba(0, 0, 0, 0.1)',
      '--shadow-card': '0 4px 16px rgba(0, 0, 0, 0.05)',
      '--shadow-power': '0 8px 32px rgba(0, 0, 0, 0.1)',

      /* ── Glass ── */
      '--glass-bg': 'rgba(255, 255, 255, 0.45)',
      '--glass-border': 'rgba(255, 255, 255, 0.6)',

      /* ── Inputs ── */
      '--input-bg': 'rgba(255, 255, 255, 0.6)',
      '--input-border': 'rgba(255, 255, 255, 0.8)',
      '--slider-track': 'rgba(0, 0, 0, 0.08)',
      '--slider-track-hover': 'rgba(0, 0, 0, 0.15)',

      /* ── Power Card ── */
      '--power-gradient-bar': 'linear-gradient(135deg, #ff2d55, #ff9500, #ffcc00)',
      '--power-stat-bg': 'rgba(255, 255, 255, 0.5)',
      '--power-stat-border': 'rgba(255, 255, 255, 0.4)',

      /* ── Info Box ── */
      '--info-bg': 'rgba(0, 122, 255, 0.12)',
      '--info-border': 'rgba(0, 122, 255, 0.25)',
      '--info-text': '#0058b0',

      /* ── Planform Toggle ── */
      '--toggle-bg': 'rgba(0, 0, 0, 0.08)',
      '--toggle-active-bg': 'rgba(255, 255, 255, 0.85)',

      /* ── Scrollbar ── */
      '--scrollbar-thumb': 'rgba(0, 0, 0, 0.2)',
      '--scrollbar-hover': 'rgba(0, 0, 0, 0.35)',

      /* ── Grid ── */
      '--grid-section': 'rgba(0, 0, 0, 0.15)',
      '--grid-cell': 'rgba(0, 0, 0, 0.05)',

      /* ── Charts ── */
      '--chart-grid': 'rgba(0, 0, 0, 0.1)',
      '--chart-tooltip-bg': 'rgba(255, 255, 255, 0.85)',

      /* ── Warning ── */
      '--warning-bg': 'rgba(255, 204, 0, 0.25)',
      '--warning-border': '#ffcc00',
      '--warning-border-accent': '#ff9500',
      '--warning-text': '#804a00',
      '--stall-bg': 'rgba(255, 59, 48, 0.25)',
      '--stall-border': '#ff3b30',
      '--stall-border-accent': '#d70015',
      '--stall-text': '#8a000d',

      /* ── Optimize ── */
      '--optimize-gradient': 'linear-gradient(135deg, #007aff, #34c759)',
      '--optimize-progress': 'linear-gradient(90deg, #007aff, #5856d6, #ff2d55)',
      '--overlay-bg': 'rgba(255, 255, 255, 0.35)',
    },
  },
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem('aeroblade-theme') || 'ocean';
    } catch {
      return 'ocean';
    }
  });

  useEffect(() => {
    const theme = THEMES[themeId];
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    try {
      localStorage.setItem('aeroblade-theme', themeId);
    } catch { /* ignore */ }
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
