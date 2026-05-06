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

export function Sidebar({ theme, onToggleTheme, activeView, onNavigate, brandName = 'Luna', logoUrl = '' }) {
  const initials = String(brandName || 'Luna')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="brand-slot" aria-label="Logo del centro">
        <div className="brand-mark">
          {logoUrl ? <img src={logoUrl} alt={brandName} /> : <span>{initials || 'LM'}</span>}
        </div>
        <span className="brand-name">{brandName}</span>
      </div>

      <nav className="sidebar-nav" aria-label="Navegacion principal">
        {items.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.id === activeView;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'is-active' : ''}`}
              aria-label={item.label}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
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
