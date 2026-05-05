export function ServiceCard({ service, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`service-card ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
    >
      <strong>{service.name}</strong>
      <p>{service.description}</p>
      <span>{service.durationMin} min</span>
    </button>
  );
}
