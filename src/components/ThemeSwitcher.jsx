import React from 'react';
import { useTheme, THEMES } from '../hooks/useTheme';

export default function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();

  return (
    <div className="theme-switcher">
      <div className="theme-switcher-label">Theme</div>
      <div className="theme-switcher-options">
        {Object.values(THEMES).map((theme) => (
          <button
            key={theme.id}
            className={`theme-option ${themeId === theme.id ? 'active' : ''}`}
            onClick={() => setThemeId(theme.id)}
            title={theme.label}
          >
            <span className="theme-option-icon">{theme.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
