import { useState } from 'react';
import { useWebSockets } from './hooks/useWebSockets';
import Dashboard from './components/Dashboard';
import StationMasterVDU from './components/StationMasterVDU';
import ImSafe from './components/ImSafe';

type View = 'dashboard' | 'vdu' | 'imsafe';

function App() {
  const { state, connected } = useWebSockets();
  const [view, setView] = useState<View>('dashboard');

  const hasIncident = state.incident_alerts.length > 0;

  const navBtn = (label: string, target: View, danger?: boolean) => (
    <button
      onClick={() => setView(target)}
      className={`px-4 py-2 rounded font-bold text-sm transition-colors ${
        view === target
          ? danger
            ? 'bg-red-600 text-white'
            : 'bg-blue-600 text-white'
          : danger
          ? 'bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-800'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-railDark text-white">
      <nav className="bg-gray-900 border-b border-gray-800 p-3 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="font-mono text-xs text-gray-400">
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </span>
          <span className="text-gray-600 text-xs hidden sm:inline">RAIL SENTINEL</span>
        </div>

        <div className="flex gap-2 items-center">
          {navBtn('Main Dashboard', 'dashboard')}
          {navBtn('Station VDU', 'vdu')}
          <button
            onClick={() => setView('imsafe')}
            className={`px-4 py-2 rounded font-bold text-sm transition-colors relative ${
              view === 'imsafe'
                ? 'bg-green-600 text-white'
                : 'bg-green-900/40 text-green-300 border border-green-800 hover:bg-green-800'
            }`}
          >
            {hasIncident && view !== 'imsafe' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            )}
            I'm Safe
          </button>
        </div>
      </nav>

      {view === 'dashboard' && <Dashboard state={state} />}
      {view === 'vdu' && <StationMasterVDU state={state} />}
      {view === 'imsafe' && <ImSafe state={state} />}
    </div>
  );
}

export default App;
