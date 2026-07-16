// Foresee 2.0 — registros.js
// Tabla de Registros: saldo corrido, formulario unificado (calculadora),
// categoría editable inline, descripción editable inline, transferencias,
// selección múltiple, badge de posibles duplicados, fila de detalle
// (info) — misma funcionalidad que el origen.
import { db, doc, collection, addDoc, updateDoc, deleteDoc, writeBatch, DB_COL } from "../firebase.js";
import { appState, saveNewDescriptionIfNeeded } from "../state.js";
import { formatCurrency, toTitleCase, getCurrentMonthStr } from "../lib/utils.js";
import { computeRunningBalanceMap, findSuspectDuplicateIds } from "../lib/balances.js";
import {
  fillSelect,
  showLoading,
  hideLoading,
  showToast,
  markInvalid,
  openModal,
  closeModal,
  openConfirmModal,
  guardClose,
  toggleInfoRow,
  updateSelectionButtons,
} from "../lib/ui.js";
import { openCalcModal } from "../lib/calc-modal.js";
import { openCategoryModal, buildCatDisplay } from "../lib/category-modal.js";
import { ICON_PENCIL, ICON_TRASH } from "../lib/icons.js";

/* ===================================================================
   FILTROS
   =================================================================== */
function getFilteredTransactions() {
  const { filterMonth, filterBank, filterCategory, transactions } = appState;
  return transactions.filter((t) => {
    if (!t || typeof t.date !== "string") return false;
    if (filterMonth && t.date.substring(0, 7) !== filterMonth) return false;
    if (filterBank && t.bank !== filterBank) return false;
    if (filterCategory && t.category !== filterCategory) return false;
    return true;
  });
}

function updateFilterDropdowns() {
  const monthSel = document.getElementById("reg-filter-month");
  if (!monthSel) return;
  const months = new Set([getCurrentMonthStr()]);
  appState.transactions.forEach((t) => {
    if (t.date && t.date.length >= 7) months.add(t.date.substring(0, 7));
  });
  const sorted = [...months].sort((a, b) => b.localeCompare(a));
  fillSelect(monthSel, sorted, {
    value: (m) => m,
    label: (m) => {
      const [y, mo] = m.split("-");
      const label = new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });
      return label.charAt(0).toUpperCase() + label.slice(1);
    },
    keepSelection: false,
  });
  monthSel.value = appState.filterMonth || getCurrentMonthStr();

  fillSelect(document.getElementById("reg-filter-bank"), appState.banks, { placeholder: "Todos los bancos" });
  fillSelect(document.getElementById("reg-filter-cat"), appState.categories, {
    value: (c) => c.name,
    label: (c) => c.name,
    placeholder: "Todas las categorías",
  });
}

function updateDescriptionDatalist() {
  const dl = document.getElementById("description-list");
  if (!dl) return;
  dl.textContent = "";
  appState.descriptions.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d;
    dl.appendChild(opt);
  });
}

/* ===================================================================
   RENDER TABLA
   =================================================================== */
export function renderTransactionsTable() {
  updateFilterDropdowns();
  updateDescriptionDatalist();

  const tbody = document.getElementById("reg-tbody");
  const empty = document.getElementById("reg-empty");
  const tfoot = document.getElementById("reg-tfoot");
  if (!tbody) return;

  const filtered = getFilteredTransactions();
  const { balMap, effectiveOrder, internalPairMap } = computeRunningBalanceMap(
    appState.transactions,
    appState.openingBalance,
  );
  const suspectDuplicateIds = findSuspectDuplicateIds(appState.transactions);

  filtered.sort((a, b) => {
    const dc = (b.date || "").localeCompare(a.date || "");
    if (dc !== 0) return dc;
    return (effectiveOrder[b.id] ?? 0) - (effectiveOrder[a.id] ?? 0);
  });

  let totalIncome = 0, totalExpenses = 0;
  tbody.textContent = "";

  if (filtered.length === 0) {
    if (empty) empty.classList.remove("hidden");
    if (tfoot) tfoot.classList.add("hidden");
    document.getElementById("reg-select-all").checked = false;
    return;
  }
  if (empty) empty.classList.add("hidden");
  if (tfoot) tfoot.classList.remove("hidden");

  const frag = document.createDocumentFragment();
  filtered.forEach((tx) => {
    const isIncome = tx.type === "income";
    const isTransfer = tx.type === "transfer";
    const isTransferLeg = isIncome && !!tx.transferLeg;
    if (isIncome && !tx.transferLeg) totalIncome += tx.amount || 0;
    if (!isIncome && !isTransfer) totalExpenses += tx.amount || 0;

    const internalRole = internalPairMap.get(tx.id);

    let rowClass, amtClass, sign;
    if (isTransferLeg) {
      rowClass = "row--transfer-in"; amtClass = "amount--transfer-in"; sign = "+";
    } else if (isTransfer && internalRole === "send") {
      rowClass = "row--transfer"; amtClass = "amount--transfer"; sign = "−";
    } else if (isTransfer && internalRole === "recv") {
      rowClass = "row--transfer-in"; amtClass = "amount--transfer-in"; sign = "+";
    } else if (isTransfer) {
      if (tx.transferDirection === "in") {
        rowClass = "row--transfer-ext-in"; amtClass = "amount--transfer-ext-in"; sign = "+";
      } else if (tx.transferDirection === "out") {
        rowClass = "row--transfer-ext-out"; amtClass = "amount--transfer-ext-out"; sign = "−";
      } else {
        rowClass = "row--transfer"; amtClass = "amount--transfer"; sign = "−";
      }
    } else if (isIncome) {
      rowClass = "row--income"; amtClass = "amount--income"; sign = "+";
    } else {
      rowClass = "row--expense"; amtClass = "amount--expense"; sign = "−";
    }
    const day = tx.date ? parseInt(tx.date.split("-")[2], 10) : "—";

    const tr = document.createElement("tr");
    tr.className = rowClass;
    tr.dataset.id = tx.id;

    const tdChk = document.createElement("td");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.className = "tx-select tx-checkbox";
    chk.dataset.id = tx.id;
    chk.setAttribute("aria-label", "Seleccionar registro");
    tdChk.appendChild(chk);
    tr.appendChild(tdChk);

    const tdDate = document.createElement("td");
    tdDate.textContent = day;
    tr.appendChild(tdDate);

    const tdDesc = document.createElement("td");
    tdDesc.className = "td-desc-editable";
    tdDesc.dataset.action = "edit-desc";
    tdDesc.dataset.id = tx.id;
    tdDesc.dataset.desc = tx.description || "";
    tdDesc.textContent = tx.description || "—";
    if (tx.description) tdDesc.dataset.tip = tx.description;
    if (suspectDuplicateIds.has(tx.id)) {
      const dupWarn = document.createElement("span");
      dupWarn.className = "dup-warn-badge";
      dupWarn.title = "Posible duplicado: misma fecha, mismo monto y descripción similar a otra transacción. Revisa antes de borrar una.";
      dupWarn.textContent = " ⚠️";
      tdDesc.appendChild(dupWarn);
    }
    tr.appendChild(tdDesc);

    const tdCat = document.createElement("td");
    tdCat.className = "td-cat-editable";
    tdCat.dataset.action = "cat";
    tdCat.dataset.id = tx.id;
    tdCat.title = "Cambiar categoría";
    tdCat.appendChild(buildCatDisplay(tx.category || "", tx.transferLeg ? "transfer" : tx.type, !!tx.importedFrom));
    tr.appendChild(tdCat);

    const tdBank = document.createElement("td");
    const bankSpan = document.createElement("span");
    bankSpan.className = "cell-bank-text";
    bankSpan.textContent = tx.bank || "—";
    tdBank.appendChild(bankSpan);
    const infoBtn = document.createElement("button");
    infoBtn.className = "btn-row-info";
    infoBtn.dataset.action = "info";
    infoBtn.dataset.desc = tx.description || "";
    infoBtn.dataset.bank = tx.bank || "";
    infoBtn.setAttribute("aria-label", "Ver detalle");
    infoBtn.textContent = "i";
    tdBank.appendChild(infoBtn);
    tr.appendChild(tdBank);

    const tdAmt = document.createElement("td");
    tdAmt.className = amtClass;
    tdAmt.textContent = `${sign} ${formatCurrency(tx.amount, appState.currency)}`;
    tr.appendChild(tdAmt);

    const saldo = balMap[tx.id] ?? 0;
    const tdSaldo = document.createElement("td");
    tdSaldo.className = saldo >= 0 ? "balance--positive" : "balance--negative";
    tdSaldo.textContent = formatCurrency(saldo, appState.currency);
    tr.appendChild(tdSaldo);

    const tdAct = document.createElement("td");
    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-icon";
    btnEdit.dataset.action = "edit";
    btnEdit.dataset.id = tx.id;
    btnEdit.title = "Editar";
    btnEdit.innerHTML = ICON_PENCIL;
    const btnDel = document.createElement("button");
    btnDel.className = "btn-icon btn-icon--danger";
    btnDel.dataset.action = "delete";
    btnDel.dataset.id = tx.id;
    btnDel.title = "Eliminar";
    btnDel.innerHTML = ICON_TRASH;
    tdAct.appendChild(btnEdit);
    tdAct.appendChild(btnDel);
    tr.appendChild(tdAct);

    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  document.getElementById("reg-total-income").textContent = "+ " + formatCurrency(totalIncome, appState.currency);
  document.getElementById("reg-total-expenses").textContent = "− " + formatCurrency(totalExpenses, appState.currency);
  updateSelectionButtons("registros");
}

/* ===================================================================
   GUARDAR / EDITAR / ELIMINAR
   =================================================================== */
export async function saveTransaction(data, editId) {
  const user = appState.currentUser;
  if (!user) return;
  const tx = {
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
      await updateDoc(doc(db, DB_COL(user.uid, "transactions"), editId), tx);
      showToast("Transacción actualizada.", "success");
    } else {
      tx.createdAt = new Date().toISOString();
      await addDoc(collection(db, DB_COL(user.uid, "transactions")), tx);
      if (tx.description && !appState.descriptions.includes(tx.description)) {
        openConfirmModal(
          "¿Guardar descripción?",
          `¿Deseas guardar "${tx.description}" para usarla en el futuro?`,
          () => saveNewDescriptionIfNeeded(tx.description),
        );
      }
    }
  } catch (err) {
    console.error("[Firestore] Guardar transacción:", err);
    showToast("Error al guardar la transacción.", "error");
  } finally {
    hideLoading();
  }
}

export async function deleteTransaction(txId) {
  const user = appState.currentUser;
  if (!user) return;
  openConfirmModal(
    "Eliminar registro",
    "¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.",
    async () => {
      showLoading();
      try {
        await deleteDoc(doc(db, DB_COL(user.uid, "transactions"), txId));
        showToast("Registro eliminado.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar transacción:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

export async function deleteSelectedItems() {
  const user = appState.currentUser;
  if (!user) return;
  const checked = [...document.querySelectorAll(".tx-checkbox:checked")];
  if (!checked.length) return;

  openConfirmModal(
    "Eliminar seleccionados",
    `¿Eliminar ${checked.length} registro(s)? Esta acción no se puede deshacer.`,
    async () => {
      showLoading();
      try {
        const batch = writeBatch(db);
        checked.forEach((chk) => batch.delete(doc(db, DB_COL(user.uid, "transactions"), chk.dataset.id)));
        await batch.commit();
        showToast(`${checked.length} registro(s) eliminado(s).`, "success");
      } catch (err) {
        console.error("[Firestore] Eliminar lote:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

export function editSelectedItem() {
  const chk = document.querySelector(".tx-checkbox:checked");
  if (!chk) return;
  const tx = appState.transactions.find((t) => t.id === chk.dataset.id);
  if (!tx) return;
  openCalcModal({ editItem: tx, onFinalize: saveTransaction });
}

function openCatForTxEdit(txId) {
  openCategoryModal((categoryName) => updateTxCategory(txId, categoryName));
}

async function updateTxCategory(txId, categoryName) {
  const user = appState.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, DB_COL(user.uid, "transactions"), txId), { category: categoryName });
    showToast("Categoría actualizada.", "success");
  } catch (e) {
    console.error("Error al actualizar categoría:", e);
    showToast("No se pudo actualizar la categoría.", "error");
  }
}

async function updateTxDescription(txId, description) {
  const user = appState.currentUser;
  if (!user) return;
  try {
    await updateDoc(doc(db, DB_COL(user.uid, "transactions"), txId), { description });
    showToast("Descripción actualizada.", "success");
  } catch (e) {
    console.error("Error al actualizar descripción:", e);
    showToast("No se pudo actualizar la descripción.", "error");
  }
}

function startDescEdit(tdEl, txId, currentDesc) {
  if (tdEl.querySelector(".td-desc-input")) return;
  const tip = document.getElementById("foresee-tip");
  if (tip) tip.style.display = "none";
  const originalText = tdEl.textContent;
  tdEl.textContent = "";
  const input = document.createElement("input");
  input.type = "text";
  input.value = currentDesc;
  input.className = "td-desc-input";
  tdEl.appendChild(input);
  input.focus();
  input.select();
  let cancelled = false;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") {
      cancelled = true;
      tdEl.textContent = originalText;
      if (currentDesc) tdEl.dataset.tip = currentDesc;
      else delete tdEl.dataset.tip;
    }
  });
  input.addEventListener("blur", async () => {
    if (cancelled) return;
    const newDesc = input.value.trim();
    tdEl.textContent = newDesc || "—";
    tdEl.dataset.desc = newDesc;
    if (newDesc) tdEl.dataset.tip = newDesc;
    else delete tdEl.dataset.tip;
    if (newDesc !== currentDesc) await updateTxDescription(txId, newDesc);
  });
}

/* ===================================================================
   TRANSFERENCIA
   =================================================================== */
function openTransferModal() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("tr-date").value = today;
  document.getElementById("tr-amount").value = "";
  fillSelect(document.getElementById("tr-from"), appState.banks, { placeholder: "— Origen —" });
  fillSelect(document.getElementById("tr-to"), appState.banks, { placeholder: "— Destino —" });
  document.getElementById("tr-from").value = "";
  document.getElementById("tr-to").value = "";
  openModal("transfer-modal");
}

function isTransferDirty() {
  return !!(
    document.getElementById("tr-from").value ||
    document.getElementById("tr-to").value ||
    parseFloat(document.getElementById("tr-amount").value) > 0
  );
}

function closeTransferModalRaw() {
  closeModal("transfer-modal");
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const user = appState.currentUser;
  if (!user) return;

  const date = document.getElementById("tr-date").value;
  const from = document.getElementById("tr-from").value.trim();
  const to = document.getElementById("tr-to").value.trim();
  const amount = parseFloat(document.getElementById("tr-amount").value);

  const fields = [
    [document.getElementById("tr-date"), !date],
    [document.getElementById("tr-from"), !from],
    [document.getElementById("tr-to"), !to],
    [document.getElementById("tr-amount"), isNaN(amount) || amount <= 0],
  ];
  const invalid = fields.filter(([, bad]) => bad);
  if (invalid.length) {
    invalid.forEach(([el]) => markInvalid(el));
    showToast("Completa todos los campos correctamente.", "warning");
    return;
  }
  if (from === to) {
    showToast("Las cuentas de origen y destino deben ser diferentes.", "warning");
    return;
  }

  showLoading();
  closeModal("transfer-modal");
  try {
    const colRef = collection(db, DB_COL(user.uid, "transactions"));
    await addDoc(colRef, {
      type: "transfer", date, amount, createdAt: new Date().toISOString(),
      bank: from, description: `Transferencia a ${to}`,
    });
    await addDoc(colRef, {
      type: "income", transferLeg: true, date, amount, createdAt: new Date().toISOString(),
      bank: to, description: `Transferencia desde ${from}`,
    });
    showToast("Transferencia registrada.", "success");
  } catch (err) {
    console.error("[Firestore] Transferencia:", err);
    showToast("Error al registrar la transferencia.", "error");
  } finally {
    hideLoading();
  }
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initRegistros() {
  document.getElementById("btn-add-transaction").addEventListener("click", () => {
    openCalcModal({ onFinalize: saveTransaction });
  });
  document.getElementById("btn-transfer").addEventListener("click", openTransferModal);

  document.getElementById("reg-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "edit") {
      const tx = appState.transactions.find((t) => t.id === btn.dataset.id);
      if (tx) openCalcModal({ editItem: tx, onFinalize: saveTransaction });
    }
    if (btn.dataset.action === "delete") deleteTransaction(btn.dataset.id);
    if (btn.dataset.action === "cat") openCatForTxEdit(btn.dataset.id);
    if (btn.dataset.action === "edit-desc") startDescEdit(btn, btn.dataset.id, btn.dataset.desc);
    if (btn.dataset.action === "info") toggleInfoRow(btn, 8);
  });

  document.getElementById("reg-select-all").addEventListener("change", (e) => {
    document.querySelectorAll(".tx-checkbox").forEach((c) => { c.checked = e.target.checked; });
    updateSelectionButtons("registros");
  });
  document.getElementById("reg-tbody").addEventListener("change", (e) => {
    if (e.target.classList.contains("tx-checkbox")) updateSelectionButtons("registros");
  });

  document.getElementById("reg-filter-month").addEventListener("change", (e) => {
    appState.filterMonth = e.target.value;
    renderTransactionsTable();
  });
  document.getElementById("reg-filter-bank").addEventListener("change", (e) => {
    appState.filterBank = e.target.value;
    renderTransactionsTable();
  });
  document.getElementById("reg-filter-cat").addEventListener("change", (e) => {
    appState.filterCategory = e.target.value;
    renderTransactionsTable();
  });
  document.querySelectorAll("#reg-filter-group .btn-filter-toggle").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest(".filter-group").classList.toggle("filter-open"));
  });

  document.getElementById("transfer-close-btn").addEventListener("click", closeTransferModalRaw);
  document.getElementById("transfer-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) guardClose(isTransferDirty, closeTransferModalRaw);
  });
  document.getElementById("transfer-form").addEventListener("submit", handleTransferSubmit);
}
