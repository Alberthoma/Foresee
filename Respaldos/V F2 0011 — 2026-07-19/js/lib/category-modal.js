// Foresee 2.0 — category-modal.js
// Modal de selección de categoría — reutilizado por la calculadora
// (nueva transacción/proyección), por la edición de categoría en
// Registros, y desde la Fase 8 por Importar. Un solo lugar, un solo
// callback de selección a la vez.
import { appState, DEFAULT_ICON } from "../state.js";
import { openModal, closeModal } from "./ui.js";

export const TRANSFER_ICON =
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514700/transferencia-interna_wjuhnq.png";

export const UNKNOWN_ICON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#F5A623"/><text x="12" y="17" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">?</text></svg>',
  );

let onSelectCb = null;

export function openCategoryModal(onSelect) {
  const grid = document.getElementById("cat-grid");
  grid.textContent = "";
  appState.categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "btn-cat";
    btn.dataset.name = cat.name;

    const img = document.createElement("img");
    img.src = cat.icon || DEFAULT_ICON;
    img.alt = "";
    img.width = 28;
    img.height = 28;

    const label = document.createElement("span");
    label.textContent = cat.name;

    btn.appendChild(img);
    btn.appendChild(label);
    grid.appendChild(btn);
  });

  onSelectCb = onSelect;
  openModal("cat-modal");
}

export function closeCategoryModal() {
  closeModal("cat-modal");
  onSelectCb = null;
}

export function initCategoryModal() {
  document.getElementById("cat-close-btn").addEventListener("click", closeCategoryModal);
  document.getElementById("cat-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCategoryModal();
  });
  document.getElementById("cat-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-cat[data-name]");
    if (!btn) return;
    const cb = onSelectCb;
    closeCategoryModal();
    if (cb) cb(btn.dataset.name);
  });
}

// Ícono + nombre de categoría para celdas de tabla. type:'transfer' usa
// el ícono de transferencia en vez de buscar la categoría (las
// transferencias no tienen categoría propia).
export function buildCatDisplay(name, type, isImported = false) {
  const cat = appState.categories.find((c) => c.name === name);
  const wrap = document.createElement("div");
  wrap.className = "cat-display";
  const img = document.createElement("img");
  img.src =
    cat && cat.icon
      ? cat.icon
      : type === "transfer"
        ? TRANSFER_ICON
        : isImported
          ? UNKNOWN_ICON
          : DEFAULT_ICON;
  img.alt = "";
  img.width = 20;
  img.height = 20;
  const span = document.createElement("span");
  span.textContent = name;
  wrap.appendChild(img);
  wrap.appendChild(span);
  return wrap;
}
