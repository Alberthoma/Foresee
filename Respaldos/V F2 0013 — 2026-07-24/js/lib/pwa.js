// Foresee 2.0 — pwa.js
// Comportamiento nativo-like: pantalla completa y pull-to-refresh. Puro
// DOM/eventos táctiles, sin estado de appState — main.js inyecta el
// callback (renderAll) para no crear una dependencia circular con el
// resto de la app.
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
