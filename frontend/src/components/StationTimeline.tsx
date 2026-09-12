import { useState } from 'react';
import type { AppState, StationETA, TrainData } from '../hooks/useWebSockets';

interface Props { state: AppState; }

function fmt(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
}
function fmtSched(t: string | null): string {
  if (!t) return '--:--';
  if (t.includes('T')) t = t.split('T')[1];
  else if (t.includes(' ')) t = t.split(' ')[1];
  return t.length >= 5 ? t.slice(0, 5) : t;
}
function dayLabel(): string {
  const d = new Date();
  return 'DAY 1 • ' + d.getDate() + ' ' + d.toLocaleString('en', { month: 'short' }).toUpperCase();
}

export function TrainTimeline({ trainId, train, etas }: { trainId: string; train: TrainData; etas: StationETA[] }) {
  const delay = train.delayMinutes ?? 0;
  const currentStation = train.currentStation || '';

  // Build combined list: past stations from StationETAs + upcoming
  const allStations = etas.length > 0 ? etas : [];

  return (
    <div style={{ background: '#060d1a', borderRadius: 12, marginBottom: 24, overflow: 'hidden', border: '1px solid #1e2d45' }}>
      {/* Train Header */}
      <div style={{ padding: '14px 20px', background: '#0a1628', borderBottom: '1px solid #1e2d45', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: train.isLive ? '#22c55e' : '#6b7280', display: 'inline-block', boxShadow: train.isLive ? '0 0 8px #22c55e' : 'none', animation: train.isLive ? 'pulse 1.5s infinite' : 'none' }} />
            <span style={{ color: '#e2f1ff', fontWeight: 700, fontSize: 15 }}>{train.trainName || trainId}</span>
            <span style={{ color: '#4a6fa1', fontFamily: 'monospace', fontSize: 12 }}>#{trainId}</span>
          </div>
          <div style={{ color: '#4a6fa1', fontSize: 12, marginTop: 2 }}>{train.source} → {train.destination}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: delay > 30 ? '#f87171' : delay > 10 ? '#fbbf24' : '#4ade80', fontWeight: 800, fontSize: 22, lineHeight: 1 }}>
            {delay >= 0 ? '+' : ''}{Math.round(delay)}<span style={{ fontSize: 13, fontWeight: 400 }}>m</span>
          </div>
          <div style={{ color: '#4a6fa1', fontSize: 11 }}>delay</div>
          <div style={{ color: '#60a5fa', fontSize: 12, marginTop: 2 }}>
            {(train.segmentSpeed ?? train.avgSpeed ?? 0).toFixed(0)} km/h
          </div>
        </div>
      </div>

      {/* Day Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', padding: '10px 20px', background: '#0a1628', borderBottom: '1px solid #1e2d45', textAlign: 'center' }}>
        <div style={{ color: '#4a6fa1', fontWeight: 700, fontSize: 11, letterSpacing: 1, textAlign: 'left' }}>ARRIVAL</div>
        <div style={{ color: '#c9d9f0', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{dayLabel()}</div>
        <div style={{ color: '#4a6fa1', fontWeight: 700, fontSize: 11, letterSpacing: 1, textAlign: 'right' }}>DEPARTURE</div>
      </div>

      {/* Station rows */}
      {allStations.length === 0 ? (
        <div style={{ color: '#4a6fa1', textAlign: 'center', padding: '24px', fontSize: 13 }}>Fetching schedule from RailRadar…</div>
      ) : (
        <div style={{ padding: '0 0 8px 0' }}>
          {allStations.map((s, i) => {
            const isCurrent = s.station_name === currentStation || (i === 0 && allStations[0]?.station_code === currentStation);
            const isPast = !isCurrent && i > 0 && !isCurrent;
            const etaTime = s.eta_timestamp ? fmt(s.eta_timestamp) : null;
            return (
              <div key={`${s.station_code}-${i}`} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px', minHeight: 72, position: 'relative' }}>
                {/* Left: Arrival */}
                <div style={{ padding: '14px 0 14px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  {s.scheduled_arrival && <div style={{ color: '#c9d9f0', fontSize: 13 }}>{fmtSched(s.scheduled_arrival)}</div>}
                  {etaTime && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>{etaTime}</div>}
                </div>

                {/* Center: Track */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {/* Vertical track line */}
                  <div style={{
                    position: 'absolute', left: '50%', top: 0, bottom: 0,
                    width: 3, transform: 'translateX(-50%)',
                    background: 'repeating-linear-gradient(to bottom, #1e3a5a 0px, #1e3a5a 6px, transparent 6px, transparent 12px)',
                  }} />
                  {/* Station dot or current marker */}
                  <div style={{ position: 'relative', zIndex: 2, marginTop: 22 }}>
                    {isCurrent ? (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e4ed8', border: '3px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px #3b82f680' }}>
                        <svg width='14' height='14' viewBox='0 0 24 24' fill='white'>
                          <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/>
                        </svg>
                      </div>
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: isPast ? '#1e3a5a' : '#1e3a5a', border: '2px solid #3b82f6', boxShadow: 'none' }} />
                    )}
                  </div>
                  {/* Station Info */}
                  <div style={{ textAlign: 'center', padding: '6px 12px 14px', width: '100%' }}>
                    <div style={{ color: isCurrent ? '#60a5fa' : '#c9d9f0', fontWeight: isCurrent ? 700 : 500, fontSize: 15 }}>{s.station_name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
                      {s.station_code && <span style={{ color: '#4a6fa1', fontSize: 11 }}>{s.station_code}</span>}
                      {s.dist_remaining_km != null && <span style={{ color: '#4a6fa1', fontSize: 11 }}>• {Math.round(s.dist_remaining_km)} km</span>}
                      {s.predicted_delay_min != null && (
                        <span style={{ background: '#1e3a6a', color: '#60a5fa', fontSize: 11, padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                          +{Math.round(s.predicted_delay_min)}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Departure */}
                <div style={{ padding: '14px 20px 14px 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
                  {s.scheduled_departure && <div style={{ color: '#c9d9f0', fontSize: 13 }}>{fmtSched(s.scheduled_departure)}</div>}
                  {etaTime && delay > 0 && <div style={{ color: '#f87171', fontSize: 13, fontWeight: 700 }}>{etaTime}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* In Train button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 16px' }}>
        <button style={{
          background: '#0a1628', border: '1px solid #1e2d45', borderRadius: 20, padding: '8px 18px',
          color: '#c9d9f0', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
        }}>
          <svg width='16' height='16' viewBox='0 0 24 24' fill='#60a5fa'><path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/></svg>
          In Train?
        </button>
      </div>
    </div>
  );
}

const StationTimeline = ({ state }: Props) => {
  const trains = state.trains?.trains ?? {};
  const stationEtas = state.station_etas ?? {};
  const trainEntries = Object.entries(trains).filter(([id]) => !id.startsWith('GHOST'));
  if (trainEntries.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      {trainEntries.map(([id, train]) => (
        <TrainTimeline
          key={id}
          trainId={id}
          train={train as TrainData}
          etas={stationEtas[id] ?? (train as any).stationETAs ?? []}
        />
      ))}
    </div>
  );
};

export default StationTimeline;
