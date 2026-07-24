// Foresee 2.0 — calc-modal.js
// La calculadora del origen, con el mismo comportamiento exacto: barra
// Ingreso/Gasto → fecha → descripción → banco → teclado numérico → «✓
// Listo» → abre el modal de categoría → guarda. Es EL formulario único
// de movimiento: Registros la usa para transacciones y la Fase 3
// (Proyección) la reutiliza tal cual pasando su propio onFinalize —
// evita los ~90 líneas duplicadas que el origen tenía entre
// finalizeTransaction/finalizeProjection.
import { appState } from "../state.js";
import { fillSelect, openModal, closeModal, showToast } from "./ui.js";
import { openCategoryModal } from "./category-modal.js";
import { processReceiptImage } from "./ocr.js";

let calcExpr = "0";
let tempData = {};
let editId = null;
let onFinalizeCb = null;

export function openCalcModal({ editItem = null, initialTipo = "expense", onFinalize, titleNew = "Nueva Transacción", titleEdit = "Editar Transacción" } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  calcExpr = "0";
  tempData = {};
  editId = null;
  onFinalizeCb = onFinalize;

  fillSelect(document.getElementById("calc-bank"), appState.banks, { placeholder: "— Banco / Cuenta —" });

  if (editItem) {
    editId = editItem.id;
    setCalcTipo(editItem.type === "income" ? "income" : "expense");
    document.getElementById("calc-date").value = editItem.date || today;
    document.getElementById("calc-desc").value = editItem.description || "";
    document.getElementById("calc-bank").value = editItem.bank || "";
    calcExpr = String(editItem.amount || 0);
    document.getElementById("calc-display").textContent = calcExpr;
    document.getElementById("calc-modal-title").textContent = titleEdit;
  } else {
    setCalcTipo(initialTipo);
    document.getElementById("calc-date").value = today;
    document.getElementById("calc-desc").value = "";
    document.getElementById("calc-bank").value = "";
    document.getElementById("calc-display").textContent = "0";
    document.getElementById("calc-modal-title").textContent = titleNew;
  }

  openModal("calc-modal");
  setTimeout(() => {
    const d = document.getElementById("calc-date");
    try { d.showPicker(); } catch (_) { d.focus(); }
  }, 80);
  document.removeEventListener("keydown", handleCalcKeyboard);
  document.addEventListener("keydown", handleCalcKeyboard);
}

function closeCalcModalRaw() {
  closeModal("calc-modal");
  document.removeEventListener("keydown", handleCalcKeyboard);
}

function setCalcTipo(tipo) {
  tempData.type = tipo;
  document.querySelectorAll(".btn-tipo").forEach((btn) => {
    btn.classList.remove("active--income", "active--expense");
    if (btn.dataset.tipo === tipo) {
      btn.classList.add(tipo === "income" ? "active--income" : "active--expense");
    }
  });
  const box = document.querySelector("#calc-modal .modal-box");
  const display = document.getElementById("calc-display");
  box.classList.toggle("tipo--income", tipo === "income");
  box.classList.toggle("tipo--expense", tipo === "expense");
  display.classList.toggle("tipo--income", tipo === "income");
  display.classList.toggle("tipo--expense", tipo === "expense");
}

function safeEval(expr) {
  if (!/^[\d+\-*/.() ]+$/.test(expr)) return NaN;
  try {
    const result = new Function("return (" + expr + ")")();
    return typeof result === "number" && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

function handleCalcKey(key) {
  if (key === "DEL") {
    calcExpr = calcExpr.length > 1 ? calcExpr.slice(0, -1) : "0";
  } else if (key === "OK") {
    handleCalcTotal();
    return;
  } else if (["+", "-", "*", "/"].includes(key)) {
    if (["+", "-", "*", "/"].includes(calcExpr.slice(-1))) calcExpr = calcExpr.slice(0, -1);
    calcExpr += key;
  } else if (key === ".") {
    const segments = calcExpr.split(/[+\-*/]/);
    if (!segments[segments.length - 1].includes(".")) calcExpr += ".";
  } else {
    calcExpr = calcExpr === "0" ? key : calcExpr + key;
  }
  document.getElementById("calc-display").textContent = calcExpr;
}

function handleCalcKeyboard(e) {
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (!document.getElementById("calc-modal").classList.contains("active")) return;

  const map = {
    Backspace: "DEL", Enter: "OK", Return: "OK",
    "+": "+", "-": "-", "*": "*", "/": "/", ".": ".", ",": ".",
  };
  if (map[e.key]) {
    e.preventDefault();
    handleCalcKey(map[e.key]);
    return;
  }
  if (/^[0-9]$/.test(e.key)) {
    e.preventDefault();
    handleCalcKey(e.key);
  }
}

function handleCalcTotal() {
  const val = safeEval(calcExpr);
  if (isNaN(val) || val <= 0) {
    showToast("Ingresa un monto válido mayor a cero.", "warning");
    return;
  }
  const bank = document.getElementById("calc-bank").value.trim();
  if (!bank) {
    showToast("Selecciona un banco o cuenta.", "warning");
    return;
  }

  tempData.amount = parseFloat(val.toFixed(2));
  tempData.date = document.getElementById("calc-date").value || new Date().toISOString().slice(0, 10);
  tempData.bank = bank;
  const description = document.getElementById("calc-desc").value.trim();

  closeCalcModalRaw();
  openCategoryModal((categoryName) => {
    const cb = onFinalizeCb;
    const id = editId;
    const data = { ...tempData, category: categoryName, description };
    tempData = {};
    editId = null;
    onFinalizeCb = null;
    if (cb) cb(data, id);
  });
}

async function handleScanReceipt(file) {
  let data;
  try {
    data = await processReceiptImage(file);
  } catch (err) {
    console.error("[Foresee OCR] Error al leer recibo:", err);
    showToast("No se pudo leer el recibo. Completa los datos a mano.", "warning");
    return;
  }
  if (!data) {
    showToast("No se pudo leer el recibo. Completa los datos a mano.", "warning");
    return;
  }
  if (data.amount !== null) {
    calcExpr = String(data.amount);
    document.getElementById("calc-display").textContent = calcExpr;
  }
  if (data.fecha) document.getElementById("calc-date").value = data.fecha;
  if (data.comercio) document.getElementById("calc-desc").value = data.comercio;

  if (data.amount === null) {
    showToast("No se detectó el monto. Revisa los demás datos y complétalo a mano.", "warning");
  } else {
    showToast("Recibo leído. Revisa los datos antes de confirmar.", "success");
  }
}

export function initCalcModal() {
  document.getElementById("calc-close-btn").addEventListener("click", closeCalcModalRaw);
  document.getElementById("calc-scan-receipt-btn").addEventListener("click", () =>
    document.getElementById("calc-receipt-input").click(),
  );
  document.getElementById("calc-receipt-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) handleScanReceipt(file);
  });
  document.getElementById("calc-modal").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-tipo");
    if (!btn) return;
    setCalcTipo(btn.dataset.tipo);
    const d = document.getElementById("calc-date");
    try { d.showPicker(); } catch (_) { d.focus(); }
  });
  document.getElementById("calc-modal").addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-key[data-key]");
    if (btn) handleCalcKey(btn.dataset.key);
  });
  document.getElementById("calc-date").addEventListener("change", () => {
    document.getElementById("calc-desc").focus();
  });
  document.getElementById("calc-desc").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("calc-bank").focus();
    }
  });
  document.getElementById("calc-bank").addEventListener("change", () => {
    document.getElementById("calc-display").focus();
  });
}
