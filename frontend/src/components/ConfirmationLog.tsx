import type { AppState, ConfirmationEntry } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

const STATUS_STYLE: Record<string, string> = {
  Clear: 'text-green-400 bg-green-900/20',
  Occupied: 'text-yellow-400 bg-yellow-900/20',
  Mismatch: 'text-red-400 bg-red-900/30 font-bold animate-pulse',
};

const SIGNAL_DOT: Record<string, string> = {
  GREEN: 'bg-green-400',
  RED: 'bg-red-400',
  YELLOW: 'bg-yellow-400',
  green: 'bg-green-400',
  red: 'bg-red-400',
  yellow: 'bg-yellow-400',
  UNKNOWN: 'bg-gray-500',
};

function LogRow({ entry }: { entry: ConfirmationEntry }) {
  const ts = new Date(entry.confirmed_at * 1000).toLocaleTimeString();
  const statusStyle = STATUS_STYLE[entry.status] ?? 'text-gray-400';
  const dotColor = SIGNAL_DOT[entry.signal] ?? 'bg-gray-500';

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-800/60 last:border-0 text-xs font-mono">
      <span className="text-gray-600 w-20 shrink-0">{ts}</span>
      <span className="text-gray-400 w-16 shrink-0">{entry.junction_id}</span>
      <span className={`px-2 py-0.5 rounded text-xs ${statusStyle}`}>{entry.status}</span>
      <span className="flex items-center gap-1 text-gray-500">
        <span className={`w-2 h-2 rounded-full inline-block ${dotColor}`}></span>
        {entry.signal}
      </span>
      <span className="ml-auto text-gray-600 text-xs">{entry.confirmed_by}</span>
    </div>
  );
}

const ConfirmationLog = ({ state }: Props) => {
  const log = state.confirmation_log;
  const mismatches = log.filter(e => e.status === 'Mismatch').length;

  return (
    <div className="mt-6 bg-[#0f172a] p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-200">Track Section Confirmation Log</h3>
        <div className="flex gap-2 text-xs">
          {mismatches > 0 && (
            <span className="text-red-400 bg-red-900/30 border border-red-800 px-2 py-1 rounded animate-pulse">
              {mismatches} MISMATCH
            </span>
          )}
          <span className="text-gray-500 bg-gray-800 px-2 py-1 rounded">{log.length} entries</span>
        </div>
      </div>

      {log.length === 0 ? (
        <p className="text-gray-500 text-sm italic">No confirmation entries yet.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <div className="flex items-center gap-3 py-1 text-xs text-gray-600 border-b border-gray-700 mb-1 font-mono">
            <span className="w-20">TIME</span>
            <span className="w-16">SECTION</span>
            <span className="w-20">STATUS</span>
            <span>SIGNAL</span>
            <span className="ml-auto">SOURCE</span>
          </div>
          {[...log].reverse().map((entry, i) => (
            <LogRow key={`${entry.junction_id}-${entry.confirmed_at}-${i}`} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ConfirmationLog;
