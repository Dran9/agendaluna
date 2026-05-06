import { ShieldCheck } from '@phosphor-icons/react'
import { useState } from 'react'

export function LoginView({
  loading = false,
  error = '',
  onLogin,
  onRequestDevToken,
  showDevShortcut = false
}) {
  const [form, setForm] = useState({
    centerId: 1,
    email: '',
    password: ''
  })

  return (
    <main className="login-shell">
      <section className="login-card">
        <header className="login-header">
          <div className="login-mark">
            <ShieldCheck size={26} />
          </div>
          <h1>Admin Agenda Luna</h1>
          <p>Ingresa con tu usuario administrador para acceder al panel.</p>
        </header>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault()
            onLogin?.(form)
          }}
        >
          <label>
            Centro ID
            <input
              type="number"
              min={1}
              value={form.centerId}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, centerId: Number(event.target.value || 1) }))
              }}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              minLength={8}
            />
          </label>

          {error ? <p className="login-error">{error}</p> : null}

          <div className="login-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            {showDevShortcut ? (
              <button
                type="button"
                className="ghost-btn"
                disabled={loading}
                onClick={() => onRequestDevToken?.()}
              >
                Usar token dev
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  )
}
