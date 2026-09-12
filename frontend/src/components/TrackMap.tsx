import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppState } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
}

const RISK_ROUTE_COLOR: Record<string, string> = {
  none: '#3b82f6',
  low: '#eab308',
  moderate: '#f97316',
  severe: '#ef4444',
};

// ── Auto-pan component — runs inside MapContainer context ────────────────
function MapController({
  followId,
  trains,
}: {
  followId: string | null;
  trains: Record<string, any>;
}) {
  const map = useMap();
  const initRef = useRef(false);

  useEffect(() => {
    // On first load with train data, fit to all train positions
    if (!initRef.current) {
      const pts = Object.values(trains)
        .filter((t: any) => t.lat && t.lng && !String(t.trainNumber).startsWith('GHOST'))
        .map((t: any) => [t.lat, t.lng] as [number, number]);

      if (pts.length > 0) {
        initRef.current = true;
        if (pts.length === 1) {
          map.setView(pts[0], 9);
        } else {
          try {
            const L = (window as any).L;
            map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 9 });
          } catch {
            map.setView(pts[0], 8);
          }
        }
      }
    }
  }, [trains, map]);

  // Follow selected train
  useEffect(() => {
    if (!followId || !trains[followId]) return;
    const t = trains[followId];
    if (t.lat && t.lng) {
      map.flyTo([t.lat, t.lng], 10, { duration: 0.8 });
    }
  }, [followId, trains, map]);

  return null;
}

// ── Pulsing SVG marker for live train ────────────────────────────────────
function TrainDot({
  id, t, color, isGhost, radius,
}: {
  id: string; t: any; color: string; isGhost: boolean; radius: number;
}) {
  const delay = t.delayMinutes ?? 0;
  const delayColor = delay > 30 ? '#dc2626' : delay > 10 ? '#ca8a04' : '#16a34a';

  const ghostPopup = (
    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4, color: '#facc15' }}>
        ⚠ {t.trainName || id}
      </div>
      <div style={{ color: '#fca5a5' }}>⚠ {t.currentStation || 'Fault detected'}</div>
      <div style={{ color: '#f87171', fontWeight: 'bold', marginTop: 4 }}>
        STATUS: {t.status}
      </div>
      {t.lat && (
        <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
          {t.lat.toFixed(4)}, {t.lng?.toFixed(4)}
        </div>
      )}
    </div>
  );

  const realPopup = (
    <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}>
      <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>
        🚂 {t.trainName || id}
      </div>
      <div>📍 {t.currentStation || '—'}</div>
      <div>⚡ {t.avgSpeed ?? '—'} km/h</div>
      <div style={{ color: delayColor, fontWeight: 'bold' }}>
        ⏱ Delay: {delay >= 0 ? `+${Math.round(delay)}` : Math.round(delay)} min
      </div>
      <div>📏 {Math.round(t.distanceFromOriginKm ?? 0)} / {Math.round(t.totalDistanceKm ?? 0)} km</div>
      <div>
        {t.isLive
          ? <span style={{ color: '#22c55e' }}>● Live GPS (RailRadar)</span>
          : <span style={{ color: '#f59e0b' }}>● Interpolated (API rate-limited)</span>}
      </div>
      {t.stationETAs?.[0] && (
        <div style={{ marginTop: 4, color: '#93c5fd' }}>
          Next: {t.stationETAs[0].station_name} in {t.stationETAs[0].dist_remaining_km} km
        </div>
      )}
    </div>
  );

  return (
    <CircleMarker
      key={id}
      center={[t.lat, t.lng]}
      radius={radius}
      color={color}
      fillColor={color}
      fillOpacity={0.92}
      weight={isGhost ? 2 : 3}
    >
      <Popup minWidth={200}>
        {isGhost ? ghostPopup : realPopup}
      </Popup>
    </CircleMarker>
  );
}

const TrackMap: React.FC<Props> = ({ state }) => {
  const [routes, setRoutes] = useState<Record<string, any>>({});
  const [followId, setFollowId] = useState<string | null>(null);

  useEffect(() => {
    if (!state.trains?.trains) return;
    Object.keys(state.trains.trains).forEach(trainNum => {
      if (!routes[trainNum] && !trainNum.startsWith('GHOST')) {
        fetch(`http://localhost:8000/api/route/${trainNum}`)
          .then(r => r.ok ? r.json() : null)
          .then(geojson => {
            if (geojson?.type || geojson?.geometry) {
              setRoutes(prev => ({ ...prev, [trainNum]: geojson }));
            }
          })
          .catch(() => {});
      }
    });
  }, [state.trains]);

  if (!state.trains) return <div className="text-gray-400 p-4">Loading map…</div>;

  const trains = (state.trains as any).trains ?? {};
  const hasIncident = state.incident_alerts.length > 0;

  const highestRisk = Object.values(state.risk_scores).reduce<string>((worst, r) => {
    const order = ['none', 'low', 'moderate', 'severe'];
    return order.indexOf(r.risk_level) > order.indexOf(worst) ? r.risk_level : worst;
  }, 'none');
  const routeColor = RISK_ROUTE_COLOR[highestRisk] ?? '#3b82f6';

  const realTrains = Object.entries(trains).filter(([id]) => !id.startsWith('GHOST'));

  return (
    <div className="bg-[#0f172a] p-4 rounded-lg border border-gray-700 mb-6 shadow-inner">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-bold text-gray-200">Live GIS Map Tracking</h2>
        <div className="flex items-center gap-3 text-xs flex-wrap justify-end">
          {hasIncident && (
            <span className="text-red-400 font-bold animate-pulse flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> INCIDENT ACTIVE
            </span>
          )}
          <span className="text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" /> RailRadar LIVE
          </span>
        </div>
      </div>

      {/* Legend + Follow buttons */}
      <div className="flex flex-wrap gap-2 mb-2 text-xs text-gray-400 items-center">
        <span><span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1" />Train</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1" />Ghost</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-1" />Coach GPS</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1" />Hospital</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1" />NDRF</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-blue-400 mr-1" />Police</span>
        {highestRisk !== 'none' && (
          <span style={{ color: routeColor }}>⚠ Route risk: {highestRisk.toUpperCase()}</span>
        )}
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setFollowId(null)}
            className={`px-2 py-0.5 rounded text-xs border ${!followId ? 'bg-gray-700 border-gray-500 text-white' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}
          >
            Overview
          </button>
          {realTrains.map(([id]) => (
            <button
              key={id}
              onClick={() => setFollowId(prev => prev === id ? null : id)}
              className={`px-2 py-0.5 rounded text-xs border transition-colors ${followId === id ? 'bg-blue-700 border-blue-500 text-white' : 'border-gray-700 text-gray-400 hover:border-blue-600 hover:text-blue-300'}`}
            >
              📍 {id}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 520 }} className="rounded-xl overflow-hidden border border-gray-800">
        <style>{`.dark-tiles{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)}`}</style>
        <MapContainer
          center={[21.5, 86.9]}
          zoom={7}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
            className="dark-tiles"
          />

          <MapController followId={followId} trains={trains} />

          {/* Routes */}
          {Object.entries(routes).map(([tid, geojson]) =>
            geojson?.type || geojson?.geometry ? (
              <GeoJSON key={`route-${tid}`} data={geojson}
                style={{ color: routeColor, weight: 3, opacity: 0.7 }} />
            ) : null
          )}

          {/* Incident zones */}
          {state.incident_alerts.map(inc =>
            inc.lat && inc.lng ? (
              <Circle key={`inc-${inc.id}`} center={[inc.lat, inc.lng]}
                radius={15000} color="#ef4444" fillColor="#ef4444" fillOpacity={0.15} weight={2}>
                <Popup>
                  <strong style={{ color: '#dc2626' }}>⚠ INCIDENT</strong>
                  <p style={{ margin: '4px 0', fontSize: 12 }}>{inc.description}</p>
                  <p style={{ fontSize: 11, color: '#666' }}>Est. coaches: {inc.estimated_affected_coaches}</p>
                </Popup>
              </Circle>
            ) : null
          )}

          {/* Train markers */}
          {Object.entries(trains).map(([id, t]: [string, any]) => {
            if (!t.lat || !t.lng) return null;
            const isGhost = id.startsWith('GHOST');
            // GHOST_SIGNAL = yellow warning marker, GHOST_SIM = red collision, real = blue
            const color = id === 'GHOST_SIGNAL' ? '#facc15' : isGhost ? '#ef4444' : '#3b82f6';
            const radius = id === 'GHOST_SIGNAL' ? 14 : isGhost ? 7 : 11;
            return <TrainDot key={id} id={id} t={t} color={color} isGhost={isGhost} radius={radius} />;
          })}

          {/* Coach GPS dots */}
          {state.coach_positions.map(coach => (
            <CircleMarker key={`coach-${coach.coach_id}`}
              center={[coach.lat, coach.long]}
              radius={6} color="#4ade80" fillColor="#4ade80" fillOpacity={0.9} weight={2}>
              <Popup>
                <div style={{ minWidth: 150, fontSize: 12 }}>
                  <strong>Coach {coach.coach_id}</strong>
                  <div>Speed: {coach.calculated_speed?.toFixed(1) ?? '—'} km/h</div>
                  {coach.route_segment_id && <div>Segment: {coach.route_segment_id}</div>}
                  <div style={{ color: coach.matched ? '#22c55e' : '#f97316' }}>
                    {coach.matched ? '✓ Map-matched' : '⚠ Outside route'}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Nearest responders for incidents */}
          {state.incident_alerts.flatMap(inc =>
            (inc.nearest_responders ?? []).map(r => {
              const color = r.type === 'hospital' ? '#a855f7'
                : r.type === 'police' ? '#60a5fa'
                : '#f97316';
              const icon = r.type === 'hospital' ? '🏥' : r.type === 'police' ? '🚔' : '🚒';
              return (
                <CircleMarker key={`resp-${inc.id}-${r.name}`}
                  center={[r.lat, r.lng]} radius={9}
                  color={color} fillColor={color} fillOpacity={0.85} weight={2}>
                  <Popup>
                    <strong>{icon} {r.name}</strong>
                    <div style={{ fontSize: 12 }}>
                      <div>{r.distance_km} km from incident</div>
                      <div>{r.contact}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })
          )}
        </MapContainer>
      </div>

      {/* Live position readout under map */}
      <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
        {realTrains.map(([id, t]: [string, any]) => (
          <span key={id} className="font-mono">
            <span className="text-blue-400">{id}</span>
            {' '}lat <span className="text-gray-300">{t.lat?.toFixed(4)}</span>
            {' '}lng <span className="text-gray-300">{t.lng?.toFixed(4)}</span>
            {' '}@ <span className="text-gray-300">{Math.round(t.distanceFromOriginKm ?? 0)} km</span>
            {' '}
            {t.isLive
              ? <span className="text-green-400">● live</span>
              : <span className="text-yellow-500">● interpolated</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TrackMap;
