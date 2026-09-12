import { useState } from 'react';
import type { AppState } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

interface SafeReport {
  coachId: string;
  count: number;
  reportedAt: number;
}

const ImSafe = ({ state }: Props) => {
  const [coachId, setCoachId] = useState('');
  const [passengerCount, setPassengerCount] = useState('');
  const [reports, setReports] = useState<SafeReport[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const hasIncident = state.incident_alerts.length > 0;
  const totalSafe = reports.reduce((sum, r) => sum + r.count, 0);

  const handleSubmit = () => {
    const count = parseInt(passengerCount) || 0;
    if (!coachId.trim() || count < 1) return;

    const report: SafeReport = {
      coachId: coachId.trim().toUpperCase(),
      count,
      reportedAt: Date.now(),
    };
    setReports(prev => [report, ...prev.filter(r => r.coachId !== report.coachId)]);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setCoachId('');
    setPassengerCount('');
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      {/* Incident banner */}
      {hasIncident && (
        <div className="mb-6 bg-red-900/40 border border-red-700 rounded-lg p-4 text-center animate-pulse">
          <div className="text-2xl mb-1">🚨</div>
          <div className="text-red-300 font-bold text-lg">INCIDENT DETECTED</div>
          <div className="text-red-400 text-sm mt-1">
            {state.incident_alerts[0].description}
          </div>
        </div>
      )}

      {/* I'm Safe button panel */}
      <div className="bg-[#0f172a] rounded-xl border border-gray-700 p-6 shadow-xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🛡️</div>
          <h1 className="text-2xl font-black text-white">Passenger Safety Report</h1>
          <p className="text-gray-400 text-sm mt-1">
            Report your coach status to rescue coordination
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Coach ID</label>
            <input
              value={coachId}
              onChange={e => setCoachId(e.target.value)}
              placeholder="e.g. S1, B2, A3"
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Passengers Safe</label>
            <input
              type="number"
              value={passengerCount}
              onChange={e => setPassengerCount(e.target.value)}
              placeholder="Number of passengers"
              min={1}
              className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none text-lg"
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!coachId.trim() || !passengerCount}
          className={`w-full py-4 rounded-xl font-black text-xl transition-all ${
            submitted
              ? 'bg-green-600 text-white scale-95'
              : 'bg-green-500 hover:bg-green-400 text-black disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {submitted ? '✓ REPORTED — STAY SAFE' : "I'M SAFE"}
        </button>
      </div>

      {/* Summary */}
      {reports.length > 0 && (
        <div className="mt-6 bg-[#0f172a] rounded-xl border border-gray-700 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-gray-200">Safety Reports</h3>
            <div className="text-green-400 font-black text-lg">{totalSafe} safe</div>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {reports.map(r => (
              <div key={r.coachId} className="flex justify-between items-center bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2 text-sm">
                <span className="font-mono font-bold text-green-300">Coach {r.coachId}</span>
                <span className="text-green-400">{r.count} passengers safe</span>
                <span className="text-gray-600 text-xs">
                  {new Date(r.reportedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <div className="text-2xl font-black text-green-400">{totalSafe}</div>
              <div className="text-gray-500 text-xs">Passengers Safe</div>
            </div>
            <div>
              <div className="text-2xl font-black text-blue-400">{reports.length}</div>
              <div className="text-gray-500 text-xs">Coaches Reported</div>
            </div>
            <div>
              <div className="text-2xl font-black text-orange-400">
                {state.incident_alerts.reduce((s, i) => s + i.estimated_affected_coaches, 0) || '—'}
              </div>
              <div className="text-gray-500 text-xs">Est. Affected</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImSafe;
