// Foresee 2.0 — presupuesto.js
// Límites de presupuesto por categoría con autoguardado al salir del
// campo. La actualización en vivo mientras se tipea reutiliza la MISMA
// función de cálculo de fila que el render inicial (el origen
// reimplementaba el cálculo ~85 líneas aparte — Mejora #14 del plan).
import { db, doc, setDoc, DB_PREF } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency } from "../lib/utils.js";
import { showToast } from "../lib/ui.js";
import { buildCatDisplay } from "../lib/category-modal.js";
import { sendBrowserNotification } from "../lib/notifications.js";

function computeCategorySpent(name) {
  const month = appState.filterMonth;
  return appState.transactions
    .filter((t) => {
      if (!t || typeof t.date !== "string") return false;
      if (month && t.date.substring(0, 7) !== month) return false;
      return t.type === "expense" && !t.transferLeg && t.category === name;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

function buildRemainCell(tdRemain, remain, budget, pct) {
  tdRemain.textContent = "";
  const balSpan = document.createElement("div");
  balSpan.className = remain > 0 ? "balance--positive" : remain < 0 ? "balance--negative" : "balance--zero";
  balSpan.textContent = formatCurrency(remain, appState.currency);
  tdRemain.appendChild(balSpan);
  if (budget > 0) {
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    const fill = document.createElement("div");
    fill.className = "progress-bar__fill" + (pct >= 100 ? " progress-bar__fill--danger" : pct >= 80 ? " progress-bar__fill--warning" : "");
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    tdRemain.appendChild(bar);
  }
}

function recomputeTotals() {
  let totBudget = 0, totSpent = 0, totRemain = 0;
  document.querySelectorAll(".budget-input").forEach((inp) => {
    const budget = parseFloat(inp.value) || 0;
    const spent = computeCategorySpent(inp.dataset.category);
    totBudget += budget;
    totSpent += spent;
    totRemain += budget - spent;
  });
  document.getElementById("budget-total-budgeted").textContent = formatCurrency(totBudget, appState.currency);
  document.getElementById("budget-total-spent").textContent = formatCurrency(totSpent, appState.currency);
  const totEl = document.getElementById("budget-total-remaining");
  totEl.textContent = formatCurrency(totRemain, appState.currency);
  totEl.className = totRemain > 0 ? "balance--positive" : totRemain < 0 ? "balance--negative" : "balance--zero";
}

export function renderBudgetTable() {
  const tbody = document.getElementById("budget-tbody");
  const empty = document.getElementById("budget-empty");
  if (!tbody) return;

  const cats = appState.categories.filter((c) => c.name !== "Sueldo" && c.name !== "Transferencia Interna");

  if (cats.length === 0) {
    tbody.textContent = "";
    empty.classList.remove("hidden");
    document.getElementById("budget-table").classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  document.getElementById("budget-table").classList.remove("hidden");

  tbody.textContent = "";
  const frag = document.createDocumentFragment();
  cats.forEach((cat) => {
    const name = cat.name;
    const budget = appState.categoryBudgets[name] || 0;
    const spent = computeCategorySpent(name);
    const remain = budget - spent;
    const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;

    const tr = document.createElement("tr");

    const tdCat = document.createElement("td");
    tdCat.appendChild(buildCatDisplay(name));
    tr.appendChild(tdCat);

    const tdBudget = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "0";
    input.value = budget > 0 ? budget : "";
    input.className = "budget-input";
    input.dataset.category = name;
    tdBudget.appendChild(input);
    tr.appendChild(tdBudget);

    const tdSpent = document.createElement("td");
    tdSpent.textContent = formatCurrency(spent, appState.currency);
    tdSpent.className = spent > 0 ? "amount--expense" : "";
    tr.appendChild(tdSpent);

    const tdRemain = document.createElement("td");
    buildRemainCell(tdRemain, remain, budget, pct);
    tr.appendChild(tdRemain);

    frag.appendChild(tr);
  });
  tbody.appendChild(frag);

  recomputeTotals();
}

async function saveBudgets(triggerInput) {
  const user = appState.currentUser;
  if (!user) return;
  const newBudgets = {};
  document.querySelectorAll(".budget-input").forEach((inp) => {
    const cat = inp.dataset.category;
    const val = parseFloat(inp.value);
    if (cat && !isNaN(val) && val > 0) newBudgets[cat] = val;
  });
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { categoryBudgets: newBudgets }, { merge: true });
    appState.categoryBudgets = newBudgets;
    if (triggerInput) {
      triggerInput.style.borderBottomColor = "var(--color-success)";
      setTimeout(() => { triggerInput.style.borderBottomColor = ""; }, 800);
    }
  } catch (err) {
    console.error("[Firestore] Guardar presupuestos:", err);
    showToast("Error al guardar presupuesto.", "error");
  }
}

/* ===================================================================
   ALERTAS DE PRESUPUESTO (80% / 90%) — se evalúan en cada render global,
   igual que el origen; dedup en appState.budgetAlertsShown por mes+categoría.
   =================================================================== */
export function checkBudgetLimits() {
  const currentMonth = appState.filterMonth;
  const byCategory = {};
  appState.transactions
    .filter((t) => t.type === "expense" && t.date && t.date.substring(0, 7) === currentMonth)
    .forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  for (const cat in appState.categoryBudgets) {
    const budget = appState.categoryBudgets[cat];
    const spent = byCategory[cat] || 0;
    if (!budget || !spent) continue;
    const pct = (spent / budget) * 100;
    const alertKey = `${currentMonth}-${cat}`;
    if (pct < 80) {
      delete appState.budgetAlertsShown[alertKey];
      continue;
    }
    if (appState.budgetAlertsShown[alertKey]) continue;
    if (pct >= 90) {
      const msg = `¡Alerta! Gastaste el ${pct.toFixed(0)}% del presupuesto de "${cat}".`;
      showToast(msg, "error");
      appState.budgetAlertsShown[alertKey] = true;
      const notifKey = `notif-budget-90-${cat}-${currentMonth}`;
      if (!localStorage.getItem(notifKey)) {
        sendBrowserNotification("Foresee — Presupuesto", msg);
        localStorage.setItem(notifKey, "1");
      }
    } else if (pct >= 80) {
      const msg = `Aviso: Gastaste el ${pct.toFixed(0)}% del presupuesto de "${cat}".`;
      showToast(msg, "warning");
      appState.budgetAlertsShown[alertKey] = true;
      const notifKey = `notif-budget-80-${cat}-${currentMonth}`;
      if (!localStorage.getItem(notifKey)) {
        sendBrowserNotification("Foresee — Presupuesto", msg);
        localStorage.setItem(notifKey, "1");
      }
    }
  }
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initPresupuesto() {
  const tbody = document.getElementById("budget-tbody");

  tbody.addEventListener("blur", (e) => {
    const input = e.target.closest(".budget-input");
    if (input) saveBudgets(input);
  }, true);

  tbody.addEventListener("input", (e) => {
    const input = e.target.closest(".budget-input");
    if (!input) return;
    const budget = parseFloat(input.value) || 0;
    const spent = computeCategorySpent(input.dataset.category);
    const remain = budget - spent;
    const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
    const tdRemain = input.closest("tr").cells[3];
    buildRemainCell(tdRemain, remain, budget, pct);
    recomputeTotals();
  });
}
