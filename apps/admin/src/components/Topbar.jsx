import { Bell, MagnifyingGlass, Question } from '@phosphor-icons/react';

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>Control</h1>
        <p>Luna Mandala</p>
      </div>

      <div className="topbar-search" role="search">
        <MagnifyingGlass size={18} />
        <input placeholder="Buscar cliente, terapeuta o cita" />
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
