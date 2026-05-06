import { formatCurrency } from '../lib/formatters';

export function TherapistsView({ loading, error, period, therapists }) {
  return (
    <section className="single-column">
      <article className="panel">
        <header className="panel-header">
          <h2>Terapeutas</h2>
          <span className="panel-subtitle">Periodo {period || 'actual'}</span>
        </header>

        {loading ? <p className="empty-state">Cargando terapeutas...</p> : null}
        {error ? <p className="empty-state error-state">{error}</p> : null}

        {!loading && !error && therapists.length === 0 ? (
          <p className="empty-state">No hay terapeutas activos para mostrar.</p>
        ) : null}

        {!loading && !error && therapists.length > 0 ? (
          <div className="therapist-grid">
            {therapists.map((therapist) => (
              <article key={therapist.id} className="therapist-card">
                <header>
                  <h3>{therapist.fullName}</h3>
                  <span className={`status-chip ${therapist.isActive ? 'is-success' : 'is-danger'}`}>
                    {therapist.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </header>

                <p className="muted-paragraph">{therapist.bioShort || 'Sin bio corta configurada.'}</p>

                <div className="card-kpis">
                  <div>
                    <strong>{therapist.sessions}</strong>
                    <small>Sesiones</small>
                  </div>
                  <div>
                    <strong>{formatCurrency(therapist.generatedCents)}</strong>
                    <small>Generado</small>
                  </div>
                  <div>
                    <strong>{formatCurrency(therapist.lunaShareCents)}</strong>
                    <small>Luna</small>
                  </div>
                </div>

                <p className="muted-paragraph">Servicios: {therapist.services.join(', ') || 'Sin asignar'}</p>
                <p className="muted-paragraph">
                  Telegram: {therapist.telegram?.linked ? `Vinculado (${therapist.telegram.telegramUsername || therapist.telegram.telegramUserId})` : 'No vinculado'}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
