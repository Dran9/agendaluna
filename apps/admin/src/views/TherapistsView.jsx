import { useMemo, useState } from 'react'
import { Drawer } from '../components/ui/Drawer'
import { EmptyState } from '../components/ui/EmptyState'
import { FeedbackBanner } from '../components/ui/FeedbackBanner'
import { FormField, TextareaField, ToggleField } from '../components/ui/FormFields'
import { formatCurrency } from '../lib/formatters'

const WEEK_DAYS = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' }
]

function createDefaultSchedule() {
  return WEEK_DAYS.map((day) => ({
    weekday: day.value,
    startTime: '08:00',
    endTime: '18:00',
    isActive: day.value >= 1 && day.value <= 5
  }))
}

function buildInitialForm(therapist) {
  return {
    fullName: therapist?.fullName || '',
    bioShort: therapist?.bioShort || '',
    phone: therapist?.phone || '',
    email: therapist?.email || '',
    commissionPct: String(therapist?.commissionPct ?? 60),
    isActive: therapist?.isActive ?? true
  }
}

export function TherapistsView({
  loading,
  error,
  period,
  therapists,
  serviceOptions,
  catalogTherapists,
  onCreateTherapist,
  onUpdateTherapist,
  onSaveTherapistServices,
  onLoadTherapistSchedule,
  onSaveTherapistSchedule
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTherapistId, setEditingTherapistId] = useState(null)
  const [form, setForm] = useState(() => buildInitialForm(null))
  const [scheduleRows, setScheduleRows] = useState(() => createDefaultSchedule())
  const [selectedServiceIds, setSelectedServiceIds] = useState([])
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  const servicesById = useMemo(() => {
    const map = new Map()
    for (const service of serviceOptions || []) {
      map.set(service.id, service)
    }
    return map
  }, [serviceOptions])

  const catalogByTherapistId = useMemo(() => {
    const map = new Map()
    for (const therapist of catalogTherapists || []) {
      map.set(therapist.id, therapist)
    }
    return map
  }, [catalogTherapists])

  async function openForCreate() {
    setEditingTherapistId(null)
    setForm(buildInitialForm(null))
    setScheduleRows(createDefaultSchedule())
    setSelectedServiceIds([])
    setSaveError('')
    setSaveSuccess('')
    setDrawerOpen(true)
  }

  async function openForEdit(therapist) {
    setEditingTherapistId(therapist.id)
    setForm(buildInitialForm(therapist))
    setSaveError('')
    setSaveSuccess('')
    setDrawerOpen(true)
    setLoadingSchedule(true)

    try {
      const catalogRow = catalogByTherapistId.get(therapist.id)
      const serviceIds = (catalogRow?.services || [])
        .filter((entry) => entry.isActive)
        .map((entry) => Number(entry.serviceId))
      setSelectedServiceIds(serviceIds)

      const schedule = await onLoadTherapistSchedule(therapist.id)
      if (schedule.length) {
        const rowByWeekday = new Map(schedule.map((item) => [item.weekday, item]))
        setScheduleRows(
          WEEK_DAYS.map((day) => {
            const found = rowByWeekday.get(day.value)
            if (!found) {
              return {
                weekday: day.value,
                startTime: '08:00',
                endTime: '18:00',
                isActive: false
              }
            }
            return {
              weekday: day.value,
              startTime: String(found.startTime).slice(0, 5),
              endTime: String(found.endTime).slice(0, 5),
              isActive: Boolean(found.isActive)
            }
          })
        )
      } else {
        setScheduleRows(createDefaultSchedule())
      }
    } catch (loadError) {
      setSaveError(loadError.message || 'No se pudo cargar horario del terapeuta.')
      setScheduleRows(createDefaultSchedule())
    } finally {
      setLoadingSchedule(false)
    }
  }

  async function handleSave() {
    setSaveError('')
    setSaveSuccess('')

    if (!form.fullName.trim()) {
      setSaveError('El nombre del terapeuta es obligatorio.')
      return
    }

    setSaving(true)

    try {
      const payload = {
        fullName: form.fullName,
        bioShort: form.bioShort,
        phone: form.phone,
        email: form.email,
        commissionPct: Number(form.commissionPct || 0),
        isActive: Boolean(form.isActive)
      }

      let therapistId = editingTherapistId

      if (!therapistId) {
        const created = await onCreateTherapist(payload)
        therapistId = created.id
      } else {
        await onUpdateTherapist(therapistId, payload)
      }

      await onSaveTherapistServices(
        therapistId,
        selectedServiceIds.map((value) => Number(value))
      )

      await onSaveTherapistSchedule(
        therapistId,
        scheduleRows.map((row) => ({
          weekday: row.weekday,
          startTime: `${row.startTime}:00`,
          endTime: `${row.endTime}:00`,
          isActive: row.isActive
        }))
      )

      setSaveSuccess('Terapeuta guardado correctamente.')
    } catch (saveOperationError) {
      setSaveError(saveOperationError.message || 'No se pudo guardar terapeuta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="single-column">
      <article className="panel">
        <header className="panel-header">
          <h2>Terapeutas</h2>
          <div className="header-actions">
            <span className="panel-subtitle">Periodo {period || 'actual'}</span>
            <button type="button" onClick={openForCreate}>
              Nuevo terapeuta
            </button>
          </div>
        </header>

        {loading ? (
          <EmptyState title="Cargando terapeutas" description="Reuniendo métricas de sesiones y producción." />
        ) : null}
        {error ? <EmptyState title="No se pudo cargar" description={error} tone="danger" /> : null}

        {!loading && !error && therapists.length === 0 ? (
          <EmptyState title="Sin terapeutas" description="Crea un terapeuta para habilitar asignación por servicio." />
        ) : null}

        {!loading && !error && therapists.length > 0 ? (
          <ul className="therapist-list">
            {therapists.map((therapist) => (
              <li key={therapist.id}>
                <article className="therapist-row">
                  <div>
                    <strong>{therapist.fullName}</strong>
                    <p>{therapist.bioShort || 'Sin bio corta configurada.'}</p>
                    <small>Servicios: {therapist.services.join(', ') || 'Sin asignar'}</small>
                  </div>

                  <div className="therapist-metrics">
                    <span>{therapist.sessions} sesiones</span>
                    <span>{formatCurrency(therapist.generatedCents)} generado</span>
                    <span>{formatCurrency(therapist.lunaShareCents)} para Luna</span>
                    <span>{therapist.isActive ? 'Activo' : 'Inactivo'}</span>
                  </div>

                  <div className="row-actions">
                    <button type="button" onClick={() => openForEdit(therapist)}>
                      Editar
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <Drawer
        open={drawerOpen}
        title={editingTherapistId ? 'Editar terapeuta' : 'Nuevo terapeuta'}
        subtitle="Perfil, porcentaje, servicios y horario semanal"
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
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar terapeuta'}
            </button>
          </div>
        }
      >
        <FeedbackBanner kind="danger" message={saveError} />
        <FeedbackBanner kind="success" message={saveSuccess} />

        <div className="form-grid two-cols">
          <FormField
            label="Nombre"
            value={form.fullName}
            onChange={(value) => setForm((prev) => ({ ...prev, fullName: value }))}
            required
          />
          <FormField
            label="Comisión terapeuta (%)"
            type="number"
            value={form.commissionPct}
            onChange={(value) => setForm((prev) => ({ ...prev, commissionPct: value }))}
          />
          <FormField
            label="Teléfono"
            value={form.phone}
            onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          />
          <FormField
            label="Email"
            value={form.email}
            onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
          />
          <TextareaField
            label="Bio corta"
            value={form.bioShort}
            onChange={(value) => setForm((prev) => ({ ...prev, bioShort: value }))}
            rows={3}
          />
          <ToggleField
            label="Terapeuta activo"
            checked={form.isActive}
            onChange={(value) => setForm((prev) => ({ ...prev, isActive: value }))}
          />
        </div>

        <h3 className="section-title">Servicios asignados</h3>
        <div className="check-grid">
          {serviceOptions.map((service) => {
            const checked = selectedServiceIds.includes(service.id)
            return (
              <label key={service.id} className="check-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const isChecked = event.target.checked
                    setSelectedServiceIds((prev) => {
                      if (isChecked) {
                        return [...prev, service.id]
                      }
                      return prev.filter((value) => value !== service.id)
                    })
                  }}
                />
                <span>{service.name}</span>
              </label>
            )
          })}
        </div>

        <h3 className="section-title">Horario semanal simple</h3>
        {loadingSchedule ? <p className="muted-paragraph">Cargando horario...</p> : null}

        {!loadingSchedule ? (
          <div className="schedule-grid">
            {scheduleRows.map((row) => {
              const dayLabel = WEEK_DAYS.find((day) => day.value === row.weekday)?.label || row.weekday
              return (
                <div key={row.weekday} className="schedule-row">
                  <strong>{dayLabel}</strong>
                  <label>
                    <span>Inicio</span>
                    <input
                      className="input"
                      type="time"
                      value={row.startTime}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setScheduleRows((prev) =>
                          prev.map((item) =>
                            item.weekday === row.weekday ? { ...item, startTime: nextValue } : item
                          )
                        )
                      }}
                    />
                  </label>
                  <label>
                    <span>Fin</span>
                    <input
                      className="input"
                      type="time"
                      value={row.endTime}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        setScheduleRows((prev) =>
                          prev.map((item) =>
                            item.weekday === row.weekday ? { ...item, endTime: nextValue } : item
                          )
                        )
                      }}
                    />
                  </label>
                  <ToggleField
                    label="Activo"
                    checked={row.isActive}
                    onChange={(value) =>
                      setScheduleRows((prev) =>
                        prev.map((item) => (item.weekday === row.weekday ? { ...item, isActive: value } : item))
                      )
                    }
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </Drawer>
    </section>
  )
}
