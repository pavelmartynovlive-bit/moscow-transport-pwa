"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Arrival = { seconds: number; realtime: boolean };
type RouteArrival = { number: string; destination: string; color: string; arrivals: Arrival[] };
type StopBoard = { id: string; label: string; routes: RouteArrival[] };
type BoardResponse = { stops: StopBoard[]; fetchedAt: number };

const CACHE_KEY = "school-548-bus-board";

function formatArrival(seconds: number) {
  if (seconds <= 45) return "подходит";
  return `${Math.max(1, Math.round(seconds / 60))} мин`;
}

function routeTone(route: string) {
  if (route.toLowerCase() === "м83") return "route-green";
  if (route.toLowerCase() === "с848") return "route-pink";
  return "route-blue";
}

function RouteRow({ route, elapsed }: { route: RouteArrival; elapsed: number }) {
  const arrivals = route.arrivals
    .map((arrival) => ({ ...arrival, seconds: arrival.seconds - elapsed }))
    .filter((arrival) => arrival.seconds > -45)
    .slice(0, 3);

  return (
    <article className="route-row">
      <div className={`route-number ${routeTone(route.number)}`}>{route.number}</div>
      <div className="route-destination">
        <span className="route-label">Куда</span>
        <strong>{route.destination}</strong>
      </div>
      <div className="arrival-list" aria-label={`Прибытия маршрута ${route.number}`}>
        {arrivals.length ? arrivals.map((arrival, index) => (
          <div className={index === 0 ? "arrival primary" : "arrival"} key={`${arrival.seconds}-${index}`}>
            <span>{formatArrival(arrival.seconds)}</span>
            <small>{arrival.realtime ? "live" : "расписание"}</small>
          </div>
        )) : <div className="arrival-empty">Нет данных</div>}
      </div>
    </article>
  );
}

function StopSection({ stop, elapsed, index }: { stop: StopBoard; elapsed: number; index: number }) {
  return (
    <section className="stop-card" aria-labelledby={`stop-${index}`}>
      <div className="stop-heading">
        <div>
          <span className="stop-index">Остановка {index + 1}</span>
          <h2 id={`stop-${index}`}>{stop.label}</h2>
        </div>
        <span className="direction-mark" aria-hidden="true">→</span>
      </div>
      <div className="routes">
        {stop.routes.map((route) => <RouteRow key={route.number} route={route} elapsed={elapsed} />)}
      </div>
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

  return (
    <main className="board-shell">
      <header className="topbar">
        <div><p className="eyebrow">Автобусы рядом</p><h1>Школа № 548</h1></div>
        <div className="board-meta">
          <span className={`connection ${status}`}><i />{status === "live" ? "данные онлайн" : status === "cached" ? "последние данные" : status === "error" ? "нет связи" : "обновляем"}</span>
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

      <footer>
        <span><i className="legend-live" /> live — по положению автобуса</span>
        <span><i className="legend-schedule" /> расписание — расчётное время</span>
        <button onClick={load} disabled={status === "loading"}>Обновить</button>
      </footer>
    </main>
  );
}
