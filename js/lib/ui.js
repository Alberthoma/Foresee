// Foresee 2.0 — ui.js
// Utilidades de interfaz compartidas: loading, toast, tema y un gestor
// GENÉRICO de modales (abrir/cerrar + focus-trap + aria-hidden + scroll
// lock centralizados). En el origen este patrón estaba repetido a mano
// ~11 veces (un open*/close* por modal) más un MutationObserver aparte;
// aquí es un único punto que cualquier módulo reutiliza con registerModal().

import { scheduleRenderAll } from "../state.js";

const THEME_KEY = "foresee-theme";

export function isLightTheme() {
  return document.documentElement.getAttribute("data-theme") === "light";
}

// Colores de ejes/grid para los gráficos de Chart.js — coherentes con
// el tema activo. Reportes destruye y recrea sus gráficos al cambiar
// de tema (ver applyTheme) para que tomen el juego de colores nuevo.
export function chartColors() {
  return isLightTheme()
    ? { tick: "#5a6070", grid: "#dde1e9", border: "#ffffff" }
    : { tick: "#8b8fa8", grid: "#2a2d3a", border: "#1a1d27" };
}

function syncThemeButtons(theme) {
  const btn = document.getElementById("btn-theme-toggle");
  if (btn) btn.textContent = theme === "light" ? "🌙 Oscuro" : "☀ Claro";
  const cfgBtn = document.getElementById("cfg-theme-btn");
  if (cfgBtn) cfgBtn.textContent = theme === "light" ? "🌙 Modo Oscuro" : "☀ Modo Claro";
  const cfgStatus = document.getElementById("cfg-theme-status");
  if (cfgStatus) cfgStatus.textContent = theme === "light" ? "Modo claro activo" : "Modo oscuro activo";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  syncThemeButtons(theme);
  // Reportes recrea sus gráficos de Chart.js en cada render — forzar un
  // render aquí es lo que les hace tomar el juego de colores del tema nuevo.
  scheduleRenderAll();
}

export function toggleTheme() {
  applyTheme(isLightTheme() ? "dark" : "light");
}

export function initThemeBtn() {
  syncThemeButtons(isLightTheme() ? "light" : "dark");
}

/* ===================================================================
   LOADING
   =================================================================== */
export function showLoading(message) {
  const overlay = document.getElementById("loading-overlay");
  overlay.classList.add("active");
  const textEl = overlay.querySelector(".loading-text");
  if (textEl) textEl.textContent = message || "Cargando datos...";
}

export function hideLoading() {
  document.getElementById("loading-overlay").classList.remove("active");
}

/* ===================================================================
   TOAST
   =================================================================== */
export function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add("show")),
  );

  const remove = () => toast.remove();
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", remove, { once: true });
    setTimeout(remove, 500);
  }, 3000);
}

/* ===================================================================
   VALIDACIÓN DE INPUTS
   =================================================================== */
export function markInvalid(el) {
  el.classList.add("input--invalid");
  el.addEventListener("input", () => el.classList.remove("input--invalid"), {
    once: true,
  });
}

/* ===================================================================
   FILLSELECT GENÉRICO
   El origen repetía "poblar un <select> con opciones" a mano en ~8
   sitios (bancos, categorías, filtros...). Una sola función parametrizada
   por lista de items + accesores de value/label + placeholder opcional.
   =================================================================== */
export function fillSelect(selectEl, items, { value, label, placeholder, keepSelection = true } = {}) {
  if (!selectEl) return;
  const getValue = value || ((item) => item);
  const getLabel = label || ((item) => item);
  const current = keepSelection ? selectEl.value : undefined;

  selectEl.textContent = "";
  if (placeholder !== undefined) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    selectEl.appendChild(opt);
  }
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = getValue(item);
    opt.textContent = getLabel(item);
    selectEl.appendChild(opt);
  });
  if (current !== undefined) selectEl.value = current;
}

/* ===================================================================
   MODAL MANAGER GENÉRICO
   =================================================================== */
const registeredModals = new Set();
let observerStarted = false;
const ARIA_BACKDROP_IDS = ["app-header", "tab-bar", "main-wrapper"];
const FOCUSABLE =
  'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function syncModalState() {
  const anyOpen = [...registeredModals].some((id) =>
    document.getElementById(id)?.classList.contains("active"),
  );
  ARIA_BACKDROP_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (anyOpen) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
  });
  document.body.style.overflow = anyOpen ? "hidden" : "";
}

function startGlobalModalObservers() {
  if (observerStarted) return;
  observerStarted = true;

  const observer = new MutationObserver(syncModalState);
  registeredModals.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const activeModal = [...registeredModals]
      .map((id) => document.getElementById(id))
      .find((el) => el && el.classList.contains("active"));
    if (!activeModal) return;
    const focusable = Array.from(
      activeModal.querySelectorAll(FOCUSABLE),
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}

// Registra un modal existente en el DOM para que participe del
// focus-trap y del aria-hidden/scroll-lock centralizados.
export function registerModal(id) {
  registeredModals.add(id);
  if (observerStarted) {
    const el = document.getElementById(id);
    if (el) new MutationObserver(syncModalState).observe(el, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }
}

export function initModalSystem(ids) {
  ids.forEach((id) => registeredModals.add(id));
  startGlobalModalObservers();
}

export function openModal(id, focusSelector) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add("active");
  if (focusSelector) {
    const target = el.querySelector(focusSelector);
    if (target) target.focus();
  }
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
}

/* ===================================================================
   CONFIRM MODAL (genérico)
   =================================================================== */
let confirmCb = null;

export function openConfirmModal(title, message, onOk) {
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  confirmCb = onOk;
  openModal("confirm-modal");
}

export function closeConfirmModal() {
  closeModal("confirm-modal");
  confirmCb = null;
}

export function runConfirmCallback() {
  const cb = confirmCb;
  closeConfirmModal();
  if (cb) cb();
}

// Pregunta antes de cerrar un formulario con datos sin guardar.
export function guardClose(isDirtyFn, closeFn) {
  if (!isDirtyFn()) {
    closeFn();
    return;
  }
  openConfirmModal(
    "¿Descartar cambios?",
    "Hay datos ingresados que se perderán. ¿Deseas cerrar de todas formas?",
    closeFn,
  );
}

/* ===================================================================
   SELECCIÓN MÚLTIPLE — btn-edit-selected/btn-delete-selected son
   compartidos por Registros, Recurrentes y (desde la Fase 3) Proyección.
   Una sola función tab-aware en vez de reimplementarla en cada sección.
   =================================================================== */
const SELECTION_CONFIG = {
  registros: { checkboxSelector: ".tx-checkbox", selectAllId: "reg-select-all" },
  recurrentes: { checkboxSelector: ".rec-checkbox", selectAllId: "rec-select-all" },
  proyeccion: { checkboxSelector: ".proj-checkbox", selectAllId: "proj-select-all" },
};

export function updateSelectionButtons(currentTab) {
  const btnEdit = document.getElementById("btn-edit-selected");
  const btnDel = document.getElementById("btn-delete-selected");
  const cfg = SELECTION_CONFIG[currentTab];
  if (!cfg) {
    btnEdit?.classList.add("hidden");
    btnDel?.classList.add("hidden");
    return;
  }
  const checked = document.querySelectorAll(`${cfg.checkboxSelector}:checked`);
  const count = checked.length;
  btnEdit?.classList.toggle("hidden", count !== 1);
  btnDel?.classList.toggle("hidden", count === 0);

  const total = document.querySelectorAll(cfg.checkboxSelector).length;
  const sa = document.getElementById(cfg.selectAllId);
  if (sa) {
    sa.checked = count > 0 && count === total;
    sa.indeterminate = count > 0 && count < total;
  }
}

/* ===================================================================
   FILA "INFO" (detalle de banco/descripción en móvil)
   El origen repetía este mismo bloque en Registros y Proyección — una
   sola función parametrizada por colspan.
   =================================================================== */
export function toggleInfoRow(btn, colspan) {
  const row = btn.closest("tr");
  const next = row.nextElementSibling;
  if (next?.classList.contains("info-row")) {
    next.remove();
    return;
  }
  const infoTr = document.createElement("tr");
  infoTr.className = "info-row";
  const infoTd = document.createElement("td");
  infoTd.colSpan = colspan;
  const inner = document.createElement("div");
  inner.className = "info-row-content";
  if (btn.dataset.desc) {
    const dSpan = document.createElement("span");
    dSpan.textContent = btn.dataset.desc;
    inner.appendChild(dSpan);
  }
  if (btn.dataset.bank) {
    const bSpan = document.createElement("span");
    bSpan.className = "info-bank";
    bSpan.textContent = btn.dataset.bank;
    inner.appendChild(bSpan);
  }
  infoTd.appendChild(inner);
  infoTr.appendChild(infoTd);
  row.after(infoTr);
}

/* ===================================================================
   TOOLTIP FLOTANTE (data-tip) — descripciones truncadas en tablas
   =================================================================== */
export function initTooltip() {
  const tip = document.getElementById("foresee-tip");
  if (!tip) return;
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && el.dataset.tip) {
      tip.textContent = el.dataset.tip;
      tip.style.display = "block";
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("[data-tip]")) tip.style.display = "none";
  });
  document.addEventListener("mousemove", (e) => {
    if (tip.style.display !== "block") return;
    let x = e.clientX + 14, y = e.clientY + 14;
    const r = tip.getBoundingClientRect();
    if (x + r.width > window.innerWidth) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight) y = e.clientY - r.height - 14;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  });
}
