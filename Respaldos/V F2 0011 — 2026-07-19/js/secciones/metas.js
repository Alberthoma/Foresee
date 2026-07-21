// Foresee 2.0 — metas.js
// Metas de ahorro: monto objetivo, fecha opcional, barra de progreso.
// Los aportes son manuales — se editan como el resto de los campos de
// la tarjeta (igual que tarjetas.js), sin historial de aportes aparte.
import { db, doc, collection, setDoc, updateDoc, deleteDoc, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency } from "../lib/utils.js";
import { showToast, markInvalid, openModal, closeModal, openConfirmModal, guardClose } from "../lib/ui.js";
import { ICON_TRASH } from "../lib/icons.js";

export function renderSavingsGoals() {
  const container = document.getElementById("goal-cards");
  const empty = document.getElementById("goal-empty");
  if (!container) return;
  container.textContent = "";

  // Metas con fecha primero (la más próxima primero); sin fecha, al final.
  const sorted = [...appState.savingsGoals].sort((a, b) => {
    if (!a.targetDate && !b.targetDate) return 0;
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return a.targetDate.localeCompare(b.targetDate);
  });

  if (sorted.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const today = new Date();
  const tplGoal = document.getElementById("tpl-goal-card");
  const frag = document.createDocumentFragment();

  sorted.forEach((goal) => {
    const saved = parseFloat(goal.savedAmount) || 0;
    const target = parseFloat(goal.targetAmount) || 0;
    const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
    const complete = target > 0 && saved >= target;

    const cardEl = tplGoal.content.cloneNode(true).querySelector(".goal-card");
    cardEl.dataset.goalId = goal.id;
    if (complete) cardEl.classList.add("goal-complete");

    cardEl.querySelector(".js-name").textContent = goal.name;

    const dueEl = cardEl.querySelector(".js-due-date");
    if (complete) {
      dueEl.textContent = "🎉 ¡Meta cumplida!";
      dueEl.classList.add("goal-complete-text");
    } else if (goal.targetDate) {
      const targetD = new Date(`${goal.targetDate}T00:00:00`);
      const days = Math.ceil((targetD - today) / 86400000);
      dueEl.textContent =
        days < 0 ? "Fecha objetivo vencida" :
        days === 0 ? "¡Es hoy!" :
        `Faltan ${days} día${days === 1 ? "" : "s"}`;
      if (days < 0) { dueEl.classList.add("due-danger"); cardEl.classList.add("due-danger"); }
      else if (days <= 7) { dueEl.classList.add("due-warning"); cardEl.classList.add("due-warning"); }
    } else {
      dueEl.textContent = "Sin fecha objetivo";
    }

    const barFill = cardEl.querySelector(".js-bar");
    barFill.style.width = `${pct.toFixed(1)}%`;
    cardEl.querySelector(".js-pct").textContent = `${pct.toFixed(0)}%`;

    cardEl.querySelector(".js-saved-display").textContent = formatCurrency(saved, appState.currency);
    cardEl.querySelector(".js-remain-display").textContent = formatCurrency(Math.max(0, target - saved), appState.currency);

    cardEl.querySelector('[data-field="savedAmount"]').value = saved.toFixed(2);
    cardEl.querySelector('[data-field="targetAmount"]').value = target > 0 ? target.toFixed(2) : "";

    const delBtn = cardEl.querySelector('[data-action="delete"]');
    delBtn.dataset.id = goal.id;
    delBtn.innerHTML = ICON_TRASH;

    frag.appendChild(cardEl);
  });
  container.appendChild(frag);
}

async function handleGoalDataChange(e) {
  const input = e.target;
  if (!input.classList.contains("goal-data-input")) return;
  const user = appState.currentUser;
  if (!user) return;

  const field = input.dataset.field;
  const value = parseFloat(input.value);
  if (isNaN(value) || value < 0) {
    showToast("Valor inválido.", "error");
    input.value = input.defaultValue;
    return;
  }

  const goalId = input.closest("[data-goal-id]").dataset.goalId;
  try {
    await updateDoc(doc(db, DB_COL(user.uid, "savingsGoals"), goalId), { [field]: value });
  } catch (err) {
    console.error("[Firestore] Actualizar meta:", err);
    showToast("Error al actualizar.", "error");
  }
}

function isMetaDirty() {
  return !!(
    document.getElementById("meta-name").value.trim() ||
    parseFloat(document.getElementById("meta-target").value) > 0
  );
}

function openMetaModal() {
  document.getElementById("meta-form").reset();
  openModal("meta-modal", "#meta-name");
}

function closeMetaModalRaw() {
  closeModal("meta-modal");
}

async function handleMetaFormSubmit(e) {
  e.preventDefault();
  const user = appState.currentUser;
  if (!user) return;

  const name = document.getElementById("meta-name").value.trim();
  const target = parseFloat(document.getElementById("meta-target").value);
  const savedRaw = document.getElementById("meta-saved").value;
  const saved = savedRaw ? parseFloat(savedRaw) : 0;
  const targetDate = document.getElementById("meta-date").value || null;

  const fields = [
    [document.getElementById("meta-name"), !name],
    [document.getElementById("meta-target"), isNaN(target) || target <= 0],
    [document.getElementById("meta-saved"), savedRaw !== "" && (isNaN(saved) || saved < 0)],
  ];
  const invalid = fields.filter(([, bad]) => bad);
  if (invalid.length) {
    invalid.forEach(([el]) => markInvalid(el));
    showToast("Completa todos los campos correctamente.", "error");
    return;
  }

  const saveBtn = document.getElementById("meta-save-btn");
  saveBtn.disabled = true;
  try {
    const ref = doc(collection(db, DB_COL(user.uid, "savingsGoals")));
    await setDoc(ref, {
      id: ref.id,
      name,
      targetAmount: target,
      savedAmount: saved,
      targetDate,
      createdAt: new Date().toISOString(),
    });
    showToast(`Meta "${name}" creada.`, "success");
    closeMetaModalRaw();
  } catch (err) {
    console.error("[Firestore] Crear meta:", err);
    showToast("Error al guardar.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteGoal(id) {
  openConfirmModal(
    "Eliminar Meta",
    "¿Eliminar esta meta de ahorro? Esta acción no se puede deshacer.",
    async () => {
      try {
        await deleteDoc(doc(db, DB_COL(appState.currentUser.uid, "savingsGoals"), id));
        showToast("Meta eliminada.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar meta:", err);
        showToast("Error al eliminar.", "error");
      }
    },
  );
}

export function initMetas() {
  document.getElementById("btn-add-meta").addEventListener("click", openMetaModal);
  document.getElementById("meta-close-btn").addEventListener("click", closeMetaModalRaw);
  document.getElementById("meta-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) guardClose(isMetaDirty, closeMetaModalRaw);
  });
  document.getElementById("meta-form").addEventListener("submit", handleMetaFormSubmit);

  const ENTER_CHAIN = ["meta-name", "meta-target", "meta-saved"];
  ENTER_CHAIN.forEach((id, i, arr) => {
    document.getElementById(id).addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (i < arr.length - 1) document.getElementById(arr[i + 1]).focus();
      else document.getElementById("meta-form").requestSubmit();
    });
  });

  document.getElementById("goal-cards").addEventListener("change", handleGoalDataChange);
  document.getElementById("goal-cards").addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (btn) deleteGoal(btn.dataset.id);
  });
}
