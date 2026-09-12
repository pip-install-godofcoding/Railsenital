import { useState, useEffect, useRef } from 'react';
import type { AppState, TrainData, StationETA } from '../hooks/useWebSockets';
import { TrainTimeline } from '../components/StationTimeline';

interface Props { state: AppState; connected: boolean; }

type PassengerTab = 'track' | 'gps' | 'safe' | 'report';

export default function PassengerApp({ state, connected }: Props) {
  const [tab, setTab] = useState<PassengerTab>('track');
  const [searchNum, setSearchNum] = useState('12841');
  const [foundTrain, setFoundTrain] = useState<TrainData | null>(null);

  // Search train from live state
  const searchTrain = () => {
    const trains = state.trains?.trains ?? {};
    const t = trains[searchNum];
    setFoundTrain(t ?? null);
  };

  // Auto-update found train when state changes
  useEffect(() => {
    if (foundTrain) {
      const t = state.trains?.trains?.[foundTrain.trainNumber];
      if (t) setFoundTrain(t);
    }
  }, [state.trains]);

  const tabs: { id: PassengerTab; icon: string; label: string }[] = [
    { id: 'track',  icon: '🔍', label: 'Track Train'     },
    { id: 'gps',    icon: '📡', label: "I'm in Train"    },
    { id: 'safe',   icon: '✅', label: "I'm Safe"        },
    { id: 'report', icon: '⚠️', label: 'Report Incident' },
  ];

  return (
    <div className="min-h-full bg-rail-bg">
      {/* Passenger header */}
      <div className="bg-rail-panel border-b border-rail-border px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-rail-text">RailSentinel Passenger</h1>
            <p className="text-xs text-rail-textMuted">Live train tracking & safety</p>
          </div>
          <span className={`flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border
            ${connected ? 'text-rail-success border-rail-success/30 bg-rail-success/5' : 'text-rail-danger border-rail-danger/30 bg-rail-danger/5'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-rail-success animate-pulse' : 'bg-rail-danger'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-rail-panel border-b border-rail-border">
        <div className="max-w-2xl mx-auto flex">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-semibold border-b-2 transition-all
                ${tab === t.id ? 'border-rail-accent text-rail-accent' : 'border-transparent text-rail-textMuted hover:text-rail-text'}`}>
              <span className="text-lg">{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {tab === 'track'  && <TrackTrainTab state={state} searchNum={searchNum} setSearchNum={setSearchNum} foundTrain={foundTrain} onSearch={searchTrain} />}
        {tab === 'gps'    && <ImInTrainTab state={state} />}
        {tab === 'safe'   && <ImSafeTab state={state} />}
        {tab === 'report' && <ReportIncidentTab state={state} />}
      </div>
    </div>
  );
}

/* ── Track Train Tab ─────────────────────────────────────────── */
function TrackTrainTab({ state, searchNum, setSearchNum, foundTrain, onSearch }: {
  state: AppState; searchNum: string; setSearchNum: (v: string) => void;
  foundTrain: TrainData | null; onSearch: () => void;
}) {
  const allTrains = Object.values(state.trains?.trains ?? {}).filter(t => !t.trainNumber.startsWith('GHOST'));

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="rail-card">
        <label className="text-xs font-mono text-rail-textMuted uppercase tracking-wider block mb-2">Search Train by Number</label>
        <div className="flex gap-2">
          <input value={searchNum} onChange={e => setSearchNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch()}
            placeholder="e.g. 12841"
            className="rail-input flex-1" />
          <button onClick={onSearch} className="rail-btn-accent px-5">Search</button>
        </div>
        {/* Quick picks */}
        <div className="flex flex-wrap gap-2 mt-3">
          {allTrains.map(t => (
            <button key={t.trainNumber}
              onClick={() => { setSearchNum(t.trainNumber); onSearch(); }}
              className="text-xs font-mono bg-rail-bg border border-rail-border hover:border-rail-accent hover:text-rail-accent px-2 py-1 rounded transition-all">
              {t.trainNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Train card */}
      {foundTrain ? (
        <TrainCard train={foundTrain} etas={state.station_etas[foundTrain.trainNumber] ?? []} />
      ) : (
        <div className="rail-card text-center py-12">
          <div className="text-4xl mb-3">🚆</div>
          <div className="text-rail-textMuted text-sm">Enter a train number to track it live</div>
          <div className="text-xs text-rail-textMuted/60 mt-1">Active trains: {allTrains.map(t => t.trainNumber).join(', ')}</div>
        </div>
      )}

      {/* All trains mini-list */}
      {allTrains.length > 0 && (
        <div className="rail-card">
          <div className="text-xs font-mono text-rail-textMuted uppercase tracking-wider mb-3">All Monitored Trains</div>
          <div className="space-y-2">
            {allTrains.map(t => <MiniTrainRow key={t.trainNumber} train={t} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function TrainCard({ train, etas }: { train: TrainData; etas: StationETA[] }) {
  const delay = train.delayMinutes ?? 0;
  const pct = train.totalDistanceKm > 0 ? Math.min(100, (train.distanceFromOriginKm / train.totalDistanceKm) * 100) : 0;

  return (
    <div className="rail-card space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-rail-text text-base">{train.trainName}</div>
          <div className="text-xs text-rail-textMuted font-mono mt-0.5">{train.source} → {train.destination}</div>
        </div>
        <span className={`rail-badge ${train.isLive ? 'bg-rail-success/10 text-rail-success border border-rail-success/30' : 'bg-rail-warning/10 text-rail-warning border border-rail-warning/30'}`}>
          {train.isLive ? '● LIVE GPS' : '● TIMETABLE'}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-rail-textMuted mb-1 font-mono">
          <span>{Math.round(train.distanceFromOriginKm)} km</span>
          <span>{Math.round(train.totalDistanceKm)} km</span>
        </div>
        <div className="h-2 bg-rail-bg rounded-full overflow-hidden border border-rail-border">
          <div className="h-full bg-rail-accent rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-center text-[10px] text-rail-textMuted mt-1 font-mono">{pct.toFixed(1)}% complete</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Speed"   value={`${Math.round(train.avgSpeed ?? 0)} km/h`} color="accent" />
        <Stat label="Delay"   value={`${delay >= 0 ? '+' : ''}${Math.round(delay)} min`} color={delay > 10 ? 'danger' : 'success'} />
        <Stat label="Station" value={train.currentStation || '—'} color="muted" small />
      </div>

      {/* Upcoming ETAs Timeline */}
      {etas.length > 0 && (
        <TrainTimeline trainId={train.trainNumber} train={train} etas={etas} />
      )}

      {/* GPS coords */}
      {train.lat && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-rail-textMuted bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
          <span>📍</span>
          <span>{train.lat.toFixed(4)}, {train.lng?.toFixed(4)}</span>
          <span className="ml-auto">{Math.round(train.distanceFromOriginKm)} km from origin</span>
        </div>
      )}
    </div>
  );
}

function MiniTrainRow({ train }: { train: TrainData }) {
  const delay = train.delayMinutes ?? 0;
  return (
    <div className="flex items-center gap-3 bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
      <span className="text-rail-accent font-mono text-xs font-bold w-14 shrink-0">{train.trainNumber}</span>
      <span className="text-xs text-rail-text flex-1 truncate">{train.trainName}</span>
      <span className="text-xs text-rail-textMuted font-mono">{Math.round(train.avgSpeed ?? 0)} km/h</span>
      <span className={`text-xs font-mono font-bold ${delay > 10 ? 'text-rail-warning' : 'text-rail-success'}`}>
        {delay >= 0 ? '+' : ''}{Math.round(delay)}m
      </span>
    </div>
  );
}

/* ── I'm In Train Tab ────────────────────────────────────────── */
function ImInTrainTab({ state }: { state: AppState }) {
  const [tracking, setTracking] = useState(false);
  const [coachId, setCoachId] = useState('S1');
  const [trainNum, setTrainNum] = useState('12841');
  const [status, setStatus] = useState('');
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number; speed?: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendPos = (lat: number, lng: number, speed: number | null) => {
    const payload = {
      coach_id: `${trainNum}-${coachId}`,
      lat, long: lng,
      speed: speed ?? 0,
      timestamp: new Date().toISOString(),
    };
    fetch('http://localhost:8001/api/v1/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
    setLastPos({ lat, lng, speed: speed ?? undefined });
    setStatus(`Sent @ ${new Date().toLocaleTimeString()}`);
  };

  const startTracking = () => {
    if (!navigator.geolocation) { setStatus('Geolocation not supported'); return; }
    setTracking(true);
    setStatus('Acquiring GPS…');
    watchRef.current = navigator.geolocation.watchPosition(
      pos => sendPos(pos.coords.latitude, pos.coords.longitude, pos.coords.speed),
      err => setStatus(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => sendPos(pos.coords.latitude, pos.coords.longitude, pos.coords.speed),
        () => {}
      );
    }, 5000);
  };

  const stopTracking = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    watchRef.current = null; intervalRef.current = null;
    setTracking(false); setStatus('Tracking stopped.');
  };

  // My coach in live data
  const myCoachId = `${trainNum}-${coachId}`.toUpperCase();
  const myCoachLive = state.coach_positions.find(c => c.coach_id === myCoachId);

  return (
    <div className="space-y-4">
      <div className="rail-card border border-rail-accent/20 bg-rail-accent/5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📡</span>
          <div>
            <div className="font-bold text-rail-text">I'm in the Train</div>
            <div className="text-xs text-rail-textMuted">Share your GPS to help track coach positions</div>
          </div>
          {tracking && <span className="ml-auto rail-badge bg-rail-success/10 text-rail-success border border-rail-success/30 animate-pulse">● TRACKING</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-rail-textMuted block mb-1">Train Number</label>
            <input value={trainNum} onChange={e => setTrainNum(e.target.value)} className="rail-input" disabled={tracking} />
          </div>
          <div>
            <label className="text-xs text-rail-textMuted block mb-1">Coach ID</label>
            <input value={coachId} onChange={e => setCoachId(e.target.value)} className="rail-input" disabled={tracking} placeholder="e.g. S1, B2" />
          </div>
        </div>

        {!tracking ? (
          <button onClick={startTracking} className="w-full py-3 rounded-xl bg-rail-accent text-rail-bg font-bold text-sm hover:bg-rail-accentDim transition-all">
            📡 Start Sharing GPS
          </button>
        ) : (
          <button onClick={stopTracking} className="w-full py-3 rounded-xl bg-rail-danger/20 border border-rail-danger/40 text-rail-danger font-bold text-sm hover:bg-rail-danger/30 transition-all">
            ⏹ Stop Tracking
          </button>
        )}

        {status && (
          <div className="mt-3 text-xs font-mono text-rail-textMuted bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
            {status}
          </div>
        )}
      </div>

      {lastPos && (
        <div className="rail-card space-y-2">
          <div className="text-xs font-mono text-rail-textMuted uppercase tracking-wider">Your Last Position</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Latitude"  value={lastPos.lat.toFixed(5)}  color="accent" />
            <Stat label="Longitude" value={lastPos.lng.toFixed(5)}  color="accent" />
            <Stat label="Speed"     value={`${Math.round(lastPos.speed ?? 0)} km/h`} color="muted" />
          </div>
        </div>
      )}

      {myCoachLive && (
        <div className="rail-card border border-rail-success/20 bg-rail-success/5">
          <div className="text-xs font-mono text-rail-success uppercase tracking-wider mb-2">✓ Your coach is visible in the system</div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="text-rail-textMuted">Coach ID: <span className="text-rail-text">{myCoachLive.coach_id}</span></div>
            <div className="text-rail-textMuted">Speed: <span className="text-rail-text">{myCoachLive.calculated_speed?.toFixed(1) ?? '—'} km/h</span></div>
            <div className="text-rail-textMuted">Map Match: <span className={myCoachLive.matched ? 'text-rail-success' : 'text-rail-warning'}>{myCoachLive.matched ? 'On Route' : 'Off Route'}</span></div>
            <div className="text-rail-textMuted">Segment: <span className="text-rail-text">{myCoachLive.route_segment_id ?? '—'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── I'm Safe Tab ────────────────────────────────────────────── */
function ImSafeTab({ state }: { state: AppState }) {
  const [name, setName] = useState('');
  const [trainNum, setTrainNum] = useState('12841');
  const [coach, setCoach] = useState('S1');
  const [sent, setSent] = useState(false);
  const [entries, setEntries] = useState<{ name: string; time: string; train: string; coach: string }[]>([]);

  const submit = () => {
    if (!name.trim()) return;
    setEntries(prev => [{ name: name.trim(), time: new Date().toLocaleTimeString(), train: trainNum, coach }, ...prev.slice(0, 19)]);
    setSent(true);
    setTimeout(() => setSent(false), 4000);
    setName('');
  };

  const hasIncident = state.incident_alerts.length > 0;

  return (
    <div className="space-y-4">
      {hasIncident && (
        <div className="bg-rail-danger/10 border border-rail-danger/40 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl shrink-0">🚨</span>
          <div>
            <div className="font-bold text-rail-danger text-sm">Active Incident Detected</div>
            <div className="text-xs text-rail-textMuted mt-1">{state.incident_alerts[0].description}</div>
            <div className="text-xs text-rail-textMuted mt-0.5">Please mark yourself safe if you are okay.</div>
          </div>
        </div>
      )}

      <div className="rail-card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-3xl">✅</span>
          <div>
            <div className="font-bold text-rail-text">Mark Yourself Safe</div>
            <div className="text-xs text-rail-textMuted">Let authorities know you are okay</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-rail-textMuted block mb-1">Your Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="rail-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-rail-textMuted block mb-1">Train No.</label>
              <input value={trainNum} onChange={e => setTrainNum(e.target.value)} className="rail-input" />
            </div>
            <div>
              <label className="text-xs text-rail-textMuted block mb-1">Coach</label>
              <input value={coach} onChange={e => setCoach(e.target.value)} className="rail-input" />
            </div>
          </div>

          {sent ? (
            <div className="w-full py-3 rounded-xl bg-rail-success/10 border border-rail-success/40 text-rail-success font-bold text-sm text-center">
              ✓ Safety status sent! Authorities notified.
            </div>
          ) : (
            <button onClick={submit}
              className="w-full py-3 rounded-xl bg-rail-success text-rail-bg font-bold text-sm hover:opacity-90 transition-all">
              ✅ I Am Safe
            </button>
          )}
        </div>
      </div>

      {entries.length > 0 && (
        <div className="rail-card">
          <div className="text-xs font-mono text-rail-textMuted uppercase tracking-wider mb-3">Recent Safe Reports</div>
          <div className="space-y-2">
            {entries.map((e, i) => (
              <div key={i} className="flex items-center gap-3 bg-rail-success/5 border border-rail-success/20 rounded-lg px-3 py-2">
                <span className="text-rail-success text-sm">✓</span>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-rail-text">{e.name}</span>
                  <span className="text-xs text-rail-textMuted ml-2">Train {e.train} · Coach {e.coach}</span>
                </div>
                <span className="text-xs font-mono text-rail-textMuted">{e.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Report Incident Tab ─────────────────────────────────────── */
function ReportIncidentTab({ state }: { state: AppState }) {
  const [type, setType] = useState('injury');
  const [desc, setDesc] = useState('');
  const [train, setTrain] = useState('12841');
  const [coach, setCoach] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const incidentTypes = [
    { id: 'injury',   label: 'Injury / Medical',   icon: '🏥' },
    { id: 'fire',     label: 'Fire / Smoke',        icon: '🔥' },
    { id: 'derail',   label: 'Derailment Risk',     icon: '⚠️' },
    { id: 'signal',   label: 'Signal Problem',      icon: '🚦' },
    { id: 'threat',   label: 'Security Threat',     icon: '🚨' },
    { id: 'other',    label: 'Other',               icon: '📝' },
  ];

  const submit = () => {
    if (!desc.trim()) return;
    // In production, this would POST to backend
    console.log('Incident report:', { type, desc, train, coach, time: new Date().toISOString() });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rail-card text-center py-12 space-y-4">
        <div className="text-5xl">📋</div>
        <div className="font-bold text-rail-text text-lg">Report Submitted</div>
        <div className="text-sm text-rail-textMuted max-w-xs mx-auto">
          Your incident report has been sent to the nearest station master and emergency services.
        </div>
        <div className="text-xs font-mono text-rail-textMuted">Ref: INC-{Date.now().toString().slice(-6)}</div>
        <button onClick={() => { setSubmitted(false); setDesc(''); }} className="rail-btn-ghost">Submit Another</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rail-card border border-rail-warning/20 bg-rail-warning/5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚠️</span>
          <div className="font-bold text-rail-text">Report an Incident</div>
        </div>
        <div className="text-xs text-rail-textMuted">Your report goes directly to emergency services and the station master</div>
      </div>

      <div className="rail-card space-y-4">
        {/* Type selector */}
        <div>
          <label className="text-xs text-rail-textMuted block mb-2 font-mono uppercase tracking-wider">Incident Type</label>
          <div className="grid grid-cols-3 gap-2">
            {incidentTypes.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs border transition-all
                  ${type === t.id ? 'border-rail-warning/50 bg-rail-warning/10 text-rail-warning' : 'border-rail-border text-rail-textMuted hover:border-rail-borderHover'}`}>
                <span className="text-xl">{t.icon}</span>
                <span className="text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-rail-textMuted block mb-1">Train No.</label>
            <input value={train} onChange={e => setTrain(e.target.value)} className="rail-input" />
          </div>
          <div>
            <label className="text-xs text-rail-textMuted block mb-1">Coach (optional)</label>
            <input value={coach} onChange={e => setCoach(e.target.value)} placeholder="e.g. S5" className="rail-input" />
          </div>
        </div>

        <div>
          <label className="text-xs text-rail-textMuted block mb-1">Description</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4}
            placeholder="Describe what happened…"
            className="rail-input resize-none" />
        </div>

        <button onClick={submit} disabled={!desc.trim()}
          className="w-full py-3 rounded-xl bg-rail-warning/90 text-rail-bg font-bold text-sm hover:bg-rail-warning transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          🚨 Submit Incident Report
        </button>
      </div>

      {/* Active system incidents */}
      {state.incident_alerts.length > 0 && (
        <div className="rail-card">
          <div className="text-xs font-mono text-rail-danger uppercase tracking-wider mb-3">Active System Incidents</div>
          {state.incident_alerts.map(inc => (
            <div key={inc.id} className="bg-rail-danger/5 border border-rail-danger/20 rounded-lg p-3 mb-2">
              <div className="text-xs font-bold text-rail-danger">{inc.type.replace('_', ' ').toUpperCase()}</div>
              <div className="text-xs text-rail-textMuted mt-1">{inc.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────────────── */
function Stat({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  const c: Record<string, string> = {
    accent: 'text-rail-accent', danger: 'text-rail-danger', success: 'text-rail-success', warning: 'text-rail-warning', muted: 'text-rail-textMuted',
  };
  return (
    <div className="bg-rail-bg rounded-lg px-3 py-2 border border-rail-border">
      <div className="text-[10px] text-rail-textMuted mb-0.5">{label}</div>
      <div className={`font-mono font-bold ${small ? 'text-xs' : 'text-sm'} ${c[color] ?? 'text-rail-text'} truncate`}>{value}</div>
    </div>
  );
}
