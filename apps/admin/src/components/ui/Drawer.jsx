export function Drawer({
  open,
  title,
  subtitle = '',
  onClose,
  children,
  footer = null,
  width = 560
}) {
  if (!open) {
    return null
  }

  return (
    <div className="drawer-overlay" role="presentation" onClick={onClose}>
      <section
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `${width}px` }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="drawer-body">{children}</div>

        {footer ? <footer className="drawer-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
