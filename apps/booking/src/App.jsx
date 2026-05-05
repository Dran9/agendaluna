import { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, Clock, UserCircle } from '@phosphor-icons/react';
import { ServiceCard } from './components/ServiceCard';

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

function formatSlotDate(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function initialDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [selectedServiceId, setSelectedServiceId] = useState(fallbackCatalog.services[0].id);
  const [therapistId, setTherapistId] = useState('');
  const [date, setDate] = useState(initialDate());
  const [availability, setAvailability] = useState({ slots: [], recommendation: null });
  const [loading, setLoading] = useState(false);

  const selectedService = useMemo(
    () => catalog.services.find((service) => service.id === selectedServiceId) || catalog.services[0],
    [catalog.services, selectedServiceId]
  );

  useEffect(() => {
    async function loadCatalog() {
      try {
        const response = await fetch('http://127.0.0.1:3000/api/public/catalog');
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (payload?.services?.length) {
          setCatalog(payload);
          setSelectedServiceId(payload.services[0].id);
        }
      } catch {
        // fallback to local mock data.
      }
    }

    loadCatalog();
  }, []);

  async function onSearchAvailability() {
    if (!selectedService) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:3000/api/public/availability', {
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

      if (!response.ok) {
        setAvailability({ slots: [], recommendation: null });
        return;
      }

      const payload = await response.json();
      setAvailability({
        slots: payload.slots || [],
        recommendation: payload.recommendation || null
      });
    } catch {
      setAvailability({ slots: [], recommendation: null });
    } finally {
      setLoading(false);
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

        <section className="section-block">
          <h2>Selecciona un servicio</h2>
          <div className="service-list">
            {catalog.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={service.id === selectedServiceId}
                onSelect={() => setSelectedServiceId(service.id)}
              />
            ))}
          </div>
        </section>

        <section className="section-block">
          <h2>Elegir terapeuta</h2>
          <label className="select-field">
            <UserCircle size={18} />
            <select value={therapistId} onChange={(event) => setTherapistId(event.target.value)}>
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
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button type="button" className="primary-btn" onClick={onSearchAvailability}>
            {loading ? 'Buscando...' : 'Ver horarios disponibles'}
          </button>
        </section>

        {availability.recommendation ? (
          <section className="recommendation">
            <p>Te ofrecemos trabajar con {availability.recommendation.therapistName}</p>
            <small>{availability.recommendation.reason}</small>
          </section>
        ) : null}

        {availability.slots.length > 0 ? (
          <section className="slots">
            {availability.slots.slice(0, 8).map((slot) => (
              <article key={slot.startsAt}>
                <Clock size={16} />
                <span>{formatSlotDate(slot.startsAt)}</span>
                <small>{slot.therapists[0]?.therapistName || 'Disponible'}</small>
              </article>
            ))}
          </section>
        ) : null}

        <footer className="footer-actions">
          <a href={supportUrl} target="_blank" rel="noreferrer" className="guide-btn">
            Buscar guia
            <ArrowSquareOut size={16} />
          </a>
          <button type="button" className="ghost-btn">
            Gestionar mi cita
          </button>
        </footer>
      </section>
    </main>
  );
}
