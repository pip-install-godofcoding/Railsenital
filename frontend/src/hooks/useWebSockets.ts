import { useState, useEffect, useCallback } from 'react';

export interface Alert {
  id: string;
  condition_id: string;
  layer: string;
  description: string;
  status: string;
  detected_at: number;
  acknowledged_by?: string;
  acknowledged_at?: number;
  escalated_at?: number;
  escalated_to?: string;
  affected_id?: string;
}

export interface TrainData {
  trainNumber: string;
  trainName: string;
  status: string;
  isLive: boolean;
  delayMinutes: number;
  currentStation: string;
  avgSpeed: number;
  segmentSpeed?: number;
  source: string;
  destination: string;
  distanceFromOriginKm: number;
  totalDistanceKm: number;
  previousHalt: string;
  nextHalt: string;
  lat?: number;
  lng?: number;
  stationETAs?: StationETA[];
}

export interface StationETA {
  station_name: string;
  station_code: string;
  dist_km: number;
  dist_remaining_km: number;
  predicted_delay_min: number;
  eta_timestamp: number;
  scheduled_arrival: string;
  expected_arrival: string;
}

export interface ETAPrediction {
  predicted_delay_min: number;
  confidence_low_min: number;
  confidence_high_min: number;
  confidence_pct: number;
  baseline_mae_min?: number;
}

export interface CoachPosition {
  coach_id: string;
  lat: number;
  long: number;
  speed: number | null;
  calculated_speed: number | null;
  timestamp: string;
  matched_lat: number | null;
  matched_long: number | null;
  match_distance_meters: number | null;
  route_segment_id: string | null;
  matched: boolean | null;
}

export interface RiskScore {
  risk_level: 'none' | 'low' | 'moderate' | 'severe';
  source: string;
  last_updated: string;
}

export interface ConfirmationEntry {
  junction_id: string;
  status: 'Clear' | 'Occupied' | 'Mismatch';
  confirmed_at: number;
  confirmed_by: string;
  signal: string;
}

export interface Responder {
  name: string;
  type: 'hospital' | 'ndrf' | 'police';
  lat: number;
  lng: number;
  contact: string;
  distance_km: number;
}

export interface IncidentAlert {
  id: string;
  type: 'signal_mismatch' | 'converging_trains' | 'gps_anomaly';
  severity: 'high' | 'critical';
  description: string;
  affected_trains: string[];
  lat: number | null;
  lng: number | null;
  detected_at: number;
  estimated_affected_coaches: number;
  nearest_responders?: Responder[];
}

export interface AuthorityDispatch {
  id: string;
  incident_id: string;
  authority_name: string;
  authority_type: 'hospital' | 'ndrf' | 'police' | 'station_master' | 'driver';
  contact: string;
  dispatched_at: number;
  status: 'sent' | 'acknowledged';
  message: string;
}

export interface AppState {
  scada: {
    tracks: Record<string, boolean>;
    points: Record<string, string>;
    signals: Record<string, string>;
    fault_active: boolean;
  } | null;
  trains: {
    trains: Record<string, TrainData>;
    ghost_trains?: Record<string, TrainData>;
    railradar_active: boolean;
  } | null;
  alerts: Alert[];
  eta: Record<string, ETAPrediction>;
  station_etas: Record<string, StationETA[]>;
  coach_positions: CoachPosition[];
  risk_scores: Record<string, RiskScore>;
  confirmation_log: ConfirmationEntry[];
  incident_alerts: IncidentAlert[];
  authority_dispatches: AuthorityDispatch[];
}

export function useWebSockets() {
  const [state, setState] = useState<AppState>({
    scada: null,
    trains: null,
    alerts: [],
    eta: {},
    station_etas: {},
    coach_positions: [],
    risk_scores: {},
    confirmation_log: [],
    incident_alerts: [],
    authority_dispatches: [],
  });
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState((prev) => ({
          ...prev,
          scada: data.scada ?? prev.scada,
          trains: data.trains ?? prev.trains,
          alerts: data.alerts ?? prev.alerts,
          eta: data.eta ?? prev.eta,
          station_etas: data.station_etas ?? prev.station_etas,
          coach_positions: data.coach_positions ?? prev.coach_positions,
          risk_scores: data.risk_scores ?? prev.risk_scores,
          confirmation_log: data.confirmation_log ?? prev.confirmation_log,
          incident_alerts: data.incident_alerts ?? prev.incident_alerts,
          authority_dispatches: data.authority_dispatches ?? prev.authority_dispatches,
        }));
      } catch (err) {
        console.error('WS parse error', err);
      }
    };

    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);

  return { state, connected };
}
