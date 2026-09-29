"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Arrival = { seconds: number; realtime: boolean };
type RouteArrival = { number: string; destination: string; color: string; arrivals: Arrival[] };
type StopBoard = { id: string; label: string; routes: RouteArrival[] };
type BoardResponse = { stops: StopBoard[]; fetchedAt: number };
type TimelineArrival = Arrival & { route: string };

const CACHE_KEY = "school-548-bus-board";

function formatArrival(seconds: number) {
  if (seconds <= 45) return "подъезжает";
  return `${Math.max(1, Math.round(seconds / 60))} мин`;
}

function routeTone(route: string) {
  if (route.toLowerCase() === "м83") return "route-green";
  if (route.toLowerCase() === "с848") return "route-pink";
  return "route-blue";
}

function timeline(stop: StopBoard, elapsed: number): TimelineArrival[] {
  return stop.routes
    .flatMap((route) => route.arrivals.map((arrival) => ({
      ...arrival,
      route: route.number,
      seconds: arrival.seconds - elapsed,
    })))
    .filter((arrival) => arrival.seconds > -45)
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, 4);
}

function StopSection({ stop, elapsed, index }: { stop: StopBoard; elapsed: number; index: number }) {
  const arrivals = timeline(stop, elapsed);

  return (
    <section className="stop-card" aria-labelledby={`stop-${index}`}>
      <header className="stop-heading">
        <span className="stop-index">Остановка {index + 1}</span>
        <h2 id={`stop-${index}`}>{stop.label}</h2>
      </header>
      <ol className="timeline">
        {arrivals.length ? arrivals.map((arrival, arrivalIndex) => (
          <li className={`arrival-row ${arrivalIndex === 0 ? "next" : ""}`} key={`${arrival.route}-${arrival.seconds}-${arrivalIndex}`}>
            <div className="arrival-time">
              {arrival.seconds > 45 && <span>через</span>}
              <strong>{formatArrival(arrival.seconds)}</strong>
            </div>
            <div className="route-meta">
              <span className={`route-number ${routeTone(arrival.route)}`}>{arrival.route}</span>
              {!arrival.realtime && <small>по расписанию</small>}
            </div>
          </li>
        )) : <li className="arrival-empty">Нет ближайших автобусов</li>}
      </ol>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">("loading");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/arrivals", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const next = (await response.json()) as BoardResponse;
      setData(next);
      setStatus("live");
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setData(JSON.parse(cached) as BoardResponse);
        setStatus("cached");
      } else {
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      load();
      setNow(Date.now());
    }, 0);
    const poll = window.setInterval(load, 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
    return () => { window.clearTimeout(initial); window.clearInterval(poll); window.clearInterval(tick); };
  }, [load]);

  const elapsed = useMemo(
    () => data ? Math.max(0, Math.floor((now - data.fetchedAt) / 1000)) : 0,
    [data, now],
  );
  const clock = now ? new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(now) : "--:--:--";
  const statusLabel = status === "live" ? "Данные обновляются" : status === "cached" ? "Показаны последние данные" : status === "error" ? "Нет связи" : "Обновляем данные";

  return (
    <main className="board-shell">
      <header className="topbar">
        <h1>Школа № 508</h1>
        <div className="clock-wrap">
          <span className={`status-dot ${status}`} aria-label={statusLabel} title={statusLabel} />
          <time>{clock}</time>
        </div>
      </header>

      {data ? (
        <div className="stop-grid">
          {data.stops.map((stop, index) => <StopSection key={stop.id} stop={stop} elapsed={elapsed} index={index} />)}
        </div>
      ) : status === "error" ? (
        <section className="state-card"><strong>Не удалось получить данные</strong><button onClick={load}>Попробовать снова</button></section>
      ) : (
        <div className="stop-grid" aria-label="Загрузка">{[0, 1].map((item) => <div className="stop-card skeleton" key={item} />)}</div>
      )}

      <footer><button onClick={load} disabled={status === "loading"}>Обновить</button></footer>
    </main>
  );
}
