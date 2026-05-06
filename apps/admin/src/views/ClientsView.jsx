import { formatShortDateTime, formatStatus } from '../lib/formatters';

export function ClientsView({
  loading,
  error,
  clients,
  selectedClient,
  onSelectClient,
  timeline,
  timelineLoading,
  timelineError
}) {
  return (
    <section className="wide-grid">
      <article className="panel">
        <header className="panel-header">
          <h2>Clientes</h2>
          <button type="button">Nuevo cliente</button>
        </header>

        {loading ? <p className="empty-state">Cargando clientes...</p> : null}
        {error ? <p className="empty-state error-state">{error}</p> : null}

        {!loading && !error && clients.length === 0 ? (
          <p className="empty-state">No hay clientes registrados todavía.</p>
        ) : null}

        {!loading && !error && clients.length > 0 ? (
          <ul className="entity-list">
            {clients.map((client) => (
              <li
                key={client.id}
                className={`entity-row ${selectedClient?.id === client.id ? 'is-active' : ''}`}
              >
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
          <p className="empty-state">Selecciona un cliente para ver su historial.</p>
        ) : null}

        {selectedClient && timelineLoading ? <p className="empty-state">Cargando timeline...</p> : null}
        {selectedClient && timelineError ? <p className="empty-state error-state">{timelineError}</p> : null}

        {selectedClient && !timelineLoading && !timelineError && timeline.length === 0 ? (
          <p className="empty-state">Aun no hay eventos para este cliente.</p>
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
                    {event.item.serviceName} · {event.item.therapistName} ·{' '}
                    {formatStatus(event.item.status)}
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
    </section>
  );
}
