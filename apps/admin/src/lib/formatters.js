export function formatCurrency(cents, currency = 'BOB') {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((Number(cents) || 0) / 100);
}

export function formatShortDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatStatus(status) {
  if (status === 'confirmed') return 'Confirmada';
  if (status === 'pending') return 'Pendiente';
  if (status === 'cancelled') return 'Cancelada';
  if (status === 'completed') return 'Completada';
  if (status === 'verified') return 'Verificado';
  if (status === 'needs_review') return 'En revisión';
  if (status === 'rejected') return 'Rechazado';
  return status || '—';
}
