import { KpiCard } from '../components/KpiCard';
import { formatShortDateTime, formatStatus } from '../lib/formatters';

function buildRoomRail(appointments) {
  if (!appointments?.length) {
    return [];
  }

  const map = new Map();
  for (const appointment of appointments) {
    if (!map.has(appointment.room_name)) {
      map.set(appointment.room_name, appointment);
    }
  }

  return Array.from(map.values()).map((item) => ({
    room: item.room_name,
    state: `${formatStatus(item.status)} • ${formatShortDateTime(item.starts_at)}`
  }));
}

export function ControlView({ loading, error, summary, appointments }) {
  const railData = buildRoomRail(appointments || []);

  return (
    <>
      <section className="main-column">
        <div className="kpi-grid">
          <KpiCard label="Citas hoy" value={String(summary?.totalToday || 0)} />
          <KpiCard
            label="Pagos pendientes"
            value={String(summary?.pendingPayments || 0)}
            tone="warning"
          />
          <KpiCard
            label="Confirmadas"
            value={String(summary?.confirmedToday || 0)}
            tone="success"
          />
          <KpiCard
            label="Pendientes"
            value={String(summary?.pendingToday || 0)}
            tone="info"
          />
        </div>

        <article className="panel">
          <header className="panel-header">
            <h2>Agenda de hoy</h2>
            <button type="button">Nueva cita</button>
          </header>

          {loading ? <p className="empty-state">Cargando agenda...</p> : null}
          {error ? <p className="empty-state error-state">{error}</p> : null}

          {!loading && !error && appointments?.length === 0 ? (
            <p className="empty-state">Aun no hay citas para hoy. Puedes crear una desde Control.</p>
          ) : null}

          {!loading && !error && appointments?.length > 0 ? (
            <ul className="appointment-list">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="appointment-row">
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
            <p className="empty-state">Sin ocupacion de salas por ahora.</p>
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

        <article className="panel">
          <h3>Marca del centro</h3>
          <p className="brand-placeholder">
            Este bloque reserva espacio real para logo, nombre legal, QR y datos de pago.
          </p>
        </article>
      </aside>
    </>
  );
}
