import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { apiUrl } from './lib/api'
import { ControlView } from './views/ControlView'
import { ClientsView } from './views/ClientsView'
import { TherapistsView } from './views/TherapistsView'
import { FinancesView } from './views/FinancesView'
import { SettingsView } from './views/SettingsView'

const TOKEN_STORAGE_KEY = 'agenda_luna_admin_token'

async function readJson(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || 'No se pudo completar la solicitud.')
  }
  return payload
}

function toViewTitle(view) {
  if (view === 'clientes') return 'Clientes'
  if (view === 'terapeutas') return 'Terapeutas'
  if (view === 'finanzas') return 'Finanzas'
  if (view === 'ajustes') return 'Ajustes'
  return 'Control'
}

export default function App({ initialTheme, onToggleTheme }) {
  const [activeView, setActiveView] = useState('control')
  const [searchText, setSearchText] = useState('')

  const [catalogState, setCatalogState] = useState({
    loading: false,
    error: '',
    center: null,
    services: [],
    therapists: [],
    rooms: []
  })

  const [controlState, setControlState] = useState({
    loading: true,
    error: '',
    summary: {
      totalToday: 0,
      confirmedToday: 0,
      pendingToday: 0,
      cancelledToday: 0,
      pendingPayments: 0
    },
    appointments: []
  })

  const [clientsState, setClientsState] = useState({
    loading: false,
    error: '',
    clients: []
  })
  const [selectedClient, setSelectedClient] = useState(null)
  const [timelineState, setTimelineState] = useState({
    loading: false,
    error: '',
    timeline: []
  })

  const [therapistsState, setTherapistsState] = useState({
    loading: false,
    error: '',
    period: '',
    therapists: []
  })

  const [financesState, setFinancesState] = useState({
    loading: false,
    error: '',
    range: null,
    summary: null,
    byTherapist: [],
    payments: []
  })
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null)

  const [settingsState, setSettingsState] = useState({
    savingCenter: false,
    saveError: ''
  })

  const ensureToken = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (stored) {
      return stored
    }

    if (!import.meta.env.DEV) {
      throw new Error('No hay sesión activa de admin para este entorno.')
    }

    const tokenResponse = await fetch(apiUrl('/api/admin/auth/dev-token'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ centerId: 1, email: 'admin@luna.local' })
    })

    const tokenPayload = await readJson(tokenResponse)
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenPayload.token)
    return tokenPayload.token
  }, [])

  const authedFetch = useCallback(
    async (path, options = {}, retried = false) => {
      const token = await ensureToken()

      const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      })

      if (response.status === 401 && !retried && import.meta.env.DEV) {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        return authedFetch(path, options, true)
      }

      return readJson(response)
    },
    [ensureToken]
  )

  const loadCatalog = useCallback(async () => {
    setCatalogState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const payload = await authedFetch('/api/admin/catalog')
      setCatalogState({
        loading: false,
        error: '',
        center: payload.center || null,
        services: payload.services || [],
        therapists: payload.therapists || [],
        rooms: payload.rooms || []
      })
    } catch (error) {
      setCatalogState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'No se pudo cargar el catálogo.'
      }))
    }
  }, [authedFetch])

  const loadControl = useCallback(async () => {
    setControlState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [summaryPayload, todayPayload] = await Promise.all([
        authedFetch('/api/admin/control/summary'),
        authedFetch('/api/admin/control/today')
      ])

      setControlState({
        loading: false,
        error: '',
        summary: summaryPayload.summary || {},
        appointments: todayPayload.appointments || []
      })
    } catch (error) {
      setControlState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'No se pudo cargar Control.'
      }))
    }
  }, [authedFetch])

  const loadClients = useCallback(
    async (queryText = '') => {
      setClientsState((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const search = queryText ? `?q=${encodeURIComponent(queryText)}` : ''
        const payload = await authedFetch(`/api/admin/clients${search}`)
        const clients = payload.clients || []
        setClientsState({ loading: false, error: '', clients })

        if (!clients.length) {
          setSelectedClient(null)
          setTimelineState({ loading: false, error: '', timeline: [] })
        } else if (selectedClient) {
          const stillExists = clients.some((item) => item.id === selectedClient.id)
          if (!stillExists) {
            setSelectedClient(null)
            setTimelineState({ loading: false, error: '', timeline: [] })
          }
        }
      } catch (error) {
        setClientsState({ loading: false, error: error.message || 'No se pudo cargar clientes.', clients: [] })
      }
    },
    [authedFetch, selectedClient]
  )

  const loadClientTimeline = useCallback(
    async (clientId) => {
      if (!clientId) {
        return
      }
      setTimelineState({ loading: true, error: '', timeline: [] })
      try {
        const payload = await authedFetch(`/api/admin/clients/${clientId}/timeline`)
        setTimelineState({ loading: false, error: '', timeline: payload.timeline || [] })
      } catch (error) {
        setTimelineState({ loading: false, error: error.message || 'No se pudo cargar timeline.', timeline: [] })
      }
    },
    [authedFetch]
  )

  const loadTherapists = useCallback(async () => {
    setTherapistsState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const payload = await authedFetch('/api/admin/therapists')
      setTherapistsState({
        loading: false,
        error: '',
        period: payload.period || '',
        therapists: payload.therapists || []
      })
    } catch (error) {
      setTherapistsState({
        loading: false,
        error: error.message || 'No se pudo cargar terapeutas.',
        period: '',
        therapists: []
      })
    }
  }, [authedFetch])

  const loadFinances = useCallback(async () => {
    setFinancesState((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const [summaryPayload, paymentsPayload] = await Promise.all([
        authedFetch('/api/admin/finances/summary'),
        authedFetch('/api/admin/finances/payments?status=all&limit=80')
      ])

      setFinancesState({
        loading: false,
        error: '',
        range: summaryPayload.range || null,
        summary: summaryPayload.summary || null,
        byTherapist: summaryPayload.byTherapist || [],
        payments: paymentsPayload.payments || []
      })
    } catch (error) {
      setFinancesState({
        loading: false,
        error: error.message || 'No se pudo cargar finanzas.',
        range: null,
        summary: null,
        byTherapist: [],
        payments: []
      })
    }
  }, [authedFetch])

  const handleCreateClient = useCallback(
    async (payload) => {
      await authedFetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await loadClients(searchText)
    },
    [authedFetch, loadClients, searchText]
  )

  const handleUpdateClient = useCallback(
    async (clientId, payload) => {
      await authedFetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await loadClients(searchText)
      await loadClientTimeline(clientId)
    },
    [authedFetch, loadClients, loadClientTimeline, searchText]
  )

  const handleCreateTherapist = useCallback(
    async (payload) => {
      const response = await authedFetch('/api/admin/therapists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadTherapists()])
      return response.therapist
    },
    [authedFetch, loadCatalog, loadTherapists]
  )

  const handleUpdateTherapist = useCallback(
    async (therapistId, payload) => {
      await authedFetch(`/api/admin/therapists/${therapistId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadTherapists()])
    },
    [authedFetch, loadCatalog, loadTherapists]
  )

  const handleSaveTherapistServices = useCallback(
    async (therapistId, serviceIds) => {
      await authedFetch(`/api/admin/therapists/${therapistId}/services`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceIds })
      })
      await Promise.all([loadCatalog(), loadTherapists()])
    },
    [authedFetch, loadCatalog, loadTherapists]
  )

  const handleLoadTherapistSchedule = useCallback(
    async (therapistId) => {
      const payload = await authedFetch(`/api/admin/therapists/${therapistId}/schedule`)
      return payload.schedule || []
    },
    [authedFetch]
  )

  const handleSaveTherapistSchedule = useCallback(
    async (therapistId, entries) => {
      await authedFetch(`/api/admin/therapists/${therapistId}/schedule`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries })
      })
    },
    [authedFetch]
  )

  const handleCreateService = useCallback(
    async (payload) => {
      await authedFetch('/api/admin/services', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadControl()])
    },
    [authedFetch, loadCatalog, loadControl]
  )

  const handleUpdateService = useCallback(
    async (serviceId, payload) => {
      await authedFetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadControl()])
    },
    [authedFetch, loadCatalog, loadControl]
  )

  const handleCreateRoom = useCallback(
    async (payload) => {
      await authedFetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadControl()])
    },
    [authedFetch, loadCatalog, loadControl]
  )

  const handleUpdateRoom = useCallback(
    async (roomId, payload) => {
      await authedFetch(`/api/admin/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadCatalog(), loadControl()])
    },
    [authedFetch, loadCatalog, loadControl]
  )

  const handleSaveCenterSettings = useCallback(
    async (payload) => {
      setSettingsState((prev) => ({ ...prev, savingCenter: true, saveError: '' }))
      try {
        await authedFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload)
        })
        await loadCatalog()
      } catch (error) {
        setSettingsState((prev) => ({
          ...prev,
          saveError: error.message || 'No se pudo guardar ajustes.'
        }))
        throw error
      } finally {
        setSettingsState((prev) => ({ ...prev, savingCenter: false }))
      }
    },
    [authedFetch, loadCatalog]
  )

  const handleGetAvailability = useCallback(
    async ({ serviceId, date, therapistId = null }) => {
      const payload = await authedFetch('/api/admin/availability', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ serviceId, date, therapistId })
      })
      return payload
    },
    [authedFetch]
  )

  const handleCreateAppointment = useCallback(
    async (payload) => {
      const response = await authedFetch('/api/admin/appointments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadControl(), loadFinances()])
      return response.appointment
    },
    [authedFetch, loadControl, loadFinances]
  )

  const handleGetAppointmentDetail = useCallback(
    async (appointmentId) => {
      const payload = await authedFetch(`/api/admin/appointments/${appointmentId}`)
      return payload
    },
    [authedFetch]
  )

  const handleUpdateAppointmentStatus = useCallback(
    async (appointmentId, status, note = '') => {
      const payload = await authedFetch(`/api/admin/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status, note })
      })
      await Promise.all([loadControl(), loadFinances()])
      return payload.appointment
    },
    [authedFetch, loadControl, loadFinances]
  )

  const handleRescheduleAppointment = useCallback(
    async (appointmentId, payload) => {
      const response = await authedFetch(`/api/admin/appointments/${appointmentId}/reschedule`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      await Promise.all([loadControl(), loadFinances()])
      return response.appointment
    },
    [authedFetch, loadControl, loadFinances]
  )

  const handleSearchClients = useCallback(
    async (queryText) => {
      const search = queryText ? `?q=${encodeURIComponent(queryText)}` : '?limit=80'
      const payload = await authedFetch(`/api/admin/clients${search}`)
      return payload.clients || []
    },
    [authedFetch]
  )

  const handleManualVerify = useCallback(
    async (paymentId, action) => {
      setVerifyingPaymentId(paymentId)
      try {
        await authedFetch(`/api/admin/payments/${paymentId}/manual-verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, note: 'Revisión manual desde panel de Finanzas.' })
        })
        await loadFinances()
      } catch (error) {
        setFinancesState((prev) => ({ ...prev, error: error.message || 'No se pudo actualizar pago.' }))
      } finally {
        setVerifyingPaymentId(null)
      }
    },
    [authedFetch, loadFinances]
  )

  useEffect(() => {
    loadCatalog()
    loadControl()
  }, [loadCatalog, loadControl])

  useEffect(() => {
    if (activeView === 'clientes') {
      const timeout = setTimeout(() => {
        loadClients(searchText)
      }, 200)
      return () => clearTimeout(timeout)
    }

    if (activeView === 'terapeutas') {
      loadTherapists()
    }

    if (activeView === 'finanzas') {
      loadFinances()
    }

    if (activeView === 'ajustes') {
      loadCatalog()
    }

    return undefined
  }, [activeView, loadCatalog, loadClients, loadTherapists, loadFinances, searchText])

  const topbarTitle = useMemo(() => toViewTitle(activeView), [activeView])

  return (
    <div className="shell">
      <Sidebar
        theme={initialTheme}
        onToggleTheme={onToggleTheme}
        activeView={activeView}
        brandName={catalogState.center?.brandName || catalogState.center?.name || 'Luna Mandala'}
        logoUrl={catalogState.center?.logoUrl || ''}
        onNavigate={(view) => {
          setActiveView(view)
          if (view !== 'clientes') {
            setSearchText('')
          }
        }}
      />

      <div className="shell-content">
        <Topbar
          title={topbarTitle}
          subtitle={catalogState.center?.name || 'Luna Mandala'}
          searchValue={searchText}
          onSearchChange={setSearchText}
          searchDisabled={activeView !== 'clientes'}
          searchPlaceholder={
            activeView === 'clientes'
              ? 'Buscar cliente por nombre o WhatsApp'
              : 'Búsqueda disponible en Clientes'
          }
        />

        <main className={`content-grid ${activeView === 'control' ? '' : 'single-layout'}`}>
          {activeView === 'control' ? (
            <ControlView
              loading={controlState.loading}
              error={controlState.error}
              summary={controlState.summary}
              appointments={controlState.appointments}
              services={catalogState.services}
              therapists={catalogState.therapists}
              rooms={catalogState.rooms}
              onSearchClients={handleSearchClients}
              onLookupAvailability={handleGetAvailability}
              onCreateAppointment={handleCreateAppointment}
              onGetAppointmentDetail={handleGetAppointmentDetail}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              onRescheduleAppointment={handleRescheduleAppointment}
            />
          ) : null}

          {activeView === 'clientes' ? (
            <ClientsView
              loading={clientsState.loading}
              error={clientsState.error}
              clients={clientsState.clients}
              selectedClient={selectedClient}
              onSelectClient={(client) => {
                setSelectedClient(client)
                loadClientTimeline(client.id)
              }}
              timeline={timelineState.timeline}
              timelineLoading={timelineState.loading}
              timelineError={timelineState.error}
              onCreateClient={handleCreateClient}
              onUpdateClient={handleUpdateClient}
            />
          ) : null}

          {activeView === 'terapeutas' ? (
            <TherapistsView
              loading={therapistsState.loading}
              error={therapistsState.error}
              period={therapistsState.period}
              therapists={therapistsState.therapists}
              serviceOptions={catalogState.services}
              catalogTherapists={catalogState.therapists}
              onCreateTherapist={handleCreateTherapist}
              onUpdateTherapist={handleUpdateTherapist}
              onSaveTherapistServices={handleSaveTherapistServices}
              onLoadTherapistSchedule={handleLoadTherapistSchedule}
              onSaveTherapistSchedule={handleSaveTherapistSchedule}
            />
          ) : null}

          {activeView === 'finanzas' ? (
            <FinancesView
              loading={financesState.loading}
              error={financesState.error}
              range={financesState.range}
              summary={financesState.summary}
              byTherapist={financesState.byTherapist}
              payments={financesState.payments}
              onManualVerify={handleManualVerify}
              verifyingPaymentId={verifyingPaymentId}
            />
          ) : null}

          {activeView === 'ajustes' ? (
            <SettingsView
              loading={catalogState.loading}
              error={catalogState.error || settingsState.saveError}
              center={catalogState.center}
              services={catalogState.services}
              rooms={catalogState.rooms}
              onSaveCenter={handleSaveCenterSettings}
              savingCenter={settingsState.savingCenter}
              onCreateService={handleCreateService}
              onUpdateService={handleUpdateService}
              onCreateRoom={handleCreateRoom}
              onUpdateRoom={handleUpdateRoom}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}
