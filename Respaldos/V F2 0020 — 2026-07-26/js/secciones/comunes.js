// Foresee 2.0 — comunes.js
// Gastos comunes: división de un gasto entre personas (partes iguales /
// porcentaje / monto manual, en cascada sobre el resto), con registro
// de quién ya pagó y en qué banco.
import { db, doc, collection, setDoc, deleteDoc, addDoc, DB_GASTOS_COMUNES, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency } from "../lib/utils.js";
import { fillSelect, showToast, openModal, closeModal, openConfirmModal } from "../lib/ui.js";
import { ICON_TRASH_SOLID } from "../lib/icons.js";

const AVATAR_COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c"];

let distPopoverItemId = null;
let distPopoverPersonIndex = null;
let distInputCallback = null;
let pendingSharedPayment = null;

export function computeAllAmounts(item) {
  const N = (item.people || []).length;
  const amounts = new Array(N).fill(0);
  const total = parseFloat(item.totalAmount) || 0;
  if (total === 0 || N === 0) return amounts;
  let remaining = total;
  for (let i = 0; i < N; i++) {
    const dist = item.distribution?.[i] || { method: "equal" };
    if (dist.method === "percentage") {
      const amt = remaining * ((parseFloat(dist.value) || 0) / 100);
      amounts[i] = amt;
      remaining -= amt;
    } else if (dist.method === "manual") {
      const amt = parseFloat(dist.value) || 0;
      amounts[i] = amt;
      remaining -= amt;
    } else {
      let equalCount = 0;
      for (let j = i; j < N; j++) {
        const d = item.distribution?.[j] || { method: "equal" };
        if (!d.method || d.method === "equal") equalCount++;
      }
      const amt = remaining / (equalCount || 1);
      amounts[i] = amt;
      remaining -= amt;
    }
  }
  return amounts;
}

export async function saveGastosComunesState() {
  const user = appState.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, DB_GASTOS_COMUNES(user.uid)), JSON.parse(JSON.stringify(appState.gastosComunes)));
  } catch (err) {
    console.error("[Firestore] Gastos comunes:", err);
    showToast("No se pudo guardar el cambio.", "error");
  }
}

export function renderGastosComunesTable() {
  const container = document.getElementById("comunes-cards");
  const empty = document.getElementById("comunes-empty");
  container.textContent = "";

  const { items } = appState.gastosComunes;
  if (!items || items.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const tplCard = document.getElementById("tpl-comunes-card");
  const tplChip = document.getElementById("tpl-person-chip");
  const tplDistRow = document.getElementById("tpl-dist-row");

  items.forEach((item) => {
    const people = item.people || [];

    const card = tplCard.content.cloneNode(true).querySelector(".item-card");
    card.dataset.itemId = item.id;

    const nameInput = card.querySelector(".item-card-name");
    nameInput.value = item.name || "";
    nameInput.dataset.itemId = item.id;

    const totalInput = card.querySelector(".item-card-total");
    totalInput.value = item.totalAmount || "";
    totalInput.dataset.itemId = item.id;

    const delBtn = card.querySelector(".item-delete-btn");
    delBtn.dataset.itemId = item.id;
    delBtn.innerHTML = ICON_TRASH_SOLID;

    const peoplePanel = card.querySelector(".item-people-panel");
    people.forEach((person, idx) => {
      const chip = tplChip.content.cloneNode(true).querySelector(".person-chip");
      const avatar = chip.querySelector(".person-chip-avatar");
      avatar.style.setProperty("background-color", AVATAR_COLORS[idx % AVATAR_COLORS.length]);
      const pName = person.name || `P${idx + 1}`;
      avatar.textContent = pName.slice(0, 2).toUpperCase();

      const pInput = chip.querySelector(".person-chip-name");
      pInput.value = person.name || "";
      pInput.placeholder = `Persona ${idx + 1}`;
      pInput.dataset.itemId = item.id;
      pInput.dataset.personIndex = idx;

      const pDel = chip.querySelector(".person-chip-delete");
      pDel.dataset.itemId = item.id;
      pDel.dataset.personIndex = idx;

      peoplePanel.appendChild(chip);
    });

    const addPBtn = document.createElement("button");
    addPBtn.className = "person-chip-add";
    addPBtn.dataset.itemId = item.id;
    addPBtn.title = "Añadir persona";
    addPBtn.textContent = "+";
    peoplePanel.appendChild(addPBtn);

    const distContainer = card.querySelector(".item-distributions");
    if (people.length === 0) {
      const hint = document.createElement("p");
      hint.className = "no-people-hint";
      hint.textContent = "Añade personas con + para distribuir este gasto.";
      distContainer.appendChild(hint);
    } else {
      const amounts = computeAllAmounts(item);
      const distFrag = document.createDocumentFragment();
      people.forEach((person, pIdx) => {
        const distData = item.distribution?.[pIdx] || { method: "equal", value: 0 };
        const isPaid = !!distData.paidDay;
        const amount = amounts[pIdx] || 0;

        let methodLabel;
        switch (distData.method) {
          case "percentage":
            methodLabel = `${distData.value || 0}% del resto`;
            break;
          case "manual":
            methodLabel = "Monto fijo";
            break;
          default: {
            const hasAbove = Array.from({ length: pIdx }, (_, j) => item.distribution?.[j]?.method).some((m) => m && m !== "equal");
            methodLabel = hasAbove ? "Del resto" : "Igual";
          }
        }

        const row = tplDistRow.content.cloneNode(true).querySelector(".dist-row");
        if (isPaid) row.classList.add("is-paid");
        row.dataset.itemId = item.id;
        row.dataset.personIndex = pIdx;

        const av = row.querySelector(".dist-avatar");
        av.style.setProperty("background-color", AVATAR_COLORS[pIdx % AVATAR_COLORS.length]);
        av.textContent = (person.name || `P${pIdx + 1}`).slice(0, 2).toUpperCase();

        row.querySelector(".dist-person-name").textContent = person.name || `Persona ${pIdx + 1}`;
        row.querySelector(".dist-method-tag").textContent = methodLabel;
        row.querySelector(".dist-amount-col").textContent = formatCurrency(amount, appState.currency);

        const statusCol = row.querySelector(".dist-status-col");
        if (isPaid) {
          const tag = document.createElement("span");
          tag.className = "paid-tag";
          tag.textContent = `✔ Día ${distData.paidDay}`;
          const undoBtn = document.createElement("button");
          undoBtn.className = "undo-paid-btn";
          undoBtn.title = "Revertir pago";
          undoBtn.dataset.itemId = item.id;
          undoBtn.dataset.personIndex = pIdx;
          undoBtn.textContent = "✕";
          statusCol.appendChild(tag);
          statusCol.appendChild(undoBtn);
        } else {
          const dayIn = document.createElement("input");
          dayIn.type = "number";
          dayIn.className = "mini-day-input";
          dayIn.min = "1";
          dayIn.max = "31";
          dayIn.placeholder = "Día";
          const okBtn = document.createElement("button");
          okBtn.className = "mini-ok-btn";
          okBtn.dataset.itemId = item.id;
          okBtn.dataset.personIndex = pIdx;
          okBtn.textContent = "OK";
          statusCol.appendChild(dayIn);
          statusCol.appendChild(okBtn);
        }

        distFrag.appendChild(row);
      });
      distContainer.appendChild(distFrag);
    }

    container.appendChild(card);
  });
}

/* ===================================================================
   POPOVER DE MÉTODO DE DISTRIBUCIÓN
   =================================================================== */
function showDistPopover(triggerEl, itemId, personIndex) {
  hideDistPopover();
  const pop = document.getElementById("dist-popover");
  distPopoverItemId = itemId;
  distPopoverPersonIndex = personIndex;
  const rect = triggerEl.getBoundingClientRect();
  const popoverLeft = Math.min(rect.left, window.innerWidth - 196);
  pop.style.setProperty("top", `${rect.bottom + 4}px`);
  pop.style.setProperty("left", `${Math.max(4, popoverLeft)}px`);
  pop.classList.remove("hidden");
  triggerEl.classList.add("active");
}

function hideDistPopover() {
  const pop = document.getElementById("dist-popover");
  pop.classList.add("hidden");
  const active = document.querySelector(".dist-method-tag.active");
  if (active) active.classList.remove("active");
  distPopoverItemId = null;
  distPopoverPersonIndex = null;
}

function openDistInputModal({ method, currentValue, callback }) {
  distInputCallback = callback;
  document.getElementById("dist-input-title").textContent = method === "percentage" ? "Ingresar Porcentaje" : "Ingresar Monto";
  document.getElementById("dist-input-label").textContent = method === "percentage" ? "Porcentaje (%)" : "Monto fijo";
  const inp = document.getElementById("dist-input-value");
  inp.value = currentValue || "";
  inp.step = method === "percentage" ? "1" : "0.01";
  openModal("dist-input-modal");
  inp.focus();
}

function closeDistInputModal() {
  closeModal("dist-input-modal");
  distInputCallback = null;
}

/* ===================================================================
   MODAL: BANCO PARA REGISTRAR PAGO
   =================================================================== */
function openSharedBankModal(payload) {
  pendingSharedPayment = payload;
  fillSelect(document.getElementById("shared-bank-select"), appState.banks, { placeholder: "-- Banco --" });
  document.getElementById("shared-bank-summary").textContent = `${payload.description} — ${formatCurrency(payload.amount, appState.currency)}`;
  openModal("shared-bank-modal");
}

function closeSharedBankModal() {
  closeModal("shared-bank-modal");
  pendingSharedPayment = null;
}

async function handleConfirmSharedPayment() {
  const user = appState.currentUser;
  if (!user || !pendingSharedPayment) return;
  const bank = document.getElementById("shared-bank-select").value;
  if (!bank) {
    showToast("Selecciona un banco.", "error");
    return;
  }
  const { amount, description, date, category, originalItemId, originalPersonIndex } = pendingSharedPayment;
  const confirmBtn = document.getElementById("shared-bank-confirm-btn");
  confirmBtn.disabled = true;
  try {
    const txRef = doc(collection(db, DB_COL(user.uid, "transactions")));
    await setDoc(txRef, { id: txRef.id, type: "income", amount, description, date, category: category || "Gasto Común", bank });

    const item = appState.gastosComunes.items.find((i) => i.id === originalItemId);
    if (item) {
      if (!item.distribution) item.distribution = {};
      if (!item.distribution[originalPersonIndex]) item.distribution[originalPersonIndex] = {};
      item.distribution[originalPersonIndex].paidDay = parseInt(date.split("-")[2], 10);
      item.distribution[originalPersonIndex].txId = txRef.id;
      await saveGastosComunesState();
    }
    showToast("Pago registrado correctamente.", "success");
    closeSharedBankModal();
  } catch (err) {
    console.error("[Firestore] Registrar pago gasto común:", err);
    showToast("Error al registrar el pago.", "error");
  } finally {
    confirmBtn.disabled = false;
  }
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initComunes() {
  document.getElementById("btn-add-comun").addEventListener("click", () => {
    if (!appState.gastosComunes.items) appState.gastosComunes.items = [];
    appState.gastosComunes.items.push({ id: `item_${Date.now()}`, name: "", totalAmount: 0, people: [], distribution: {} });
    saveGastosComunesState();
  });

  const comunesCards = document.getElementById("comunes-cards");

  comunesCards.addEventListener("input", (e) => {
    const itemId = e.target.dataset.itemId;
    const item = appState.gastosComunes.items?.find((i) => i.id === itemId);
    if (!item) return;
    if (e.target.matches(".item-card-name")) {
      item.name = e.target.value;
    } else if (e.target.matches(".item-card-total")) {
      item.totalAmount = parseFloat(e.target.value) || 0;
    } else if (e.target.matches(".person-chip-name")) {
      const idx = parseInt(e.target.dataset.personIndex, 10);
      if (item.people?.[idx]) {
        item.people[idx].name = e.target.value;
        const avatar = e.target.closest(".person-chip")?.querySelector(".person-chip-avatar");
        if (avatar) avatar.textContent = (e.target.value || `P${idx + 1}`).slice(0, 2).toUpperCase();
      }
    }
  });

  comunesCards.addEventListener("blur", (e) => {
    if (e.target.matches(".item-card-name, .item-card-total, .person-chip-name")) {
      const input = e.target;
      saveGastosComunesState().then(() => {
        input.style.borderBottomColor = "var(--color-success)";
        setTimeout(() => { input.style.borderBottomColor = ""; }, 800);
      });
    }
  }, true);

  comunesCards.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === "Escape") && e.target.matches(".item-card-name, .item-card-total, .person-chip-name")) {
      e.preventDefault();
      e.target.blur();
    }
  });

  comunesCards.addEventListener("click", (e) => {
    const addPersonBtn = e.target.closest(".person-chip-add");
    if (addPersonBtn) {
      const item = appState.gastosComunes.items?.find((i) => i.id === addPersonBtn.dataset.itemId);
      if (!item) return;
      if (!item.people) item.people = [];
      item.people.push({ name: `Persona ${item.people.length + 1}` });
      saveGastosComunesState();
      return;
    }

    const delPersonBtn = e.target.closest(".person-chip-delete");
    if (delPersonBtn) {
      const idx = parseInt(delPersonBtn.dataset.personIndex, 10);
      const item = appState.gastosComunes.items?.find((i) => i.id === delPersonBtn.dataset.itemId);
      if (!item) return;
      const pName = item.people?.[idx]?.name || `Persona ${idx + 1}`;
      openConfirmModal(
        "Eliminar persona",
        `¿Eliminar a "${pName}" del ítem "${item.name || "este gasto"}"?`,
        () => {
          item.people.splice(idx, 1);
          if (item.distribution) {
            const newDist = {};
            Object.keys(item.distribution).forEach((k) => {
              const n = parseInt(k, 10);
              if (n < idx) newDist[n] = item.distribution[k];
              else if (n > idx) newDist[n - 1] = item.distribution[k];
            });
            item.distribution = newDist;
          }
          saveGastosComunesState();
        },
      );
      return;
    }

    const methodTag = e.target.closest(".dist-method-tag");
    if (methodTag) {
      const row = methodTag.closest(".dist-row");
      if (row) showDistPopover(methodTag, row.dataset.itemId, parseInt(row.dataset.personIndex, 10));
      return;
    }

    const okBtn = e.target.closest(".mini-ok-btn");
    if (okBtn) {
      const statusCol = okBtn.closest(".dist-status-col");
      const dayInput = statusCol?.querySelector(".mini-day-input");
      const day = dayInput ? parseInt(dayInput.value, 10) : NaN;
      if (isNaN(day) || day < 1 || day > 31) {
        showToast("Ingresa un día válido (1-31).", "error");
        dayInput?.focus();
        return;
      }
      const item = appState.gastosComunes.items?.find((i) => i.id === okBtn.dataset.itemId);
      const pIdx = parseInt(okBtn.dataset.personIndex, 10);
      const person = item?.people?.[pIdx];
      if (!item || !person) return;
      const amount = computeAllAmounts(item)[pIdx] || 0;
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth(), day).toISOString().split("T")[0];
      openSharedBankModal({
        amount,
        description: `${person.name || "Persona"} - ${item.name || "Gasto Común"}`,
        date,
        category: "Gasto Común",
        originalItemId: item.id,
        originalPersonIndex: pIdx,
      });
      return;
    }

    const undoPaidBtn = e.target.closest(".undo-paid-btn");
    if (undoPaidBtn) {
      const item = appState.gastosComunes.items?.find((i) => i.id === undoPaidBtn.dataset.itemId);
      const pIdx = parseInt(undoPaidBtn.dataset.personIndex, 10);
      const person = item?.people?.[pIdx];
      if (!item || !person) return;
      const personName = person.name || `Persona ${pIdx + 1}`;
      openConfirmModal(
        "Revertir pago",
        `¿Revertir el pago de "${personName}"? Se eliminará el ingreso registrado en Registros.`,
        async () => {
          const distEntry = item.distribution?.[pIdx];
          const txId = distEntry?.txId;
          if (txId) {
            const user = appState.currentUser;
            if (user) {
              try {
                await deleteDoc(doc(db, DB_COL(user.uid, "transactions"), txId));
                appState.transactions = appState.transactions.filter((t) => t.id !== txId);
              } catch (err) {
                console.error("[Firestore] Revertir pago gasto común:", err);
                showToast("Error al eliminar la transacción.", "error");
                return;
              }
            }
          }
          if (item.distribution?.[pIdx]) {
            delete item.distribution[pIdx].paidDay;
            delete item.distribution[pIdx].txId;
          }
          await saveGastosComunesState();
          showToast("Pago revertido.", "success");
        },
      );
      return;
    }

    const delItemBtn = e.target.closest(".item-delete-btn");
    if (delItemBtn) {
      const item = appState.gastosComunes.items?.find((i) => i.id === delItemBtn.dataset.itemId);
      openConfirmModal(
        "Eliminar ítem",
        `¿Eliminar "${item?.name || "este ítem"}"?`,
        () => {
          appState.gastosComunes.items = appState.gastosComunes.items.filter((i) => i.id !== delItemBtn.dataset.itemId);
          saveGastosComunesState();
        },
      );
    }
  });

  document.getElementById("dist-popover").addEventListener("click", (e) => {
    const opt = e.target.closest(".dist-popover-item[data-method]");
    if (!opt || distPopoverItemId === null) return;
    const method = opt.dataset.method;
    const item = appState.gastosComunes.items?.find((i) => i.id === distPopoverItemId);
    if (!item) return;
    if (!item.distribution) item.distribution = {};
    if (!item.distribution[distPopoverPersonIndex]) item.distribution[distPopoverPersonIndex] = {};
    const pIndex = distPopoverPersonIndex;
    const currentValue = item.distribution[pIndex].value;
    const applyChange = (val) => {
      item.distribution[pIndex] = { method, value: parseFloat(val) || 0 };
      hideDistPopover();
      saveGastosComunesState();
    };
    if (method === "percentage" || method === "manual") {
      openDistInputModal({ method, currentValue, callback: applyChange });
    } else {
      applyChange(0);
    }
  });

  document.addEventListener("click", (e) => {
    const pop = document.getElementById("dist-popover");
    if (!pop.classList.contains("hidden") && !e.target.closest(".dist-method-tag") && !e.target.closest("#dist-popover")) {
      hideDistPopover();
    }
  });

  document.getElementById("dist-input-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("dist-input-value").value;
    if (distInputCallback) distInputCallback(val);
    closeDistInputModal();
  });
  document.getElementById("dist-input-close-btn").addEventListener("click", closeDistInputModal);
  document.getElementById("dist-input-cancel-btn").addEventListener("click", closeDistInputModal);

  document.getElementById("shared-bank-close-btn").addEventListener("click", closeSharedBankModal);
  document.getElementById("shared-bank-cancel-btn").addEventListener("click", closeSharedBankModal);
  document.getElementById("shared-bank-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeSharedBankModal();
  });
  document.getElementById("shared-bank-confirm-btn").addEventListener("click", handleConfirmSharedPayment);
}
