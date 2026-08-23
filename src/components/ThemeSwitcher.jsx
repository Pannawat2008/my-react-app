import { useTheme } from '../hooks/useTheme';

export default function ThemeSwitcher() {
  const { themeId, setThemeId, themes } = useTheme();

  return (
    <div className="theme-switcher">
      <div className="theme-switcher-options">
        {Object.values(themes).map((t) => (
          <button
            key={t.id}
            className={`theme-option ${themeId === t.id ? 'active' : ''}`}
            onClick={() => setThemeId(t.id)}
            title={t.label}
            aria-label={t.label}
          >
            {t.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
