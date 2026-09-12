import { useState, useEffect } from 'react';

export default function WeatherPanel() {
  const [weather, setWeather] = useState<any>(null);
  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/weather');
        const d = await res.json();
        if (d.status === 'ok') setWeather(d);
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 30000);
    return () => clearInterval(iv);
  }, []);
  if (!weather) return null;

  const isFlood = weather.cwc_flood_risk !== 'Normal';
  const wmo: Record<number, string> = {
    0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
    61: 'Rain', 63: 'Mod. Rain', 65: 'Heavy Rain', 80: 'Showers', 95: 'Thunderstorm',
  };
  const desc = wmo[weather.weathercode] ?? 'Unknown';
  const wIcon: Record<string, string> = {
    'Clear': '☀️', 'Mainly Clear': '🌤️', 'Partly Cloudy': '⛅', 'Overcast': '☁️',
    'Rain': '🌧️', 'Mod. Rain': '🌧️', 'Heavy Rain': '⛈️', 'Showers': '🌦️', 'Thunderstorm': '⛈️',
  };

  return (
    <div className="rail-card mb-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">{wIcon[desc] ?? '🌡️'}</span>
          <span className="text-xs font-mono text-rail-textMuted uppercase tracking-wider">
            Live Environmental & CWC Status
          </span>
        </div>
        {weather.train_name && (
          <span className="text-[10px] font-mono text-rail-accent bg-rail-accent/5 border border-rail-accent/20 px-2 py-0.5 rounded">
            📍 {weather.train_name}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <WeatherCell label="Condition"       value={desc}                      color="text-rail-text" />
        <WeatherCell label="Temperature"     value={`${weather.temperature}°C`} color="text-orange-300" />
        <WeatherCell label="Wind"            value={`${weather.windspeed} km/h`} color="text-blue-300" />
        <WeatherCell label="Precip (3h)"     value={`${weather.precipitation_3h} mm`} color="text-rail-accent" />
        <div className={`rounded-lg px-3 py-2 flex flex-col items-center border text-center
          ${isFlood ? 'bg-rail-danger/10 border-rail-danger/40 animate-pulse' : 'bg-rail-bg border-rail-border'}`}>
          <span className="text-[10px] text-rail-textMuted">CWC Flood Risk</span>
          <span className={`text-xs font-bold font-mono mt-0.5 ${isFlood ? 'text-rail-danger' : 'text-rail-success'}`}>
            {weather.cwc_flood_risk}
          </span>
        </div>
      </div>
    </div>
  );
}

function WeatherCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-rail-bg rounded-lg px-3 py-2 flex flex-col items-center border border-rail-border">
      <span className="text-[10px] text-rail-textMuted">{label}</span>
      <span className={`text-xs font-bold font-mono mt-0.5 ${color}`}>{value}</span>
    </div>
  );
}
