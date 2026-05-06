function renderHelp(help) {
  if (!help) {
    return null
  }
  return <small className="field-help">{help}</small>
}

function renderError(error) {
  if (!error) {
    return null
  }
  return <small className="field-error">{error}</small>
}

export function FormField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  disabled = false,
  help = '',
  error = ''
}) {
  return (
    <label className="field-block">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {renderHelp(help)}
      {renderError(error)}
    </label>
  )
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 3,
  required = false,
  disabled = false,
  help = '',
  error = ''
}) {
  return (
    <label className="field-block">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <textarea
        className="input textarea-input"
        value={value}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {renderHelp(help)}
      {renderError(error)}
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  help = '',
  error = ''
}) {
  return (
    <label className="field-block">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <select className="input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {renderHelp(help)}
      {renderError(error)}
    </label>
  )
}

export function ToggleField({ label, checked, onChange, help = '' }) {
  return (
    <label className="toggle-field">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle-btn ${checked ? 'is-on' : ''}`}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
      {help ? <small className="field-help">{help}</small> : null}
    </label>
  )
}

export function MoneyField({ label, cents, onChange, currency = 'BOB', help = '', error = '' }) {
  const value = Number(cents || 0) / 100
  return (
    <label className="field-block">
      <span>{label}</span>
      <div className="money-input">
        <span>{currency}</span>
        <input
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => {
            const amount = Number(event.target.value || 0)
            onChange(Math.round(amount * 100))
          }}
        />
      </div>
      {renderHelp(help)}
      {renderError(error)}
    </label>
  )
}
