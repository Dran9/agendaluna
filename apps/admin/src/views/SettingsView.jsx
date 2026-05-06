import { useEffect, useMemo, useState } from 'react'
import { EmptyState } from '../components/ui/EmptyState'
import { FeedbackBanner } from '../components/ui/FeedbackBanner'
import { FormField, MoneyField, TextareaField, ToggleField } from '../components/ui/FormFields'
import { Modal } from '../components/ui/Modal'
import { SaveBar } from '../components/ui/SaveBar'

const TABS = [
  { id: 'centro', label: 'Centro' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'salas', label: 'Salas' },
  { id: 'pagos', label: 'Pagos/QR' },
  { id: 'mensajes', label: 'Mensajes' }
]

function buildCenterForm(center) {
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
  }
}

function buildServiceForm(service) {
  return {
    name: service?.name || '',
    description: service?.description || '',
    durationMin: String(service?.durationMin || 60),
    basePriceCents: service?.basePriceCents || 0,
    currency: service?.currency || 'BOB',
    isActive: service?.isActive ?? true
  }
}

function buildRoomForm(room) {
  return {
    name: room?.name || '',
    capacity: String(room?.capacity || 1),
    isActive: room?.isActive ?? true
  }
}

export function SettingsView({
  loading,
  error,
  center,
  services,
  rooms,
  onSaveCenter,
  savingCenter,
  onCreateService,
  onUpdateService,
  onCreateRoom,
  onUpdateRoom
}) {
  const [activeTab, setActiveTab] = useState('centro')
  const [centerForm, setCenterForm] = useState(() => buildCenterForm(center))
  const [centerMessage, setCenterMessage] = useState('')

  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState(() => buildServiceForm(null))
  const [serviceSaving, setServiceSaving] = useState(false)
  const [serviceError, setServiceError] = useState('')

  const [roomModalOpen, setRoomModalOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [roomForm, setRoomForm] = useState(() => buildRoomForm(null))
  const [roomSaving, setRoomSaving] = useState(false)
  const [roomError, setRoomError] = useState('')

  useEffect(() => {
    setCenterForm(buildCenterForm(center))
  }, [center])

  const centerFingerprint = useMemo(() => JSON.stringify(buildCenterForm(center)), [center])
  const centerDirty = useMemo(
    () => JSON.stringify(centerForm) !== centerFingerprint,
    [centerForm, centerFingerprint]
  )

  async function handleSaveCenter() {
    setCenterMessage('')
    try {
      await onSaveCenter(centerForm)
      setCenterMessage('Ajustes del centro guardados.')
    } catch {
      // handled by parent error state
    }
  }

  async function handleServiceSubmit() {
    setServiceSaving(true)
    setServiceError('')
    try {
      const payload = {
        name: serviceForm.name,
        description: serviceForm.description,
        durationMin: Number(serviceForm.durationMin || 0),
        basePriceCents: Number(serviceForm.basePriceCents || 0),
        currency: serviceForm.currency,
        isActive: serviceForm.isActive
      }
      if (editingService) {
        await onUpdateService(editingService.id, payload)
      } else {
        await onCreateService(payload)
      }
      setServiceModalOpen(false)
      setEditingService(null)
      setServiceForm(buildServiceForm(null))
    } catch (saveError) {
      setServiceError(saveError.message || 'No se pudo guardar servicio.')
    } finally {
      setServiceSaving(false)
    }
  }

  async function handleRoomSubmit() {
    setRoomSaving(true)
    setRoomError('')
    try {
      const payload = {
        name: roomForm.name,
        capacity: Number(roomForm.capacity || 1),
        isActive: roomForm.isActive
      }
      if (editingRoom) {
        await onUpdateRoom(editingRoom.id, payload)
      } else {
        await onCreateRoom(payload)
      }
      setRoomModalOpen(false)
      setEditingRoom(null)
      setRoomForm(buildRoomForm(null))
    } catch (saveError) {
      setRoomError(saveError.message || 'No se pudo guardar sala.')
    } finally {
      setRoomSaving(false)
    }
  }

  return (
    <section className="single-column">
      <article className="panel">
        <header className="panel-header">
          <h2>Ajustes</h2>
          <span className="panel-subtitle">Centro, servicios y salas operativas</span>
        </header>

        <div className="tabs-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? <EmptyState title="Cargando ajustes" description="Obteniendo catálogo y configuración actual." /> : null}
        {!loading && error ? <EmptyState title="No se pudo cargar" description={error} tone="danger" /> : null}

        {!loading && !error && activeTab === 'centro' ? (
          <div className="form-stack">
            <FeedbackBanner kind="success" message={centerMessage} />

            <div className="form-grid two-cols">
              <FormField
                label="Nombre del centro"
                value={centerForm.centerName}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, centerName: value }))}
              />
              <FormField
                label="Marca visible"
                value={centerForm.brandName}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, brandName: value }))}
              />
              <FormField
                label="URL logo"
                value={centerForm.logoUrl}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, logoUrl: value }))}
              />
              <FormField
                label="WhatsApp"
                value={centerForm.whatsappNumber}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, whatsappNumber: value }))}
              />
              <FormField
                label="Timezone"
                value={centerForm.timezone}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, timezone: value }))}
              />
              <FormField
                label="Locale"
                value={centerForm.locale}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, locale: value }))}
              />
              <FormField
                label="Color primario"
                value={centerForm.primaryColor}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, primaryColor: value }))}
              />
              <FormField
                label="Color acento"
                value={centerForm.accentColor}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, accentColor: value }))}
              />
              <TextareaField
                label="Texto guía WhatsApp"
                value={centerForm.supportWhatsappText}
                onChange={(value) => setCenterForm((prev) => ({ ...prev, supportWhatsappText: value }))}
                rows={3}
              />
            </div>

            {centerDirty ? (
              <SaveBar
                message="Tienes cambios pendientes en datos del centro."
                onSave={handleSaveCenter}
                onCancel={() => setCenterForm(buildCenterForm(center))}
                saving={savingCenter}
              />
            ) : null}
          </div>
        ) : null}

        {!loading && !error && activeTab === 'servicios' ? (
          <div className="form-stack">
            <div className="panel-header slim">
              <h3>Servicios</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingService(null)
                  setServiceForm(buildServiceForm(null))
                  setServiceError('')
                  setServiceModalOpen(true)
                }}
              >
                Nuevo servicio
              </button>
            </div>
            <FeedbackBanner kind="danger" message={serviceError} />

            {!services.length ? (
              <EmptyState title="Sin servicios" description="Crea el primer servicio para habilitar el booking." />
            ) : (
              <ul className="resource-list">
                {services.map((service) => (
                  <li key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>
                        {service.durationMin} min · {service.currency} {Number(service.basePriceCents || 0) / 100}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-btn-inline"
                        onClick={async () => {
                          setServiceError('')
                          try {
                            await onUpdateService(service.id, { isActive: !service.isActive })
                          } catch (toggleError) {
                            setServiceError(toggleError.message || 'No se pudo actualizar el servicio.')
                          }
                        }}
                      >
                        {service.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingService(service)
                          setServiceForm(buildServiceForm(service))
                          setServiceError('')
                          setServiceModalOpen(true)
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!loading && !error && activeTab === 'salas' ? (
          <div className="form-stack">
            <div className="panel-header slim">
              <h3>Salas</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingRoom(null)
                  setRoomForm(buildRoomForm(null))
                  setRoomError('')
                  setRoomModalOpen(true)
                }}
              >
                Nueva sala
              </button>
            </div>
            <FeedbackBanner kind="danger" message={roomError} />

            {!rooms.length ? (
              <EmptyState title="Sin salas" description="Registra una sala para validar disponibilidad interna." />
            ) : (
              <ul className="resource-list">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <div>
                      <strong>{room.name}</strong>
                      <span>Capacidad {room.capacity}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost-btn-inline"
                        onClick={async () => {
                          setRoomError('')
                          try {
                            await onUpdateRoom(room.id, { isActive: !room.isActive })
                          } catch (toggleError) {
                            setRoomError(toggleError.message || 'No se pudo actualizar la sala.')
                          }
                        }}
                      >
                        {room.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoom(room)
                          setRoomForm(buildRoomForm(room))
                          setRoomError('')
                          setRoomModalOpen(true)
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {!loading && !error && activeTab === 'pagos' ? (
          <EmptyState
            title="Pagos/QR próximo"
            description="Esta sección queda marcada como próximo: QR y cuentas destino en la siguiente iteración."
          />
        ) : null}

        {!loading && !error && activeTab === 'mensajes' ? (
          <EmptyState
            title="Mensajes próximo"
            description="Plantillas de WhatsApp y automatizaciones se implementarán en la fase siguiente."
          />
        ) : null}
      </article>

      <Modal
        open={serviceModalOpen}
        title={editingService ? 'Editar servicio' : 'Nuevo servicio'}
        onClose={() => setServiceModalOpen(false)}
        footer={
          <div className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={() => setServiceModalOpen(false)}>
              Cerrar
            </button>
            <button type="button" onClick={handleServiceSubmit} disabled={serviceSaving}>
              {serviceSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <FeedbackBanner kind="danger" message={serviceError} />
        <div className="form-grid two-cols">
          <FormField
            label="Nombre"
            value={serviceForm.name}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, name: value }))}
          />
          <FormField
            label="Duración (min)"
            type="number"
            value={serviceForm.durationMin}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, durationMin: value }))}
          />
          <MoneyField
            label="Precio base"
            cents={serviceForm.basePriceCents}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, basePriceCents: value }))}
            currency={serviceForm.currency}
          />
          <FormField
            label="Moneda"
            value={serviceForm.currency}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, currency: value.toUpperCase() }))}
          />
          <TextareaField
            label="Descripción"
            value={serviceForm.description}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, description: value }))}
          />
          <ToggleField
            label="Activo"
            checked={serviceForm.isActive}
            onChange={(value) => setServiceForm((prev) => ({ ...prev, isActive: value }))}
          />
        </div>
      </Modal>

      <Modal
        open={roomModalOpen}
        title={editingRoom ? 'Editar sala' : 'Nueva sala'}
        onClose={() => setRoomModalOpen(false)}
        footer={
          <div className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={() => setRoomModalOpen(false)}>
              Cerrar
            </button>
            <button type="button" onClick={handleRoomSubmit} disabled={roomSaving}>
              {roomSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        }
      >
        <FeedbackBanner kind="danger" message={roomError} />
        <div className="form-grid two-cols">
          <FormField
            label="Nombre"
            value={roomForm.name}
            onChange={(value) => setRoomForm((prev) => ({ ...prev, name: value }))}
          />
          <FormField
            label="Capacidad"
            type="number"
            value={roomForm.capacity}
            onChange={(value) => setRoomForm((prev) => ({ ...prev, capacity: value }))}
          />
          <ToggleField
            label="Activa"
            checked={roomForm.isActive}
            onChange={(value) => setRoomForm((prev) => ({ ...prev, isActive: value }))}
          />
        </div>
      </Modal>
    </section>
  )
}
