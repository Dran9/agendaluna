import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { apiUrl } from './lib/api';
import { ControlView } from './views/ControlView';
import { ClientsView } from './views/ClientsView';
import { TherapistsView } from './views/TherapistsView';
import { FinancesView } from './views/FinancesView';
import { SettingsView } from './views/SettingsView';

const TOKEN_STORAGE_KEY = 'agenda_luna_admin_token';

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || 'No se pudo completar la solicitud.');
  }
  return payload;
}

function toViewTitle(view) {
  if (view === 'clientes') return 'Clientes';
  if (view === 'terapeutas') return 'Terapeutas';
  if (view === 'finanzas') return 'Finanzas';
  if (view === 'ajustes') return 'Ajustes';
  return 'Control';
}

export default function App({ initialTheme, onToggleTheme }) {
  const [activeView, setActiveView] = useState('control');
  const [searchText, setSearchText] = useState('');

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
  });

  const [clientsState, setClientsState] = useState({
    loading: false,
    error: '',
    clients: []
  });
  const [selectedClient, setSelectedClient] = useState(null);
  const [timelineState, setTimelineState] = useState({
    loading: false,
    error: '',
    timeline: []
  });

  const [therapistsState, setTherapistsState] = useState({
    loading: false,
    error: '',
    period: '',
    therapists: []
  });

  const [financesState, setFinancesState] = useState({
    loading: false,
    error: '',
    range: null,
    summary: null,
    byTherapist: [],
    payments: []
  });
  const [verifyingPaymentId, setVerifyingPaymentId] = useState(null);

  const [settingsState, setSettingsState] = useState({
    loading: false,
    error: '',
    saving: false,
    saveError: '',
    settings: null
  });

  const ensureToken = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    if (!import.meta.env.DEV) {
      throw new Error('No hay sesión activa de admin para este entorno.');
    }

    const tokenResponse = await fetch(apiUrl('/api/admin/auth/dev-token'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ centerId: 1, email: 'admin@luna.local' })
    });

    const tokenPayload = await readJson(tokenResponse);
    localStorage.setItem(TOKEN_STORAGE_KEY, tokenPayload.token);
    return tokenPayload.token;
  }, []);

  const authedFetch = useCallback(
    async (path, options = {}, retried = false) => {
      const token = await ensureToken();

      const response = await fetch(apiUrl(path), {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401 && !retried && import.meta.env.DEV) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return authedFetch(path, options, true);
      }

      return readJson(response);
    },
    [ensureToken]
  );

  const loadControl = useCallback(async () => {
    setControlState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const [summaryPayload, todayPayload] = await Promise.all([
        authedFetch('/api/admin/control/summary'),
        authedFetch('/api/admin/control/today')
      ]);

      setControlState({
        loading: false,
        error: '',
        summary: summaryPayload.summary || {},
        appointments: todayPayload.appointments || []
      });
    } catch (error) {
      setControlState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'No se pudo cargar Control.'
      }));
    }
  }, [authedFetch]);

  const loadClients = useCallback(
    async (queryText = '') => {
      setClientsState((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const search = queryText ? `?q=${encodeURIComponent(queryText)}` : '';
        const payload = await authedFetch(`/api/admin/clients${search}`);
        setClientsState({ loading: false, error: '', clients: payload.clients || [] });

        if (!payload.clients?.length) {
          setSelectedClient(null);
          setTimelineState({ loading: false, error: '', timeline: [] });
        }
      } catch (error) {
        setClientsState({ loading: false, error: error.message || 'No se pudo cargar clientes.', clients: [] });
      }
    },
    [authedFetch]
  );

  const loadClientTimeline = useCallback(
    async (clientId) => {
      if (!clientId) {
        return;
      }
      setTimelineState({ loading: true, error: '', timeline: [] });
      try {
        const payload = await authedFetch(`/api/admin/clients/${clientId}/timeline`);
        setTimelineState({ loading: false, error: '', timeline: payload.timeline || [] });
      } catch (error) {
        setTimelineState({ loading: false, error: error.message || 'No se pudo cargar timeline.', timeline: [] });
      }
    },
    [authedFetch]
  );

  const loadTherapists = useCallback(async () => {
    setTherapistsState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const payload = await authedFetch('/api/admin/therapists');
      setTherapistsState({
        loading: false,
        error: '',
        period: payload.period || '',
        therapists: payload.therapists || []
      });
    } catch (error) {
      setTherapistsState({
        loading: false,
        error: error.message || 'No se pudo cargar terapeutas.',
        period: '',
        therapists: []
      });
    }
  }, [authedFetch]);

  const loadFinances = useCallback(async () => {
    setFinancesState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const [summaryPayload, paymentsPayload] = await Promise.all([
        authedFetch('/api/admin/finances/summary'),
        authedFetch('/api/admin/finances/payments?status=all&limit=80')
      ]);

      setFinancesState({
        loading: false,
        error: '',
        range: summaryPayload.range || null,
        summary: summaryPayload.summary || null,
        byTherapist: summaryPayload.byTherapist || [],
        payments: paymentsPayload.payments || []
      });
    } catch (error) {
      setFinancesState({
        loading: false,
        error: error.message || 'No se pudo cargar finanzas.',
        range: null,
        summary: null,
        byTherapist: [],
        payments: []
      });
    }
  }, [authedFetch]);

  const loadSettings = useCallback(async () => {
    setSettingsState((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const payload = await authedFetch('/api/admin/settings');
      setSettingsState((prev) => ({
        ...prev,
        loading: false,
        error: '',
        settings: payload,
        saveError: ''
      }));
    } catch (error) {
      setSettingsState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'No se pudo cargar ajustes.',
        settings: null
      }));
    }
  }, [authedFetch]);

  const handleManualVerify = useCallback(
    async (paymentId, action) => {
      setVerifyingPaymentId(paymentId);
      try {
        await authedFetch(`/api/admin/payments/${paymentId}/manual-verify`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, note: 'Revisión manual desde panel de Finanzas.' })
        });
        await loadFinances();
      } catch (error) {
        setFinancesState((prev) => ({ ...prev, error: error.message || 'No se pudo actualizar pago.' }));
      } finally {
        setVerifyingPaymentId(null);
      }
    },
    [authedFetch, loadFinances]
  );

  const handleSaveSettings = useCallback(
    async (form) => {
      setSettingsState((prev) => ({ ...prev, saving: true, saveError: '' }));
      try {
        await authedFetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form)
        });
        await loadSettings();
      } catch (error) {
        setSettingsState((prev) => ({ ...prev, saveError: error.message || 'No se pudo guardar ajustes.' }));
      } finally {
        setSettingsState((prev) => ({ ...prev, saving: false }));
      }
    },
    [authedFetch, loadSettings]
  );

  useEffect(() => {
    loadControl();
  }, [loadControl]);

  useEffect(() => {
    if (activeView === 'clientes') {
      const timeout = setTimeout(() => {
        loadClients(searchText);
      }, 200);
      return () => clearTimeout(timeout);
    }

    if (activeView === 'terapeutas') {
      loadTherapists();
    }

    if (activeView === 'finanzas') {
      loadFinances();
    }

    if (activeView === 'ajustes') {
      loadSettings();
    }

    return undefined;
  }, [activeView, loadClients, loadTherapists, loadFinances, loadSettings, searchText]);

  const topbarTitle = useMemo(() => toViewTitle(activeView), [activeView]);

  return (
    <div className="shell">
      <Sidebar
        theme={initialTheme}
        onToggleTheme={onToggleTheme}
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          if (view !== 'clientes') {
            setSearchText('');
          }
        }}
      />

      <div className="shell-content">
        <Topbar
          title={topbarTitle}
          subtitle="Luna Mandala"
          searchValue={searchText}
          onSearchChange={setSearchText}
        />

        <main className={`content-grid ${activeView === 'control' ? '' : 'single-layout'}`}>
          {activeView === 'control' ? (
            <ControlView
              loading={controlState.loading}
              error={controlState.error}
              summary={controlState.summary}
              appointments={controlState.appointments}
            />
          ) : null}

          {activeView === 'clientes' ? (
            <ClientsView
              loading={clientsState.loading}
              error={clientsState.error}
              clients={clientsState.clients}
              selectedClient={selectedClient}
              onSelectClient={(client) => {
                setSelectedClient(client);
                loadClientTimeline(client.id);
              }}
              timeline={timelineState.timeline}
              timelineLoading={timelineState.loading}
              timelineError={timelineState.error}
            />
          ) : null}

          {activeView === 'terapeutas' ? (
            <TherapistsView
              loading={therapistsState.loading}
              error={therapistsState.error}
              period={therapistsState.period}
              therapists={therapistsState.therapists}
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
              loading={settingsState.loading}
              error={settingsState.error}
              settings={settingsState.settings}
              onSave={handleSaveSettings}
              saving={settingsState.saving}
              saveError={settingsState.saveError}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
