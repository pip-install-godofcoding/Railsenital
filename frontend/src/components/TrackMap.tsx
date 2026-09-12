import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Circle, useMap, Tooltip, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppState } from '../hooks/useWebSockets';

interface Props {
  state: AppState;
  selectedTrainId?: string | null;
  onSelectTrain?: (id: string) => void;
  height?: number;
}

interface StationInfo {
  code: string; name: string; km: number;
  lat: number | null; lng: number | null;
  status: 'past' | 'current' | 'upcoming';
  scheduled_arr: string | null; scheduled_dep: string | null;
}

const RISK_COLOR: Record<string, string> = {
  none: '#00f2fe', low: '#eab308', moderate: '#f97316', severe: '#ef4444',
};

/* ── Train-shaped DivIcon ─────────────────────────────────────────────────── */
function makeTrainIcon(id: string, color: string, isSelected: boolean): L.DivIcon {
  const sel = isSelected;
  const trainSvg = `
    <svg width="26" height="13" viewBox="0 0 26 13" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="1" width="20" height="10" rx="2" fill="#040b14" opacity="0.75"/>
      <path d="M20 1 L25 6.5 L20 12 Z" fill="#040b14" opacity="0.75"/>
      <rect x="2" y="3" width="4.5" height="3.5" rx="0.7" fill="rgba(255,255,255,0.65)"/>
      <rect x="9" y="3" width="4.5" height="3.5" rx="0.7" fill="rgba(255,255,255,0.65)"/>
      <rect x="0" y="11" width="20" height="1.5" rx="0.7" fill="rgba(0,0,0,0.35)"/>
      <circle cx="3.5"  cy="12.5" r="1.5" fill="#040b14" opacity="0.6"/>
      <circle cx="10"   cy="12.5" r="1.5" fill="#040b14" opacity="0.6"/>
      <circle cx="16.5" cy="12.5" r="1.5" fill="#040b14" opacity="0.6"/>
    </svg>`;

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.7));">
      <div style="
        background:${color};
        border:${sel ? '2.5px solid #fff' : '1.5px solid rgba(255,255,255,0.55)'};
        border-radius:6px;
        padding:3px 9px 3px 5px;
        display:flex;align-items:center;gap:4px;
        ${sel ? `box-shadow:0 0 0 3px ${color}50,0 0 18px ${color}70;` : ''}
      ">
        ${trainSvg}
        <span style="font-size:9px;font-weight:700;color:#040b14;font-family:'JetBrains Mono',monospace;white-space:nowrap;line-height:1;">${id}</span>
      </div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid ${color};margin-top:-1px;"></div>
    </div>`;

  return L.divIcon({
    html,
    className: '',
    iconSize:   [80, 34],
    iconAnchor: [40, 34],
    popupAnchor:[0, -36],
  });
}

const MapController = memo(function MapController({
  followId, trains, resetViewRef
}: {
  followId: string | null;
  trains: Record<string, any>;
  resetViewRef: React.MutableRefObject<(() => void) | null>;
}) {
  const map = useMap();
  const initRef = useRef(false);
  const userInteractedRef = useRef(false);

  // Expose a reset function so Overview button can re-trigger fit
  useEffect(() => {
    resetViewRef.current = () => {
      userInteractedRef.current = false;
      initRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onUserInteract = () => { userInteractedRef.current = true; };
    map.on('zoomstart', onUserInteract);
    map.on('dragstart', onUserInteract);
    return () => {
      map.off('zoomstart', onUserInteract);
      map.off('dragstart', onUserInteract);
    };
  }, [map]);

  // Fit bounds only on first data load
  useEffect(() => {
    if (initRef.current || userInteractedRef.current) return;
    const pts = Object.values(trains)
      .filter((t: any) => t.lat && t.lng && !String(t.trainNumber || '').startsWith('GHOST'))
      .map((t: any) => [t.lat, t.lng] as [number, number]);
    if (pts.length > 0) {
      initRef.current = true;
      if (pts.length === 1) map.setView(pts[0], 9);
      else {
        try { map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 9 }); }
        catch { map.setView(pts[0], 8); }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!Object.values(trains).find((t: any) => t.lat)]);

  // Follow selected train only when followId changes
  useEffect(() => {
    if (!followId || !trains[followId]) return;
    const t = trains[followId];
    if (t.lat && t.lng) {
      userInteractedRef.current = false;
      map.flyTo([t.lat, t.lng], 10, { duration: 1.2, animate: true });
    }
  }, [followId]);

  return null;
});

/* ── Train marker — uses ref to update position imperatively (smooth movement) */
const TrainMarker = memo(function TrainMarker({ id, t, color, isSelected, onClick }: {
  id: string; t: any; color: string; isSelected: boolean; onClick?: () => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const icon  = useMemo(() => makeTrainIcon(id, color, isSelected), [id, color, isSelected]);
  const delay = t.delayMinutes ?? 0;
  const delayColor = delay > 30 ? '#dc2626' : delay > 10 ? '#ca8a04' : '#16a34a';

  // Smoothly slide marker to new position without full React re-render
  useEffect(() => {
    if (markerRef.current && t.lat && t.lng) {
      markerRef.current.setLatLng([t.lat, t.lng]);
    }
  }, [t.lat, t.lng]);

  return (
    <Marker ref={markerRef} position={[t.lat, t.lng]} icon={icon} eventHandlers={onClick ? { click: onClick } : {}}>
      <Popup minWidth={210}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, color: '#e2f1ff' }}>
          <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 4 }}>🚂 {t.trainName || id}</div>
          <div>📍 {t.currentStation || '—'}</div>
          <div>⚡ {t.segmentSpeed ?? t.avgSpeed ?? '—'} km/h</div>
          <div style={{ color: delayColor, fontWeight: 'bold' }}>
            ⏱ Delay: {delay >= 0 ? `+${Math.round(delay)}` : Math.round(delay)} min
          </div>
          <div>📏 {Math.round(t.distanceFromOriginKm ?? 0)} / {Math.round(t.totalDistanceKm ?? 0)} km</div>
          <div>{t.isLive ? <span style={{ color: '#22c55e' }}>● Live GPS</span> : <span style={{ color: '#f59e0b' }}>● Schedule</span>}</div>
          {t.stationETAs?.[0] && (
            <div style={{ marginTop: 4, color: '#93c5fd' }}>Next: {t.stationETAs[0].station_name}</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
});

/* ── Ghost marker (still a circle — warning symbol) ──────────────────────── */
const GhostMarker = memo(function GhostMarker({ id, t, color, radius }: {
  id: string; t: any; color: string; radius: number;
}) {
  return (
    <CircleMarker center={[t.lat, t.lng]} radius={radius} color={color} fillColor={color} fillOpacity={0.85} weight={2}>
      <Popup minWidth={190}>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e2f1ff' }}>
          <div style={{ fontWeight: 'bold', color: '#facc15', marginBottom: 4 }}>⚠ {t.trainName || id}</div>
          <div style={{ color: '#fca5a5' }}>{t.currentStation || 'Fault detected'}</div>
          <div style={{ color: '#f87171', fontWeight: 'bold', marginTop: 4 }}>STATUS: {t.status}</div>
        </div>
      </Popup>
    </CircleMarker>
  );
});

/* ── Station dot ──────────────────────────────────────────────────────────── */
const StationDot = memo(function StationDot({ s }: { s: StationInfo }) {
  if (!s.lat || !s.lng) return null;
  const color  = s.status === 'past' ? '#22c55e' : s.status === 'current' ? '#facc15' : '#64748b';
  const radius = s.status === 'current' ? 6 : 4;
  const opacity= s.status === 'past' ? 0.75 : s.status === 'current' ? 1.0 : 0.55;
  return (
    <CircleMarker center={[s.lat, s.lng]} radius={radius} color={color}
      fillColor={color} fillOpacity={opacity} weight={s.status === 'current' ? 2 : 1.5}>
      <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
        <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5 }}>
          <strong style={{ color }}>{s.code}</strong> — {s.name}
          <br/>
          {s.status === 'past'    && <span style={{ color: '#86efac' }}>✓ Passed</span>}
          {s.status === 'current' && <span style={{ color: '#fef08a' }}>● At Station</span>}
          {s.status === 'upcoming' && s.scheduled_arr && <span style={{ color: '#94a3b8' }}>Sched: {s.scheduled_arr}</span>}
        </div>
      </Tooltip>
    </CircleMarker>
  );
});

/* ── Main component ───────────────────────────────────────────────────────── */
const TrackMap: React.FC<Props> = ({ state, selectedTrainId, onSelectTrain, height = 480 }) => {
  const [routes,      setRoutes]      = useState<Record<string, any>>({});
  const [followId,    setFollowId]    = useState<string | null>(null);
  const [stationData, setStationData] = useState<Record<string, StationInfo[]>>({});

  // Sync map follow with parent selection
  useEffect(() => {
    if (selectedTrainId !== undefined) setFollowId(selectedTrainId);
  }, [selectedTrainId]);

  const trains     = useMemo(() => (state.trains as any)?.trains ?? {}, [state.trains]);
  const realTrains = useMemo(() => Object.entries(trains).filter(([id]) => !id.startsWith('GHOST')), [trains]);

  // Memoize risk color — only recompute when actual risk levels change
  const riskKey = useMemo(() =>
    Object.values(state.risk_scores).map((r: any) => r.risk_level).sort().join(','),
    [state.risk_scores]
  );
  const routeColor = useMemo(() => {
    const order = ['none', 'low', 'moderate', 'severe'];
    const highest = Object.values(state.risk_scores).reduce<string>((w, r: any) =>
      order.indexOf(r.risk_level) > order.indexOf(w) ? r.risk_level : w, 'none');
    return RISK_COLOR[highest] ?? '#00f2fe';
  }, [riskKey]); // stable — only changes when risk levels change

  // Stable GeoJSON style object — prevents route flicker
  const routeStyle = useMemo(() => ({
    color: routeColor, weight: 3.5, opacity: 0.7,
  }), [routeColor]);

  // Fetch routes (once per new train)
  useEffect(() => {
    realTrains.forEach(([id]) => {
      if (!routes[id]) {
        fetch(`http://localhost:8000/api/route/${id}`)
          .then(r => r.ok ? r.json() : null)
          .then(geojson => {
            if (geojson?.type || geojson?.geometry)
              setRoutes(prev => ({ ...prev, [id]: geojson }));
          }).catch(() => {});
      }
    });
  }, [realTrains.map(([id]) => id).join(',')]);

  // Fetch station data every 15 s
  const trainIdKey = realTrains.map(([id]) => id).sort().join(',');
  useEffect(() => {
    const fetch_ = () => {
      realTrains.forEach(([id]) => {
        fetch(`http://localhost:8000/api/stations/${id}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.stations) setStationData(prev => ({ ...prev, [id]: d.stations })); })
          .catch(() => {});
      });
    };
    fetch_();
    const iv = setInterval(fetch_, 15000);
    return () => clearInterval(iv);
  }, [trainIdKey]);

  const resetViewRef = useRef<(() => void) | null>(null);

  const handleSelect = useCallback((id: string) => {
    setFollowId(id);
    onSelectTrain?.(id);
  }, [onSelectTrain]);

  const handleOverview = useCallback(() => {
    setFollowId(null);
    onSelectTrain?.('');
    resetViewRef.current?.();
  }, [onSelectTrain]);

  const hasIncident = state.incident_alerts.length > 0;

  if (!state.trains) return <div className="text-rail-textMuted p-4 text-sm">Loading map…</div>;

  return (
      <div className="flex flex-col gap-2 w-full h-full">
        {/* Legacy Legend hidden - handled by ControlRoom overlays */}
        <div className="hidden">
          <span className="flex items-center gap-1.5">
          <span style={{ background: '#00f2fe', display: 'inline-block', width: 10, height: 10, borderRadius: 2 }} />Train
        </span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />Ghost</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Coach GPS</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Past station</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />Current</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block" />Upcoming</span>
        {hasIncident && (
          <span className="text-red-400 font-bold animate-pulse-slow flex items-center gap-1 ml-auto">
            <span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> INCIDENT ACTIVE
          </span>
        )}
        <div className={hasIncident ? '' : 'ml-auto'}>
          <div className="flex gap-1 flex-wrap">
            <button onClick={handleOverview}
              className={`px-2 py-0.5 rounded text-xs border ${!followId ? 'bg-rail-accent/15 border-rail-accent/40 text-rail-accent' : 'border-rail-border text-rail-textMuted hover:text-rail-text'}`}>
              Overview
            </button>
            {realTrains.map(([id]) => (
              <button key={id} onClick={() => handleSelect(id)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${followId === id ? 'bg-rail-accent/15 border-rail-accent/40 text-rail-accent' : 'border-rail-border text-rail-textMuted hover:border-rail-accent/30 hover:text-rail-accent'}`}>
                📍 {id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ height }} className="rounded-xl overflow-hidden border border-rail-border">
        <style>{`.dark-tiles{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)}`}</style>
        <MapContainer center={[21.5, 82.0]} zoom={6} style={{ height: '100%', width: '100%' }} attributionControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="dark-tiles" />

          <MapController followId={followId} trains={trains} resetViewRef={resetViewRef} />

          {/* Routes — stable keys, memoized style */}
          {Object.entries(routes).map(([tid, geojson]) =>
            (geojson?.type || geojson?.geometry) ? (
              <GeoJSON key={`route-${tid}`} data={geojson} style={routeStyle} />
            ) : null
          )}

          {/* Station markers */}
          {Object.entries(stationData).map(([trainId, stations]) =>
            stations.map(s => <StationDot key={`st-${trainId}-${s.code}`} s={s} />)
          )}

          {/* Incident zones */}
          {state.incident_alerts.map(inc =>
            inc.lat && inc.lng ? (
              <Circle key={`inc-${inc.id}`} center={[inc.lat, inc.lng]}
                radius={15000} color="#ef4444" fillColor="#ef4444" fillOpacity={0.1} weight={2}>
                <Popup>
                  <strong style={{ color: '#dc2626' }}>⚠ INCIDENT</strong>
                  <p style={{ margin: '4px 0', fontSize: 12 }}>{inc.description}</p>
                </Popup>
              </Circle>
            ) : null
          )}

          {/* Train markers — train-shaped DivIcon for real trains, circles for ghosts */}
          {Object.entries(trains).map(([id, t]: [string, any]) => {
            if (!t.lat || !t.lng) return null;
            const isGhost = id.startsWith('GHOST');
            if (isGhost) {
              const color  = id === 'GHOST_SIGNAL' ? '#facc15' : '#ef4444';
              const radius = id === 'GHOST_SIGNAL' ? 14 : 8;
              return <GhostMarker key={id} id={id} t={t} color={color} radius={radius} />;
            }
            const color      = '#00f2fe';
            const isSelected = id === followId;
            return <TrainMarker key={id} id={id} t={t} color={color}
              isSelected={isSelected} onClick={() => handleSelect(id)} />;
          })}

          {/* Coach GPS dots */}
          {state.coach_positions.map(coach => (
            <CircleMarker key={`coach-${coach.coach_id}`}
              center={[coach.lat, coach.long]} radius={5}
              color="#4ade80" fillColor="#4ade80" fillOpacity={0.9} weight={2}>
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <strong>Coach {coach.coach_id}</strong>
                  <div>Speed: {coach.calculated_speed?.toFixed(1) ?? '—'} km/h</div>
                  <div style={{ color: coach.matched ? '#22c55e' : '#f97316' }}>
                    {coach.matched ? '✓ Matched' : '⚠ Off-route'}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Nearest responders */}
          {state.incident_alerts.flatMap(inc =>
            (inc.nearest_responders ?? []).map(r => {
              const col  = r.type === 'hospital' ? '#a855f7' : r.type === 'police' ? '#60a5fa' : '#f97316';
              const icon = r.type === 'hospital' ? '🏥' : r.type === 'police' ? '🚔' : '🚒';
              return (
                <CircleMarker key={`resp-${inc.id}-${r.name}`}
                  center={[r.lat, r.lng]} radius={8}
                  color={col} fillColor={col} fillOpacity={0.85} weight={2}>
                  <Popup>
                    <strong>{icon} {r.name}</strong>
                    <div style={{ fontSize: 12 }}>{r.distance_km} km away · {r.contact}</div>
                  </Popup>
                </CircleMarker>
              );
            })
          )}
        </MapContainer>
      </div>

      {/* Position readout */}
      <div className="flex flex-wrap gap-4 text-xs text-rail-textMuted font-mono">
        {realTrains.map(([id, t]: [string, any]) => (
          <span key={id}>
            <span className="text-rail-accent">{id}</span>
            {' '}{t.lat?.toFixed(4)}, {t.lng?.toFixed(4)}
            {' '}@ <span className="text-rail-text">{Math.round(t.distanceFromOriginKm ?? 0)} km</span>
            {' '}{t.isLive
              ? <span className="text-rail-success">● live</span>
              : <span className="text-yellow-500">● sched</span>}
          </span>
        ))}
      </div>
    </div>
  );
};

export default memo(TrackMap);
