// Foresee 2.0 — balances.js
// Motor único de saldos. En el origen esta lógica estaba repetida (con
// inconsistencias reales) en renderTransactionsTable, renderDashboard,
// exportExcel, renderProyeccionTable y renderBankBalances — el caso más
// notorio: el dashboard ignoraba las transferencias externas (Zelle
// entrante/saliente de un tercero) y por eso podía mostrar un saldo
// distinto al de Registros o Saldos. Se adelanta desde la Fase 2 del
// plan porque el dashboard de la Fase 1 ya necesita el número correcto.
//
// Regla de saldo (idéntica en todas las vistas):
//   suma  → income (incl. transferLeg propio) | transferDirection:'in' | rol 'recv'
//   resta → expense | transfer rol 'send' | transferDirection:'out'
import { sharesDescriptionWord } from "./utils.js";

// Últimos 5 caracteres (minúscula) de cada token alfanumérico de 6+
// caracteres que contenga al menos un dígito — el sufijo del número de
// referencia se repite en ambos lados de una transferencia aunque cada
// banco le anteponga un prefijo distinto.
export function sharesRefToken(descA, descB) {
  const refSuffixes = (s) =>
    (s || "")
      .match(/[a-z0-9]{6,}/gi)
      ?.filter((t) => /\d/.test(t))
      .map((t) => t.toLowerCase().slice(-5)) || [];
  const setB = new Set(refSuffixes(descB));
  return refSuffixes(descA).some((t) => setB.has(t));
}

// Para cada transacción type:'transfer', detecta si tiene un par en otro
// banco con misma fecha+monto y token de referencia compartido — y
// devuelve un Map txId → 'send' | 'recv'.
export function buildInternalPairMap(transactions) {
  const pairMap = new Map();
  const xfers = transactions.filter((t) => t.type === "transfer");

  const byKey = {};
  xfers.forEach((t) => {
    const k = `${t.date}_${Math.abs(t.amount || 0)}`;
    (byKey[k] || (byKey[k] = [])).push(t);
  });

  Object.values(byKey).forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      if (pairMap.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (pairMap.has(group[j].id)) continue;
        const a = group[i], b = group[j];
        if ((a.bank || "") === (b.bank || "")) continue;
        if (!sharesRefToken(a.description, b.description)) continue;
        let aRole, bRole;
        if (a.transferDirection === "out" || b.transferDirection === "in") {
          aRole = "send"; bRole = "recv";
        } else if (a.transferDirection === "in" || b.transferDirection === "out") {
          aRole = "recv"; bRole = "send";
        } else {
          aRole = (a.bank || "") < (b.bank || "") ? "send" : "recv";
          bRole = aRole === "send" ? "recv" : "send";
        }
        pairMap.set(a.id, aRole);
        pairMap.set(b.id, bRole);
        break;
      }
    }
  });
  return pairMap;
}

export function addsToBalance(t, internalPairMap) {
  return (
    t.type === "income" ||
    t.transferDirection === "in" ||
    internalPairMap.get(t.id) === "recv"
  );
}

// Saldo total actual: saldo inicial + todo el historial no archivado,
// aplicando la regla de arriba a cada transacción.
export function computeTotalBalance(transactions, openingBalance) {
  const internalPairMap = buildInternalPairMap(transactions);
  let balance = openingBalance || 0;
  transactions.forEach((t) => {
    if (t.isArchived) return;
    balance += addsToBalance(t, internalPairMap) ? t.amount || 0 : -(t.amount || 0);
  });
  return Math.round(balance * 100) / 100;
}

// Mismo criterio de emparejamiento que buildInternalPairMap (misma
// fecha+monto, banco distinto, mismo token de referencia) pero devuelve
// el id del par en vez del rol — sirve para agruparlos de forma
// adyacente en la tabla de Registros/Proyección sin romper la cadena
// de saldo corrido.
export function buildTransferPairPartners(transactions) {
  const partnerMap = new Map();
  const xfers = transactions.filter((t) => t.type === "transfer");
  const byKey = {};
  xfers.forEach((t) => {
    const k = `${t.date}_${Math.abs(t.amount || 0)}`;
    (byKey[k] || (byKey[k] = [])).push(t);
  });
  Object.values(byKey).forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      if (partnerMap.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (partnerMap.has(group[j].id)) continue;
        const a = group[i], b = group[j];
        if ((a.bank || "") === (b.bank || "")) continue;
        if (!sharesRefToken(a.description, b.description)) continue;
        partnerMap.set(a.id, b.id);
        partnerMap.set(b.id, a.id);
        break;
      }
    }
  });
  return partnerMap;
}

// Detecta posibles duplicados ya guardados: mismo día + mismo monto +
// mismo banco (excluye transferencias, que ya tienen su propio sistema
// de pareo) y comparten al menos una palabra en la descripción. No
// borra nada — solo marca para que el usuario revise.
export function findSuspectDuplicateIds(transactions) {
  const suspects = new Set();
  const byKey = {};
  transactions.forEach((t) => {
    if (t.type === "transfer" || t.transferLeg) return;
    const k = `${t.date}_${Math.abs(t.amount || 0)}_${(t.bank || "").toLowerCase().trim()}`;
    (byKey[k] || (byKey[k] = [])).push(t);
  });
  Object.values(byKey).forEach((group) => {
    if (group.length < 2) return;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (sharesDescriptionWord(group[i].description, group[j].description)) {
          suspects.add(group[i].id);
          suspects.add(group[j].id);
        }
      }
    }
  });
  return suspects;
}

// Saldo corrido por transacción — el número que se muestra en la
// columna "Saldo" de Registros. Empareja transferencias adyacentes
// (mismo ancla de orden separada por 0.5) para que ambas patas queden
// juntas en la tabla sin romper la cadena SaldoFila[N] - MontoFila[N] =
// SaldoFila[N+1].
export function computeRunningBalanceMap(transactions, openingBalance) {
  const txOrder = {};
  transactions.forEach((t, i) => { txOrder[t.id] = i; });

  const transferPairPartners = buildTransferPairPartners(transactions);
  const effectiveOrder = {};
  transactions.forEach((t) => {
    const partnerId = transferPairPartners.get(t.id);
    if (partnerId !== undefined && txOrder[partnerId] !== undefined) {
      const myIdx = txOrder[t.id];
      const partnerIdx = txOrder[partnerId];
      const anchor = Math.min(myIdx, partnerIdx);
      effectiveOrder[t.id] = myIdx <= partnerIdx ? anchor : anchor + 0.5;
    } else {
      effectiveOrder[t.id] = txOrder[t.id];
    }
  });

  const internalPairMap = buildInternalPairMap(transactions);
  const allByDate = [...transactions].sort((a, b) => {
    const dc = (a.date || "").localeCompare(b.date || "");
    if (dc !== 0) return dc;
    return (effectiveOrder[a.id] ?? 0) - (effectiveOrder[b.id] ?? 0);
  });

  let runBal = openingBalance || 0;
  const balMap = {};
  allByDate.forEach((t) => {
    runBal = addsToBalance(t, internalPairMap)
      ? Math.round((runBal + (t.amount || 0)) * 100) / 100
      : Math.round((runBal - (t.amount || 0)) * 100) / 100;
    balMap[t.id] = runBal;
  });

  return { balMap, effectiveOrder, internalPairMap };
}
