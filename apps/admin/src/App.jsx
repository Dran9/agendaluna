import { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { KpiCard } from './components/KpiCard';
import { apiUrl } from './lib/api';

const TOKEN_STORAGE_KEY = 'agenda_luna_admin_token';

function toShortTime(value) {
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return date.toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusLabel(status) {
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'pending') return 'Pendiente';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'completed') return 'Completada';
  return status;
}

function useAdminData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({
    totalToday: 0,
    confirmedToday: 0,
    pendingToday: 0,
    cancelledToday: 0,
    pendingPayments: 0
  });
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    async function getToken() {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) {
        return stored;
      }

      if (!import.meta.env.DEV) {
        throw new Error('No hay sesion activa de admin para este entorno.');
      }

      const tokenResponse = await fetch(apiUrl('/api/admin/auth/dev-token'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ centerId: 1, email: 'admin@luna.local' })
      });

      const tokenPayload = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenPayload?.token) {
        throw new Error(tokenPayload?.message || 'No se pudo obtener token dev.');
      }

      localStorage.setItem(TOKEN_STORAGE_KEY, tokenPayload.token);
      return tokenPayload.token;
    }

    async function load() {
      setLoading(true);
      setError('');

      try {
        const token = await getToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [summaryResponse, todayResponse] = await Promise.all([
          fetch(apiUrl('/api/admin/control/summary'), { headers }),
          fetch(apiUrl('/api/admin/control/today'), { headers })
        ]);

        const summaryPayload = await summaryResponse.json();
        const todayPayload = await todayResponse.json();

        if (!summaryResponse.ok) {
          throw new Error(summaryPayload?.message || 'No se pudo cargar resumen de Control.');
        }

        if (!todayResponse.ok) {
          throw new Error(todayPayload?.message || 'No se pudo cargar citas de hoy.');
        }

        setSummary(summaryPayload.summary || {});
        setAppointments(todayPayload.appointments || []);
      } catch (err) {
        setError(err.message || 'No se pudo cargar Control.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { loading, error, summary, appointments };
}

export default function App({ initialTheme, onToggleTheme }) {
  const { loading, error, summary, appointments } = useAdminData();

  const railData = useMemo(() => {
    if (!appointments.length) {
      return [];
    }

    const byRoom = new Map();
    for (const appointment of appointments) {
      if (!byRoom.has(appointment.room_name)) {
        byRoom.set(appointment.room_name, appointment);
      }
    }

    return Array.from(byRoom.values()).map((item) => ({
      room: item.room_name,
      state: `${statusLabel(item.status)} • ${toShortTime(item.starts_at)}`
    }));
  }, [appointments]);

  return (
    <div className="shell">
      <Sidebar theme={initialTheme} onToggleTheme={onToggleTheme} />

      <div className="shell-content">
        <Topbar />

        <main className="content-grid">
          <section className="main-column">
            <div className="kpi-grid">
              <KpiCard label="Citas hoy" value={String(summary.totalToday || 0)} />
              <KpiCard
                label="Pagos pendientes"
                value={String(summary.pendingPayments || 0)}
                tone="warning"
              />
              <KpiCard
                label="Confirmadas"
                value={String(summary.confirmedToday || 0)}
                tone="success"
              />
              <KpiCard
                label="Pendientes"
                value={String(summary.pendingToday || 0)}
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

              {!loading && !error && appointments.length === 0 ? (
                <p className="empty-state">Aun no hay citas para hoy. Puedes crear una desde Control.</p>
              ) : null}

              {!loading && !error && appointments.length > 0 ? (
                <ul className="appointment-list">
                  {appointments.map((appointment) => (
                    <li key={appointment.id} className="appointment-row">
                      <div>
                        <strong>{toShortTime(appointment.starts_at)}</strong>
                        <span>{appointment.client_name}</span>
                      </div>
                      <div>
                        <span>{appointment.service_name}</span>
                        <small>{appointment.therapist_name}</small>
                      </div>
                      <div>
                        <span>{appointment.room_name}</span>
                        <small>{statusLabel(appointment.status)}</small>
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
        </main>
      </div>
    </div>
  );
}
