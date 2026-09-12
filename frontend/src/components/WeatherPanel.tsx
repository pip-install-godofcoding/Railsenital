import { useState, useEffect } from 'react';

export default function WeatherPanel() {
  const [weather, setWeather] = useState<any>(null);
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/weather');
        const data = await res.json();
        if (data.status === 'ok') setWeather(data);
      } catch (e) { console.error(e); }
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 30000);
    return () => clearInterval(iv);
  }, []);
  if (!weather) return null;
  const isFlood = weather.cwc_flood_risk !== 'Normal';
  const wmo: Record<number,string> = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',61:'Rain',63:'Moderate rain',65:'Heavy rain',80:'Showers',95:'Thunderstorm'};
  const desc = wmo[weather.weathercode] ?? 'Unknown';
  return (
    <div className='bg-[#0f172a] p-4 rounded-lg border border-gray-700 mb-4 shadow-inner'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
          Live Environmental and CWC Status
        </h3>
        {weather.train_name && (
          <span className='text-xs text-blue-400 font-mono bg-blue-950/40 border border-blue-800 px-2 py-0.5 rounded'>
            📍 {weather.train_name}
          </span>
        )}
      </div>
      <div className='grid grid-cols-2 md:grid-cols-5 gap-3 text-sm'>
        <div className='bg-[#1e293b] p-3 rounded flex flex-col items-center'>
          <span className='text-gray-400 text-xs'>Condition</span>
          <span className='text-base font-bold text-white text-center'>{desc}</span>
        </div>
        <div className='bg-[#1e293b] p-3 rounded flex flex-col items-center'>
          <span className='text-gray-400 text-xs'>Temperature</span>
          <span className='text-xl font-bold text-orange-300'>{weather.temperature}C</span>
        </div>
        <div className='bg-[#1e293b] p-3 rounded flex flex-col items-center'>
          <span className='text-gray-400 text-xs'>Wind Speed</span>
          <span className='text-xl font-bold text-blue-300'>{weather.windspeed} km/h</span>
        </div>
        <div className='bg-[#1e293b] p-3 rounded flex flex-col items-center'>
          <span className='text-gray-400 text-xs'>Precipitation (3h)</span>
          <span className='text-xl font-bold text-blue-400'>{weather.precipitation_3h} mm</span>
        </div>
        <div className={isFlood ? 'p-3 rounded flex flex-col items-center bg-red-900/50 border border-red-500 animate-pulse' : 'p-3 rounded flex flex-col items-center bg-[#1e293b]'}>
          <span className='text-gray-400 text-xs text-center'>CWC Flood Risk</span>
          <span className={isFlood ? 'text-base font-bold text-red-400' : 'text-base font-bold text-green-400'}>
            {weather.cwc_flood_risk}
          </span>
        </div>
      </div>
    </div>
  );
}
