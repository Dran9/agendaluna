import { useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { KpiCard } from './components/KpiCard';

const mockAppointments = [
  {
    id: 1042,
    time: '09:00',
    client: 'Daniela Soto',
    service: 'Reiki Integral',
    therapist: 'Mara Quintana',
    room: 'Sala Cielo',
    status: 'Confirmada'
  },
  {
    id: 1043,
    time: '10:30',
    client: 'Rocio Vargas',
    service: 'Terapia Floral',
    therapist: 'Sofia Velarde',
    room: 'Sala Agua',
    status: 'Pago pendiente'
  },
  {
    id: 1044,
    time: '12:00',
    client: 'Alicia Prieto',
    service: 'Masaje Terapeutico',
    therapist: 'Camila Arze',
    room: 'Sala Tierra',
    status: 'Comprobante en revision'
  }
];

export default function App({ initialTheme, onToggleTheme }) {
  const railData = useMemo(
    () => [
      { room: 'Sala Cielo', state: 'Ocupada hasta 10:00' },
      { room: 'Sala Agua', state: 'Libre desde 11:15' },
      { room: 'Sala Tierra', state: 'Mantenimiento 14:00' }
    ],
    []
  );

  return (
    <div className="shell">
      <Sidebar theme={initialTheme} onToggleTheme={onToggleTheme} />

      <div className="shell-content">
        <Topbar />

        <main className="content-grid">
          <section className="main-column">
            <div className="kpi-grid">
              <KpiCard label="Citas hoy" value="18" />
              <KpiCard label="Pagos pendientes" value="6" tone="warning" />
              <KpiCard label="Conflictos sala" value="0" tone="success" />
              <KpiCard label="Comprobantes nuevos" value="3" tone="info" />
            </div>

            <article className="panel">
              <header className="panel-header">
                <h2>Agenda de hoy</h2>
                <button type="button">Nueva cita</button>
              </header>

              <ul className="appointment-list">
                {mockAppointments.map((appointment) => (
                  <li key={appointment.id} className="appointment-row">
                    <div>
                      <strong>{appointment.time}</strong>
                      <span>{appointment.client}</span>
                    </div>
                    <div>
                      <span>{appointment.service}</span>
                      <small>{appointment.therapist}</small>
                    </div>
                    <div>
                      <span>{appointment.room}</span>
                      <small>{appointment.status}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <aside className="side-rail">
            <article className="panel">
              <h3>Estado de salas</h3>
              <ul className="room-rail">
                {railData.map((item) => (
                  <li key={item.room}>
                    <strong>{item.room}</strong>
                    <span>{item.state}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="panel">
              <h3>Marca del centro</h3>
              <p className="brand-placeholder">
                Este bloque reserva espacio real para logo, nombre legal, QR y datos de pago.
              </p>
            </article>
          </aside>
        </main>
      </div>
    </div>
  );
}
