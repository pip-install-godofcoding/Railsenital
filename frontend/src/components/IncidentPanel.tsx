import type { AppState, IncidentAlert, Responder } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

const TYPE_LABEL: Record<string, string> = {
  signal_mismatch: 'Signal Mismatch',
  converging_trains: 'Converging Trains',
  gps_anomaly: 'GPS Cluster Anomaly',
};

const TYPE_ICON: Record<string, string> = {
  signal_mismatch: '🚨',
  converging_trains: '⚡',
  gps_anomaly: '📍',
};

function ResponderCard({ r }: { r: Responder }) {
  return (
    <div className="flex items-start gap-2 bg-gray-900 rounded p-2 text-xs">
      <span className="text-base mt-0.5">{r.type === 'hospital' ? '🏥' : '🚒'}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-gray-200 truncate">{r.name}</div>
        <div className="text-gray-400">{r.distance_km} km away</div>
        <div className="text-gray-500">{r.contact}</div>
      </div>
    </div>
  );
}

function IncidentCard({ inc }: { inc: IncidentAlert }) {
  const ts = new Date(inc.detected_at * 1000).toLocaleTimeString();
  const severityColor = inc.severity === 'critical' ? 'border-red-600 bg-red-950/40' : 'border-orange-600 bg-orange-950/30';
  const badgeColor = inc.severity === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white';

  return (
    <div className={`rounded-lg border p-4 ${severityColor}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICON[inc.type] ?? '⚠'}</span>
          <div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${badgeColor}`}>
              {inc.severity.toUpperCase()}
            </span>
            <div className="font-bold text-white mt-1">{TYPE_LABEL[inc.type] ?? inc.type}</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 shrink-0">
          <div className="font-mono">{ts}</div>
          <div className="text-gray-600">{inc.id}</div>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-3">{inc.description}</p>

      <div className="flex flex-wrap gap-3 text-xs mb-3">
        {inc.affected_trains.filter(Boolean).map(tid => (
          <span key={tid} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded font-mono">{tid}</span>
        ))}
        <span className="text-orange-400 font-semibold">~{inc.estimated_affected_coaches} coaches affected</span>
        {inc.lat && <span className="text-gray-500">{inc.lat.toFixed(3)}, {inc.lng?.toFixed(3)}</span>}
      </div>

      {inc.nearest_responders && inc.nearest_responders.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Nearest Responders</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {inc.nearest_responders.map(r => (
              <ResponderCard key={`${r.name}-${r.type}`} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const IncidentPanel = ({ state }: Props) => {
  const incidents = state.incident_alerts;

  return (
    <div className="mt-6 bg-[#0f172a] p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200">Disaster Management</h3>
        {incidents.length > 0 ? (
          <span className="animate-pulse text-xs font-bold text-red-400 bg-red-900/30 border border-red-800 px-2 py-1 rounded">
            {incidents.length} ACTIVE INCIDENT{incidents.length > 1 ? 'S' : ''}
          </span>
        ) : (
          <span className="text-xs text-green-400 bg-green-900/20 border border-green-800 px-2 py-1 rounded">
            ALL CLEAR
          </span>
        )}
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">✅</div>
          <div>No active incidents detected</div>
          <div className="text-xs mt-1">System is monitoring for signal mismatches, converging trains, and GPS anomalies</div>
        </div>
      ) : (
        <div className="space-y-4">
          {incidents.map(inc => (
            <IncidentCard key={inc.id} inc={inc} />
          ))}
        </div>
      )}
    </div>
  );
};

export default IncidentPanel;
