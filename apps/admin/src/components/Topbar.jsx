import { Bell, MagnifyingGlass, Question } from '@phosphor-icons/react';

export function Topbar({
  title = 'Control',
  subtitle = 'Luna Mandala',
  searchValue = '',
  onSearchChange,
  searchDisabled = false,
  searchPlaceholder = 'Buscar cliente'
}) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="topbar-search" role="search">
        <MagnifyingGlass size={18} />
        <input
          value={searchValue}
          placeholder={searchPlaceholder}
          disabled={searchDisabled}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <button type="button" aria-label="Ayuda (próximamente)" disabled title="Próximamente">
          <Question size={18} />
        </button>
        <button
          type="button"
          aria-label="Notificaciones (próximamente)"
          disabled
          title="Próximamente"
        >
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
