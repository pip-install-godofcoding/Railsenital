import { useState } from 'react';
import { useWebSockets } from './hooks/useWebSockets';
import ControlRoom from './pages/ControlRoom';
import PassengerApp from './pages/PassengerApp';
import StationMasterVDU from './pages/StationMasterVDU';

export type Page = 'control' | 'passenger' | 'stationmaster';

export default function App() {
  const [page, setPage] = useState<Page>('control');
  const { state, connected } = useWebSockets();

  return (
    <div className="min-h-screen bg-rail-bg flex flex-col pb-14 md:pb-0 md:pt-12">
      {/* Top / Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-rail-panel/95 backdrop-blur border-t border-rail-border
                      flex items-center justify-center gap-1 px-4 py-2
                      md:top-0 md:bottom-auto md:border-t-0 md:border-b">
        <div className="flex items-center gap-2 max-w-5xl w-full">
          {/* Brand */}
          <div className="hidden md:flex items-center gap-2 mr-6 shrink-0">
            <div className="w-7 h-7 rounded bg-rail-accent/10 border border-rail-accent/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-rail-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-rail-text tracking-wider">RailSentinel</div>
              <div className="text-[9px] font-mono text-rail-textMuted uppercase tracking-widest">Safety Command</div>
            </div>
          </div>

          {/* Page tabs */}
          <div className="flex gap-1 flex-1">
            <NavBtn icon="🛡️" label="Control Room"    sub="Operator Dashboard" active={page==='control'}       onClick={() => setPage('control')} />
            <NavBtn icon="🚆" label="Passenger"        sub="Track & Safety"    active={page==='passenger'}     onClick={() => setPage('passenger')} />
            <NavBtn icon="📡" label="Station Master"   sub="VDU Console"       active={page==='stationmaster'} onClick={() => setPage('stationmaster')} />
          </div>

          {/* Connection status */}
          <div className={`hidden md:flex items-center gap-1.5 text-xs font-mono ml-4 shrink-0 ${connected ? 'text-rail-success' : 'text-rail-danger'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-rail-success animate-pulse' : 'bg-rail-danger animate-ping'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>

          {/* Incident banner dot */}
          {state.incident_alerts.length > 0 && (
            <span className="hidden md:flex items-center gap-1 text-[10px] font-mono font-bold text-rail-danger bg-rail-danger/10 border border-rail-danger/30 px-2 py-0.5 rounded animate-pulse ml-2">
              🚨 {state.incident_alerts.length} INCIDENT{state.incident_alerts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 overflow-hidden">
        {page === 'control'       && <ControlRoom state={state} connected={connected} />}
        {page === 'passenger'     && <PassengerApp state={state} connected={connected} />}
        {page === 'stationmaster' && <StationMasterVDU state={state} connected={connected} />}
      </div>
    </div>
  );
}

function NavBtn({ icon, label, sub, active, onClick }: {
  icon: string; label: string; sub: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 md:flex-none justify-center border
        ${active
          ? 'bg-rail-accent/15 text-rail-accent border-rail-accent/30 shadow-accent'
          : 'text-rail-textMuted hover:text-rail-text hover:bg-rail-panelHover border-transparent'}`}
    >
      <span className="text-base">{icon}</span>
      <div className="hidden sm:block text-left">
        <div className="text-xs font-bold leading-none">{label}</div>
        <div className="text-[9px] opacity-60 leading-none mt-0.5">{sub}</div>
      </div>
    </button>
  );
}
