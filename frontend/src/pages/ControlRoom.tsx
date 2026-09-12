import { useState, useEffect } from 'react';
import type { AppState } from '../hooks/useWebSockets';
import TrackMap from '../components/TrackMap';
import WeatherPanel from '../components/WeatherPanel';
import IncidentPanel from '../components/IncidentPanel';
import ETAPanel from '../components/ETAPanel';
import ConfirmationLog from '../components/ConfirmationLog';
import AlertDispatch from '../components/AlertDispatch';
import StationTimeline from '../components/StationTimeline';

interface Props { state: AppState; connected: boolean; }

type NavId = 'dashboard' | 'trains' | 'map' | 'safety' | 'incidents' | 'eta' | 'confirmations' | 'reports' | 'settings';

/* ══ Nav item definitions ══ */
const NAV_ITEMS: { id: NavId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
  { id: 'trains',    label: 'Passengers', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1.5 1.5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 6h3.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16l-1.5 1.5" /></svg> },
  { id: 'map',       label: 'Track Map',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg> },
  { id: 'safety',    label: 'Safety & Conflicts', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  { id: 'incidents', label: 'Incidents',  icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
  { id: 'eta',       label: 'ETA Analytics', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'confirmations', label: 'Confirmations', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { id: 'reports',   label: 'Reports',    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: 'settings',  label: 'Settings',   icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
];

function useClock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));
  useEffect(() => {
    const iv = setInterval(() => setT(new Date().toLocaleTimeString('en-US', { hour12: false })), 1000);
    return () => clearInterval(iv);
  }, []);
  return t;
}

export default function ControlRoom({ state, connected }: Props) {
  const [nav, setNav] = useState<NavId>('dashboard');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>('12841');
  const clock = useClock();

  const trains = state.trains?.trains ?? {};
  const realTrains = Object.entries(trains).filter(([id]) => !id.startsWith('GHOST'));
  const incidents = state.incident_alerts || [];
  const activeAlerts = state.alerts?.filter(a => a.status !== 'Resolved') || [];
  const hasIncident = incidents.length > 0;
  const selectedTrain = selectedId ? trains[selectedId] : null;

  useEffect(() => {
    if (!selectedId && realTrains.length > 0) setSelectedId(realTrains[0][0]);
  }, [realTrains.length, selectedId]);

  const trackNewTrain = async () => {
    const term = search.trim();
    if (!term) return;
    const existing = Object.keys(trains).filter(k => !k.startsWith('GHOST'));
    if (!existing.includes(term)) {
      try {
        await fetch('http://localhost:8000/api/set_trains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trains: [...existing, term] })
        });
      } catch (e) {
        console.error(e);
      }
    }
    setSelectedId(term);
    setSearch('');
  };

  const removeTrain = async (idToRemove: string) => {
    const existing = Object.keys(trains).filter(k => !k.startsWith('GHOST'));
    const updated = existing.filter(id => id !== idToRemove);
    try {
      await fetch('http://localhost:8000/api/set_trains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trains: updated })
      });
    } catch (e) {
      console.error(e);
    }
    if (selectedId === idToRemove) {
      setSelectedId(updated.length > 0 ? updated[0] : null);
    }
  };

  const inject = (ep: string) => fetch(`http://localhost:8000/api/${ep}`, { method: 'POST' });

  const resetSystem = async () => {
    try {
      await fetch('http://localhost:8000/api/resolve_all', { method: 'POST' });
      await fetch('http://localhost:8000/api/set_trains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trains: ["12841", "12952"] })
      });
      setSelectedId('12841');
    } catch (e) {
      console.error(e);
    }
  };

  const triggerBalasoreDemo = async () => {
    try {
      await inject('inject_signal_mismatch');
      setTimeout(() => inject('inject_converging_trains'), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  // Extract the true train name by stripping out any duplicated ID
  const rawName = selectedTrain?.trainName || '';
  const cleanTrainName = rawName.startsWith(selectedId!) ? rawName.slice(selectedId!.length).trim() : rawName;

  const etas = selectedTrain ? (state.station_etas?.[selectedId!] ?? selectedTrain.stationETAs ?? []) : [];
  
  // Format helper
  const formatETA = (etaSeconds: number | null | undefined) => {
    if (!etaSeconds) return '—';
    const dt = new Date(etaSeconds * 1000);
    const today = new Date();
    const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    if (dt.getDate() === today.getDate() && dt.getMonth() === today.getMonth() && dt.getFullYear() === today.getFullYear()) {
       return timeStr;
    } else {
       const tom = new Date(today);
       tom.setDate(tom.getDate() + 1);
       if (dt.getDate() === tom.getDate() && dt.getMonth() === tom.getMonth()) {
          return `Tom ${timeStr}`;
       }
       return `${dt.getDate()}/${dt.getMonth() + 1} ${timeStr}`;
    }
  };

  const nextHalt = etas.length > 0 ? etas[0] : null;
  const finalHalt = etas.length > 0 ? etas[etas.length - 1] : null;

  const nextETATime = formatETA(nextHalt?.eta_timestamp);
  const finalETATime = formatETA(finalHalt?.eta_timestamp);
  
  const predDelay = selectedTrain?.delayMinutes ?? 0;
  const speed = selectedTrain?.avgSpeed ?? 0;
  const confidence = (state.eta as any)?.[selectedId!]?.confidence_pct ?? 100;

  return (
    <div className="flex h-full bg-[#040b14] text-white overflow-hidden font-sans relative z-0">
      {/* ══ Sidebar ══════════════════════════════════════════════════════════ */}
      <aside className="w-64 bg-[#091524] border-r border-[#1e2d45] flex flex-col shrink-0">
        <div className="p-5 flex items-center gap-3 border-b border-[#1e2d45]">
          <div className="w-8 h-8 rounded bg-[#00f2fe]/20 text-[#00f2fe] flex items-center justify-center border border-[#00f2fe]/50 shadow-[0_0_10px_rgba(0,242,254,0.3)]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <div className="font-bold text-sm leading-none text-white tracking-wide">RailSentinel</div>
            <div className="text-[9px] text-[#00f2fe] uppercase tracking-widest mt-1">Control Center</div>
          </div>
        </div>

        <div className="px-5 mt-6 mb-3 text-[10px] text-[#6b829f] font-bold uppercase tracking-widest font-mono">
          Main Navigation
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(n => (
            <button
              key={n.id}
              onClick={() => setNav(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left group
                ${nav === n.id
                  ? 'bg-[#00f2fe]/10 text-[#00f2fe] border border-[#00f2fe]/30 shadow-[inset_0_1px_0_rgba(0,242,254,0.1)]'
                  : 'text-[#6b829f] hover:text-white hover:bg-[#1e2d45]/50 border border-transparent'}`}
            >
              <span className={`shrink-0 ${nav === n.id ? 'text-[#00f2fe]' : 'text-[#6b829f] group-hover:text-white'}`}>
                {n.icon}
              </span>
              <span className="truncate">{n.label}</span>
              {n.id === 'incidents' && incidents.length > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                  {incidents.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1e2d45] bg-[#060d1a]">
          <div className="flex items-center gap-2 text-[11px] font-mono text-green-400 font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_#22c55e]" />
            System Online
          </div>
          <div className="text-[10px] font-mono text-[#6b829f]">
            Last synchronized: <span className="text-[#a0b6d0]">{clock}</span>
          </div>
        </div>
      </aside>

      {/* ══ Main Content ═════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a1628]">
        {hasIncident && (
          <div className="bg-red-600/90 text-white text-[10px] font-mono font-bold tracking-widest text-center py-1 uppercase shadow-[0_0_15px_rgba(220,38,38,0.5)] z-50">
            ⚠️ INCIDENT MODE ACTIVE: CRITICAL SAFETY ALERT DETECTED ON ROUTE {selectedId}
          </div>
        )}

        {/* Top Header */}
        <header className="h-14 border-b border-[#1e2d45] bg-[#091524] flex items-center px-4 shrink-0 justify-between">
          <div className="flex flex-col flex-1 max-w-xl">
            <div className="flex gap-2 relative h-8">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b829f] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && trackNewTrain()}
                placeholder="Search train # or name (e.g. 12841, Coromandel Express)..."
                className="pl-9 pr-14 text-xs h-full w-full bg-[#132337] border border-[#1e2d45] rounded text-white focus:outline-none focus:border-[#00f2fe] placeholder-[#475b75] transition-colors"
              />
              <div className="absolute right-20 top-1/2 -translate-y-1/2 flex items-center">
                <kbd className="hidden sm:inline-block border border-[#475b75] bg-[#091524] text-[#6b829f] text-[9px] font-mono px-1.5 py-0.5 rounded">Ctrl+K</kbd>
              </div>
              <button 
                onClick={trackNewTrain}
                className="h-full bg-[#00f2fe] text-[#040b14] font-bold text-xs px-4 rounded hover:bg-[#22d3ee] transition-colors whitespace-nowrap shadow-[0_0_10px_rgba(0,242,254,0.3)]"
              >
                Track
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-4 shrink-0">
            <button onClick={triggerBalasoreDemo} className="hidden lg:block border border-[#00f2fe] bg-[#00f2fe]/10 text-[#00f2fe] text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider hover:bg-[#00f2fe]/20 transition">
              Balasore Incident Demo
            </button>
            <button 
              onClick={() => inject('inject_converging_trains')}
              className="bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded uppercase tracking-wider shadow-[0_0_10px_rgba(220,38,38,0.5)] hover:bg-red-500 transition"
            >
              Trigger Collision
            </button>
            {hasIncident && (
              <div className="border border-red-500 bg-red-500/20 text-red-500 text-[10px] font-bold px-3 py-1.5 rounded flex items-center gap-2 tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                INCIDENT MODE
              </div>
            )}
            <div className="text-[#a0b6d0] text-xs font-mono border-l border-[#1e2d45] pl-4 flex items-center gap-3">
              <svg className="w-4 h-4 text-[#6b829f]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              <div className="w-6 h-6 rounded-full bg-[#1e2d45] flex items-center justify-center text-[10px] font-bold text-white border border-[#475b75]">
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {(nav === 'dashboard') && (
            <>
              {/* Weather Panel */}
              <div className="mb-4">
                 <WeatherPanel />
              </div>
              
              {/* Monitored Trains List */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[11px] font-mono text-[#a0b6d0] mr-2">Monitored Trains:</span>
                {realTrains.map(([id, t]: [string, any]) => (
                  <div key={id} 
                    className={`flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition shadow-sm ${id === selectedId ? 'bg-[#00f2fe]/20 text-[#00f2fe] border border-[#00f2fe]/50' : 'bg-[#1e2d45] text-[#a0b6d0] border border-[#3b4b6b] hover:border-[#00f2fe]/30'}`} 
                    onClick={() => setSelectedId(id)}
                  >
                     <span className={id === selectedId ? 'animate-pulse' : ''}>●</span>
                     {id} {t.trainName ? t.trainName.split(' ')[0] : ''}
                     <button 
                        onClick={(e) => { e.stopPropagation(); removeTrain(id); }} 
                        className="hover:text-red-400 ml-1 text-[#6b829f] transition px-1"
                        title="Remove Train"
                     >✕</button>
                  </div>
                ))}
              </div>

          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
             <KpiCard icon="🚆" label="ACTIVE TRAINS" value={realTrains.length.toString()} sub="+4 from last hour" color="blue" />
             <KpiCard icon="🛤️" label="ON ROUTE" value="138" sub="97% adherence" color="blue" />
             <KpiCard icon="⏱️" label="AVG DELAY" value="12m" sub="Network wide" color="yellow" />
             <KpiCard icon="⚠️" label="AT RISK" value="0" sub="Segments elevated" color="green" />
             <KpiCard icon="⚡" label="ACTIVE CONFLICTS" value={incidents.length.toString()} sub="Requires resolution" color={hasIncident ? "red" : "green"} />
             <KpiCard icon="🔔" label="ACTIVE ALERTS" value={activeAlerts.length.toString()} sub="Unresolved safety" color={activeAlerts.length > 0 ? "red" : "green"} />
          </div>

          {/* Map + Sidebar */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 h-[550px]">
             
             {/* Map Area */}
             <div className="xl:col-span-3 rounded-xl overflow-hidden border border-[#1e2d45] bg-[#060d1a] relative shadow-lg">
                <div className="absolute top-4 left-4 z-[400] right-4 flex justify-between items-start pointer-events-none">
                   <div className="bg-[#091524]/90 backdrop-blur border border-[#1e2d45] text-[#a0b6d0] text-[10px] font-mono px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                     <span className="w-2 h-2 bg-[#00f2fe] rounded-full"></span>
                     Tracking #{selectedId} ({cleanTrainName}) → {selectedTrain?.source} → {selectedTrain?.destination}
                   </div>
                   {hasIncident && (
                     <div className="bg-red-950/90 border border-red-500 text-white text-[10px] font-mono px-3 py-1.5 rounded-full flex items-center gap-2 font-bold shadow-[0_0_15px_rgba(220,38,38,0.4)] pointer-events-auto cursor-pointer animate-pulse-slow">
                       <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       INCIDENT MODE B2 <span className="bg-black/40 px-1 rounded ml-1 text-[9px] text-red-400">CRITICAL</span>
                     </div>
                   )}
                </div>
                
                {/* Embedded Live Map */}
                <div className="w-full h-full pointer-events-auto">
                   <TrackMap state={state} selectedTrainId={selectedId} onSelectTrain={setSelectedId} height={550} />
                </div>
                
                {/* Map Legend Overlay */}
                <div className="absolute bottom-4 right-4 z-[400] bg-[#091524]/90 backdrop-blur border border-[#1e2d45] rounded-lg p-3 shadow-xl pointer-events-auto hidden md:block">
                   <div className="text-[9px] font-mono text-[#6b829f] uppercase tracking-widest mb-2">Map Legend</div>
                   <div className="space-y-1.5 text-[10px] text-[#a0b6d0] font-mono">
                      <div className="flex items-center gap-2"><div className="w-3 h-1 bg-[#00f2fe]"></div> Railway Route</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-[#00f2fe]/20 border border-[#00f2fe]"></div> Coach/Engine</div>
                      <div className="flex items-center gap-2"><div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-red-500"></div> Incident</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500"></div> Responder</div>
                   </div>
                </div>
                
                {/* Live Feed Overlay */}
                <div className="absolute bottom-4 left-4 z-[400] bg-[#091524]/90 backdrop-blur border border-[#1e2d45] rounded-full px-3 py-1.5 shadow-xl pointer-events-auto flex items-center gap-2">
                   <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_5px_#22c55e]"></span>
                   <span className="text-[10px] font-mono text-white font-bold">LIVE FEED: TRAIN {selectedId}</span>
                   <span className="text-[9px] font-mono text-[#6b829f] ml-1">Updated: 8s ago</span>
                </div>
             </div>
             
             {/* Right Sidebar Panels */}
             <div className="xl:col-span-1 space-y-4 flex flex-col h-full">
                
                {/* Selected Train Panel */}
                <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg flex-1 overflow-hidden flex flex-col">
                   <div className="flex justify-between items-start mb-3">
                      <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest">Selected Train</div>
                      <div className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded ${speed > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                         {speed > 0 ? 'MOVING' : 'HALTED'}
                      </div>
                   </div>
                   
                   <div className="mb-4">
                      <div className="text-xl font-bold text-white leading-none">{selectedId} <span className="font-normal opacity-90 text-[#a0b6d0]">{cleanTrainName}</span></div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Speed</div>
                         <div className="text-sm font-bold text-white">{speed.toFixed(1)} <span className="text-[#00f2fe] text-xs">km/h</span></div>
                      </div>
                      <div>
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Current Delay</div>
                         <div className={`text-sm font-bold ${predDelay > 0 ? 'text-red-400' : 'text-green-400'}`}>{predDelay > 0 ? `+${predDelay} min` : 'On Time'}</div>
                      </div>
                      <div>
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Predicted Delay</div>
                         <div className={`text-sm font-bold ${predDelay > 0 ? 'text-red-400' : 'text-green-400'}`}>{predDelay > 0 ? `+${predDelay} min` : '0 min'}</div>
                      </div>
                      <div>
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Track Dist. Err</div>
                         <div className="text-sm font-bold text-white">0.0 <span className="text-[#6b829f] text-xs">m</span></div>
                      </div>
                   </div>
                   
                   <div className="border-t border-[#1e2d45] pt-3 mb-4">
                      <div className="flex justify-between items-end mb-1">
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Next Station ETA</div>
                         <div className="text-lg font-bold text-[#00f2fe]">{nextETATime}</div>
                      </div>
                      <div className="flex justify-between items-end mb-1">
                         <div className="text-[9px] font-mono text-[#6b829f] uppercase">Final Dest ETA</div>
                         <div className="text-[11px] font-bold text-white">{finalETATime}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                         <div className="flex-1 h-1 bg-[#1e2d45] rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${confidence}%` }}></div>
                         </div>
                         <div className="text-[9px] font-mono text-[#6b829f]">{confidence}% Conf</div>
                      </div>
                   </div>
                   
                   <div className="mt-auto">
                      <div className="flex justify-between text-[10px] font-mono text-[#a0b6d0] mb-1">
                         <span>Next: {nextHalt?.station_name || '...'}</span>
                         <span>{nextHalt?.dist_remaining_km?.toFixed(1) || '0'} km</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-[#6b829f]">
                         <span>Route Progress:</span>
                         <div className="flex-1 h-1 bg-[#1e2d45] rounded-full overflow-hidden">
                            <div className="h-full bg-[#00f2fe]" style={{ width: '38%' }}></div>
                         </div>
                         <span>38%</span>
                      </div>
                   </div>
                </div>
                
                {/* Safety Status Panel */}
                <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg shrink-0">
                   <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest mb-3">Safety Status</div>
                   
                   <div className="space-y-2.5">
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-[#1e2d45] pb-2">
                         <span className="text-[#a0b6d0]">Current Section</span>
                         <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-bold">CLEAR</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-[#1e2d45] pb-2">
                         <span className="text-[#a0b6d0]">Next Junction</span>
                         <span className="text-white font-bold">{etas[0]?.station_name || '...'}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono border-b border-[#1e2d45] pb-2">
                         <span className="text-[#a0b6d0]">Section Status</span>
                         <span className={hasIncident ? "bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded font-bold" : "bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-bold"}>
                            {hasIncident ? 'HOLD' : 'CLEAR'}
                         </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono pt-1">
                         <span className="text-[#a0b6d0]">Last Confirmation</span>
                         <span className="text-green-400">✓ CLEAR @ {clock}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          
          {/* Bottom Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-4">
             {/* ETA Analytics */}
             <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                   <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest">ETA Analytics</div>
                   <div className="bg-blue-500/20 text-[#00f2fe] border border-blue-500/30 text-[9px] font-bold px-2 py-0.5 rounded">ML MODEL LIVE</div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                   <div>
                      <div className="text-[9px] font-mono text-[#6b829f] uppercase mb-1">Final ETA</div>
                      <div className="text-lg font-bold text-white leading-none">{finalETATime}</div>
                      <div className="text-[9px] font-mono text-green-400 mt-1">100% CONFIDENCE</div>
                   </div>
                   <div>
                      <div className="text-[9px] font-mono text-[#6b829f] uppercase mb-1">Delay</div>
                      <div className="text-lg font-bold text-yellow-400 leading-none">+{predDelay}m</div>
                      <div className="text-[9px] font-mono text-[#a0b6d0] mt-1">BASELINE MAE: 14.2m</div>
                   </div>
                </div>
                <div className="text-[9px] font-mono text-[#6b829f] flex justify-between items-center">
                   <span>Model Improvement:</span>
                   <div className="flex-1 h-1 bg-[#1e2d45] mx-2 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400" style={{ width: '42%' }}></div>
                   </div>
                   <span className="text-green-400">42%</span>
                </div>
             </div>
             
             {/* Network Status */}
             <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-center mb-3">
                   <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest">Network Status</div>
                   <div className="text-green-400 text-[9px] font-bold font-mono">92% HEALTH</div>
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between text-[10px] font-mono">
                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> On Time</span>
                      <span className="text-white">138</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-mono">
                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></span> Delayed</span>
                      <span className="text-white">12</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-mono">
                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span> At Risk</span>
                      <span className="text-white">4</span>
                   </div>
                   <div className="flex justify-between text-[10px] font-mono">
                      <span className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-700 rounded-full animate-pulse"></span> Critical</span>
                      <span className="text-white">1</span>
                   </div>
                   <div className="mt-2 h-1 bg-[#1e2d45] rounded-full overflow-hidden flex">
                      <div className="h-full bg-green-500" style={{ width: '80%' }}></div>
                      <div className="h-full bg-yellow-500" style={{ width: '15%' }}></div>
                      <div className="h-full bg-red-500" style={{ width: '5%' }}></div>
                   </div>
                </div>
             </div>
             
             {/* Live Safety Feed */}
             <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg overflow-y-auto">
                <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest mb-3">Live Safety Feed</div>
                <div className="space-y-2.5">
                   {hasIncident && (
                     <div className="flex items-start gap-2 text-[10px] font-mono p-1.5 bg-red-500/10 border border-red-500/20 rounded">
                        <span className="text-[#6b829f]">21:29</span>
                        <span className="text-red-500">⚠️ Section B2 - ANOMALY</span>
                     </div>
                   )}
                   <div className="flex items-start gap-2 text-[10px] font-mono p-1">
                      <span className="text-[#6b829f]">{clock}</span>
                      <span className="text-green-400">✓ Junction A - CLEAR</span>
                   </div>
                   <div className="flex items-start gap-2 text-[10px] font-mono p-1">
                      <span className="text-[#6b829f]">21:28</span>
                      <span className="text-yellow-400">⚠️ Station BBS - HOLD</span>
                   </div>
                   <div className="flex items-start gap-2 text-[10px] font-mono p-1">
                      <span className="text-[#6b829f]">21:25</span>
                      <span className="text-white">✓ Section B - CLEAR</span>
                   </div>
                </div>
             </div>
             
             {/* Quick Actions */}
             <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg">
                <div className="text-[10px] font-mono text-[#6b829f] uppercase tracking-widest mb-3">Quick Actions</div>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => inject('inject_signal_mismatch')} className="bg-[#1e2d45] hover:bg-[#2a3f5c] border border-[#3b4b6b] text-[#a0b6d0] text-[9px] font-mono py-2 rounded transition">
                      Trigger Incident
                   </button>
                   <button onClick={resetSystem} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-mono py-2 rounded transition">
                      Reset System
                   </button>
                   <button onClick={() => inject('simulate_gps_anomaly')} className="bg-[#1e2d45] hover:bg-[#2a3f5c] border border-[#3b4b6b] text-[#a0b6d0] text-[9px] font-mono py-2 rounded transition">
                      GPS Anomaly
                   </button>
                   <button onClick={() => inject('resolve_all')} className="bg-[#1e2d45] hover:bg-green-900/50 border border-[#3b4b6b] text-green-400 text-[9px] font-mono py-2 rounded transition">
                      Confirm Safety
                   </button>
                   <button onClick={() => inject('inject_converging_trains')} className="bg-[#1e2d45] hover:bg-[#2a3f5c] border border-[#3b4b6b] text-[#a0b6d0] text-[9px] font-mono py-2 rounded transition">
                      Simulate Conflict
                   </button>
                   <button onClick={() => alert('Generating Safety Report (Demo)...')} className="bg-[#1e2d45] hover:bg-[#2a3f5c] border border-[#3b4b6b] text-[#a0b6d0] text-[9px] font-mono py-2 rounded transition">
                      Generate Report
                   </button>
                  </div>
               </div>
               
            </div>
            </>
          )}

          {nav === 'map' && (
            <div className="w-full h-[calc(100vh-140px)] min-h-[600px] border border-[#1e2d45] rounded-xl overflow-hidden shadow-lg relative">
               <TrackMap state={state} selectedTrainId={selectedId} onSelectTrain={setSelectedId} height={800} />
            </div>
          )}

          {nav === 'trains' && (
            <div className="bg-[#091524] border border-[#1e2d45] rounded-xl p-4 shadow-lg min-h-[600px]">
               <div className="text-[12px] font-mono text-[#00f2fe] uppercase tracking-widest mb-4 border-b border-[#1e2d45] pb-2">Live Trains Passenger Timeline</div>
               <div className="mb-4"><WeatherPanel /></div>
               <StationTimeline state={state} />
            </div>
          )}

          {nav === 'incidents'     && <IncidentPanel state={state} />}
          {nav === 'eta'           && <ETAPanel state={state} />}
          {nav === 'confirmations' && <ConfirmationLog state={state} />}
          {nav === 'safety'        && <AlertDispatch state={state} />}
          {nav === 'reports'       && <div className="text-[#a0b6d0] p-8 text-center border border-[#1e2d45] rounded-xl border-dashed">Report generation module active. Awaiting query parameters...</div>}
          {nav === 'settings'      && <div className="text-[#a0b6d0] p-8 text-center border border-[#1e2d45] rounded-xl border-dashed">System Settings. Administrator access required.</div>}

        </div>
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  const bg = color === 'blue' ? 'bg-[#091524]' : color === 'red' ? 'bg-red-950/20' : color === 'green' ? 'bg-green-950/20' : 'bg-yellow-950/20';
  const border = color === 'blue' ? 'border-[#1e2d45]' : color === 'red' ? 'border-red-900/30' : color === 'green' ? 'border-green-900/30' : 'border-yellow-900/30';
  const textIcon = color === 'blue' ? 'text-[#00f2fe]' : color === 'red' ? 'text-red-500' : color === 'green' ? 'text-green-500' : 'text-yellow-500';
  const textVal = color === 'blue' ? 'text-white' : color === 'red' ? 'text-red-400' : color === 'green' ? 'text-green-400' : 'text-yellow-400';
  
  return (
    <div className={`p-4 rounded-xl border ${border} ${bg} flex flex-col justify-between shadow-lg`}>
      <div className="flex justify-between items-start mb-2">
        <div className={`text-xl ${textIcon}`}>{icon}</div>
        <div className={`text-xs font-mono font-bold ${textVal}`}>{label}</div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white mb-0.5">{value}</div>
        <div className="text-[9px] font-mono text-[#6b829f] truncate">{sub}</div>
      </div>
    </div>
  );
}
