export function SaveBar({ message, onSave, onCancel, saving = false, saveLabel = 'Guardar' }) {
  return (
    <div className="save-bar">
      <p>{message}</p>
      <div className="save-bar-actions">
        <button type="button" className="ghost-btn" onClick={onCancel} disabled={saving}>
          Descartar
        </button>
        <button type="button" className="accent-btn" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  )
}
