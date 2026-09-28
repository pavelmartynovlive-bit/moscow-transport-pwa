const API_URL = "https://school-548-bus-board.rosenbe.chatgpt.site/api/arrivals";
const CACHE_KEY = "school-548-bus-board";

const board = document.querySelector("#board");
const connection = document.querySelector("#connection");
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
    loading: "обновляем",
    live: "данные онлайн",
    cached: "последние данные",
    error: "нет связи",
  };
  connection.className = `connection ${status}`;
  connection.querySelector("span").textContent = labels[status];
}

function formatArrival(seconds) {
  if (seconds <= 45) return "подходит";
  return `${Math.max(1, Math.round(seconds / 60))} мин`;
}

function routeTone(route) {
  const value = route.toLowerCase();
  if (value === "м83") return "route-green";
  if (value === "с848") return "route-pink";
  return "route-blue";
}

function render() {
  if (!data) return;
  const elapsed = Math.max(0, Math.floor((now - data.fetchedAt) / 1000));

  board.innerHTML = data.stops.map((stop, stopIndex) => `
    <section class="stop-card" aria-labelledby="stop-${stopIndex}">
      <div class="stop-heading">
        <div>
          <span class="stop-index">Остановка ${stopIndex + 1}</span>
          <h2 id="stop-${stopIndex}">${escapeHtml(stop.label)}</h2>
        </div>
        <span class="direction-mark" aria-hidden="true">→</span>
      </div>
      <div class="routes">
        ${stop.routes.map((route) => {
          const arrivals = route.arrivals
            .map((arrival) => ({ ...arrival, seconds: arrival.seconds - elapsed }))
            .filter((arrival) => arrival.seconds > -45)
            .slice(0, 3);
          return `
            <article class="route-row">
              <div class="route-number ${routeTone(route.number)}">${escapeHtml(route.number)}</div>
              <div class="route-destination">
                <span class="route-label">Куда</span>
                <strong>${escapeHtml(route.destination)}</strong>
              </div>
              <div class="arrival-list" aria-label="Прибытия маршрута ${escapeHtml(route.number)}">
                ${arrivals.length ? arrivals.map((arrival, index) => `
                  <div class="arrival ${index === 0 ? "primary" : ""}">
                    <span>${formatArrival(arrival.seconds)}</span>
                    <small>${arrival.realtime ? "live" : "расписание"}</small>
                  </div>
                `).join("") : '<div class="arrival-empty">Нет данных</div>'}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `).join("");
}

async function load() {
  setStatus("loading");
  refresh.disabled = true;
  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
