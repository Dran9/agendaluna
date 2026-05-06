import { Bell, MagnifyingGlass, Question } from '@phosphor-icons/react';

export function Topbar({
  title = 'Control',
  subtitle = 'Luna Mandala',
  searchValue = '',
  onSearchChange
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
          placeholder="Buscar cliente, terapeuta o cita"
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <button type="button" aria-label="Ayuda">
          <Question size={18} />
        </button>
        <button type="button" aria-label="Notificaciones">
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
