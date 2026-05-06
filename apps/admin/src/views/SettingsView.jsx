import { useEffect, useState } from 'react';

function buildInitialForm(center) {
  return {
    centerName: center?.name || '',
    brandName: center?.brandName || '',
    logoUrl: center?.logoUrl || '',
    timezone: center?.timezone || 'America/La_Paz',
    locale: center?.locale || 'es-BO',
    whatsappNumber: center?.whatsappNumber || '',
    supportWhatsappText: center?.supportWhatsappText || '',
    primaryColor: center?.primaryColor || '',
    accentColor: center?.accentColor || ''
  };
}

export function SettingsView({ loading, error, settings, onSave, saving, saveError }) {
  const [form, setForm] = useState(() => buildInitialForm(settings?.center));

  useEffect(() => {
    setForm(buildInitialForm(settings?.center));
  }, [settings?.center]);

  return (
    <section className="wide-grid">
      <article className="panel">
        <header className="panel-header">
          <h2>Ajustes del centro</h2>
          <button type="button" onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </header>

        {loading ? <p className="empty-state">Cargando ajustes...</p> : null}
        {error ? <p className="empty-state error-state">{error}</p> : null}
        {saveError ? <p className="empty-state error-state">{saveError}</p> : null}

        {!loading && !error ? (
          <div className="settings-form">
            <label>
              <span>Nombre del centro</span>
              <input
                value={form.centerName}
                onChange={(event) => setForm((prev) => ({ ...prev, centerName: event.target.value }))}
              />
            </label>

            <label>
              <span>Marca visible</span>
              <input
                value={form.brandName}
                onChange={(event) => setForm((prev) => ({ ...prev, brandName: event.target.value }))}
              />
            </label>

            <label>
              <span>URL logo</span>
              <input
                value={form.logoUrl}
                onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <label>
              <span>WhatsApp</span>
              <input
                value={form.whatsappNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, whatsappNumber: event.target.value }))
                }
              />
            </label>

            <label className="full-width">
              <span>Texto de guía WhatsApp</span>
              <textarea
                value={form.supportWhatsappText}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supportWhatsappText: event.target.value }))
                }
                rows={3}
              />
            </label>

            <label>
              <span>Timezone</span>
              <input
                value={form.timezone}
                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
              />
            </label>

            <label>
              <span>Locale</span>
              <input
                value={form.locale}
                onChange={(event) => setForm((prev) => ({ ...prev, locale: event.target.value }))}
              />
            </label>

            <label>
              <span>Color primario</span>
              <input
                value={form.primaryColor}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, primaryColor: event.target.value }))
                }
                placeholder="#4f46e5"
              />
            </label>

            <label>
              <span>Color acento</span>
              <input
                value={form.accentColor}
                onChange={(event) => setForm((prev) => ({ ...prev, accentColor: event.target.value }))}
                placeholder="#8b5cf6"
              />
            </label>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <h3>Recursos</h3>

        <p className="muted-paragraph">Servicios activos: {settings?.services?.length || 0}</p>
        <ul className="simple-list">
          {(settings?.services || []).slice(0, 12).map((service) => (
            <li key={service.id}>
              <strong>{service.name}</strong>
              <span>{service.duration_min} min</span>
            </li>
          ))}
        </ul>

        <p className="muted-paragraph">Salas: {settings?.rooms?.length || 0}</p>
        <ul className="simple-list">
          {(settings?.rooms || []).slice(0, 12).map((room) => (
            <li key={room.id}>
              <strong>{room.name}</strong>
              <span>Capacidad {room.capacity}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
