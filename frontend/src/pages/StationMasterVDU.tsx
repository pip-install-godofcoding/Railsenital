import { useState, useEffect, useRef } from 'react';
import type { AppState, Alert } from '../hooks/useWebSockets';

interface Props { state: AppState; connected: boolean; }

export default function StationMasterVDU({ state, connected }: Props) {
  const [escalationTimeout, setEscalationTimeout] = useState(10);
  const [phone, setPhone] = useState('');
  const [configSaved, setConfigSaved] = useState(false);

  const saveConfig = async () => {
    await fetch('http://localhost:8000/api/escalation_config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeout_seconds: escalationTimeout, phone_number: phone }),
    });
    setConfigSaved(true); setTimeout(() => setConfigSaved(false), 2000);
  };

  useEffect(() => {
    fetch('http://localhost:8000/api/escalation_config')
      .then(r => r.json())
      .then(d => { if (d.timeout_seconds) { setEscalationTimeout(d.timeout_seconds); setPhone(d.phone_number || ''); } })
      .catch(() => {});
  }, []);

  const inject  = (ep: string) => fetch(`http://localhost:8000/api/${ep}`, { method: 'POST' });
  const resolve = () => inject('resolve_all');

  const hasIncident = state.incident_alerts.length > 0;
  const activeAlerts = state.alerts.filter(a => a.status !== 'Resolved');
  const escalatedAlerts = state.alerts.filter(a => a.status === 'Escalated' || a.escalated_at);

  return (
    <div className="h-[calc(100vh-3rem)] overflow-y-auto bg-rail-bg">
      {/* VDU Header */}
      <div className={`border-b px-6 py-3 flex items-center gap-4 ${hasIncident ? 'bg-rail-danger/10 border-rail-danger/30' : 'bg-rail-panel border-rail-border'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${hasIncident ? 'bg-rail-danger/20 border-rail-danger/40' : 'bg-rail-accent/10 border-rail-accent/30'}`}>
            <span className="text-xl">📡</span>
          </div>
          <div>
            <div className="font-bold text-rail-text">Station Master — VDU Console</div>
            <div className="text-xs font-mono text-rail-textMuted">Interlocking & Safety Command Interface</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {hasIncident && (
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-rail-danger bg-rail-danger/10 border border-rail-danger/30 px-3 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rail-danger animate-ping" />
              {state.incident_alerts.length} ACTIVE INCIDENT{state.incident_alerts.length > 1 ? 'S' : ''}
            </span>
          )}
          <span className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border ${connected ? 'text-rail-success border-rail-success/30' : 'text-rail-danger border-rail-danger/30'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-rail-success animate-pulse' : 'bg-rail-danger'}`} />
            {connected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* ── Row 1: KPIs ──────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <VduKpi icon="🚨" label="Active Alerts"    value={activeAlerts.length}              color={activeAlerts.length ? 'danger' : 'success'} />
          <VduKpi icon="⚡" label="Escalated"        value={escalatedAlerts.length}           color={escalatedAlerts.length ? 'warning' : 'success'} />
          <VduKpi icon="🚂" label="Trains Monitored" value={Object.keys(state.trains?.trains ?? {}).filter(k => !k.startsWith('GHOST')).length} color="accent" />
          <VduKpi icon="📍" label="Coach GPS"        value={state.coach_positions.length}     color="accent" />
        </div>

        {/* ── Row 2: SCADA + Simulation ─────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* SCADA Signal Board */}
          <ScadaBoard state={state} />

          {/* Simulation / Fault Injection */}
          <div className="rail-card space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <div>
                <div className="font-semibold text-rail-text text-sm">Fault Injection</div>
                <div className="text-xs text-rail-textMuted">Simulate scenarios for drill / testing</div>
              </div>
            </div>

            <div className="space-y-2">
              <SimCard
                icon="🚦" title="Signal Mismatch (Balasore-style)"
                desc="Injects P1=Reverse, T2=Occupied, S1=Green → fires Layer 1 alert + Loco Pilot + SM dispatch"
                color="danger"
                onInject={() => inject('inject_signal_mismatch')}
                onResolve={() => inject('resolve_signal_mismatch')}
              />
              <SimCard
                icon="⚡" title="Converging Trains (Head-On)"
                desc="Ghost train 50 km ahead converging. Closes in at 3 km/s — triggers Layer 3 collision alert"
                color="warning"
                onInject={() => inject('inject_converging_trains')}
                onResolve={() => inject('resolve_converging_trains')}
              />
              <SimCard
                icon="📍" title="GPS Cluster Anomaly"
                desc="3 coaches (S4/S5/S6) stopped at same location — triggers GPS cluster incident"
                color="accent"
                onInject={() => inject('simulate_gps_anomaly')}
              />
            </div>

            <button onClick={resolve}
              className="w-full py-2 rounded-lg bg-rail-success/10 border border-rail-success/30 text-rail-success text-sm font-semibold hover:bg-rail-success/20 transition-all">
              ✓ Resolve All Active Faults
            </button>
          </div>
        </div>

        {/* ── Row 3: Communications Feed + Incidents ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Live Communications Feed */}
          <CommsFeed state={state} />

          {/* Incident Command */}
          <IncidentCommand state={state} />
        </div>

        {/* ── Row 4: Alert History + Escalation ──────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AlertHistoryPanel alerts={state.alerts} />
          <EscalationPanel
            timeout={escalationTimeout} phone={phone}
            setTimeout={setEscalationTimeout} setPhone={setPhone}
            onSave={saveConfig} saved={configSaved}
            escalated={escalatedAlerts}
          />
        </div>
      </div>
    </div>
  );
}

/* ── SCADA Signal Board ────────────────────────────────────── */
function ScadaBoard({ state }: { state: AppState }) {
  const scada = state.scada;
  const log   = state.confirmation_log;
  const mismatches = log.filter(e => e.status === 'Mismatch').length;

  const trackColor = (occupied: boolean) => occupied ? 'bg-rail-warning text-rail-bg' : 'bg-rail-success/20 text-rail-success border border-rail-success/30';
  const sigColor   = (sig: string) => sig === 'green' ? 'text-rail-success' : sig === 'red' ? 'text-rail-danger' : 'text-rail-warning';
  const sigDot     = (sig: string) => sig === 'green' ? 'bg-rail-success' : sig === 'red' ? 'bg-rail-danger' : 'bg-rail-warning';
  const pointColor = (p: string)   => p === 'normal' ? 'text-rail-success' : 'text-rail-danger';

  return (
    <div className="rail-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚦</span>
          <div>
            <div className="font-semibold text-rail-text text-sm">SCADA Signal Board</div>
            <div className="text-xs text-rail-textMuted">Real-time interlocking state</div>
          </div>
        </div>
        {mismatches > 0 && (
          <span className="rail-badge bg-rail-danger/10 text-rail-danger border border-rail-danger/30 animate-pulse">
            ⚠ {mismatches} MISMATCH
          </span>
        )}
        {scada?.fault_active && (
          <span className="rail-badge bg-rail-danger/20 text-rail-danger border border-rail-danger/50 animate-pulse">FAULT ACTIVE</span>
        )}
      </div>

      {scada ? (
        <div className="space-y-3">
          {/* Track sections */}
          <div>
            <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">Track Sections</div>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(scada.tracks).map(([id, occ]) => (
                <div key={id} className={`rounded-lg px-2 py-2 text-center text-xs font-mono font-bold ${trackColor(occ as boolean)}`}>
                  <div className="text-[9px] opacity-70 mb-0.5">{id}</div>
                  <div>{(occ as boolean) ? 'OCCUPIED' : 'CLEAR'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Signals */}
          <div>
            <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">Signals</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(scada.signals).map(([id, sig]) => (
                <div key={id} className="flex items-center gap-2 bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
                  <span className={`w-3 h-3 rounded-full ${sigDot(sig as string)} ${sig === 'green' ? 'animate-pulse' : ''}`} />
                  <span className="text-xs text-rail-textMuted font-mono">{id}</span>
                  <span className={`ml-auto text-xs font-mono font-bold uppercase ${sigColor(sig as string)}`}>{sig as string}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Points */}
          <div>
            <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">Point Machines</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(scada.points).map(([id, pos]) => (
                <div key={id} className="flex items-center gap-2 bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
                  <span className="text-xs text-rail-textMuted font-mono">{id}</span>
                  <span className={`ml-auto text-xs font-mono font-bold uppercase ${pointColor(pos as string)}`}>{pos as string}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 text-rail-textMuted text-xs">No SCADA data yet</div>
      )}

      {/* Confirmation log mini */}
      {log.length > 0 && (
        <div>
          <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">Recent Track Confirmations</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {[...log].reverse().slice(0, 8).map((e, i) => (
              <div key={i} className={`flex items-center gap-2 text-[10px] font-mono px-2 py-1 rounded ${e.status === 'Mismatch' ? 'bg-rail-danger/10 border border-rail-danger/20' : 'bg-rail-bg border border-rail-border'}`}>
                <span className="text-rail-textMuted w-16 shrink-0">{new Date(e.confirmed_at * 1000).toLocaleTimeString()}</span>
                <span className="text-rail-textMuted w-8 shrink-0">{e.junction_id}</span>
                <span className={e.status === 'Mismatch' ? 'text-rail-danger font-bold' : e.status === 'Occupied' ? 'text-rail-warning' : 'text-rail-success'}>{e.status}</span>
                <span className="ml-auto text-rail-textMuted">{e.signal}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Comms Feed ────────────────────────────────────────────── */
function CommsFeed({ state }: { state: AppState }) {
  const feedRef = useRef<HTMLDivElement>(null);

  const dispatches = state.authority_dispatches ?? [];
  const alerts     = state.alerts.filter(a => a.status !== 'Resolved').slice(0, 10);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0;
  }, [dispatches.length, alerts.length]);

  const typeIcon: Record<string, string> = {
    driver: '🚂', station_master: '📡', hospital: '🏥', ndrf: '🚒', police: '🚔',
  };
  const typeColor: Record<string, string> = {
    driver: 'border-rail-warning/40 bg-rail-warning/5 text-rail-warning',
    station_master: 'border-rail-danger/40 bg-rail-danger/5 text-rail-danger',
    hospital: 'border-purple-500/40 bg-purple-500/5 text-purple-400',
    ndrf: 'border-orange-500/40 bg-orange-500/5 text-orange-400',
    police: 'border-blue-500/40 bg-blue-500/5 text-blue-400',
  };

  return (
    <div className="rail-card flex flex-col" style={{ minHeight: 400 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📻</span>
        <div>
          <div className="font-semibold text-rail-text text-sm">Communications Feed</div>
          <div className="text-xs text-rail-textMuted">Live dispatch & alert stream</div>
        </div>
        {dispatches.length > 0 && (
          <span className="ml-auto rail-badge bg-rail-accent/10 text-rail-accent border border-rail-accent/30 font-mono">{dispatches.length} sent</span>
        )}
      </div>

      <div ref={feedRef} className="flex-1 overflow-y-auto space-y-2 max-h-80">
        {dispatches.length === 0 && alerts.length === 0 && (
          <div className="text-center py-8 text-rail-textMuted text-xs">
            <div className="text-3xl mb-2">📡</div>
            No active communications. System nominal.
          </div>
        )}

        {/* Dispatch entries — driver & SM first */}
        {[...dispatches]
          .sort((a, b) => {
            const order: Record<string, number> = { driver: 0, station_master: 1, hospital: 2, ndrf: 3, police: 4 };
            return (order[a.authority_type] ?? 9) - (order[b.authority_type] ?? 9);
          })
          .map(d => (
            <div key={d.id} className={`rounded-lg border px-3 py-2 ${typeColor[d.authority_type] ?? 'border-rail-border bg-rail-bg text-rail-text'}`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <span>{typeIcon[d.authority_type] ?? '📢'}</span>
                  <span>{d.authority_name}</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">{new Date(d.dispatched_at * 1000).toLocaleTimeString()}</span>
              </div>
              <p className="text-[10px] leading-snug opacity-80 line-clamp-3">{d.message}</p>
              {d.contact !== 'VDU-ALERT' && (
                <div className="text-[10px] font-mono opacity-60 mt-1">📞 {d.contact}</div>
              )}
            </div>
          ))}

        {/* Active alerts */}
        {alerts.map(a => (
          <div key={a.id} className={`rounded-lg border px-3 py-2 ${a.status === 'Escalated' ? 'border-purple-500/40 bg-purple-500/5' : 'border-rail-danger/30 bg-rail-danger/5'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-rail-danger">{a.layer} — {a.status}</span>
              <span className="text-[10px] font-mono text-rail-textMuted">{new Date(a.detected_at * 1000).toLocaleTimeString()}</span>
            </div>
            <p className="text-[10px] text-rail-textMuted leading-snug">{a.description}</p>
            {a.escalated_to && <div className="text-[10px] font-mono text-purple-400 mt-1">Escalated → {a.escalated_to}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Incident Command ──────────────────────────────────────── */
function IncidentCommand({ state }: { state: AppState }) {
  const incidents = state.incident_alerts;

  const incColor: Record<string, string> = {
    signal_mismatch:  'border-rail-danger/40  bg-rail-danger/5',
    converging_trains:'border-rail-warning/40 bg-rail-warning/5',
    gps_anomaly:      'border-rail-accent/30  bg-rail-accent/5',
  };
  const incIcon: Record<string, string> = {
    signal_mismatch: '🚦', converging_trains: '⚡', gps_anomaly: '📍',
  };

  return (
    <div className="rail-card flex flex-col" style={{ minHeight: 400 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🚨</span>
        <div>
          <div className="font-semibold text-rail-text text-sm">Incident Command</div>
          <div className="text-xs text-rail-textMuted">Active incidents & nearest responders</div>
        </div>
        {incidents.length > 0 && (
          <span className="ml-auto rail-badge bg-rail-danger/10 text-rail-danger border border-rail-danger/30 animate-pulse font-mono">{incidents.length} ACTIVE</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 max-h-80">
        {incidents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-xs text-rail-textMuted">No active incidents</div>
            <div className="text-[10px] text-rail-textMuted/60 mt-1">Monitoring signal, GPS, and convergence</div>
          </div>
        ) : incidents.map(inc => (
          <div key={inc.id} className={`rounded-xl border p-3 ${incColor[inc.type] ?? 'border-rail-border bg-rail-bg'}`}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{incIcon[inc.type] ?? '⚠️'}</span>
                <span className={`text-xs font-bold uppercase ${inc.severity === 'critical' ? 'text-rail-danger' : 'text-rail-warning'}`}>
                  {inc.type.replace('_', ' ')}
                </span>
              </div>
              <span className="text-[10px] font-mono text-rail-textMuted">{new Date(inc.detected_at * 1000).toLocaleTimeString()}</span>
            </div>
            <p className="text-xs text-rail-textMuted mb-2">{inc.description}</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {inc.affected_trains.filter(Boolean).map(t => (
                <span key={t} className="text-[10px] font-mono bg-rail-bg border border-rail-border px-1.5 py-0.5 rounded">{t}</span>
              ))}
              <span className="text-[10px] text-rail-warning font-mono">~{inc.estimated_affected_coaches} coaches</span>
            </div>

            {/* Responders */}
            {inc.nearest_responders && inc.nearest_responders.length > 0 && (
              <div>
                <div className="text-[10px] font-mono text-rail-textMuted uppercase mb-1">Nearest Responders</div>
                <div className="space-y-1">
                  {inc.nearest_responders.slice(0, 3).map(r => (
                    <div key={r.name} className="flex items-center gap-2 bg-rail-bg/50 rounded px-2 py-1 text-[10px] font-mono border border-rail-border/50">
                      <span>{r.type === 'hospital' ? '🏥' : r.type === 'police' ? '🚔' : '🚒'}</span>
                      <span className="text-rail-text flex-1 truncate">{r.name}</span>
                      <span className="text-rail-textMuted shrink-0">{r.distance_km} km</span>
                      <span className="text-rail-accent shrink-0">{r.contact}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Alert History Panel ───────────────────────────────────── */
function AlertHistoryPanel({ alerts }: { alerts: Alert[] }) {
  const statusColor: Record<string, string> = {
    Detected:     'bg-rail-danger/10 text-rail-danger border-rail-danger/30',
    Displayed:    'bg-rail-warning/10 text-rail-warning border-rail-warning/30',
    Acknowledged: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Escalated:    'bg-purple-500/10 text-purple-400 border-purple-500/30',
    Resolved:     'bg-rail-success/10 text-rail-success border-rail-success/30',
  };

  return (
    <div className="rail-card">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📋</span>
        <div className="font-semibold text-rail-text text-sm">Alert History</div>
        <span className="ml-auto text-xs font-mono text-rail-textMuted">{alerts.length} total</span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-rail-textMuted text-xs italic">No alerts recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-mono text-rail-textMuted border-b border-rail-border">
                <th className="text-left pb-2 pr-3">ID</th>
                <th className="text-left pb-2 pr-3">Layer</th>
                <th className="text-left pb-2 pr-3">Status</th>
                <th className="text-left pb-2 pr-3 hidden md:table-cell">Description</th>
                <th className="text-left pb-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {[...alerts].reverse().map(a => (
                <tr key={a.id} className="border-b border-rail-border/50 hover:bg-rail-panelHover transition-colors">
                  <td className="py-1.5 pr-3 font-mono text-rail-textMuted">{a.id}</td>
                  <td className="py-1.5 pr-3 text-rail-text">{a.layer}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`rail-badge border ${statusColor[a.status] ?? 'bg-rail-bg text-rail-textMuted border-rail-border'}`}>{a.status}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-rail-textMuted truncate max-w-[200px] hidden md:table-cell" title={a.description}>{a.description}</td>
                  <td className="py-1.5 font-mono text-rail-textMuted">{new Date(a.detected_at * 1000).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Escalation Panel ──────────────────────────────────────── */
function EscalationPanel({ timeout, phone, setTimeout, setPhone, onSave, saved, escalated }: {
  timeout: number; phone: string; setTimeout: (v: number) => void; setPhone: (v: string) => void;
  onSave: () => void; saved: boolean; escalated: Alert[];
}) {
  return (
    <div className="rail-card space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">⏱️</span>
        <div>
          <div className="font-semibold text-rail-text text-sm">Escalation Settings</div>
          <div className="text-xs text-rail-textMuted">Auto-escalate if alert is unacknowledged</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="text-xs text-rail-textMuted block mb-1">Escalation Timeout (seconds)</label>
          <input type="number" value={timeout} min={5} max={300}
            onChange={e => setTimeout(parseInt(e.target.value) || 15)}
            className="rail-input" />
        </div>
        <div>
          <label className="text-xs text-rail-textMuted block mb-1">SMS / WhatsApp Number</label>
          <input type="tel" value={phone} placeholder="+91XXXXXXXXXX"
            onChange={e => setPhone(e.target.value)}
            className="rail-input" />
        </div>
        <button onClick={onSave}
          className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${saved ? 'bg-rail-success/20 border border-rail-success/40 text-rail-success' : 'rail-btn-accent'}`}>
          {saved ? '✓ Saved!' : 'Save Configuration'}
        </button>
      </div>

      {/* Escalated alerts */}
      <div>
        <div className="text-[10px] font-mono text-rail-textMuted uppercase tracking-wider mb-2">
          Escalated Alerts {escalated.length > 0 && <span className="text-rail-danger">({escalated.length})</span>}
        </div>
        {escalated.length === 0 ? (
          <div className="text-xs text-rail-textMuted italic">No escalated alerts.</div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {escalated.map(a => (
              <div key={a.id} className="bg-purple-500/5 border border-purple-500/30 rounded-lg p-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-purple-400">{a.id}</span>
                  <span className="text-[10px] font-mono text-rail-textMuted">
                    {a.escalated_at ? new Date(a.escalated_at * 1000).toLocaleTimeString() : '—'}
                  </span>
                </div>
                <p className="text-[10px] text-rail-textMuted mt-1 leading-snug">{a.description}</p>
                {a.escalated_to && <div className="text-[10px] text-purple-400 font-mono mt-1">→ {a.escalated_to}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SimCard ──────────────────────────────────────────────── */
function SimCard({ icon, title, desc, color, onInject, onResolve }: {
  icon: string; title: string; desc: string; color: string;
  onInject: () => void; onResolve?: () => void;
}) {
  const colorMap: Record<string, string> = {
    danger: 'border-rail-danger/30 bg-rail-danger/5',
    warning:'border-rail-warning/30 bg-rail-warning/5',
    accent: 'border-rail-accent/30 bg-rail-accent/5',
  };
  const btnMap: Record<string, string> = {
    danger: 'border-rail-danger/40 text-rail-danger hover:bg-rail-danger/10',
    warning:'border-rail-warning/40 text-rail-warning hover:bg-rail-warning/10',
    accent: 'border-rail-accent/40 text-rail-accent hover:bg-rail-accent/10',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] ?? colorMap.accent}`}>
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-rail-text">{title}</div>
          <div className="text-[10px] text-rail-textMuted mt-0.5 leading-snug">{desc}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onInject}
          className={`flex-1 py-1.5 rounded text-xs font-bold border transition-all ${btnMap[color] ?? btnMap.accent}`}>
          Inject
        </button>
        {onResolve && (
          <button onClick={onResolve}
            className="px-3 py-1.5 rounded text-xs font-bold border border-rail-success/40 text-rail-success hover:bg-rail-success/10 transition-all">
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}

/* ── VDU KPI card ─────────────────────────────────────────── */
function VduKpi({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const c: Record<string, string> = {
    accent: 'border-rail-accent/20 bg-rail-accent/5 text-rail-accent',
    danger: 'border-rail-danger/20 bg-rail-danger/5 text-rail-danger',
    success:'border-rail-success/20 bg-rail-success/5 text-rail-success',
    warning:'border-rail-warning/20 bg-rail-warning/5 text-rail-warning',
  };
  return (
    <div className={`rail-card border flex items-center gap-3 ${c[color] ?? c.accent}`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xl font-bold font-mono leading-none">{value}</div>
        <div className="text-[10px] text-rail-textMuted mt-0.5">{label}</div>
      </div>
    </div>
  );
}
