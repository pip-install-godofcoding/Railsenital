import { useState } from 'react';
import type { AppState } from '../hooks/useWebSockets';
import TrackMap from '../components/TrackMap';
import ETAPanel from '../components/ETAPanel';
import ConfirmationLog from '../components/ConfirmationLog';
import AlertDispatch from '../components/AlertDispatch';
import IncidentPanel from '../components/IncidentPanel';
import WeatherPanel from '../components/WeatherPanel';

interface Props { state: AppState; connected: boolean; }

type NavSection = 'map' | 'incidents' | 'eta' | 'confirmations' | 'dispatch';

const NAV: { id: NavSection; icon: string; label: string }[] = [
  { id: 'map',           icon: '🗺️',  label: 'Live Map'        },
  { id: 'incidents',     icon: '🚨',  label: 'Incidents'       },
  { id: 'eta',           icon: '⏱️',  label: 'ETA Analytics'   },
  { id: 'confirmations', icon: '✅',  label: 'Signal Log'      },
  { id: 'dispatch',      icon: '📢',  label: 'Dispatch'        },
];

export default function ControlRoom({ state, connected }: Props) {
  const [section, setSection] = useState<NavSection>('map');
  const [train1, setTrain1] = useState('12841');
  const [train2, setTrain2] = useState('12952');

  const activeAlerts   = state.alerts.filter(a => a.status !== 'Resolved');
  const incidents      = state.incident_alerts;
  const hasIncident    = incidents.length > 0;

  const inject = (ep: string) => fetch(`http://localhost:8000/api/${ep}`, { method: 'POST' });

  const updateTrains = () =>
    fetch('http://localhost:8000/api/set_trains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trains: [train1, train2] }),
    });

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside className="w-14 md:w-56 bg-rail-panel border-r border-rail-border flex flex-col shrink-0">
        {/* KPI mini-stats */}
        <div className="p-3 border-b border-rail-border space-y-2 hidden md:block">
          <KpiMini label="Active Trains"  value={Object.keys(state.trains?.trains ?? {}).filter(k => !k.startsWith('GHOST')).length} color="accent" />
          <KpiMini label="Active Alerts"  value={activeAlerts.length} color={activeAlerts.length > 0 ? 'danger' : 'success'} />
          <KpiMini label="Incidents"      value={incidents.length}    color={incidents.length > 0 ? 'danger' : 'success'} />
          <KpiMini label="Coaches GPS"    value={state.coach_positions.length} color="accent" />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left
                ${section === n.id
                  ? 'bg-rail-accent/10 text-rail-accent border border-rail-accent/25 shadow-accent'
                  : 'text-rail-textMuted hover:text-rail-text hover:bg-rail-panelHover'}`}
            >
              <span className="text-base shrink-0">{n.icon}</span>
              <span className="hidden md:inline truncate">{n.label}</span>
              {n.id === 'incidents' && incidents.length > 0 && (
                <span className="ml-auto hidden md:inline text-[10px] font-mono font-bold bg-rail-danger text-white px-1.5 py-0.5 rounded-full">{incidents.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Train selector */}
        <div className="p-3 border-t border-rail-border space-y-2 hidden md:block">
          <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">Track Trains</div>
          <input value={train1} onChange={e => setTrain1(e.target.value)} placeholder="Train 1 No." className="rail-input text-xs py-1.5" />
          <input value={train2} onChange={e => setTrain2(e.target.value)} placeholder="Train 2 No." className="rail-input text-xs py-1.5" />
          <button onClick={updateTrains} className="w-full rail-btn-accent text-xs py-1.5">Update</button>
        </div>

        {/* Status */}
        <div className="p-3 border-t border-rail-border hidden md:block">
          <div className={`flex items-center gap-2 text-xs font-mono ${connected ? 'text-rail-success' : 'text-rail-danger'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-rail-success animate-pulse' : 'bg-rail-danger'}`} />
            {connected ? 'System Online' : 'Disconnected'}
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Incident alert ribbon */}
        {hasIncident && (
          <div className="bg-rail-danger/90 text-white px-4 py-1.5 flex items-center gap-3 text-xs font-mono font-bold animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-white animate-ping shrink-0" />
            🚨 INCIDENT ACTIVE — {incidents[0].description}
            <button onClick={() => inject('resolve_signal_mismatch').then(() => inject('resolve_converging_trains'))}
              className="ml-auto bg-white/20 hover:bg-white/30 border border-white/30 px-2 py-0.5 rounded text-white text-xs">
              Resolve All
            </button>
          </div>
        )}

        {/* Weather strip */}
        <div className="shrink-0 px-4 pt-3">
          <WeatherPanel />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {section === 'map' && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                <KpiCard icon="🚂" label="Active Trains"  value={Object.keys(state.trains?.trains ?? {}).filter(k => !k.startsWith('GHOST')).length} sub="on network" color="accent" />
                <KpiCard icon="⚠️" label="Active Alerts"  value={activeAlerts.length} sub="unresolved" color={activeAlerts.length ? 'danger' : 'success'} />
                <KpiCard icon="🚨" label="Incidents"      value={incidents.length} sub="critical" color={incidents.length ? 'danger' : 'success'} />
                <KpiCard icon="📍" label="Coach GPS"      value={state.coach_positions.length} sub="positions" color="accent" />
              </div>

              <TrackMap state={state} />

              {/* Simulation controls */}
              <div className="rail-card">
                <div className="text-xs font-mono text-rail-textMuted uppercase tracking-wider mb-3">Fault Injection / Simulation</div>
                <div className="flex flex-wrap gap-2">
                  <SimBtn label="Signal Mismatch" color="danger"  onClick={() => inject('inject_signal_mismatch')} />
                  <SimBtn label="Converging Trains" color="warning" onClick={() => inject('inject_converging_trains')} />
                  <SimBtn label="GPS Anomaly"      color="accent"  onClick={() => inject('simulate_gps_anomaly')} />
                  <SimBtn label="✓ Resolve All"    color="success" onClick={() => inject('resolve_signal_mismatch').then(() => inject('resolve_converging_trains'))} />
                </div>
              </div>
            </>
          )}

          {section === 'incidents'     && <div className="mt-3"><IncidentPanel state={state} /></div>}
          {section === 'eta'           && <div className="mt-3"><ETAPanel state={state} /></div>}
          {section === 'confirmations' && <div className="mt-3"><ConfirmationLog state={state} /></div>}
          {section === 'dispatch'      && <div className="mt-3"><AlertDispatch state={state} /></div>}
        </div>
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: number | string; sub: string; color: string }) {
  const colors: Record<string, string> = {
    accent:  'text-rail-accent  border-rail-accent/20  bg-rail-accent/5',
    danger:  'text-rail-danger  border-rail-danger/20  bg-rail-danger/5',
    success: 'text-rail-success border-rail-success/20 bg-rail-success/5',
    warning: 'text-rail-warning border-rail-warning/20 bg-rail-warning/5',
  };
  return (
    <div className={`rail-card flex items-center gap-3 border ${colors[color] ?? colors.accent}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xl font-bold font-mono leading-none">{value}</div>
        <div className="text-xs text-rail-textMuted mt-0.5">{label}</div>
        <div className="text-[10px] text-rail-textMuted opacity-60">{sub}</div>
      </div>
    </div>
  );
}

function KpiMini({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    accent: 'text-rail-accent', danger: 'text-rail-danger', success: 'text-rail-success',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-rail-textMuted truncate">{label}</span>
      <span className={`text-xs font-mono font-bold ${colors[color] ?? 'text-rail-text'}`}>{value}</span>
    </div>
  );
}

function SimBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    danger:  'border-rail-danger/40  text-rail-danger  hover:bg-rail-danger/10',
    warning: 'border-rail-warning/40 text-rail-warning hover:bg-rail-warning/10',
    accent:  'border-rail-accent/40  text-rail-accent  hover:bg-rail-accent/10',
    success: 'border-rail-success/40 text-rail-success hover:bg-rail-success/10',
  };
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${colors[color] ?? colors.accent}`}
    >
      {label}
    </button>
  );
}
