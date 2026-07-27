// Foresee 2.0 — dashboard.js
import { appState } from "../state.js";
import { formatCurrency, formatMonthLabel } from "../lib/utils.js";
import { computeTotalBalance } from "../lib/balances.js";

export function renderDashboard() {
  const month = appState.filterMonth;

  // Ingresos/gastos "del mes" excluyen transferencias a propósito (mover
  // dinero entre tus propias cuentas no es ingreso ni gasto real) — igual
  // que el origen. El saldo total sí las considera vía computeTotalBalance.
  let monthIncome = 0;
  let monthExpenses = 0;
  appState.transactions.forEach((t) => {
    if (!t || typeof t.date !== "string") return;
    if (t.date.substring(0, 7) !== month) return;
    if (t.type === "income" && !t.transferLeg) monthIncome += t.amount || 0;
    if (t.type === "expense") monthExpenses += t.amount || 0;
  });

  const balance = computeTotalBalance(appState.transactions, appState.openingBalance);

  const projectedBalance = (() => {
    const today = new Date();
    let proj = balance;
    for (let d = 1; d <= 15; d++) {
      const target = new Date(today);
      target.setDate(today.getDate() + d);
      const targetDay = target.getDate();
      appState.recurringExpenses.forEach((exp) => {
        if (parseInt(exp.day, 10) === targetDay) proj -= parseFloat(exp.amount) || 0;
      });
    }
    return proj;
  })();

  const projBanner = document.getElementById("dash-proj-banner");
  if (projBanner) {
    if (projectedBalance < 0) {
      projBanner.textContent = `Atención: tu saldo podría ser negativo en los próximos 15 días (${formatCurrency(projectedBalance, appState.currency)} estimado).`;
      projBanner.classList.remove("hidden");
    } else {
      projBanner.classList.add("hidden");
    }
  }

  document.getElementById("dash-balance-value").textContent = formatCurrency(balance, appState.currency);
  document.getElementById("dash-income-value").textContent = formatCurrency(monthIncome, appState.currency);
  document.getElementById("dash-expense-value").textContent = formatCurrency(monthExpenses, appState.currency);
  document.getElementById("dash-month-label").textContent = formatMonthLabel(month);

  renderEmailVerifyAlert();
  renderCreditCardAlerts();
  renderRecurringAlerts();
}

let emailVerifyDismissed = false;

export function dismissEmailVerifyAlert() {
  emailVerifyDismissed = true;
  const banner = document.getElementById("email-verify-banner");
  if (banner) banner.classList.add("hidden");
}

function renderEmailVerifyAlert() {
  const banner = document.getElementById("email-verify-banner");
  if (!banner) return;
  const user = appState.currentUser;
  const show = !!user && !user.emailVerified && !emailVerifyDismissed;
  banner.classList.toggle("hidden", !show);
}

function renderCreditCardAlerts() {
  const container = document.getElementById("credit-card-alerts");
  if (!container) return;
  container.textContent = "";
  appState.creditCards.forEach((card) => {
    const deuda = parseFloat(card.amount) || 0;
    const limite = parseFloat(card.limit) || 0;
    if (!limite || deuda / limite < 0.8) return;
    const pct = ((deuda / limite) * 100).toFixed(0);
    const text = `Tarjeta ${card.bank}: ${pct}% del límite usado (${formatCurrency(deuda, appState.currency)} de ${formatCurrency(limite, appState.currency)}).`;
    const div = document.createElement("div");
    div.className = deuda / limite >= 0.9 ? "alert-item alert-item--danger" : "alert-item";
    div.appendChild(document.createTextNode(text));
    container.appendChild(div);
  });
}

function renderRecurringAlerts() {
  const container = document.getElementById("recurring-alerts");
  if (!container) return;
  container.textContent = "";
  const today = new Date();

  appState.recurringExpenses.forEach((exp) => {
    const day = parseInt(exp.day, 10);
    const next = new Date(today.getFullYear(), today.getMonth(), day);
    if (today.getDate() > day) next.setMonth(next.getMonth() + 1);
    const diff = Math.ceil((next - today) / 86400000);
    if (diff < 0 || diff > 5) return;

    const text =
      diff === 0
        ? `¡Vence HOY! "${exp.description}" — ${formatCurrency(exp.amount, appState.currency)}.`
        : `Vence en ${diff} día(s): "${exp.description}" — ${formatCurrency(exp.amount, appState.currency)}.`;
    const div = document.createElement("div");
    div.className = `alert-item ${diff <= 2 ? "alert-item--danger" : ""}`;
    div.appendChild(document.createTextNode(text));
    container.appendChild(div);
  });
}
