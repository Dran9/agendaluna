import { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, CalendarDots, CheckCircle, Clock, UserCircle, WarningCircle } from '@phosphor-icons/react';
import { ServiceCard } from './components/ServiceCard';
import { apiUrl } from './lib/api';

const fallbackCatalog = {
  center: {
    id: 1,
    brandName: 'Luna Mandala',
    logoUrl: '',
    supportWhatsappText:
      'Hola, quisiera orientacion para elegir una terapia en Luna Mandala.',
    whatsappNumber: '59170000000'
  },
  services: [
    {
      id: 1,
      name: 'Terapia Floral',
      description: 'Sesion de equilibrio emocional con esencias florales.',
      durationMin: 60,
      basePriceCents: 14000,
      currency: 'BOB'
    },
    {
      id: 2,
      name: 'Masaje Terapeutico',
      description: 'Trabajo corporal orientado a tension muscular y descanso.',
      durationMin: 75,
      basePriceCents: 18000,
      currency: 'BOB'
    }
  ],
  therapists: [
    { id: 1, fullName: 'Mara Quintana' },
    { id: 2, fullName: 'Sofia Velarde' },
    { id: 3, fullName: 'Camila Arze' }
  ]
};

function dateInputTodayInBolivia() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(new Date());
  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return `${map.year}-${map.month}-${map.day}`;
}

function makeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `idem_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
}

function formatSlotTime(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCurrency(cents, currency) {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: currency || 'BOB',
    maximumFractionDigits: 2
  }).format((Number(cents) || 0) / 100);
}

function resolveSlotCandidate(slot, selectedTherapistId, recommendation) {
  if (!slot?.candidates?.length) {
    return null;
  }

  if (selectedTherapistId) {
    const direct = slot.candidates.find((item) => item.therapistId === Number(selectedTherapistId));
    if (direct) {
      return direct;
    }
  }

  if (recommendation?.therapistId) {
    const byRecommendation = slot.candidates.find(
      (item) => item.therapistId === recommendation.therapistId
    );
    if (byRecommendation) {
      return byRecommendation;
    }
  }

  return slot.candidates[0];
}

export default function App() {
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [catalogError, setCatalogError] = useState('');

  const [selectedServiceId, setSelectedServiceId] = useState(fallbackCatalog.services[0].id);
  const [therapistId, setTherapistId] = useState('');
  const [date, setDate] = useState(dateInputTodayInBolivia());

  const [availability, setAvailability] = useState({
    slots: [],
    recommendation: null,
    mockFallbackUsed: false
  });
  const [availabilityError, setAvailabilityError] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmedAppointment, setConfirmedAppointment] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState('');
  const [manageSuccess, setManageSuccess] = useState('');
  const [manageAppointmentId, setManageAppointmentId] = useState('');
  const [manageWhatsapp, setManageWhatsapp] = useState('');
  const [manageToken, setManageToken] = useState('');
  const [managedAppointment, setManagedAppointment] = useState(null);
  const [manageDate, setManageDate] = useState(dateInputTodayInBolivia());
  const [manageSlots, setManageSlots] = useState([]);
  const [manageSelectedSlot, setManageSelectedSlot] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const selectedService = useMemo(
    () => catalog.services.find((service) => service.id === selectedServiceId) || catalog.services[0],
    [catalog.services, selectedServiceId]
  );

  useEffect(() => {
    async function loadCatalog() {
      setCatalogError('');
      try {
        const response = await fetch(apiUrl('/api/public/catalog'));
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message || 'No se pudo cargar el catalogo.');
        }

        if (!payload?.services?.length) {
          throw new Error('El centro no tiene servicios configurados.');
        }

        setCatalog(payload);
        setSelectedServiceId(payload.services[0].id);
      } catch (error) {
        setCatalogError(error.message || 'No se pudo cargar el catalogo.');
        setCatalog(fallbackCatalog);
      }
    }

    loadCatalog();
  }, []);

  async function onSearchAvailability() {
    if (!selectedService) {
      return;
    }

    setLoadingAvailability(true);
    setAvailabilityError('');
    setConfirmError('');
    setConfirmedAppointment(null);
    setSelectedSlot(null);

    try {
      const response = await fetch(apiUrl('/api/public/availability'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          centerId: catalog.center.id,
          serviceId: selectedService.id,
          therapistId: therapistId ? Number(therapistId) : null,
          date
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo calcular disponibilidad.');
      }

      setAvailability({
        slots: payload.slots || [],
        recommendation: payload.recommendation || null,
        mockFallbackUsed: Boolean(payload.mockFallbackUsed)
      });

      if (!payload?.slots?.length) {
        setAvailabilityError('No encontramos horarios disponibles para esta fecha.');
      }
    } catch (error) {
      setAvailability({ slots: [], recommendation: null, mockFallbackUsed: false });
      setAvailabilityError(error.message || 'No se pudo calcular disponibilidad.');
    } finally {
      setLoadingAvailability(false);
    }
  }

  function onSelectSlot(slot) {
    const candidate = resolveSlotCandidate(slot, therapistId, availability.recommendation);
    setSelectedSlot({ ...slot, selectedCandidate: candidate });
    setConfirmedAppointment(null);
    setConfirmError('');
  }

  async function onConfirmAppointment() {
    if (!selectedService || !selectedSlot?.startsAt) {
      setConfirmError('Primero selecciona un horario disponible.');
      return;
    }

    if (!clientName.trim() || !clientWhatsapp.trim()) {
      setConfirmError('Ingresa nombre y WhatsApp para confirmar.');
      return;
    }

    setConfirming(true);
    setConfirmError('');

    const effectiveTherapistId = therapistId
      ? Number(therapistId)
      : selectedSlot?.selectedCandidate?.therapistId || null;

    try {
      const response = await fetch(apiUrl('/api/public/confirm'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          centerId: catalog.center.id,
          serviceId: selectedService.id,
          therapistId: effectiveTherapistId,
          startsAt: selectedSlot.startsAt,
          idempotencyKey: makeIdempotencyKey(),
          client: {
            fullName: clientName.trim(),
            whatsappPhone: clientWhatsapp.trim()
          }
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ese horario se acaba de ocupar. Elige otro slot.');
        }
        throw new Error(payload?.message || 'No se pudo confirmar la cita.');
      }

      setConfirmedAppointment(payload.appointment || null);
      setSelectedSlot(null);
      setAvailability((prev) => ({ ...prev, slots: [] }));
    } catch (error) {
      setConfirmError(error.message || 'No se pudo confirmar la cita.');
    } finally {
      setConfirming(false);
    }
  }

  async function onRequestManageToken() {
    if (!manageAppointmentId.trim() || !manageWhatsapp.trim()) {
      setManageError('Ingresa ID de cita y WhatsApp para continuar.');
      return;
    }

    setManageLoading(true);
    setManageError('');
    setManageSuccess('');

    try {
      const response = await fetch(apiUrl('/api/public/manage-token'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          centerId: catalog.center.id,
          appointmentId: Number(manageAppointmentId),
          whatsappPhone: manageWhatsapp.trim()
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo validar la cita.');
      }

      setManageToken(payload.manageToken || '');
      setManagedAppointment(payload.appointment || null);
      setManageDate(dateInputTodayInBolivia());
      setManageSlots([]);
      setManageSelectedSlot(null);
    } catch (error) {
      setManageError(error.message || 'No se pudo validar la cita.');
    } finally {
      setManageLoading(false);
    }
  }

  async function onSearchManageAvailability() {
    if (!managedAppointment?.serviceId) {
      setManageError('Primero valida la cita.');
      return;
    }

    setManageLoading(true);
    setManageError('');
    setManageSuccess('');

    try {
      const response = await fetch(apiUrl('/api/public/availability'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          centerId: catalog.center.id,
          serviceId: managedAppointment.serviceId,
          therapistId: managedAppointment.therapistId || null,
          date: manageDate
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo cargar disponibilidad para reagendar.');
      }

      setManageSlots(payload.slots || []);
      setManageSelectedSlot(null);

      if (!payload?.slots?.length) {
        setManageError('No hay slots para esa fecha.');
      }
    } catch (error) {
      setManageSlots([]);
      setManageError(error.message || 'No se pudo cargar disponibilidad.');
    } finally {
      setManageLoading(false);
    }
  }

  async function onRescheduleAppointment() {
    if (!manageToken || !managedAppointment?.id) {
      setManageError('Primero valida la cita para gestionar.');
      return;
    }

    if (!manageSelectedSlot?.startsAt) {
      setManageError('Selecciona un horario para reagendar.');
      return;
    }

    setManageLoading(true);
    setManageError('');
    setManageSuccess('');

    try {
      const response = await fetch(apiUrl('/api/public/reschedule'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          centerId: catalog.center.id,
          appointmentId: managedAppointment.id,
          manageToken,
          startsAt: manageSelectedSlot.startsAt,
          therapistId: manageSelectedSlot?.selectedCandidate?.therapistId || null
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Ese horario ya no está disponible.');
        }
        throw new Error(payload?.message || 'No se pudo reagendar.');
      }

      setManagedAppointment(payload.appointment || managedAppointment);
      setManageSuccess('Cita reagendada correctamente.');
      setManageSlots([]);
      setManageSelectedSlot(null);
    } catch (error) {
      setManageError(error.message || 'No se pudo reagendar.');
    } finally {
      setManageLoading(false);
    }
  }

  async function onCancelAppointment() {
    if (!manageToken || !managedAppointment?.id) {
      setManageError('Primero valida la cita para gestionar.');
      return;
    }

    setManageLoading(true);
    setManageError('');
    setManageSuccess('');

    try {
      const response = await fetch(apiUrl('/api/public/cancel'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          centerId: catalog.center.id,
          appointmentId: managedAppointment.id,
          manageToken,
          reason: cancelReason.trim()
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'No se pudo cancelar la cita.');
      }

      setManagedAppointment(payload.appointment || managedAppointment);
      setManageSuccess('Cita cancelada correctamente.');
      setManageSlots([]);
      setManageSelectedSlot(null);
    } catch (error) {
      setManageError(error.message || 'No se pudo cancelar la cita.');
    } finally {
      setManageLoading(false);
    }
  }

  const supportUrl = `https://wa.me/${catalog.center.whatsappNumber || ''}?text=${encodeURIComponent(
    catalog.center.supportWhatsappText
  )}`;

  return (
    <main className="booking-page">
      <section className="booking-card">
        <header className="booking-header">
          <div className="logo-slot" aria-label="Logo del centro">
            {catalog.center.logoUrl ? (
              <img src={catalog.center.logoUrl} alt={catalog.center.brandName} />
            ) : (
              <span>LM</span>
            )}
          </div>
          <div>
            <p>Agenda Luna</p>
            <h1>{catalog.center.brandName}</h1>
          </div>
        </header>

        {catalogError ? (
          <section className="warning-strip" role="status">
            <WarningCircle size={16} />
            <span>{catalogError}</span>
          </section>
        ) : null}

        <section className="section-block">
          <h2>Selecciona un servicio</h2>
          <div className="service-list">
            {catalog.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={service.id === selectedServiceId}
                onSelect={() => {
                  setSelectedServiceId(service.id);
                  setAvailability({ slots: [], recommendation: null, mockFallbackUsed: false });
                  setSelectedSlot(null);
                  setConfirmedAppointment(null);
                }}
              />
            ))}
          </div>
          <small className="service-price">
            Desde {formatCurrency(selectedService?.basePriceCents, selectedService?.currency)}
          </small>
        </section>

        <section className="section-block">
          <h2>Elegir terapeuta</h2>
          <label className="select-field">
            <UserCircle size={18} />
            <select
              value={therapistId}
              onChange={(event) => {
                setTherapistId(event.target.value);
                setSelectedSlot(null);
                setConfirmedAppointment(null);
              }}
            >
              <option value="">Sugerencia automatica</option>
              {catalog.therapists.map((therapist) => (
                <option key={therapist.id} value={therapist.id}>
                  {therapist.fullName}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="section-block compact">
          <h2>Fecha</h2>
          <label className="select-field">
            <CalendarDots size={18} />
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedSlot(null);
                setConfirmedAppointment(null);
              }}
            />
          </label>
          <button type="button" className="primary-btn" onClick={onSearchAvailability}>
            {loadingAvailability ? 'Buscando...' : 'Ver horarios disponibles'}
          </button>
        </section>

        {availability.mockFallbackUsed ? (
          <section className="warning-strip" role="status">
            <WarningCircle size={16} />
            <span>Usando mock de desarrollo (ENABLE_MOCK_FALLBACK=true).</span>
          </section>
        ) : null}

        {availability.recommendation ? (
          <section className="recommendation">
            <p>Te ofrecemos trabajar con {availability.recommendation.therapistName}</p>
            <small>{availability.recommendation.reason}</small>
          </section>
        ) : null}

        {availabilityError ? <p className="error-text">{availabilityError}</p> : null}

        {availability.slots.length > 0 ? (
          <section className="slots">
            {availability.slots.slice(0, 12).map((slot) => {
              const candidate = resolveSlotCandidate(slot, therapistId, availability.recommendation);
              const isSelected = selectedSlot?.startsAt === slot.startsAt;

              return (
                <button
                  key={`${slot.startsAt}-${candidate?.therapistId || 'any'}`}
                  type="button"
                  className={`slot-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelectSlot(slot)}
                >
                  <Clock size={16} />
                  <strong>{formatSlotTime(slot.startsAt)}</strong>
                  <small>{candidate?.therapistName || 'Disponible'}</small>
                </button>
              );
            })}
          </section>
        ) : null}

        <section className="section-block">
          <h2>Datos de contacto</h2>
          <input
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Nombre y apellido"
          />
          <input
            value={clientWhatsapp}
            onChange={(event) => setClientWhatsapp(event.target.value)}
            placeholder="WhatsApp"
          />
          <button type="button" className="primary-btn" onClick={onConfirmAppointment}>
            {confirming ? 'Confirmando...' : 'Confirmar cita'}
          </button>
          {confirmError ? <p className="error-text">{confirmError}</p> : null}
        </section>

        {confirmedAppointment ? (
          <section className="success-panel" role="status">
            <CheckCircle size={18} />
            <div>
              <strong>Cita confirmada</strong>
              <p>
                #{confirmedAppointment.id} para {formatSlotTime(confirmedAppointment.startsAt)}.
              </p>
            </div>
          </section>
        ) : null}

        {manageOpen ? (
          <section className="manage-panel">
            <h2>Gestionar mi cita</h2>
            <p>
              Si ya tienes una cita confirmada, puedes validarla con tu ID y WhatsApp para
              reagendar o cancelar.
            </p>

            <input
              value={manageAppointmentId}
              onChange={(event) => setManageAppointmentId(event.target.value)}
              placeholder="ID de cita (ej. 22)"
            />
            <input
              value={manageWhatsapp}
              onChange={(event) => setManageWhatsapp(event.target.value)}
              placeholder="WhatsApp usado en la reserva"
            />
            <button type="button" className="primary-btn" onClick={onRequestManageToken}>
              {manageLoading ? 'Validando...' : 'Validar cita'}
            </button>

            {managedAppointment ? (
              <div className="manage-summary">
                <strong>Cita #{managedAppointment.id}</strong>
                <small>
                  Estado: {managedAppointment.status} · Inicio:{' '}
                  {formatSlotTime(managedAppointment.startsAt)}
                </small>
              </div>
            ) : null}

            {managedAppointment ? (
              <div className="manage-actions">
                <label className="select-field">
                  <CalendarDots size={18} />
                  <input
                    type="date"
                    value={manageDate}
                    onChange={(event) => setManageDate(event.target.value)}
                  />
                </label>
                <button type="button" className="ghost-btn" onClick={onSearchManageAvailability}>
                  Buscar slots
                </button>

                {manageSlots.length > 0 ? (
                  <div className="slots">
                    {manageSlots.slice(0, 8).map((slot) => {
                      const selectedCandidate = resolveSlotCandidate(
                        slot,
                        managedAppointment?.therapistId || '',
                        null
                      );
                      const isSelected = manageSelectedSlot?.startsAt === slot.startsAt;

                      return (
                        <button
                          key={`manage-${slot.startsAt}`}
                          type="button"
                          className={`slot-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() =>
                            setManageSelectedSlot({
                              ...slot,
                              selectedCandidate
                            })
                          }
                        >
                          <Clock size={16} />
                          <strong>{formatSlotTime(slot.startsAt)}</strong>
                          <small>{selectedCandidate?.therapistName || 'Disponible'}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <button type="button" className="primary-btn" onClick={onRescheduleAppointment}>
                  {manageLoading ? 'Procesando...' : 'Reagendar'}
                </button>

                <input
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  placeholder="Motivo de cancelación (opcional)"
                />
                <button type="button" className="ghost-btn" onClick={onCancelAppointment}>
                  Cancelar cita
                </button>
              </div>
            ) : null}

            {manageError ? <p className="error-text">{manageError}</p> : null}
            {manageSuccess ? <p className="success-text">{manageSuccess}</p> : null}
          </section>
        ) : null}

        <footer className="footer-actions">
          <a href={supportUrl} target="_blank" rel="noreferrer" className="guide-btn">
            Buscar guia
            <ArrowSquareOut size={16} />
          </a>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setManageOpen((prev) => !prev)}
          >
            {manageOpen ? 'Cerrar gestión' : 'Gestionar mi cita'}
          </button>
        </footer>
      </section>
    </main>
  );
}
