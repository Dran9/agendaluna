import { Bell, MagnifyingGlass, Question, SignOut } from '@phosphor-icons/react';

export function Topbar({
  title = 'Control',
  subtitle = 'Luna Mandala',
  searchValue = '',
  onSearchChange,
  searchDisabled = false,
  searchPlaceholder = 'Buscar cliente',
  onLogout
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
        {onLogout ? (
          <button type="button" className="topbar-logout" onClick={onLogout} title="Cerrar sesión">
            <SignOut size={16} />
            <span>Salir</span>
          </button>
        ) : null}
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
