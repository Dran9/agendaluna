import { useEffect, useMemo, useState } from 'react'
import { KpiCard } from '../components/KpiCard'
import { Drawer } from '../components/ui/Drawer'
import { EmptyState } from '../components/ui/EmptyState'
import { FeedbackBanner } from '../components/ui/FeedbackBanner'
import { FormField, SelectField, TextareaField } from '../components/ui/FormFields'
import { formatShortDateTime, formatStatus } from '../lib/formatters'

function pad(value) {
  return String(value).padStart(2, '0')
}

function toDateInput(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toLocalDateTimeInput(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIsoFromLocalInput(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
}

function buildRoomRail(appointments) {
  if (!appointments?.length) {
    return []
  }

  const map = new Map()
  for (const appointment of appointments) {
    if (!map.has(appointment.room_name)) {
      map.set(appointment.room_name, appointment)
    }
  }

  return Array.from(map.values()).map((item) => ({
    room: item.room_name,
    state: `${formatStatus(item.status)} • ${formatShortDateTime(item.starts_at)}`
  }))
}

export function ControlView({
  loading,
  error,
  summary,
  appointments,
  services,
  therapists,
  rooms,
  onSearchClients,
  onLookupAvailability,
  onCreateAppointment,
  onGetAppointmentDetail,
  onUpdateAppointmentStatus,
  onRescheduleAppointment
}) {
  const railData = buildRoomRail(appointments || [])
  const activeServices = useMemo(() => (services || []).filter((item) => item.isActive), [services])

  const [newDrawerOpen, setNewDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientOptions, setClientOptions] = useState([])

  const [appointmentForm, setAppointmentForm] = useState({
    clientMode: 'existing',
    clientId: '',
    client: {
      fullName: '',
      whatsappPhone: '',
      email: '',
      notes: ''
    },
    serviceId: '',
    therapistId: '',
    date: toDateInput(),
    startsAt: '',
    note: ''
  })

  const [availabilityState, setAvailabilityState] = useState({
    loading: false,
    error: '',
    recommendation: null,
    slots: []
  })

  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailData, setDetailData] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [rescheduleBusy, setRescheduleBusy] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  const [rescheduleForm, setRescheduleForm] = useState({
    startsAtLocal: '',
    therapistId: '',
    roomId: '',
    note: ''
  })

  useEffect(() => {
    if (!newDrawerOpen) {
      return
    }

    const defaultService = activeServices[0]
    setAppointmentForm((prev) => ({
      ...prev,
      serviceId: prev.serviceId || (defaultService ? String(defaultService.id) : '')
    }))

    onSearchClients('')
      .then((clients) => setClientOptions(clients || []))
      .catch(() => setClientOptions([]))
  }, [newDrawerOpen, activeServices, onSearchClients])

  async function searchAvailability() {
    setCreateError('')
    setCreateSuccess('')

    if (!appointmentForm.serviceId || !appointmentForm.date) {
      setAvailabilityState((prev) => ({
        ...prev,
        error: 'Selecciona servicio y fecha para buscar disponibilidad.'
      }))
      return
    }

    setAvailabilityState({ loading: true, error: '', recommendation: null, slots: [] })

    try {
      const payload = await onLookupAvailability({
        serviceId: Number(appointmentForm.serviceId),
        date: appointmentForm.date,
        therapistId: appointmentForm.therapistId ? Number(appointmentForm.therapistId) : null
      })

      setAvailabilityState({
        loading: false,
        error: '',
        recommendation: payload.recommendation || null,
        slots: payload.slots || []
      })
    } catch (lookupError) {
      setAvailabilityState({
        loading: false,
        error: lookupError.message || 'No se pudo consultar disponibilidad.',
        recommendation: null,
        slots: []
      })
    }
  }

  async function handleCreateAppointment() {
    setCreateError('')
    setCreateSuccess('')

    if (!appointmentForm.startsAt) {
      setCreateError('Selecciona un horario disponible.')
      return
    }

    if (appointmentForm.clientMode === 'existing' && !appointmentForm.clientId) {
      setCreateError('Selecciona un cliente existente.')
      return
    }

    if (
      appointmentForm.clientMode === 'new' &&
      (!appointmentForm.client.fullName.trim() || !appointmentForm.client.whatsappPhone.trim())
    ) {
      setCreateError('Para cliente nuevo se requiere nombre y WhatsApp.')
      return
    }

    const payload = {
      serviceId: Number(appointmentForm.serviceId),
      therapistId: appointmentForm.therapistId ? Number(appointmentForm.therapistId) : null,
      startsAt: appointmentForm.startsAt,
      note: appointmentForm.note
    }

    if (appointmentForm.clientMode === 'existing') {
      payload.clientId = Number(appointmentForm.clientId)
    } else {
      payload.client = {
        fullName: appointmentForm.client.fullName,
        whatsappPhone: appointmentForm.client.whatsappPhone,
        email: appointmentForm.client.email,
        notes: appointmentForm.client.notes
      }
    }

    setCreating(true)

    try {
      const created = await onCreateAppointment(payload)
      setCreateSuccess(`Cita #${created.id} creada correctamente.`)
      setAppointmentForm({
        clientMode: 'existing',
        clientId: '',
        client: {
          fullName: '',
          whatsappPhone: '',
          email: '',
          notes: ''
        },
        serviceId: activeServices[0] ? String(activeServices[0].id) : '',
        therapistId: '',
        date: toDateInput(),
        startsAt: '',
        note: ''
      })
      setAvailabilityState({ loading: false, error: '', recommendation: null, slots: [] })
    } catch (createAppointmentError) {
      setCreateError(createAppointmentError.message || 'No se pudo crear la cita manual.')
    } finally {
      setCreating(false)
    }
  }

  async function openAppointmentDetail(appointmentId) {
    setDetailDrawerOpen(true)
    setDetailLoading(true)
    setDetailError('')
    setRescheduleError('')

    try {
      const payload = await onGetAppointmentDetail(appointmentId)
      setDetailData(payload)
      setRescheduleForm({
        startsAtLocal: toLocalDateTimeInput(payload.appointment?.startsAt),
        therapistId: payload.appointment?.therapist?.id ? String(payload.appointment.therapist.id) : '',
        roomId: payload.appointment?.room?.id ? String(payload.appointment.room.id) : '',
        note: ''
      })
    } catch (loadError) {
      setDetailError(loadError.message || 'No se pudo abrir el detalle de la cita.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshDetail() {
    if (!detailData?.appointment?.id) {
      return
    }
    await openAppointmentDetail(detailData.appointment.id)
  }

  async function handleStatusChange(nextStatus) {
    if (!detailData?.appointment?.id) {
      return
    }

    setStatusBusy(true)
    setRescheduleError('')

    try {
      await onUpdateAppointmentStatus(detailData.appointment.id, nextStatus)
      await refreshDetail()
    } catch (updateError) {
      setRescheduleError(updateError.message || 'No se pudo cambiar el estado.')
    } finally {
      setStatusBusy(false)
    }
  }

  async function handleReschedule() {
    if (!detailData?.appointment?.id) {
      return
    }

    const startsAt = toIsoFromLocalInput(rescheduleForm.startsAtLocal)
    if (!startsAt) {
      setRescheduleError('Selecciona fecha y hora válidas para reagendar.')
      return
    }

    setRescheduleBusy(true)
    setRescheduleError('')

    try {
      await onRescheduleAppointment(detailData.appointment.id, {
        startsAt,
        therapistId: rescheduleForm.therapistId ? Number(rescheduleForm.therapistId) : null,
        roomId: rescheduleForm.roomId ? Number(rescheduleForm.roomId) : null,
        note: rescheduleForm.note
      })
      await refreshDetail()
    } catch (rescheduleOperationError) {
      setRescheduleError(rescheduleOperationError.message || 'No se pudo reagendar.')
    } finally {
      setRescheduleBusy(false)
    }
  }

  return (
    <>
      <section className="main-column">
        <div className="kpi-grid">
          <KpiCard label="Citas hoy" value={String(summary?.totalToday || 0)} />
          <KpiCard label="Pagos pendientes" value={String(summary?.pendingPayments || 0)} tone="warning" />
          <KpiCard label="Confirmadas" value={String(summary?.confirmedToday || 0)} tone="success" />
          <KpiCard label="Pendientes" value={String(summary?.pendingToday || 0)} tone="info" />
        </div>

        <article className="panel">
          <header className="panel-header">
            <h2>Agenda de hoy</h2>
            <button type="button" onClick={() => setNewDrawerOpen(true)}>
              Nueva cita
            </button>
          </header>

          {loading ? <EmptyState title="Cargando agenda" description="Buscando citas confirmadas y pendientes de hoy." /> : null}
          {error ? <EmptyState title="No se pudo cargar" description={error} tone="danger" /> : null}

          {!loading && !error && appointments?.length === 0 ? (
            <EmptyState
              title="Sin citas por ahora"
              description="Cuando registres una cita manual o desde booking, aparecerá aquí."
            />
          ) : null}

          {!loading && !error && appointments?.length > 0 ? (
            <ul className="appointment-list">
              {appointments.map((appointment) => (
                <li key={appointment.id}>
                  <button
                    type="button"
                    className="appointment-row"
                    onClick={() => openAppointmentDetail(appointment.id)}
                  >
                    <div>
                      <strong>{formatShortDateTime(appointment.starts_at)}</strong>
                      <span>{appointment.client_name}</span>
                    </div>
                    <div>
                      <span>{appointment.service_name}</span>
                      <small>{appointment.therapist_name}</small>
                    </div>
                    <div>
                      <span>{appointment.room_name}</span>
                      <small>{formatStatus(appointment.status)}</small>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>

      <aside className="side-rail">
        <article className="panel">
          <h3>Estado de salas</h3>

          {railData.length === 0 ? (
            <EmptyState title="Sin ocupación" description="Todavía no hay salas ocupadas en el rango de hoy." />
          ) : (
            <ul className="room-rail">
              {railData.map((item) => (
                <li key={item.room}>
                  <strong>{item.room}</strong>
                  <span>{item.state}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="panel brand-panel">
          <h3>Marca del centro</h3>
          <p>
            El branding y datos del centro se editan en Ajustes. Este panel asegura presencia visible del
            brand mark en operación diaria.
          </p>
        </article>
      </aside>

      <Drawer
        open={newDrawerOpen}
        title="Nueva cita"
        subtitle="Crear una cita manual con validación de terapeuta + sala"
        onClose={() => {
          setNewDrawerOpen(false)
          setCreateError('')
          setCreateSuccess('')
        }}
        footer={
          <div className="drawer-actions">
            <button type="button" className="ghost-btn" onClick={searchAvailability}>
              Buscar horarios
            </button>
            <button type="button" onClick={handleCreateAppointment} disabled={creating}>
              {creating ? 'Creando...' : 'Confirmar cita'}
            </button>
          </div>
        }
      >
        <FeedbackBanner kind="danger" message={createError} />
        <FeedbackBanner kind="success" message={createSuccess} />

        <div className="segmented-toggle">
          <button
            type="button"
            className={appointmentForm.clientMode === 'existing' ? 'is-active' : ''}
            onClick={() => setAppointmentForm((prev) => ({ ...prev, clientMode: 'existing' }))}
          >
            Cliente existente
          </button>
          <button
            type="button"
            className={appointmentForm.clientMode === 'new' ? 'is-active' : ''}
            onClick={() => setAppointmentForm((prev) => ({ ...prev, clientMode: 'new' }))}
          >
            Cliente nuevo
          </button>
        </div>

        {appointmentForm.clientMode === 'existing' ? (
          <div className="form-stack">
            <FormField
              label="Buscar cliente"
              value={clientSearch}
              onChange={(value) => {
                setClientSearch(value)
                onSearchClients(value)
                  .then((clients) => setClientOptions(clients || []))
                  .catch(() => setClientOptions([]))
              }}
              placeholder="Nombre o WhatsApp"
            />
            <SelectField
              label="Cliente"
              value={appointmentForm.clientId}
              onChange={(value) => setAppointmentForm((prev) => ({ ...prev, clientId: value }))}
              options={[
                { value: '', label: 'Selecciona un cliente' },
                ...clientOptions.map((client) => ({
                  value: String(client.id),
                  label: `${client.fullName} · ${client.whatsappPhone}`
                }))
              ]}
            />
          </div>
        ) : (
          <div className="form-stack">
            <FormField
              label="Nombre completo"
              value={appointmentForm.client.fullName}
              onChange={(value) =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  client: { ...prev.client, fullName: value }
                }))
              }
              required
            />
            <FormField
              label="WhatsApp"
              value={appointmentForm.client.whatsappPhone}
              onChange={(value) =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  client: { ...prev.client, whatsappPhone: value }
                }))
              }
              required
            />
            <FormField
              label="Email"
              value={appointmentForm.client.email}
              onChange={(value) =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  client: { ...prev.client, email: value }
                }))
              }
            />
            <TextareaField
              label="Notas"
              value={appointmentForm.client.notes}
              onChange={(value) =>
                setAppointmentForm((prev) => ({
                  ...prev,
                  client: { ...prev.client, notes: value }
                }))
              }
            />
          </div>
        )}

        <div className="form-grid two-cols">
          <SelectField
            label="Servicio"
            value={appointmentForm.serviceId}
            onChange={(value) =>
              setAppointmentForm((prev) => ({
                ...prev,
                serviceId: value,
                startsAt: ''
              }))
            }
            options={[
              { value: '', label: 'Selecciona un servicio' },
              ...activeServices.map((service) => ({ value: String(service.id), label: service.name }))
            ]}
            required
          />

          <SelectField
            label="Terapeuta (opcional)"
            value={appointmentForm.therapistId}
            onChange={(value) => setAppointmentForm((prev) => ({ ...prev, therapistId: value, startsAt: '' }))}
            options={[
              { value: '', label: 'Sugerencia automática' },
              ...therapists
                .filter((item) => item.isActive)
                .map((therapist) => ({ value: String(therapist.id), label: therapist.fullName }))
            ]}
          />

          <FormField
            label="Fecha"
            type="date"
            value={appointmentForm.date}
            onChange={(value) => setAppointmentForm((prev) => ({ ...prev, date: value, startsAt: '' }))}
            required
          />

          <TextareaField
            label="Nota interna"
            value={appointmentForm.note}
            onChange={(value) => setAppointmentForm((prev) => ({ ...prev, note: value }))}
            rows={2}
          />
        </div>

        <FeedbackBanner kind="danger" message={availabilityState.error} />
        {availabilityState.recommendation ? (
          <p className="recommendation-note">
            Recomendado: <strong>{availabilityState.recommendation.therapistName}</strong>.
          </p>
        ) : null}

        {availabilityState.loading ? <p className="muted-paragraph">Buscando horarios disponibles...</p> : null}

        {!availabilityState.loading && availabilityState.slots.length > 0 ? (
          <div className="slot-grid">
            {availabilityState.slots.map((slot) => {
              const key = String(slot.startsAt)
              const selected = appointmentForm.startsAt === String(slot.startsAt)
              return (
                <button
                  key={key}
                  type="button"
                  className={`slot-btn ${selected ? 'is-active' : ''}`}
                  onClick={() => setAppointmentForm((prev) => ({ ...prev, startsAt: String(slot.startsAt) }))}
                >
                  <strong>{formatShortDateTime(slot.startsAt)}</strong>
                  <small>{slot.candidates?.[0]?.therapistName || 'Sin terapeuta'}</small>
                  <small>{slot.candidates?.[0]?.roomName || 'Sin sala'}</small>
                </button>
              )
            })}
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={detailDrawerOpen}
        title={detailData?.appointment ? `Cita #${detailData.appointment.id}` : 'Detalle de cita'}
        subtitle="Estado, pago, auditoría y reagendado"
        onClose={() => {
          setDetailDrawerOpen(false)
          setDetailData(null)
          setDetailError('')
        }}
      >
        {detailLoading ? <EmptyState title="Cargando detalle" description="Consultando la cita seleccionada." /> : null}
        {detailError ? <EmptyState title="No se pudo abrir" description={detailError} tone="danger" /> : null}

        {!detailLoading && !detailError && detailData?.appointment ? (
          <div className="form-stack">
            <dl className="detail-grid">
              <div>
                <dt>Cliente</dt>
                <dd>{detailData.appointment.client?.fullName}</dd>
              </div>
              <div>
                <dt>WhatsApp</dt>
                <dd>{detailData.appointment.client?.whatsappPhone}</dd>
              </div>
              <div>
                <dt>Servicio</dt>
                <dd>{detailData.appointment.service?.name}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{formatStatus(detailData.appointment.status)}</dd>
              </div>
              <div>
                <dt>Terapeuta</dt>
                <dd>{detailData.appointment.therapist?.fullName}</dd>
              </div>
              <div>
                <dt>Sala</dt>
                <dd>{detailData.appointment.room?.name}</dd>
              </div>
              <div>
                <dt>Inicio</dt>
                <dd>{formatShortDateTime(detailData.appointment.startsAt)}</dd>
              </div>
              <div>
                <dt>Pago</dt>
                <dd>{formatStatus(detailData.appointment.paymentStatus)}</dd>
              </div>
            </dl>

            <div className="drawer-actions wrap">
              <button type="button" onClick={() => handleStatusChange('completed')} disabled={statusBusy}>
                Completar
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleStatusChange('cancelled')} disabled={statusBusy}>
                Cancelar
              </button>
              <button type="button" className="ghost-btn" onClick={() => handleStatusChange('no_show')} disabled={statusBusy}>
                No-show
              </button>
            </div>

            <h3 className="section-title">Reagendar / cambiar terapeuta o sala</h3>
            <div className="form-grid two-cols">
              <FormField
                label="Fecha y hora"
                type="datetime-local"
                value={rescheduleForm.startsAtLocal}
                onChange={(value) => setRescheduleForm((prev) => ({ ...prev, startsAtLocal: value }))}
              />

              <SelectField
                label="Terapeuta"
                value={rescheduleForm.therapistId}
                onChange={(value) => setRescheduleForm((prev) => ({ ...prev, therapistId: value }))}
                options={[
                  { value: '', label: 'Mantener terapeuta actual' },
                  ...therapists
                    .filter((item) => item.isActive)
                    .map((therapist) => ({ value: String(therapist.id), label: therapist.fullName }))
                ]}
              />

              <SelectField
                label="Sala"
                value={rescheduleForm.roomId}
                onChange={(value) => setRescheduleForm((prev) => ({ ...prev, roomId: value }))}
                options={[
                  { value: '', label: 'Mantener sala actual' },
                  ...rooms
                    .filter((item) => item.isActive)
                    .map((room) => ({ value: String(room.id), label: room.name }))
                ]}
              />

              <TextareaField
                label="Motivo"
                value={rescheduleForm.note}
                onChange={(value) => setRescheduleForm((prev) => ({ ...prev, note: value }))}
                rows={2}
              />
            </div>

            <button type="button" onClick={handleReschedule} disabled={rescheduleBusy}>
              {rescheduleBusy ? 'Reagendando...' : 'Guardar cambio'}
            </button>

            <FeedbackBanner kind="danger" message={rescheduleError} />

            <h3 className="section-title">Pagos</h3>
            {detailData.payments?.length ? (
              <ul className="simple-list compact">
                {detailData.payments.map((payment) => (
                  <li key={payment.id}>
                    <strong>Pago #{payment.id}</strong>
                    <span>{formatStatus(payment.status)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin pagos" description="La cita aún no tiene pagos registrados." />
            )}

            <h3 className="section-title">Auditoría</h3>
            {detailData.audit?.length ? (
              <ul className="timeline-list">
                {detailData.audit.map((event) => (
                  <li key={event.id}>
                    <div>
                      <strong>{formatShortDateTime(event.createdAt)}</strong>
                      <span className="status-chip">{event.action}</span>
                    </div>
                    <p>{event.actorType}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin eventos" description="No hay eventos de auditoría para esta cita." />
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
