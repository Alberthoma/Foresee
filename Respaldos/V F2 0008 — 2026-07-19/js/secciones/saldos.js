// Foresee 2.0 — saldos.js
// Saldo por banco (tarjetas) + balance total, usando el mismo motor de
// pares de transferencia que Registros para decidir qué mueve cada banco.
import { appState } from "../state.js";
import { formatCurrency } from "../lib/utils.js";
import { buildInternalPairMap } from "../lib/balances.js";

export function renderBankBalances() {
  const grid = document.getElementById("saldos-grid");
  const emptyEl = document.getElementById("saldos-empty");
  grid.textContent = "";

  if (appState.banks.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  const internalPairMap = buildInternalPairMap(appState.transactions);
  const bankMap = {};
  appState.banks.forEach((b) => { bankMap[b] = { income: 0, expense: 0, count: 0 }; });

  appState.transactions.forEach((t) => {
    if (!t.bank || !bankMap[t.bank]) return;
    const e = bankMap[t.bank];
    e.count++;
    if (t.type === "income") {
      e.income += t.amount;
    } else if (t.type === "expense") {
      e.expense += t.amount;
    } else if (t.type === "transfer") {
      const role = internalPairMap.get(t.id);
      const addsToBank = t.transferDirection === "in" || role === "recv";
      if (addsToBank) e.income += t.amount;
      else e.expense += t.amount;
    }
  });

  let totalNet = 0;
  appState.banks.forEach((bankName) => {
    const { income, expense, count } = bankMap[bankName];
    const net = income - expense;
    totalNet += net;

    const card = document.createElement("div");
    card.className = "saldo-card";

    const nameEl = document.createElement("p");
    nameEl.className = "saldo-card__name";
    nameEl.textContent = bankName;

    const amtEl = document.createElement("p");
    amtEl.className = "saldo-card__amount " + (net >= 0 ? "saldo-card__amount--positive" : "saldo-card__amount--negative");
    amtEl.textContent = formatCurrency(net, appState.currency);

    const metaEl = document.createElement("p");
    metaEl.className = "saldo-card__meta";
    metaEl.textContent = `${count} movimiento${count !== 1 ? "s" : ""}`;

    card.appendChild(nameEl);
    card.appendChild(amtEl);
    card.appendChild(metaEl);
    grid.appendChild(card);
  });

  const totalBalance = appState.openingBalance + totalNet;
  const totalCard = document.createElement("div");
  totalCard.className = "saldo-card saldo-card--total";

  const totalName = document.createElement("p");
  totalName.className = "saldo-card__name";
  totalName.textContent = "Balance Total";

  const totalAmt = document.createElement("p");
  totalAmt.className = "saldo-card__amount " + (totalBalance >= 0 ? "saldo-card__amount--positive" : "saldo-card__amount--negative");
  totalAmt.textContent = formatCurrency(totalBalance, appState.currency);

  const totalMeta = document.createElement("p");
  totalMeta.className = "saldo-card__meta";
  totalMeta.textContent = `Saldo inicial: ${formatCurrency(appState.openingBalance, appState.currency)}`;

  totalCard.appendChild(totalName);
  totalCard.appendChild(totalAmt);
  totalCard.appendChild(totalMeta);
  grid.appendChild(totalCard);
}
