import { useEffect, useState } from 'react'
import { Drawer } from '../components/ui/Drawer'
import { EmptyState } from '../components/ui/EmptyState'
import { FeedbackBanner } from '../components/ui/FeedbackBanner'
import { FormField, TextareaField } from '../components/ui/FormFields'
import { formatShortDateTime, formatStatus } from '../lib/formatters'

function buildInitialForm(client) {
  return {
    fullName: client?.fullName || '',
    whatsappPhone: client?.whatsappPhone || '',
    email: client?.email || '',
    notes: client?.notes || ''
  }
}

export function ClientsView({
  loading,
  error,
  clients,
  selectedClient,
  onSelectClient,
  timeline,
  timelineLoading,
  timelineError,
  onCreateClient,
  onUpdateClient
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingClientId, setEditingClientId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [form, setForm] = useState(() => buildInitialForm(null))

  useEffect(() => {
    if (!drawerOpen) {
      return
    }

    if (!editingClientId) {
      setForm(buildInitialForm(null))
      return
    }

    const found = clients.find((item) => item.id === editingClientId) || selectedClient
    setForm(buildInitialForm(found))
  }, [drawerOpen, editingClientId, clients, selectedClient])

  async function handleSubmit() {
    setSaveError('')
    setSaveSuccess('')

    if (!form.fullName.trim() || !form.whatsappPhone.trim()) {
      setSaveError('Nombre y WhatsApp son obligatorios.')
      return
    }

    setSaving(true)

    try {
      if (editingClientId) {
        await onUpdateClient(editingClientId, form)
        setSaveSuccess('Cliente actualizado.')
      } else {
        await onCreateClient(form)
        setSaveSuccess('Cliente creado.')
      }
    } catch (submitError) {
      setSaveError(submitError.message || 'No se pudo guardar cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="wide-grid">
      <article className="panel">
        <header className="panel-header">
          <h2>Clientes</h2>
          <div className="header-actions">
            {selectedClient ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEditingClientId(selectedClient.id)
                  setDrawerOpen(true)
                }}
              >
                Editar cliente
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setEditingClientId(null)
                setDrawerOpen(true)
              }}
            >
              Nuevo cliente
            </button>
          </div>
        </header>

        {loading ? <EmptyState title="Cargando clientes" description="Buscando clientes y actividad reciente." /> : null}
        {error ? <EmptyState title="No se pudo cargar" description={error} tone="danger" /> : null}

        {!loading && !error && clients.length === 0 ? (
          <EmptyState title="Aún sin clientes" description="Registra el primer cliente para empezar a operar." />
        ) : null}

        {!loading && !error && clients.length > 0 ? (
          <ul className="entity-list">
            {clients.map((client) => (
              <li key={client.id} className={`entity-row ${selectedClient?.id === client.id ? 'is-active' : ''}`}>
                <button type="button" onClick={() => onSelectClient(client)}>
                  <strong>{client.fullName}</strong>
                  <span>{client.whatsappPhone}</span>
                  <small>
                    Citas: {client.totalAppointments} · Pendientes: {client.pendingAppointments}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="panel">
        <header className="panel-header">
          <h2>Timeline</h2>
          <span className="panel-subtitle">{selectedClient?.fullName || 'Sin seleccionar'}</span>
        </header>

        {!selectedClient ? (
          <EmptyState title="Selecciona un cliente" description="Aquí verás citas, pagos y eventos de auditoría." />
        ) : null}

        {selectedClient && timelineLoading ? (
          <EmptyState title="Cargando timeline" description="Consultando historial del cliente." />
        ) : null}

        {selectedClient && timelineError ? <EmptyState title="Error" description={timelineError} tone="danger" /> : null}

        {selectedClient && !timelineLoading && !timelineError && timeline.length === 0 ? (
          <EmptyState title="Sin eventos" description="Este cliente todavía no tiene movimientos registrados." />
        ) : null}

        {selectedClient && !timelineLoading && !timelineError && timeline.length > 0 ? (
          <ul className="timeline-list">
            {timeline.map((event, index) => (
              <li key={`${event.kind}-${event.item.id}-${index}`}>
                <div>
                  <strong>{formatShortDateTime(event.at)}</strong>
                  <span className="status-chip">{event.kind}</span>
                </div>
                {event.kind === 'appointment' ? (
                  <p>
                    {event.item.serviceName} · {event.item.therapistName} · {formatStatus(event.item.status)}
                  </p>
                ) : null}
                {event.kind === 'payment' ? (
                  <p>
                    Pago {event.item.id} · {formatStatus(event.item.status)}
                  </p>
                ) : null}
                {event.kind === 'audit' ? <p>{event.item.action}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <Drawer
        open={drawerOpen}
        title={editingClientId ? 'Editar cliente' : 'Nuevo cliente'}
        subtitle="Datos de contacto y notas operativas"
        onClose={() => {
          setDrawerOpen(false)
          setSaveError('')
          setSaveSuccess('')
        }}
        footer={
          <div className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={() => setDrawerOpen(false)}>
              Cerrar
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <FeedbackBanner kind="danger" message={saveError} />
        <FeedbackBanner kind="success" message={saveSuccess} />

        <div className="form-stack">
          <FormField
            label="Nombre completo"
            value={form.fullName}
            onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
            required
          />
          <FormField
            label="WhatsApp"
            value={form.whatsappPhone}
            onChange={(value) => setForm((prev) => ({ ...prev, whatsappPhone: value }))}
            required
          />
          <FormField
            label="Email"
            value={form.email}
            onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
          />
          <TextareaField
            label="Notas"
            value={form.notes}
            onChange={(value) => setForm((prev) => ({ ...prev, notes: value }))}
            rows={4}
          />
        </div>
      </Drawer>
    </section>
  )
}
