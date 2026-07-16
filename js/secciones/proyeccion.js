// Foresee 2.0 — proyeccion.js
// Proyección dinámica: transacciones reales del mes + proyecciones
// manuales + asientos virtuales generados desde Recurrentes (excluyendo
// los que ya se cubrieron con un gasto real, mismo criterio que el
// auto-registro). El alta/edición reutiliza la MISMA calculadora que
// Registros (Mejora #8 del plan) — sin modal de proyección aparte.
import { db, doc, collection, setDoc, deleteDoc, writeBatch, DB_COL } from "../firebase.js";
import { appState, saveNewDescriptionIfNeeded } from "../state.js";
import { formatCurrency, formatMonthLabel, toTitleCase, sharesDescriptionWord, withinDays } from "../lib/utils.js";
import { buildInternalPairMap, addsToBalance } from "../lib/balances.js";
import {
  showLoading,
  hideLoading,
  showToast,
  openConfirmModal,
  toggleInfoRow,
  updateSelectionButtons,
} from "../lib/ui.js";
import { openCalcModal } from "../lib/calc-modal.js";
import { buildCatDisplay } from "../lib/category-modal.js";
import { ICON_PENCIL, ICON_TRASH } from "../lib/icons.js";
import { saveTransaction, deleteTransaction } from "./registros.js";

function getNextMonthStr(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  let nextY = y, nextM = m + 1;
  if (nextM > 12) { nextM = 1; nextY++; }
  return `${nextY}-${String(nextM).padStart(2, "0")}`;
}

export function getDynamicProjections(includeNextMonth = false) {
  const month = appState.filterMonth;
  const months = includeNextMonth ? [month, getNextMonthStr(month)] : [month];

  const realTxs = appState.transactions.filter(
    (t) => t && typeof t.date === "string" && months.includes(t.date.substring(0, 7)),
  );
  const manualProj = appState.projections
    .filter((p) => p && typeof p.date === "string" && months.includes(p.date.substring(0, 7)))
    .map((p) => ({ ...p, isPureProjection: true }));

  const virtualFromRecurring = months.flatMap((ym) => {
    const [year, mo] = ym.split("-").map(Number);
    return appState.recurringExpenses.map((re) => ({
      id: `recurring-${re.id}-${ym}`,
      date: `${year}-${String(mo).padStart(2, "0")}-${String(re.day).padStart(2, "0")}`,
      description: re.description,
      category: re.category,
      bank: re.bank,
      amount: re.amount,
      type: "expense",
      isVirtual: true,
    }));
  });

  // Mismo criterio que processRecurringExpenses: palabra compartida ±5 días,
  // comparado contra TODAS las transacciones (no solo las del mes filtrado)
  // porque el match real puede caer cerca de un límite de mes.
  const futureVirtual = virtualFromRecurring.filter(
    (vp) => !appState.transactions.some(
      (rt) => rt.type === "expense" && sharesDescriptionWord(rt.description, vp.description) && withinDays(rt.date, vp.date, 5),
    ),
  );

  return [...realTxs, ...manualProj, ...futureVirtual].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function populateProjFilterMonth() {
  const sel = document.getElementById("proj-filter-month");
  const cur = appState.filterMonth;
  sel.textContent = "";
  const months = new Set();
  appState.transactions.forEach((t) => t?.date && months.add(t.date.substring(0, 7)));
  appState.projections.forEach((p) => p?.date && months.add(p.date.substring(0, 7)));
  months.add(cur);
  [...months].sort().reverse().forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    const [y, mo] = m.split("-");
    opt.textContent = new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });
    if (m === cur) opt.selected = true;
    sel.appendChild(opt);
  });
}

export function renderProyeccionTable() {
  populateProjFilterMonth();
  const showNextMonthChk = document.getElementById("proj-show-next-month");
  const includeNextMonth = !!(showNextMonthChk && showNextMonthChk.checked);
  const projections = getDynamicProjections(includeNextMonth);
  const tbody = document.getElementById("proj-tbody");
  const tfoot = document.getElementById("proj-tfoot");
  const empty = document.getElementById("proj-empty");
  tbody.textContent = "";

  if (projections.length === 0) {
    tfoot.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }
  tfoot.classList.remove("hidden");
  empty.classList.add("hidden");

  const internalPairMap = buildInternalPairMap(appState.transactions);
  const rowAddsToBalance = (t) => addsToBalance(t, internalPairMap);

  let runningBalance = appState.openingBalance;
  const month = appState.filterMonth;
  appState.transactions
    .filter((t) => t?.date && t.date.substring(0, 7) < month)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((t) => {
      runningBalance = Math.round((runningBalance + (rowAddsToBalance(t) ? t.amount : -t.amount)) * 100) / 100;
    });

  let totalIncome = 0, totalExpenses = 0;
  const frag = document.createDocumentFragment();
  let lastRowMonth = null;

  projections.forEach((p) => {
    const rowMonth = p.date ? p.date.substring(0, 7) : null;
    if (includeNextMonth && lastRowMonth !== null && rowMonth !== lastRowMonth) {
      const trDivider = document.createElement("tr");
      trDivider.className = "proj-month-divider";
      const tdDivider = trDivider.insertCell();
      tdDivider.colSpan = 8;
      tdDivider.textContent = formatMonthLabel(rowMonth);
      frag.appendChild(trDivider);
    }
    lastRowMonth = rowMonth;

    const pAdds = rowAddsToBalance(p);
    runningBalance = Math.round((runningBalance + (pAdds ? p.amount : -p.amount)) * 100) / 100;
    if (pAdds) totalIncome += p.amount; else totalExpenses += p.amount;

    const tr = document.createElement("tr");
    tr.className = pAdds ? "row--income" : "row--expense";
    if (p.isVirtual) tr.classList.add("proj-virtual");
    if (p.isPureProjection) tr.classList.add("proj-manual");

    const tdChk = tr.insertCell();
    if (!p.isVirtual) {
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "proj-checkbox";
      chk.dataset.id = p.id;
      chk.dataset.type = p.isPureProjection ? "proj" : "tx";
      chk.setAttribute("aria-label", "Seleccionar");
      tdChk.appendChild(chk);
    }

    tr.insertCell().textContent = p.date ? parseInt(p.date.split("-")[2], 10) : "—";
    tr.insertCell().textContent = p.description || "—";

    const tdCat = tr.insertCell();
    tdCat.appendChild(buildCatDisplay(p.category || "", p.transferLeg ? "transfer" : p.type));

    const tdBank = tr.insertCell();
    const bankSpan = document.createElement("span");
    bankSpan.className = "cell-bank-text";
    bankSpan.textContent = p.bank || "—";
    tdBank.appendChild(bankSpan);
    const infoBtn = document.createElement("button");
    infoBtn.className = "btn-row-info";
    infoBtn.dataset.action = "info";
    infoBtn.dataset.desc = p.description || "";
    infoBtn.dataset.bank = p.bank || "";
    infoBtn.setAttribute("aria-label", "Ver detalle");
    infoBtn.textContent = "i";
    tdBank.appendChild(infoBtn);

    const tdAmt = tr.insertCell();
    tdAmt.className = pAdds ? "amount--income" : "amount--expense";
    tdAmt.textContent = formatCurrency(p.amount, appState.currency);

    const tdBal = tr.insertCell();
    tdBal.className = runningBalance >= 0 ? "balance--positive" : "balance--negative";
    tdBal.textContent = formatCurrency(runningBalance, appState.currency);

    const tdAct = tr.insertCell();
    if (p.isVirtual) {
      const span = document.createElement("span");
      span.className = "proj-label";
      span.textContent = "(proyectado)";
      tdAct.appendChild(span);
    } else {
      const btnE = document.createElement("button");
      btnE.className = "btn-icon";
      btnE.title = p.isPureProjection ? "Editar" : "Editar transacción";
      btnE.dataset.action = p.isPureProjection ? "edit-proj" : "edit-tx";
      btnE.dataset.id = p.id;
      btnE.innerHTML = ICON_PENCIL;
      const btnD = document.createElement("button");
      btnD.className = "btn-icon btn-icon--danger";
      btnD.title = p.isPureProjection ? "Eliminar" : "Eliminar transacción";
      btnD.dataset.action = p.isPureProjection ? "delete-proj" : "delete-tx";
      btnD.dataset.id = p.id;
      btnD.innerHTML = ICON_TRASH;
      tdAct.appendChild(btnE);
      tdAct.appendChild(btnD);
    }
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  document.getElementById("proj-total-income").textContent = formatCurrency(totalIncome, appState.currency);
  document.getElementById("proj-total-expenses").textContent = formatCurrency(totalExpenses, appState.currency);
  updateSelectionButtons("proyeccion");
}

/* ===================================================================
   GUARDAR / ELIMINAR PROYECCIÓN MANUAL
   =================================================================== */
export async function saveProjection(data, editId) {
  const user = appState.currentUser;
  if (!user) return;
  const proj = {
    type: data.type,
    amount: data.amount,
    date: data.date,
    bank: data.bank,
    category: data.category || "",
    description: data.description ? toTitleCase(data.description) : "",
  };
  showLoading();
  try {
    if (editId) {
      await setDoc(doc(db, DB_COL(user.uid, "projections"), editId), proj, { merge: true });
      showToast("Proyección actualizada.", "success");
    } else {
      const newRef = doc(collection(db, DB_COL(user.uid, "projections")));
      await setDoc(newRef, { ...proj, id: newRef.id });
      showToast("Proyección añadida.", "success");
      if (proj.description && !appState.descriptions.includes(proj.description)) {
        openConfirmModal(
          "¿Guardar descripción?",
          `¿Deseas guardar "${proj.description}" para usarla en el futuro?`,
          () => saveNewDescriptionIfNeeded(proj.description),
        );
      }
    }
  } catch (err) {
    console.error("[Firestore] Guardar proyección:", err);
    showToast("Error al guardar la proyección.", "error");
  } finally {
    hideLoading();
  }
}

async function deleteProjection(id) {
  openConfirmModal(
    "Eliminar Proyección",
    "Esta proyección manual será eliminada. ¿Continuar?",
    async () => {
      showLoading();
      try {
        await deleteDoc(doc(db, DB_COL(appState.currentUser.uid, "projections"), id));
        showToast("Proyección eliminada.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar proyección:", err);
        showToast("Error al eliminar la proyección.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

/* ===================================================================
   SELECCIÓN MÚLTIPLE (dispatch desde main.js según pestaña activa)
   =================================================================== */
export function editSelectedProjection() {
  const chk = document.querySelector(".proj-checkbox:checked");
  if (!chk) return;
  const { id, type } = chk.dataset;
  if (type === "proj") {
    const proj = appState.projections.find((p) => p.id === id);
    if (proj) openCalcModal({ editItem: proj, onFinalize: saveProjection, titleNew: "Nueva Proyección", titleEdit: "Editar Proyección" });
  } else {
    const tx = appState.transactions.find((t) => t.id === id);
    if (tx) openCalcModal({ editItem: tx, onFinalize: saveTransaction });
  }
}

// Igual que el origen: el borrado en lote de Proyección solo alcanza a
// las proyecciones manuales (data-type="proj") — las filas que son
// transacciones reales se editan/eliminan una por una desde sus propios
// botones de fila, no por selección múltiple.
export async function deleteSelectedProjection() {
  const user = appState.currentUser;
  if (!user) return;
  const checked = [...document.querySelectorAll('.proj-checkbox[data-type="proj"]:checked')];
  if (!checked.length) return;
  openConfirmModal(
    "Eliminar seleccionados",
    `¿Eliminar ${checked.length} proyección(es)? Esta acción no se puede deshacer.`,
    async () => {
      showLoading();
      try {
        const batch = writeBatch(db);
        checked.forEach((chk) => batch.delete(doc(db, DB_COL(user.uid, "projections"), chk.dataset.id)));
        await batch.commit();
        showToast(`${checked.length} proyección(es) eliminada(s).`, "success");
      } catch (err) {
        console.error("[Firestore] Eliminar proyecciones seleccionadas:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initProyeccion() {
  document.getElementById("btn-add-projection").addEventListener("click", () => {
    openCalcModal({ onFinalize: saveProjection, titleNew: "Nueva Proyección", titleEdit: "Editar Proyección" });
  });

  document.getElementById("proj-filter-month").addEventListener("change", (e) => {
    appState.filterMonth = e.target.value;
    renderProyeccionTable();
  });
  document.getElementById("proj-show-next-month").addEventListener("change", renderProyeccionTable);

  document.getElementById("proj-select-all").addEventListener("change", (e) => {
    document.querySelectorAll(".proj-checkbox").forEach((c) => { c.checked = e.target.checked; });
    updateSelectionButtons("proyeccion");
  });
  document.getElementById("proj-tbody").addEventListener("change", (e) => {
    if (e.target.classList.contains("proj-checkbox")) updateSelectionButtons("proyeccion");
  });

  document.getElementById("proj-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "delete-proj") deleteProjection(id);
    if (action === "edit-proj") {
      const proj = appState.projections.find((p) => p.id === id);
      if (proj) openCalcModal({ editItem: proj, onFinalize: saveProjection, titleNew: "Nueva Proyección", titleEdit: "Editar Proyección" });
    }
    if (action === "delete-tx") deleteTransaction(id);
    if (action === "edit-tx") {
      const tx = appState.transactions.find((t) => t.id === id);
      if (tx) openCalcModal({ editItem: tx, onFinalize: saveTransaction });
    }
    if (action === "info") toggleInfoRow(btn, 8);
  });
}
