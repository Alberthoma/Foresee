// Foresee 2.0 — pwa.js
// Comportamiento nativo-like: pantalla completa, pull-to-refresh y swipe
// horizontal entre pestañas. Puro DOM/eventos táctiles, sin estado de
// appState — main.js inyecta los callbacks (renderAll, switchTab) para
// no crear una dependencia circular con el resto de la app.
export function requestFullscreen() {
  const el = document.documentElement;
  (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
}

export function exitFullscreen() {
  (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
}

export function setupPullToRefresh(onRefresh) {
  const ptr = document.getElementById("ptr-container");
  let startY = 0;
  let active = false;

  document.addEventListener(
    "touchstart",
    (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        active = true;
      }
    },
    { passive: true },
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!active) return;
      const delta = e.touches[0].clientY - startY;
      if (delta > 10) ptr.classList.add("ptr-visible");
      if (delta > 60) ptr.classList.add("ptr-rotate");
    },
    { passive: true },
  );

  document.addEventListener("touchend", () => {
    if (!active) return;
    active = false;
    if (ptr.classList.contains("ptr-rotate")) {
      ptr.classList.add("ptr-loading");
      onRefresh();
      setTimeout(() => {
        ptr.className = "";
        ptr.id = "ptr-container";
      }, 1200);
    } else {
      ptr.classList.remove("ptr-visible", "ptr-rotate");
    }
  });
}

const TAB_ORDER = [
  "registros", "voz", "proyeccion", "recurrentes", "gastos-comunes",
  "tarjetas", "saldos", "reportes", "presupuesto", "configuracion",
];

// Swipe horizontal para navegar entre tabs — deshabilitado en el dashboard,
// con un modal abierto, o sobre tablas/inputs (donde el gesto horizontal
// tiene otro significado, ej. scroll de tabla).
export function setupSwipeNavigation({ getCurrentTab, switchTab }) {
  let sx = 0, sy = 0;

  document.addEventListener(
    "touchstart",
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true },
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (document.body.classList.contains("view-dashboard")) return;
      if (document.querySelector(".modal-overlay.active")) return;
      if (e.target.closest(".table-wrapper, input, textarea, select, [contenteditable]")) return;

      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;

      const idx = TAB_ORDER.indexOf(getCurrentTab());
      if (idx === -1) return;
      if (dx < 0 && idx < TAB_ORDER.length - 1) switchTab(TAB_ORDER[idx + 1]);
      else if (dx > 0 && idx > 0) switchTab(TAB_ORDER[idx - 1]);
    },
    { passive: true },
  );
}
