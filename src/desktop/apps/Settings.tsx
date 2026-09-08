import { useStore } from '../store';

export function SettingsApp() {
  const settings = useStore((s) => s.desktop.settings);
  const setCategory = useStore((s) => s.settingsCategory);
  const toggle = useStore((s) => s.settingsToggle);
  const openDropdown = useStore((s) => s.settingsOpenDropdown);
  const selectValue = useStore((s) => s.settingsSelect);
  const defs = settings.defs.filter((d) => d.category === settings.activeCategory);

  return (
    <div className="app settings">
      <div className="app-split">
        <ul className="list sidebar" data-testid="settings-categories">
          {settings.categories.map((c) => (
            <li
              key={c}
              className={`list-item ${c === settings.activeCategory ? 'is-active' : ''}`}
              data-testid={`settings-cat-${c}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </li>
          ))}
        </ul>
        <div className="pane">
          <div className="pane-title">{settings.activeCategory}</div>
          {defs.map((d) => {
            const v = settings.values[d.key];
            return (
              <div className="setting-row" key={d.key} data-testid={`setting-${d.key}`}>
                <span className="setting-label">{d.label}</span>
                {d.kind === 'toggle' ? (
                  <button
                    className={`switch ${v ? 'is-on' : ''}`}
                    data-testid={`setting-toggle-${d.key}`}
                    aria-pressed={!!v}
                    onClick={() => toggle(d.key)}
                  >
                    <span className="switch-knob" />
                    <span className="switch-text">{v ? 'On' : 'Off'}</span>
                  </button>
                ) : (
                  <div className="dropdown">
                    <button
                      className="btn dropdown-btn"
                      data-testid={`setting-select-${d.key}`}
                      onClick={() => openDropdown(settings.openDropdown === d.key ? null : d.key)}
                    >
                      {String(v)} <span className="caret">v</span>
                    </button>
                    {settings.openDropdown === d.key && (
                      <ul className="dropdown-menu" data-testid={`setting-menu-${d.key}`}>
                        {d.options!.map((o) => (
                          <li
                            key={o}
                            className={`dropdown-item ${o === v ? 'is-active' : ''}`}
                            data-testid={`setting-option-${d.key}-${o}`}
                            onClick={() => selectValue(d.key, o)}
                          >
                            {o}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
