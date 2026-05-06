import { formatCurrency, formatShortDateTime, formatStatus } from '../lib/formatters';

export function FinancesView({
  loading,
  error,
  range,
  summary,
  byTherapist,
  payments,
  onManualVerify,
  verifyingPaymentId
}) {
  return (
    <section className="single-column">
      <article className="panel">
        <header className="panel-header">
          <h2>Finanzas</h2>
          <span className="panel-subtitle">
            {range?.from || '—'} a {range?.to || '—'}
          </span>
        </header>

        {loading ? <p className="empty-state">Cargando finanzas...</p> : null}
        {error ? <p className="empty-state error-state">{error}</p> : null}

        {!loading && !error ? (
          <div className="finance-kpis">
            <div>
              <strong>{formatCurrency(summary?.totalCents || 0)}</strong>
              <small>Total</small>
            </div>
            <div>
              <strong>{formatCurrency(summary?.pendingCents || 0)}</strong>
              <small>Pendiente</small>
            </div>
            <div>
              <strong>{formatCurrency(summary?.verifiedCents || 0)}</strong>
              <small>Verificado</small>
            </div>
            <div>
              <strong>{formatCurrency(summary?.reviewCents || 0)}</strong>
              <small>En revisión</small>
            </div>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <header className="panel-header">
          <h2>Corte por terapeuta</h2>
        </header>

        {!loading && !error && byTherapist.length === 0 ? (
          <p className="empty-state">No hay datos de corte en este periodo.</p>
        ) : null}

        {!loading && !error && byTherapist.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Terapeuta</th>
                  <th>Sesiones</th>
                  <th>Bruto</th>
                  <th>Terapeuta</th>
                  <th>Luna</th>
                </tr>
              </thead>
              <tbody>
                {byTherapist.map((row) => (
                  <tr key={row.therapistId}>
                    <td>{row.therapistName}</td>
                    <td>{row.sessions}</td>
                    <td>{formatCurrency(row.grossCents)}</td>
                    <td>{formatCurrency(row.therapistShareCents)}</td>
                    <td>{formatCurrency(row.lunaShareCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="panel">
        <header className="panel-header">
          <h2>Pagos</h2>
        </header>

        {!loading && !error && payments.length === 0 ? (
          <p className="empty-state">No hay pagos en la cola.</p>
        ) : null}

        {!loading && !error && payments.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Actualizado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.id}</td>
                    <td>{payment.client_name}</td>
                    <td>{payment.service_name}</td>
                    <td>{formatCurrency(payment.amount_cents, payment.currency)}</td>
                    <td>{formatStatus(payment.status)}</td>
                    <td>{formatShortDateTime(payment.updated_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => onManualVerify(payment.id, 'verified')}
                          disabled={verifyingPaymentId === payment.id}
                        >
                          Verificar
                        </button>
                        <button
                          type="button"
                          className="ghost-btn-inline"
                          onClick={() => onManualVerify(payment.id, 'needs_review')}
                          disabled={verifyingPaymentId === payment.id}
                        >
                          Revisar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
