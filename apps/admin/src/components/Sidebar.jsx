import {
  Lightning,
  UsersThree,
  UserGear,
  Wallet,
  SlidersHorizontal,
  Moon,
  Sun
} from '@phosphor-icons/react';

const items = [
  { id: 'control', label: 'Control', icon: Lightning },
  { id: 'clientes', label: 'Clientes', icon: UsersThree },
  { id: 'terapeutas', label: 'Terapeutas', icon: UserGear },
  { id: 'finanzas', label: 'Finanzas', icon: Wallet },
  { id: 'ajustes', label: 'Ajustes', icon: SlidersHorizontal }
];

export function Sidebar({ theme, onToggleTheme }) {
  return (
    <aside className="sidebar">
      <div className="brand-slot" aria-label="Logo del centro">
        <div className="brand-mark">LM</div>
        <span className="brand-name">Luna</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navegacion principal">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${index === 0 ? 'is-active' : ''}`}
              aria-label={item.label}
            >
              <Icon size={22} weight={index === 0 ? 'fill' : 'regular'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="theme-toggle"
        onClick={onToggleTheme}
        aria-label="Cambiar tema"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </aside>
  );
}
