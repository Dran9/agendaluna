export function KpiCard({ label, value, tone = 'default' }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
