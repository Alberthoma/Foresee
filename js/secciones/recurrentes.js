// Foresee 2.0 — recurrentes.js
// CRUD de gastos recurrentes (suscripciones, pagos fijos). El
// auto-registro mensual y los recordatorios viven en lib/recurring-engine.js.
import { db, doc, collection, setDoc, deleteDoc, DB_COL } from "../firebase.js";
import { appState, saveNewDescriptionIfNeeded } from "../state.js";
import { formatCurrency } from "../lib/utils.js";
import { fillSelect, showToast, markInvalid, openModal, closeModal, openConfirmModal, guardClose, updateSelectionButtons } from "../lib/ui.js";
import { buildCatDisplay } from "../lib/category-modal.js";
import { ICON_PENCIL, ICON_TRASH } from "../lib/icons.js";

const REC_TIP_DISMISS_KEY = "foresee-rec-tip-dismissed";

export function renderRecurringTable() {
  const tbody = document.getElementById("rec-tbody");
  const tfoot = document.getElementById("rec-tfoot");
  const empty = document.getElementById("rec-empty");
  if (!tbody) return;
  tbody.textContent = "";

  const sorted = [...appState.recurringExpenses].sort((a, b) => a.day - b.day);

  if (sorted.length === 0) {
    tfoot.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  tfoot.classList.remove("hidden");
  empty.classList.add("hidden");

  const frag = document.createDocumentFragment();
  sorted.forEach((re) => {
    const tr = document.createElement("tr");

    const tdChk = tr.insertCell();
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "rec-checkbox";
    chk.dataset.id = re.id;
    chk.setAttribute("aria-label", "Seleccionar");
    tdChk.appendChild(chk);

    tr.insertCell().textContent = re.day;
    tr.insertCell().textContent = re.description;

    const tdCat = tr.insertCell();
    tdCat.appendChild(buildCatDisplay(re.category));

    const tdAmt = tr.insertCell();
    tdAmt.className = "rec-amount";
    tdAmt.appendChild(document.createTextNode(formatCurrency(re.amount, appState.currency)));
    if (re.sharedAmount > 0) {
      const sharedSpan = document.createElement("span");
      sharedSpan.className = "rec-amount-shared";
      sharedSpan.textContent = `Total banco: ${formatCurrency(re.sharedAmount, appState.currency)}`;
      tdAmt.appendChild(sharedSpan);
    }

    tr.insertCell().textContent = re.bank;

    const tdAct = tr.insertCell();
    const editBtn = document.createElement("button");
    editBtn.className = "btn-icon";
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = re.id;
    editBtn.title = "Editar";
    editBtn.innerHTML = ICON_PENCIL;
    const delBtn = document.createElement("button");
    delBtn.className = "btn-icon btn-icon--danger";
    delBtn.dataset.action = "delete";
    delBtn.dataset.id = re.id;
    delBtn.title = "Eliminar";
    delBtn.innerHTML = ICON_TRASH;
    tdAct.appendChild(editBtn);
    tdAct.appendChild(delBtn);

    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  const total = Math.round(sorted.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  document.getElementById("rec-total").textContent = formatCurrency(total, appState.currency);
  updateSelectionButtons("recurrentes");
}

function isRecDirty() {
  return !!(
    document.getElementById("rec-desc").value.trim() ||
    parseFloat(document.getElementById("rec-amount").value) > 0
  );
}

function openRecModal(id = null) {
  const form = document.getElementById("rec-form");
  form.reset();
  document.getElementById("rec-edit-id").value = "";
  document.getElementById("rec-modal-title").textContent = "Añadir Gasto Recurrente";

  const tipBanner = document.getElementById("rec-tip-banner");
  if (tipBanner) tipBanner.classList.toggle("hidden", localStorage.getItem(REC_TIP_DISMISS_KEY) === "1");

  fillSelect(document.getElementById("rec-cat"), appState.categories, { value: (c) => c.name, label: (c) => c.name, placeholder: "— Categoría —" });
  fillSelect(document.getElementById("rec-bank"), appState.banks, { placeholder: "— Banco —" });

  if (id) {
    const rec = appState.recurringExpenses.find((r) => r.id === id);
    if (!rec) return;
    document.getElementById("rec-modal-title").textContent = "Editar Gasto Recurrente";
    document.getElementById("rec-edit-id").value = rec.id;
    document.getElementById("rec-desc").value = rec.description;
    document.getElementById("rec-cat").value = rec.category;
    document.getElementById("rec-bank").value = rec.bank;
    document.getElementById("rec-amount").value = rec.amount;
    document.getElementById("rec-day").value = rec.day;
    document.getElementById("rec-shared-amount").value = rec.sharedAmount || "";
  }

  openModal("rec-modal");
  document.getElementById("rec-desc").focus();
}

function closeRecModalRaw() {
  closeModal("rec-modal");
}

async function handleRecFormSubmit(e) {
  e.preventDefault();
  const user = appState.currentUser;
  if (!user) return;

  const id = document.getElementById("rec-edit-id").value.trim();
  const description = document.getElementById("rec-desc").value.trim();
  const category = document.getElementById("rec-cat").value;
  const bank = document.getElementById("rec-bank").value;
  const amount = parseFloat(document.getElementById("rec-amount").value);
  const day = parseInt(document.getElementById("rec-day").value, 10);
  const sharedAmountRaw = document.getElementById("rec-shared-amount").value.trim();
  const sharedAmount = sharedAmountRaw ? parseFloat(sharedAmountRaw) : null;

  const fields = [
    [document.getElementById("rec-desc"), !description],
    [document.getElementById("rec-cat"), !category],
    [document.getElementById("rec-bank"), !bank],
    [document.getElementById("rec-amount"), isNaN(amount) || amount <= 0],
    [document.getElementById("rec-day"), isNaN(day) || day < 1 || day > 31],
    [document.getElementById("rec-shared-amount"), sharedAmountRaw !== "" && (isNaN(sharedAmount) || sharedAmount <= 0)],
  ];
  const invalid = fields.filter(([, bad]) => bad);
  if (invalid.length) {
    invalid.forEach(([el]) => markInvalid(el));
    showToast("Completa todos los campos correctamente.", "error");
    return;
  }

  const saveBtn = document.getElementById("rec-save-btn");
  saveBtn.disabled = true;
  const data = { description, category, bank, amount, day, sharedAmount };

  try {
    const colRef = collection(db, DB_COL(user.uid, "recurringExpenses"));
    if (id) {
      await setDoc(doc(colRef, id), data, { merge: true });
      showToast("Gasto recurrente actualizado.", "success");
      closeRecModalRaw();
    } else {
      const newRef = doc(colRef);
      await setDoc(newRef, { ...data, id: newRef.id });
      showToast("Gasto recurrente añadido.", "success");
      resetFormForNext();
    }
    await saveNewDescriptionIfNeeded(description);
  } catch (err) {
    console.error("[Firestore] Guardar gasto recurrente:", err);
    showToast("Error al guardar.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

function resetFormForNext() {
  document.getElementById("rec-form").reset();
  document.getElementById("rec-modal-title").textContent = "Añadir Gasto Recurrente";
  document.getElementById("rec-edit-id").value = "";
  document.getElementById("rec-desc").focus();
}

async function deleteRecurring(id) {
  openConfirmModal(
    "Eliminar Gasto Recurrente",
    "¿Eliminar este gasto recurrente? No afecta transacciones ya creadas.",
    async () => {
      try {
        await deleteDoc(doc(db, DB_COL(appState.currentUser.uid, "recurringExpenses"), id));
        showToast("Gasto recurrente eliminado.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar gasto recurrente:", err);
        showToast("Error al eliminar.", "error");
      }
    },
  );
}

export function editSelectedRecurring() {
  const chk = document.querySelector(".rec-checkbox:checked");
  if (chk) openRecModal(chk.dataset.id);
}

export function initRecurrentes() {
  document.getElementById("btn-add-rec").addEventListener("click", () => openRecModal());
  document.getElementById("rec-tip-dismiss").addEventListener("change", (e) => {
    if (e.target.checked) {
      localStorage.setItem(REC_TIP_DISMISS_KEY, "1");
      document.getElementById("rec-tip-banner").classList.add("hidden");
    }
  });
  document.getElementById("rec-close-btn").addEventListener("click", () => guardClose(isRecDirty, closeRecModalRaw));
  document.getElementById("rec-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) guardClose(isRecDirty, closeRecModalRaw);
  });
  document.getElementById("rec-form").addEventListener("submit", handleRecFormSubmit);

  ["rec-desc", "rec-cat", "rec-bank", "rec-amount"].forEach((id, i, arr) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById(arr[i + 1]).focus();
      }
    });
  });
  document.getElementById("rec-cat").addEventListener("change", () => document.getElementById("rec-bank").focus());
  document.getElementById("rec-bank").addEventListener("change", () => document.getElementById("rec-amount").focus());
  document.getElementById("rec-day").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("rec-shared-amount").focus(); }
  });
  document.getElementById("rec-shared-amount").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("rec-form").requestSubmit(); }
  });

  document.getElementById("rec-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit") openRecModal(btn.dataset.id);
    if (btn.dataset.action === "delete") deleteRecurring(btn.dataset.id);
  });

  document.getElementById("rec-select-all").addEventListener("change", (e) => {
    document.querySelectorAll(".rec-checkbox").forEach((c) => { c.checked = e.target.checked; });
    updateSelectionButtons("recurrentes");
  });
  document.getElementById("rec-tbody").addEventListener("change", (e) => {
    if (e.target.classList.contains("rec-checkbox")) updateSelectionButtons("recurrentes");
  });
}

export async function deleteSelectedRecurring() {
  const user = appState.currentUser;
  if (!user) return;
  const checked = [...document.querySelectorAll(".rec-checkbox:checked")];
  if (!checked.length) return;
  openConfirmModal(
    "Eliminar seleccionados",
    `¿Eliminar ${checked.length} gasto(s) recurrente(s)? No afecta transacciones ya creadas.`,
    async () => {
      try {
        await Promise.all(
          checked.map((chk) => deleteDoc(doc(db, DB_COL(user.uid, "recurringExpenses"), chk.dataset.id))),
        );
        showToast(`${checked.length} gasto(s) recurrente(s) eliminado(s).`, "success");
      } catch (err) {
        console.error("[Firestore] Eliminar recurrentes seleccionados:", err);
        showToast("Error al eliminar.", "error");
      }
    },
  );
}
