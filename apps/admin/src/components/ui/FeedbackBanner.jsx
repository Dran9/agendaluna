export function FeedbackBanner({ kind = 'info', message }) {
  if (!message) {
    return null
  }

  return <p className={`feedback-banner kind-${kind}`}>{message}</p>
}
