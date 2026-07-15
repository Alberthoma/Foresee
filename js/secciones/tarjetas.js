// Foresee 2.0 — tarjetas.js
// Tarjetas de crédito: deuda, límite, cuota mensual estimada
// (amortización francesa) y alertas de vencimiento.
import { db, doc, collection, setDoc, updateDoc, deleteDoc, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency, toTitleCase } from "../lib/utils.js";
import { showToast, markInvalid, openModal, closeModal, openConfirmModal, guardClose } from "../lib/ui.js";
import { ICON_TRASH } from "../lib/icons.js";
import { sendBrowserNotification } from "../lib/notifications.js";

export function calculateMonthlyPayment(principal, annualRate, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const r = annualRate / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function renderCreditCardsTable() {
  const container = document.getElementById("cc-cards");
  const tfoot = document.getElementById("cc-tfoot");
  const empty = document.getElementById("cc-empty");
  container.textContent = "";

  const sorted = [...appState.creditCards].sort((a, b) => a.dueDate - b.dueDate);

  if (sorted.length === 0) {
    tfoot.classList.add("hidden");
    empty.classList.remove("hidden");
    document.getElementById("cc-total-amount").textContent = formatCurrency(0, appState.currency);
    document.getElementById("cc-total-limit").textContent = formatCurrency(0, appState.currency);
    document.getElementById("cc-total-available").textContent = formatCurrency(0, appState.currency);
    document.getElementById("cc-total-monthly").textContent = formatCurrency(0, appState.currency);
    return;
  }
  tfoot.classList.remove("hidden");
  empty.classList.add("hidden");

  const today = new Date();
  let totalAdeudado = 0, totalLimite = 0, totalMensual = 0;
  const tplCard = document.getElementById("tpl-cc-card");
  const frag = document.createDocumentFragment();

  sorted.forEach((card) => {
    const next = new Date(today.getFullYear(), today.getMonth(), card.dueDate);
    if (today.getDate() > card.dueDate) next.setMonth(next.getMonth() + 1);
    const days = Math.ceil((next - today) / 86400000);

    const deuda = parseFloat(card.amount) || 0;
    const limite = parseFloat(card.limit) || 0;
    const disponible = limite - deuda;
    const pct = limite > 0 ? Math.min(100, (deuda / limite) * 100) : 0;
    const pago = calculateMonthlyPayment(deuda, card.rate, card.months);

    if (!card.exclude) totalAdeudado += deuda;
    totalLimite += limite;
    totalMensual += pago;

    const cardEl = tplCard.content.cloneNode(true).querySelector(".cc-card");
    cardEl.dataset.cardId = card.id;
    if (days >= 0 && days <= 2) cardEl.classList.add("due-danger");
    else if (days <= 5) cardEl.classList.add("due-warning");

    cardEl.querySelector(".js-bank").textContent = card.bank;

    const dueEl = cardEl.querySelector(".js-due-date");
    dueEl.textContent =
      days <= 2 ? `⚠ Vence en ${days} día${days === 1 ? "" : "s"}` :
      days <= 5 ? `Vence en ${days} días` :
      `Día de pago: ${card.dueDate}`;
    if (days <= 2) dueEl.classList.add("due-danger");
    else if (days <= 5) dueEl.classList.add("due-warning");

    const barFill = cardEl.querySelector(".js-bar");
    barFill.style.width = `${pct.toFixed(1)}%`;
    if (pct >= 90) barFill.classList.add("bar--danger");
    else if (pct >= 70) barFill.classList.add("bar--warning");
    cardEl.querySelector(".js-pct").textContent = `${pct.toFixed(0)}%`;

    cardEl.querySelector(".js-deuda-display").textContent = formatCurrency(deuda, appState.currency);

    const dispEl = cardEl.querySelector(".js-disp");
    dispEl.textContent = formatCurrency(disponible, appState.currency);
    dispEl.className = `cc-fig-val js-disp ${disponible >= 0 ? "balance--positive" : "balance--negative"}`;

    cardEl.querySelector('[data-field="exclude"]').checked = !!card.exclude;
    cardEl.querySelector('[data-field="amount"]').value = deuda.toFixed(2);
    cardEl.querySelector('[data-field="limit"]').value = limite > 0 ? limite.toFixed(2) : "";
    cardEl.querySelector('[data-field="rate"]').value = Number(card.rate).toFixed(2);
    cardEl.querySelector('[data-field="months"]').value = card.months;
    cardEl.querySelector(".js-pago").textContent = formatCurrency(pago, appState.currency);

    const delBtn = cardEl.querySelector('[data-action="delete"]');
    delBtn.dataset.id = card.id;
    delBtn.innerHTML = ICON_TRASH;

    frag.appendChild(cardEl);
  });
  container.appendChild(frag);

  const totalDisp = totalLimite - totalAdeudado;
  document.getElementById("cc-total-amount").textContent = formatCurrency(totalAdeudado, appState.currency);
  document.getElementById("cc-total-limit").textContent = formatCurrency(totalLimite, appState.currency);
  document.getElementById("cc-total-available").textContent = formatCurrency(totalDisp, appState.currency);
  document.getElementById("cc-total-monthly").textContent = formatCurrency(totalMensual, appState.currency);
}

// Notificación nativa cuando una tarjeta llega al 80%+ de su límite —
// una por tarjeta por día (dedup en localStorage), independiente del
// banner en pantalla de renderCreditCardAlerts (dashboard.js).
export function checkCreditCardNotifications() {
  const todayKey = new Date().toISOString().split("T")[0];
  appState.creditCards.forEach((card) => {
    const deuda = parseFloat(card.amount) || 0;
    const limite = parseFloat(card.limit) || 0;
    if (!limite || deuda / limite < 0.8) return;
    const notifKey = `notif-cc-${card.id}-${todayKey}`;
    if (localStorage.getItem(notifKey)) return;
    const pct = ((deuda / limite) * 100).toFixed(0);
    sendBrowserNotification(
      "Foresee — Tarjeta de crédito",
      `Tarjeta ${card.bank}: ${pct}% del límite usado (${formatCurrency(deuda, appState.currency)} de ${formatCurrency(limite, appState.currency)}).`,
    );
    localStorage.setItem(notifKey, "1");
  });
}

async function handleCardDataChange(e) {
  const input = e.target;
  if (!input.classList.contains("card-data-input")) return;
  const user = appState.currentUser;
  if (!user) return;

  const field = input.dataset.field;
  let value = input.type === "checkbox" ? input.checked : parseFloat(input.value);

  if (input.type === "number") {
    if (isNaN(value) || value < 0) {
      showToast(`Valor inválido para "${field}".`, "error");
      input.value = input.defaultValue;
      return;
    }
    if (field === "months" && value < 1) {
      showToast("Los meses deben ser al menos 1.", "error");
      input.value = input.defaultValue;
      return;
    }
  }

  const cardId = input.closest("[data-card-id]").dataset.cardId;
  try {
    await updateDoc(doc(db, DB_COL(user.uid, "creditCards"), cardId), { [field]: value });
  } catch (err) {
    console.error("[Firestore] Actualizar tarjeta:", err);
    showToast("Error al actualizar.", "error");
  }
}

function isCcDirty() {
  return !!(
    document.getElementById("cc-bank").value.trim() ||
    parseFloat(document.getElementById("cc-amount").value) > 0
  );
}

function openCcModal() {
  document.getElementById("cc-form").reset();
  openModal("cc-modal", "#cc-bank");
}

function closeCcModalRaw() {
  closeModal("cc-modal");
}

async function handleCcFormSubmit(e) {
  e.preventDefault();
  const user = appState.currentUser;
  if (!user) return;

  const bank = toTitleCase(document.getElementById("cc-bank").value.trim());
  const dueDate = parseInt(document.getElementById("cc-due-date").value, 10);
  const amount = parseFloat(document.getElementById("cc-amount").value);
  const limitVal = parseFloat(document.getElementById("cc-limit").value) || 0;
  const rate = parseFloat(document.getElementById("cc-rate").value);
  const months = parseInt(document.getElementById("cc-months").value, 10);

  const fields = [
    [document.getElementById("cc-bank"), !bank],
    [document.getElementById("cc-due-date"), isNaN(dueDate) || dueDate < 1 || dueDate > 31],
    [document.getElementById("cc-amount"), isNaN(amount) || amount < 0],
    [document.getElementById("cc-rate"), isNaN(rate) || rate < 0],
    [document.getElementById("cc-months"), isNaN(months) || months < 1],
  ];
  const invalid = fields.filter(([, bad]) => bad);
  if (invalid.length) {
    invalid.forEach(([el]) => markInvalid(el));
    showToast("Completa todos los campos correctamente.", "error");
    return;
  }
  if (appState.creditCards.some((c) => c.bank.toLowerCase() === bank.toLowerCase())) {
    showToast(`Ya existe una tarjeta para "${bank}".`, "error");
    return;
  }

  const saveBtn = document.getElementById("cc-save-btn");
  saveBtn.disabled = true;
  try {
    const ref = doc(collection(db, DB_COL(user.uid, "creditCards")));
    await setDoc(ref, { id: ref.id, bank, dueDate, amount, rate, months, limit: limitVal, exclude: false });
    showToast(`Tarjeta "${bank}" añadida.`, "success");
    closeCcModalRaw();
  } catch (err) {
    console.error("[Firestore] Añadir tarjeta:", err);
    showToast("Error al guardar.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteCreditCard(id) {
  openConfirmModal(
    "Eliminar Tarjeta",
    "¿Eliminar esta tarjeta? No afecta transacciones ya creadas.",
    async () => {
      try {
        await deleteDoc(doc(db, DB_COL(appState.currentUser.uid, "creditCards"), id));
        showToast("Tarjeta eliminada.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar tarjeta:", err);
        showToast("Error al eliminar.", "error");
      }
    },
  );
}

export function initTarjetas() {
  document.getElementById("btn-add-card").addEventListener("click", openCcModal);
  document.getElementById("cc-close-btn").addEventListener("click", () => guardClose(isCcDirty, closeCcModalRaw));
  document.getElementById("cc-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) guardClose(isCcDirty, closeCcModalRaw);
  });
  document.getElementById("cc-form").addEventListener("submit", handleCcFormSubmit);

  const ENTER_CHAIN = ["cc-bank", "cc-amount", "cc-limit", "cc-due-date", "cc-rate", "cc-months"];
  ENTER_CHAIN.forEach((id, i, arr) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (i < arr.length - 1) document.getElementById(arr[i + 1]).focus();
      else document.getElementById("cc-form").requestSubmit();
    });
  });

  document.getElementById("cc-cards").addEventListener("change", handleCardDataChange);
  document.getElementById("cc-cards").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (btn) deleteCreditCard(btn.dataset.id);
  });
}
