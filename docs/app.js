const API_URLS = [
  "https://pasha-music.132-243-23-229.sslip.io/api/arrivals",
  "https://school-548-bus-board.rosenbe.chatgpt.site/api/arrivals",
];
const CACHE_KEY = "school-548-bus-board";

const board = document.querySelector("#board");
const statusDot = document.querySelector("#status-dot");
const clock = document.querySelector("#clock");
const refresh = document.querySelector("#refresh");

let data = null;
let now = Date.now();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(status) {
  const labels = {
    loading: "Обновляем данные",
    live: "Данные обновляются",
    cached: "Показаны последние данные",
    error: "Нет связи",
  };
  statusDot.className = `status-dot ${status}`;
  statusDot.setAttribute("aria-label", labels[status]);
  statusDot.title = labels[status];
}

function formatArrival(seconds) {
  if (seconds <= 45) return "подъезжает";
  return `${Math.max(1, Math.round(seconds / 60))} мин`;
}

function routeTone(route) {
  const value = route.toLowerCase();
  if (value === "м83") return "route-green";
  if (value === "с848") return "route-pink";
  return "route-blue";
}

function timeline(stop, elapsed) {
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

function render() {
  if (!data) return;
  const elapsed = Math.max(0, Math.floor((now - data.fetchedAt) / 1000));

  board.innerHTML = data.stops.map((stop, stopIndex) => {
    const arrivals = timeline(stop, elapsed);
    return `
      <section class="stop-card" aria-labelledby="stop-${stopIndex}">
        <header class="stop-heading">
          <span class="stop-index">Остановка ${stopIndex + 1}</span>
          <h2 id="stop-${stopIndex}">${escapeHtml(stop.label)}</h2>
        </header>
        <ol class="timeline">
          ${arrivals.length ? arrivals.map((arrival, arrivalIndex) => `
            <li class="arrival-row ${arrivalIndex === 0 ? "next" : ""}">
              <div class="arrival-time">
                ${arrival.seconds > 45 ? "<span>через</span>" : ""}
                <strong>${formatArrival(arrival.seconds)}</strong>
              </div>
              <div class="route-meta">
                <span class="route-number ${routeTone(arrival.route)}">${escapeHtml(arrival.route)}</span>
                ${arrival.realtime ? "" : "<small>по расписанию</small>"}
              </div>
            </li>
          `).join("") : '<li class="arrival-empty">Нет ближайших автобусов</li>'}
        </ol>
      </section>
    `;
  }).join("");
}

async function load() {
  setStatus("loading");
  refresh.disabled = true;
  try {
    let lastError;
    let nextData = null;
    for (const url of API_URLS) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        nextData = await response.json();
        break;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeout);
      }
    }
    if (!nextData) throw lastError ?? new Error("No arrivals API is available");
    data = nextData;
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    setStatus("live");
    now = Date.now();
    render();
  } catch {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      data = JSON.parse(cached);
      setStatus("cached");
      render();
    } else {
      setStatus("error");
      board.innerHTML = '<section class="state-card"><strong>Не удалось получить данные</strong><button type="button" id="retry">Попробовать снова</button></section>';
      document.querySelector("#retry")?.addEventListener("click", load);
    }
  } finally {
    refresh.disabled = false;
  }
}

function tick() {
  now = Date.now();
  clock.textContent = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);
  render();
}

refresh.addEventListener("click", load);
setInterval(load, 30_000);
setInterval(tick, 1_000);
tick();
load();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");
