import type { AppState, StationETA, TrainData } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

function delayColor(min: number) {
  if (min > 30) return 'text-red-400';
  if (min > 10) return 'text-yellow-400';
  return 'text-green-400';
}

function formatEta(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ProgressBar({ dist, total }: { dist: number; total: number }) {
  const pct = total > 0 ? Math.min((dist / total) * 100, 100) : 0;
  return (
    <div className="relative h-2 bg-gray-700 rounded-full mt-2 mb-1">
      <div
        className="absolute h-2 bg-blue-500 rounded-full transition-all duration-1000"
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute w-3 h-3 bg-white rounded-full border-2 border-blue-500 -top-0.5 -translate-x-1/2 transition-all duration-1000"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function TrainCard({ trainId, train, etas }: { trainId: string; train: TrainData; etas: StationETA[] }) {
  const delay = train.delayMinutes ?? 0;
  const dColor = delayColor(delay);
  const pct = train.totalDistanceKm > 0
    ? Math.round((train.distanceFromOriginKm / train.totalDistanceKm) * 100)
    : 0;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mb-4">
      {/* Train header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full inline-block ${train.isLive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            <span className="font-bold text-white">{train.trainName}</span>
            <span className="text-xs text-gray-500 font-mono">#{trainId}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {train.source || '—'} → {train.destination || '—'}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-black ${dColor}`}>
            {delay >= 0 ? '+' : ''}{delay.toFixed(0)}
            <span className="text-sm font-normal ml-0.5">min</span>
          </div>
          <div className="text-xs text-gray-500">delay</div>
        </div>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
        <div className="bg-gray-900 rounded p-2">
          <div className="text-blue-400 font-bold text-lg">
            {train.segmentSpeed ?? train.avgSpeed ?? '—'} <span className="text-sm font-normal text-gray-500">km/h</span>
          </div>
          <div className="text-gray-500">Live Speed (Avg: {train.avgSpeed ?? '—'})</div>
        </div>
        <div className="bg-gray-900 rounded p-2">
          <div className="text-gray-200 font-bold">{train.currentStation || '—'}</div>
          <div className="text-gray-500">Current</div>
        </div>
        <div className="bg-gray-900 rounded p-2">
          <div className="text-gray-200 font-bold">{pct}%</div>
          <div className="text-gray-500">Journey</div>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar dist={train.distanceFromOriginKm} total={train.totalDistanceKm} />
      <div className="flex justify-between text-xs text-gray-600 mb-3">
        <span>{Math.round(train.distanceFromOriginKm)} km</span>
        <span>{Math.round(train.totalDistanceKm)} km</span>
      </div>

      {/* Station ETAs */}
      {etas.length > 0 ? (
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Upcoming Stations — XGBoost ETA
          </div>
          <div className="space-y-1">
            {etas.map((s, i) => (
              <div key={`${s.station_code}-${i}`}
                className="flex items-center justify-between bg-gray-900 rounded px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                  <span className="text-gray-300 font-medium">{s.station_name}</span>
                  {s.station_code && (
                    <span className="text-gray-600 font-mono">{s.station_code}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-gray-500">{s.dist_remaining_km} km</span>
                  <span className={`font-bold ${delayColor(s.predicted_delay_min)}`}>
                    +{s.predicted_delay_min}m
                  </span>
                  <span className="text-gray-300 font-mono">{formatEta(s.eta_timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-600 italic text-center py-2">
          Fetching station schedule from RailRadar…
        </div>
      )}
    </div>
  );
}

const StationTimeline = ({ state }: Props) => {
  const trains = state.trains?.trains ?? {};
  const stationEtas = state.station_etas ?? {};

  const trainEntries = Object.entries(trains).filter(([id]) => !id.startsWith('GHOST'));
  if (trainEntries.length === 0) return null;

  return (
    <div className="mt-6 bg-[#0f172a] p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200">Live Train Tracking</h3>
        <span className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800 px-2 py-1 rounded font-mono">
          GPS + XGBoost ETA
        </span>
      </div>
      {trainEntries.map(([id, train]) => (
        <TrainCard
          key={id}
          trainId={id}
          train={train}
          etas={stationEtas[id] ?? train.stationETAs ?? []}
        />
      ))}
    </div>
  );
};

export default StationTimeline;
