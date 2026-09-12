import type { AppState, AuthorityDispatch } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

const TYPE_ICON: Record<string, string> = {
  hospital: '🏥',
  ndrf: '🚒',
  police: '🚔',
  station_master: '📡',
  driver: '🚂',
};

const TYPE_COLOR: Record<string, string> = {
  hospital: 'border-purple-700 bg-purple-950/30',
  ndrf: 'border-orange-700 bg-orange-950/20',
  police: 'border-blue-700 bg-blue-950/20',
  station_master: 'border-red-700 bg-red-950/30',
  driver: 'border-yellow-500 bg-yellow-950/40',
};

function DispatchRow({ d }: { d: AuthorityDispatch }) {
  const ts = new Date(d.dispatched_at * 1000).toLocaleTimeString();
  const borderCls = TYPE_COLOR[d.authority_type] ?? 'border-gray-700 bg-gray-800';

  return (
    <div className={`border rounded-lg p-3 ${borderCls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{TYPE_ICON[d.authority_type] ?? '📢'}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-100 truncate">{d.authority_name}</div>
            {d.contact !== 'VDU-ALERT' && (
              <div className="text-xs text-gray-400">{d.contact}</div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xs font-bold px-2 py-0.5 rounded ${
            d.status === 'acknowledged'
              ? 'bg-green-700 text-white'
              : 'bg-yellow-700/60 text-yellow-200'
          }`}>
            {d.status.toUpperCase()}
          </div>
          <div className="text-xs text-gray-500 mt-1 font-mono">{ts}</div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-2 leading-relaxed line-clamp-2">{d.message}</p>
      <div className="text-xs text-gray-600 mt-1 font-mono">→ {d.incident_id}</div>
    </div>
  );
}

const TYPE_SORT_ORDER: Record<string, number> = {
  driver: 0,
  station_master: 1,
  hospital: 2,
  ndrf: 3,
  police: 4,
};

const AlertDispatch = ({ state }: Props) => {
  const dispatches = state.authority_dispatches ?? [];
  const hasDispatches = dispatches.length > 0;

  const sorted = [...dispatches].sort(
    (a, b) => (TYPE_SORT_ORDER[a.authority_type] ?? 9) - (TYPE_SORT_ORDER[b.authority_type] ?? 9)
  );

  const counts = dispatches.reduce<Record<string, number>>((acc, d) => {
    acc[d.authority_type] = (acc[d.authority_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mt-6 bg-[#0f172a] p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200">Authority Notifications</h3>
        {hasDispatches ? (
          <div className="flex gap-2 text-xs flex-wrap justify-end">
            {counts.driver && (
              <span className="bg-yellow-900/50 text-yellow-300 border border-yellow-600 px-2 py-0.5 rounded animate-pulse font-bold">
                🚂 {counts.driver} LOCO PILOT
              </span>
            )}
            {counts.station_master && (
              <span className="bg-red-900/40 text-red-300 border border-red-800 px-2 py-0.5 rounded">
                📡 {counts.station_master} SM
              </span>
            )}
            {counts.hospital && (
              <span className="bg-purple-900/40 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">
                🏥 {counts.hospital}
              </span>
            )}
            {counts.police && (
              <span className="bg-blue-900/40 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                🚔 {counts.police}
              </span>
            )}
            {counts.ndrf && (
              <span className="bg-orange-900/40 text-orange-300 border border-orange-800 px-2 py-0.5 rounded">
                🚒 {counts.ndrf}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">No active dispatches</span>
        )}
      </div>

      {!hasDispatches ? (
        <div className="text-center py-6 text-gray-600">
          <div className="text-3xl mb-2">📡</div>
          <div className="text-sm">Authorities notified automatically when incident fires</div>
          <div className="text-xs mt-1">Loco Pilot · Station Master · Hospitals · NDRF · Police</div>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {sorted.map(d => (
            <DispatchRow key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AlertDispatch;
