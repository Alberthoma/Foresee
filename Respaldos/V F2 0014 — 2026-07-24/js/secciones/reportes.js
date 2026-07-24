// Foresee 2.0 — reportes.js
// 7 bloques de reportes con Chart.js: donut de categorías (con detalle
// al click), flujo de caja 6 meses, tasa de ahorro, evolución del saldo,
// recurrentes vs variables, gasto por día del mes, comparativa vs mes
// anterior, resumen anual. showCatDetail se define UNA vez a nivel de
// módulo (el origen la redefinía dentro de cada renderReportes()).
import { db, doc, getDoc, APP_ID } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency, getCurrentMonthStr } from "../lib/utils.js";
import { chartColors } from "../lib/ui.js";

const REP_PALETTE = [
  "#4f8fff", "#22c97a", "#f05252", "#f59e0b", "#a78bfa", "#06b6d4",
  "#7c5cfc", "#ec4899", "#14b8a6", "#f97316", "#84cc16", "#64748b",
];

let expensesChartInstance = null;
let cashFlowChartInstance = null;
let balanceChartInstance = null;
let daysChartInstance = null;
let annualChartInstance = null;

function populateRepFilterMonth() {
  const sel = document.getElementById("rep-filter-month");
  const months = [...new Set(appState.transactions.map((t) => (t.date ? t.date.substring(0, 7) : null)).filter(Boolean))]
    .sort()
    .reverse();
  const current = sel.value || appState.filterMonth;
  sel.textContent = "";
  if (months.length === 0) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Sin datos";
    sel.appendChild(o);
    return;
  }
  months.forEach((m) => {
    const o = document.createElement("option");
    o.value = m;
    const [y, mo] = m.split("-");
    o.textContent = new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });
    if (m === current) o.selected = true;
    sel.appendChild(o);
  });
}

// Único punto de verdad del mes activo en Reportes — cualquier valor que
// no tenga forma "YYYY-MM" (select vacío, appState.filterMonth sin
// inicializar, etc.) cae al mes actual real en vez de propagarse a los
// 6 gráficos y romper los cálculos de fecha (ver informe V F2 0014).
function currentRepMonth() {
  const value = document.getElementById("rep-filter-month").value || appState.filterMonth;
  return /^\d{4}-\d{2}$/.test(value) ? value : getCurrentMonthStr();
}

// Definida una sola vez — recalcula todo a partir del mes actual del
// filtro en vez de capturar variables del render que la disparó.
function showCatDetail(catName) {
  const month = currentRepMonth();
  const expByCategory = appState.transactions
    .filter((t) => t.type === "expense" && t.date && t.date.substring(0, 7) === month)
    .reduce((acc, t) => {
      const cat = t.category || "Sin categoría";
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {});

  const detail = document.getElementById("rep-cat-detail");
  const legend = document.getElementById("rep-donut-legend");
  const items = legend.querySelectorAll(".rep-legend-item");
  const clickedItem = [...items].find((el) => el.querySelector(".rep-legend-name").textContent === catName);
  const wasActive = clickedItem && clickedItem.classList.contains("rep-legend-item--active");

  items.forEach((el) => el.classList.remove("rep-legend-item--active"));
  if (wasActive) {
    detail.classList.add("hidden");
    return;
  }
  if (clickedItem) clickedItem.classList.add("rep-legend-item--active");

  const txs = appState.transactions
    .filter((t) => t.type === "expense" && t.date && t.date.substring(0, 7) === month && (t.category || "Sin categoría") === catName)
    .sort((a, b) => b.date.localeCompare(a.date));

  document.getElementById("rep-cat-detail-name").textContent = catName + " — " + formatCurrency(expByCategory[catName] || 0, appState.currency);

  const list = document.getElementById("rep-cat-detail-list");
  list.textContent = "";
  if (txs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Sin transacciones.";
    list.appendChild(empty);
  } else {
    txs.forEach((tx) => {
      const row = document.createElement("div");
      row.className = "rep-cat-detail__row";
      const dateEl = document.createElement("span");
      dateEl.className = "rep-cat-detail__date";
      const [yr, mo, dy] = (tx.date || "").split("-");
      dateEl.textContent = dy && mo && yr ? `${dy}/${mo}/${yr}` : "—";
      const descEl = document.createElement("span");
      descEl.className = "rep-cat-detail__desc";
      descEl.textContent = tx.description || "—";
      const amtEl = document.createElement("span");
      amtEl.className = "rep-cat-detail__amount";
      amtEl.textContent = formatCurrency(tx.amount, appState.currency);
      row.appendChild(dateEl);
      row.appendChild(descEl);
      row.appendChild(amtEl);
      list.appendChild(row);
    });
  }
  detail.classList.remove("hidden");
}

async function fetchMonthArchive(month) {
  const user = appState.currentUser;
  if (!user) return null;
  try {
    const ref = doc(db, `artifacts/${APP_ID}/users/${user.uid}/user_data/archive_${month}`);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("[Firestore] archive fetch:", err);
    return null;
  }
}

export function renderReportes() {
  populateRepFilterMonth();
  const month = currentRepMonth();
  document.getElementById("rep-cat-detail").classList.add("hidden");

  if (typeof Chart === "undefined") {
    console.warn("Chart.js no está disponible. Saltando renderizado de gráficos.");
    return;
  }

  /* --- Donut: gastos por categoría --- */
  const expByCategory = appState.transactions
    .filter((t) => t.type === "expense" && t.date && t.date.substring(0, 7) === month)
    .reduce((acc, t) => {
      const cat = t.category || "Sin categoría";
      acc[cat] = (acc[cat] || 0) + t.amount;
      return acc;
    }, {});
  const catLabels = Object.keys(expByCategory).sort((a, b) => expByCategory[b] - expByCategory[a]);
  const catValues = catLabels.map((k) => expByCategory[k]);
  const totalExpenses = catValues.reduce((s, v) => s + v, 0);
  const colors = catLabels.map((_, i) => REP_PALETTE[i % REP_PALETTE.length]);

  document.getElementById("rep-empty").classList.toggle("hidden", totalExpenses > 0);

  if (expensesChartInstance) { expensesChartInstance.destroy(); expensesChartInstance = null; }
  const donutCtx = document.getElementById("rep-donut-canvas").getContext("2d");
  expensesChartInstance = new Chart(donutCtx, {
    type: "doughnut",
    data: { labels: catLabels, datasets: [{ data: catValues, backgroundColor: colors, borderWidth: 2, borderColor: chartColors().border }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (evt, elements) => { if (elements.length) showCatDetail(catLabels[elements[0].index]); },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed, appState.currency)}` } } },
      cutout: "65%",
    },
  });

  const legend = document.getElementById("rep-donut-legend");
  legend.textContent = "";
  catLabels.forEach((name, i) => {
    const item = document.createElement("div");
    item.className = "rep-legend-item";
    item.addEventListener("click", () => showCatDetail(name));
    const dot = document.createElement("span");
    dot.className = "rep-legend-dot";
    dot.style.setProperty("background-color", colors[i]);
    const nameEl = document.createElement("span");
    nameEl.className = "rep-legend-name";
    nameEl.textContent = name;
    const pct = totalExpenses > 0 ? ((catValues[i] / totalExpenses) * 100).toFixed(1) : "0.0";
    const valEl = document.createElement("span");
    valEl.className = "rep-legend-val";
    valEl.textContent = pct + "%";
    item.appendChild(dot);
    item.appendChild(nameEl);
    item.appendChild(valEl);
    legend.appendChild(item);
  });
  document.getElementById("rep-cat-detail-close").onclick = () => {
    document.getElementById("rep-cat-detail").classList.add("hidden");
    legend.querySelectorAll(".rep-legend-item").forEach((el) => el.classList.remove("rep-legend-item--active"));
  };

  /* --- Bar: flujo de caja últimos 6 meses --- */
  const [cy, cm] = month.split("-").map(Number);
  const months6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cy, cm - 1 - i, 1);
    months6.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const incomeData = months6.map((m) => round2(appState.transactions.filter((t) => t.type === "income" && t.date && t.date.substring(0, 7) === m).reduce((s, t) => s + t.amount, 0)));
  const expenseData = months6.map((m) => round2(appState.transactions.filter((t) => t.type === "expense" && t.date && t.date.substring(0, 7) === m).reduce((s, t) => s + t.amount, 0)));
  const barLabels = months6.map((m) => { const [y, mo] = m.split("-"); return new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "short" }); });

  if (cashFlowChartInstance) { cashFlowChartInstance.destroy(); cashFlowChartInstance = null; }
  const barCtx = document.getElementById("rep-bar-canvas").getContext("2d");
  const colorsNow = chartColors();
  cashFlowChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: [
        { label: "Ingresos", data: incomeData, backgroundColor: "rgba(34,201,122,0.7)", borderColor: "#22c97a", borderWidth: 1, borderRadius: 4 },
        { label: "Gastos", data: expenseData, backgroundColor: "rgba(240,82,82,0.7)", borderColor: "#f05252", borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colorsNow.tick, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y, appState.currency)}` } },
      },
      scales: {
        x: { ticks: { color: colorsNow.tick }, grid: { color: colorsNow.grid } },
        y: { ticks: { color: colorsNow.tick, callback: (v) => formatCurrency(v, appState.currency) }, grid: { color: colorsNow.grid } },
      },
    },
  });

  renderSavingsRate(month);
  renderBalanceChart(month);
  renderRecurringStats(month);
  renderDaysChart(month);
  renderCompareCard(month).catch((err) => console.error("[Rep] comparativa:", err));
  renderAnnualChart(month).catch((err) => console.error("[Rep] anual:", err));
}

function round2(x) { return Math.round(x * 100) / 100; }

function renderSavingsRate(month) {
  const container = document.getElementById("rep-savings-stats");
  container.textContent = "";
  const income = round2(appState.transactions.filter((t) => t.type === "income" && t.date?.substring(0, 7) === month).reduce((s, t) => s + t.amount, 0));
  const expenses = round2(appState.transactions.filter((t) => t.type === "expense" && t.date?.substring(0, 7) === month).reduce((s, t) => s + t.amount, 0));
  const saved = round2(income - expenses);
  const rate = income > 0 ? Math.round((saved / income) * 100) : null;

  const stats = [
    { label: "Ingresos del mes", value: formatCurrency(income, appState.currency), cls: "rep-stat-box__value--income" },
    { label: "Gastos del mes", value: formatCurrency(expenses, appState.currency), cls: "rep-stat-box__value--expense" },
    { label: "Ahorro neto", value: formatCurrency(saved, appState.currency), cls: saved > 0 ? "rep-stat-box__value--income" : saved < 0 ? "rep-stat-box__value--expense" : "rep-stat-box__value--neutral" },
    { label: "Tasa de ahorro", value: rate === null ? "—" : `${rate}%`, cls: (rate === null ? "rep-stat-box__value--neutral" : rate > 0 ? "rep-stat-box__value--income" : "rep-stat-box__value--expense") + " rep-stat-box__value--big" },
  ];
  stats.forEach(({ label, value, cls }) => {
    const box = document.createElement("div");
    box.className = "rep-stat-box";
    const lbl = document.createElement("div");
    lbl.className = "rep-stat-box__label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "rep-stat-box__value " + cls;
    val.textContent = value;
    box.appendChild(lbl);
    box.appendChild(val);
    container.appendChild(box);
  });
}

function renderBalanceChart(month) {
  const canvas = document.getElementById("rep-balance-canvas");
  const wrap = document.getElementById("rep-balance-wrap");
  const emptyEl = document.getElementById("rep-balance-empty");

  const txMonth = appState.transactions.filter((t) => t.date && t.date.substring(0, 7) === month).sort((a, b) => a.date.localeCompare(b.date));
  if (txMonth.length === 0) {
    if (balanceChartInstance) { balanceChartInstance.destroy(); balanceChartInstance = null; }
    wrap.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  emptyEl.classList.add("hidden");

  const [cy, cm] = month.split("-").map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const today = new Date();
  const isCurrentMonth = month === today.toISOString().slice(0, 7);
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const dailyDelta = {};
  txMonth.forEach((t) => {
    const day = parseInt(t.date.substring(8, 10), 10);
    dailyDelta[day] = (dailyDelta[day] || 0) + (t.type === "income" ? t.amount : -t.amount);
  });

  const labels = [], data = [];
  let balance = appState.openingBalance;
  for (let d = 1; d <= lastDay; d++) {
    if (dailyDelta[d]) balance = round2(balance + dailyDelta[d]);
    labels.push(d);
    data.push(balance);
  }

  if (balanceChartInstance) { balanceChartInstance.destroy(); balanceChartInstance = null; }
  const colorsNow = chartColors();
  balanceChartInstance = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{ label: "Saldo", data, borderColor: "#4f8fff", backgroundColor: "rgba(79,143,255,0.1)", borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y, appState.currency)}` } } },
      scales: {
        x: { ticks: { color: colorsNow.tick, maxTicksLimit: 12 }, grid: { color: colorsNow.grid } },
        y: { ticks: { color: colorsNow.tick, callback: (v) => formatCurrency(v, appState.currency) }, grid: { color: colorsNow.grid } },
      },
    },
  });
}

function renderRecurringStats(month) {
  const container = document.getElementById("rep-recurring-stats");
  container.textContent = "";
  const recurTotal = round2(appState.recurringExpenses.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0));
  const totalExpenses = round2(appState.transactions.filter((t) => t.type === "expense" && t.date?.substring(0, 7) === month).reduce((s, t) => s + t.amount, 0));
  const variableTotal = round2(Math.max(0, totalExpenses - recurTotal));

  const stats = [
    { label: "Comprometido (recurrentes)", value: formatCurrency(recurTotal, appState.currency), cls: "rep-stat-box__value--expense" },
    { label: "Variable (resto del mes)", value: formatCurrency(variableTotal, appState.currency), cls: "" },
    { label: "Total gastos del mes", value: formatCurrency(totalExpenses, appState.currency), cls: "rep-stat-box__value--neutral" },
  ];
  stats.forEach(({ label, value, cls }) => {
    const box = document.createElement("div");
    box.className = "rep-stat-box";
    const lbl = document.createElement("div");
    lbl.className = "rep-stat-box__label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "rep-stat-box__value" + (cls ? " " + cls : "");
    val.textContent = value;
    box.appendChild(lbl);
    box.appendChild(val);
    container.appendChild(box);
  });
}

function renderDaysChart(month) {
  const canvas = document.getElementById("rep-days-canvas");
  const [cy, cm] = month.split("-").map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const dayTotals = new Array(daysInMonth).fill(0);

  appState.transactions
    .filter((t) => t.type === "expense" && t.date?.substring(0, 7) === month)
    .forEach((t) => {
      const day = parseInt(t.date.substring(8, 10), 10);
      if (day >= 1 && day <= daysInMonth) dayTotals[day - 1] = round2(dayTotals[day - 1] + t.amount);
    });

  const maxVal = Math.max(...dayTotals);
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const bgColors = dayTotals.map((v) => (v === maxVal && v > 0 ? "rgba(240,82,82,0.8)" : "rgba(79,143,255,0.5)"));
  const borderColors = dayTotals.map((v) => (v === maxVal && v > 0 ? "#f05252" : "#4f8fff"));

  if (daysChartInstance) { daysChartInstance.destroy(); daysChartInstance = null; }
  const colorsNow = chartColors();
  daysChartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Gasto", data: dayTotals, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1, borderRadius: 3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y, appState.currency)}` } } },
      scales: {
        x: { ticks: { color: colorsNow.tick, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: colorsNow.tick, callback: (v) => formatCurrency(v, appState.currency) }, grid: { color: colorsNow.grid } },
      },
    },
  });
}

async function renderCompareCard(month) {
  const body = document.getElementById("rep-compare-body");
  body.textContent = "";
  const loadEl = document.createElement("p");
  loadEl.className = "rep-async-msg";
  loadEl.textContent = "Cargando datos del mes anterior…";
  body.appendChild(loadEl);

  const [cy, cm] = month.split("-").map(Number);
  const prevDate = new Date(cy, cm - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const archive = await fetchMonthArchive(prevMonth);
  body.textContent = "";

  let prevTransactions;
  if (archive) {
    prevTransactions = archive.transactions || [];
  } else {
    prevTransactions = appState.transactions.filter((t) => t.date?.substring(0, 7) === prevMonth);
    if (prevTransactions.length === 0) {
      const msg = document.createElement("p");
      msg.className = "rep-async-msg";
      msg.textContent = "Aún no hay datos del mes anterior. Vuelve el próximo mes.";
      body.appendChild(msg);
      return;
    }
  }

  const currentByCat = {};
  appState.transactions.filter((t) => t.type === "expense" && t.date?.substring(0, 7) === month).forEach((t) => {
    const cat = t.category || "Sin categoría";
    currentByCat[cat] = (currentByCat[cat] || 0) + t.amount;
  });
  const prevByCat = {};
  prevTransactions.filter((t) => t.type === "expense").forEach((t) => {
    const cat = t.category || "Sin categoría";
    prevByCat[cat] = (prevByCat[cat] || 0) + t.amount;
  });

  const allCats = [...new Set([...Object.keys(currentByCat), ...Object.keys(prevByCat)])].sort((a, b) => (currentByCat[b] || 0) - (currentByCat[a] || 0));
  if (allCats.length === 0) {
    const msg = document.createElement("p");
    msg.className = "rep-async-msg";
    msg.textContent = "Sin datos para comparar en este período.";
    body.appendChild(msg);
    return;
  }

  const [prevY, prevM] = prevMonth.split("-");
  const prevLabel = new Date(+prevY, +prevM - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });
  const currLabel = new Date(cy, cm - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });

  const list = document.createElement("div");
  list.className = "rep-compare-list";
  const header = document.createElement("div");
  header.className = "rep-compare-header";
  ["Categoría", prevLabel, currLabel].forEach((txt) => {
    const s = document.createElement("span");
    s.textContent = txt;
    header.appendChild(s);
  });
  list.appendChild(header);

  allCats.forEach((cat) => {
    const curr = currentByCat[cat] || 0;
    const prev = prevByCat[cat] || 0;
    const delta = round2(curr - prev);

    const row = document.createElement("div");
    row.className = "rep-compare-row";
    const catEl = document.createElement("span");
    catEl.className = "rep-compare-cat";
    catEl.textContent = cat;
    const prevEl = document.createElement("span");
    prevEl.className = "rep-compare-prev";
    prevEl.textContent = formatCurrency(prev, appState.currency);
    const currCol = document.createElement("span");
    currCol.className = "rep-compare-curr";
    const amtEl = document.createElement("span");
    amtEl.className = "rep-compare-curr-amt";
    amtEl.textContent = formatCurrency(curr, appState.currency);
    const deltaEl = document.createElement("span");
    const sign = delta > 0 ? "+" : "";
    const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
    deltaEl.className = "rep-compare-delta " + (delta > 0 ? "rep-compare-delta--up" : delta < 0 ? "rep-compare-delta--down" : "rep-compare-delta--flat");
    deltaEl.textContent = delta === 0 ? "—" : `${arrow} ${sign}${formatCurrency(Math.abs(delta), appState.currency)}`;
    currCol.appendChild(amtEl);
    currCol.appendChild(deltaEl);
    row.appendChild(catEl);
    row.appendChild(prevEl);
    row.appendChild(currCol);
    list.appendChild(row);
  });
  body.appendChild(list);
}

async function renderAnnualChart(month) {
  const wrap = document.getElementById("rep-annual-wrap");
  const canvas = document.getElementById("rep-annual-canvas");
  const emptyEl = document.getElementById("rep-annual-empty");
  const user = appState.currentUser;
  if (!user) return;

  const year = month.split("-")[0];
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthsToFetch = [];
  for (let m = 1; m <= 12; m++) {
    const mStr = `${year}-${String(m).padStart(2, "0")}`;
    if (mStr > currentMonth) break;
    monthsToFetch.push(mStr);
  }

  const results = await Promise.all(monthsToFetch.map(async (m) => {
    if (m === currentMonth) {
      return {
        month: m,
        income: round2(appState.transactions.filter((t) => t.type === "income" && t.date?.substring(0, 7) === m).reduce((s, t) => s + t.amount, 0)),
        expense: round2(appState.transactions.filter((t) => t.type === "expense" && t.date?.substring(0, 7) === m).reduce((s, t) => s + t.amount, 0)),
      };
    }
    try {
      const snap = await getDoc(doc(db, `artifacts/${APP_ID}/users/${user.uid}/user_data/archive_${m}`));
      if (!snap.exists()) return { month: m, income: 0, expense: 0 };
      const txs = snap.data().transactions || [];
      return {
        month: m,
        income: round2(txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)),
        expense: round2(txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)),
      };
    } catch {
      return { month: m, income: 0, expense: 0 };
    }
  }));

  const hasData = results.some((r) => r.income > 0 || r.expense > 0);
  if (!hasData) {
    if (annualChartInstance) { annualChartInstance.destroy(); annualChartInstance = null; }
    wrap.classList.add("hidden");
    emptyEl.classList.remove("hidden");
    emptyEl.textContent = "Aún no hay datos del año actual. Vuelve el próximo mes.";
    return;
  }
  wrap.classList.remove("hidden");
  emptyEl.classList.add("hidden");

  const labels = results.map((r) => { const [y, mo] = r.month.split("-"); return new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "short" }); });

  if (annualChartInstance) { annualChartInstance.destroy(); annualChartInstance = null; }
  const colorsNow = chartColors();
  annualChartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: results.map((r) => r.income), backgroundColor: "rgba(34,201,122,0.7)", borderColor: "#22c97a", borderWidth: 1, borderRadius: 4 },
        { label: "Gastos", data: results.map((r) => r.expense), backgroundColor: "rgba(240,82,82,0.7)", borderColor: "#f05252", borderWidth: 1, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colorsNow.tick, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.y, appState.currency)}` } },
      },
      scales: {
        x: { ticks: { color: colorsNow.tick }, grid: { color: colorsNow.grid } },
        y: { ticks: { color: colorsNow.tick, callback: (v) => formatCurrency(v, appState.currency) }, grid: { color: colorsNow.grid } },
      },
    },
  });
}

export function initReportes() {
  document.getElementById("rep-filter-month").addEventListener("change", renderReportes);
}
