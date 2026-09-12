import { useState, useEffect } from 'react';
import type { AppState } from '../hooks/useWebSockets';
import TrackMap from './TrackMap';
import AlertBanner from './AlertBanner';
import AlertLog from './AlertLog';
import ETAPanel from './ETAPanel';
import RiskPanel from './RiskPanel';
import IncidentPanel from './IncidentPanel';
import ConfirmationLog from './ConfirmationLog';
import StationTimeline from './StationTimeline';
import AlertDispatch from './AlertDispatch';
import WeatherPanel from './WeatherPanel';

interface Props {
  state: AppState;
}

interface EscalationConfig {
  timeout_seconds: number;
  phone_number: string;
}

const Dashboard = ({ state }: Props) => {
  // removed loading state
  const [escalationConfig, setEscalationConfig] = useState<EscalationConfig>({
    timeout_seconds: 15,
    phone_number: '',
  });
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    // Fetch current escalation config on mount
    fetch('http://localhost:8000/api/escalation_config')
      .then(res => res.json())
      .then(data => {
        if (data.timeout_seconds != null) {
          setEscalationConfig({
            timeout_seconds: data.timeout_seconds,
            phone_number: data.phone_number || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  const injectFault = async (endpoint: string) => {
    try {
      await fetch(`http://localhost:8000/api/${endpoint}`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const saveEscalationConfig = async () => {
    try {
      await fetch('http://localhost:8000/api/escalation_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(escalationConfig),
      });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save escalation config', e);
    }
  };

  const resolveAll = async () => {
    try {
      await fetch('http://localhost:8000/api/resolve_all', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const escalatedAlerts = state.alerts.filter(a => a.status === 'Escalated' || a.escalated_at);

  const [train1, setTrain1] = useState('12859');
  const [train2, setTrain2] = useState('14707');

  const updateTrains = async () => {
    try {
      await fetch(`http://localhost:8000/api/set_trains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trains: [train1, train2] })
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#020813] text-gray-300 p-4 font-sans">
      <div className="max-w-[1600px] mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-railPanel/50 p-4 rounded-xl border border-gray-800">
          <div>
            <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-3">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_#3b82f6]"></span>
              MAIN CONTROL ROOM
            </h1>
            <p className="text-gray-500 text-sm mt-1">Independent Signal &amp; Position Integrity Verification</p>
          </div>
          
          <div className="flex flex-col items-end gap-3 mt-4 md:mt-0">
            {/* Train Selector */}
            <div className="flex gap-2 items-center bg-[#0a1628] p-1.5 rounded-lg border border-[#1e2d45]">
              <span className="text-xs font-bold text-gray-500 px-2 uppercase tracking-widest">Track</span>
              <input value={train1} onChange={e => setTrain1(e.target.value)} placeholder="Train 1 No." className="bg-[#1e293b] text-white px-2 py-1.5 rounded-md w-24 text-sm font-mono border-none focus:ring-1 focus:ring-blue-500" />
              <input value={train2} onChange={e => setTrain2(e.target.value)} placeholder="Train 2 No." className="bg-[#1e293b] text-white px-2 py-1.5 rounded-md w-24 text-sm font-mono border-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={updateTrains} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-bold transition shadow-[0_0_10px_#2563eb40]">
                Set
              </button>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button onClick={() => injectFault('inject_signal_mismatch')} className="px-3 py-1.5 bg-red-950/40 text-red-300 border border-red-900/50 rounded hover:bg-red-900/60 transition text-xs font-bold">Signal Mismatch</button>
              <button onClick={() => injectFault('inject_converging_trains')} className="px-3 py-1.5 bg-orange-950/40 text-orange-300 border border-orange-900/50 rounded hover:bg-orange-900/60 transition text-xs font-bold">Simulate Collision</button>
              <button onClick={() => injectFault('simulate_gps_anomaly')} className="px-3 py-1.5 bg-purple-950/40 text-purple-300 border border-purple-900/50 rounded hover:bg-purple-900/60 transition text-xs font-bold">GPS Anomaly</button>
              <button onClick={resolveAll} className="px-3 py-1.5 bg-green-950/40 text-green-300 border border-green-900/50 rounded hover:bg-green-900/60 transition text-xs font-bold ml-2">Resolve</button>
            </div>
          </div>
        </div>

        {/* Top Row: Weather / Alerts */}
        <div className="mb-6">
          <WeatherPanel />
          <div className="mt-4"><AlertBanner alerts={state.alerts} /></div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* LEFT COLUMN: Map (spans 2 cols) */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-[#0a1628] rounded-xl border border-[#1e2d45] shadow-lg overflow-hidden flex flex-col h-full">
              <div className="px-4 py-3 border-b border-[#1e2d45] flex justify-between items-center bg-[#060d1a]">
                <h2 className="text-sm font-bold text-gray-300 tracking-widest uppercase">Live GIS Map</h2>
                <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded font-mono">● RailRadar LIVE</span>
              </div>
              <div className="flex-1 p-2">
                {/* BIGGER MAP */}
                <TrackMap state={state} height={800} />
              </div>
            </div>
            
            {/* Operational Panels moved below map */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IncidentPanel state={state} />
              <AlertDispatch state={state} />
              <RiskPanel state={state} />
              <ConfirmationLog state={state} />
            </div>
          </div>

          {/* RIGHT COLUMN: Passenger View (StationTimeline) */}
          <div className="space-y-6">
            <div className="bg-[#060d1a] border border-[#1e2d45] rounded-xl p-4">
              <h2 className="text-sm font-bold text-gray-300 tracking-widest uppercase mb-4">Passenger View</h2>
              <StationTimeline state={state} />
            </div>

            {/* Escalation Config */}
            <div className="bg-[#0a1628] rounded-xl border border-[#1e2d45] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e2d45] bg-[#060d1a]">
                <h3 className="text-sm font-bold text-gray-300 tracking-widest uppercase">Escalation Settings</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Timeout (s)</label>
                    <input type="number" value={escalationConfig.timeout_seconds} onChange={e => setEscalationConfig(prev => ({ ...prev, timeout_seconds: parseInt(e.target.value) || 15 }))} className="w-full bg-[#1e293b] text-white px-2 py-1.5 rounded border border-[#1e2d45] text-sm font-mono" />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-[10px] text-gray-500 uppercase mb-1">Phone Number</label>
                    <input type="text" value={escalationConfig.phone_number} onChange={e => setEscalationConfig(prev => ({ ...prev, phone_number: e.target.value }))} placeholder="+91XXXXXXXXXX" className="w-full bg-[#1e293b] text-white px-2 py-1.5 rounded border border-[#1e2d45] text-sm font-mono" />
                  </div>
                </div>
                <button onClick={saveEscalationConfig} className="w-full bg-blue-900/40 hover:bg-blue-800/60 border border-blue-800/50 text-blue-300 py-1.5 rounded font-bold text-xs transition">
                  {configSaved ? '✓ Saved!' : 'Save Config'}
                </button>
              </div>
            </div>

            <AlertLog alerts={state.alerts} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
