export function EmptyState({ title, description, tone = 'default' }) {
  return (
    <div className={`empty-state-block tone-${tone}`}>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}
