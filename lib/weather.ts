// Weather via Open-Meteo: free, no API key, no OAuth.
// Ottawa by default; override with HOME_LAT / HOME_LON.
//
// Shape mirrors the demo dashboard: 24 hourly slots for today
// (t = temp, c = condition word, p = precip chance) plus hi/lo/feels/humidity/wind.

export type Weather = {
  tempC: number | null;
  feelsC: number | null;
  code: number | null;
  label: string;
  emoji: string;
  highC: number | null;
  lowC: number | null;
  precipChance: number | null;
  humidity: number | null;
  wind: number | null;
  sunrise: string | null;
  sunset: string | null;
  ok: boolean;
  t: number[];
  c: string[];
  p: number[];
};

const CODES: Record<number, [string, string]> = {
  0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"], 45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"], 80: ["Showers", "🌦️"], 81: ["Showers", "🌧️"],
  82: ["Heavy showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunder + hail", "⛈️"], 99: ["Thunder + hail", "⛈️"],
};

// WMO code -> the demo's icon vocabulary: sun | partly | cloud | rain | snow | moon
// Night for the icons is the real night, not 20:00: in November the sun is gone
// at 16:32 and a sun at 7 PM is a small lie the wall tells every evening.
function condWord(code: number, night: boolean): string {
  if (code >= 95) return "rain";
  if (code >= 71 && code <= 86) return "snow";
  if (code >= 51) return "rain";
  if (code === 45 || code === 48 || code === 3) return "cloud";
  if (code === 2) return night ? "moon" : "partly";
  if (code <= 1) return night ? "moon" : "sun";
  return "cloud";
}

const empty = (): Weather => ({
  tempC: null, feelsC: null, code: null, label: "unavailable", emoji: "❓",
  highC: null, lowC: null, precipChance: null, humidity: null, wind: null,
  sunrise: null, sunset: null, ok: false,
  t: new Array(24).fill(0), c: new Array(24).fill("cloud"), p: new Array(24).fill(0),
});

export async function getWeather(): Promise<Weather> {
  const lat = process.env.HOME_LAT || "45.4215";
  const lon = process.env.HOME_LON || "-75.6972";
  const tz = process.env.HOME_TZ || "America/Toronto";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m` +
    `&hourly=temperature_2m,weather_code,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=1`;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return empty();
    const j: any = await res.json();
    const code = j?.current?.weather_code ?? null;
    const [label, emoji] = code != null ? CODES[code] ?? ["—", "🌡️"] : ["—", "🌡️"];

    const temps: number[] = (j?.hourly?.temperature_2m || []).slice(0, 24);
    const codes: number[] = (j?.hourly?.weather_code || []).slice(0, 24);
    const probs: number[] = (j?.hourly?.precipitation_probability || []).slice(0, 24);

    return {
      tempC: j?.current?.temperature_2m ?? null,
      feelsC: j?.current?.apparent_temperature ?? null,
      code,
      label,
      emoji,
      highC: j?.daily?.temperature_2m_max?.[0] ?? null,
      lowC: j?.daily?.temperature_2m_min?.[0] ?? null,
      precipChance: j?.daily?.precipitation_probability_max?.[0] ?? null,
      humidity: j?.current?.relative_humidity_2m ?? null,
      wind: j?.current?.wind_speed_10m ?? null,
      sunrise: j?.daily?.sunrise?.[0] ?? null,
      sunset: j?.daily?.sunset?.[0] ?? null,
      ok: true,
      t: Array.from({ length: 24 }, (_, h) => (temps[h] != null ? Math.round(temps[h]) : 0)),
      c: Array.from({ length: 24 }, (_, h) => {
        const sr = j?.daily?.sunrise?.[0];
        const ss = j?.daily?.sunset?.[0];
        const hm = (v: string | undefined, fallback: number) => {
          const m = v ? /T(\d{2}):(\d{2})/.exec(v) : null;
          return m ? Number(m[1]) + Number(m[2]) / 60 : fallback;
        };
        const night = h + 0.5 < hm(sr, 6) || h + 0.5 >= hm(ss, 20);
        return codes[h] != null ? condWord(codes[h], night) : "cloud";
      }),
      p: Array.from({ length: 24 }, (_, h) => (probs[h] != null ? probs[h] : 0)),
    };
  } catch {
    return empty();
  }
}
