// Foresee 2.0 — exports.js
// Copia de seguridad JSON, y exportación a Excel (4 hojas con fórmulas)
// y PDF. exportCSV() del origen NO se porta — estaba muerta desde que
// llegó la exportación a Excel (sus 3 botones ya vivían ocultos).
import { db, doc, collection, setDoc, getDocs, DB_COL, DB_PREF, DB_GASTOS_COMUNES } from "../firebase.js";
import { appState } from "../state.js";
import { formatCurrency, formatDate, roundMoney } from "./utils.js";
import { showLoading, hideLoading, showToast, openConfirmModal } from "./ui.js";
import { buildInternalPairMap, addsToBalance } from "./balances.js";
import { commitInChunks } from "./month-transition.js";
import { calculateMonthlyPayment } from "../secciones/tarjetas.js";
import { getDynamicProjections } from "../secciones/proyeccion.js";

export function cfgExportJson() {
  const data = {
    transactions: appState.transactions,
    projections: appState.projections,
    recurringExpenses: appState.recurringExpenses,
    creditCards: appState.creditCards,
    savingsGoals: appState.savingsGoals,
    gastosComunes: appState.gastosComunes,
    categories: appState.categories,
    banks: appState.banks,
    descriptions: appState.descriptions,
    categoryBudgets: appState.categoryBudgets,
    openingBalance: appState.openingBalance,
    userAlias: appState.userAlias,
    currency: appState.currency,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `foresee_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Copia exportada a JSON.", "success");
}

export function cfgImportJson(file) {
  if (!file) return;
  const user = appState.currentUser;
  if (!user) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      showToast("El archivo no es un JSON válido.", "error");
      return;
    }

    openConfirmModal(
      "Importar datos",
      "Esto reemplazará TODOS los datos actuales con los del archivo. ¿Continuar?",
      async () => {
        showLoading();
        try {
          const prefData = {};
          if (data.categories) prefData.categories = data.categories;
          if (data.banks) prefData.banks = data.banks;
          if (data.descriptions) prefData.descriptions = data.descriptions;
          if (data.categoryBudgets) prefData.categoryBudgets = data.categoryBudgets;
          if (data.openingBalance != null) prefData.openingBalance = data.openingBalance;
          if (data.userAlias) prefData.userAlias = data.userAlias;
          if (data.currency) prefData.currency = data.currency;
          if (Object.keys(prefData).length) {
            await setDoc(doc(db, DB_PREF(user.uid)), prefData, { merge: true });
          }

          if (data.gastosComunes && Array.isArray(data.gastosComunes.items)) {
            await setDoc(doc(db, DB_GASTOS_COMUNES(user.uid)), { items: data.gastosComunes.items });
          }

          const importCol = async (colName, items) => {
            if (!Array.isArray(items)) return;
            const colRef = collection(db, DB_COL(user.uid, colName));
            const snap = await getDocs(colRef);
            const ops = [
              ...snap.docs.map((d) => (b) => b.delete(doc(colRef, d.id))),
              ...items.map((item) => {
                const ref = item.id ? doc(colRef, item.id) : doc(colRef);
                return (b) => b.set(ref, item);
              }),
            ];
            await commitInChunks(ops);
          };

          await importCol("transactions", data.transactions);
          await importCol("projections", data.projections);
          await importCol("recurringExpenses", data.recurringExpenses);
          await importCol("creditCards", data.creditCards);
          await importCol("savingsGoals", data.savingsGoals);
          showToast("Datos importados correctamente.", "success");
        } catch (err) {
          console.error("[Firestore] Importar JSON:", err);
          showToast("Error al importar los datos.", "error");
        } finally {
          hideLoading();
        }
      },
    );
  };
  reader.readAsText(file);
}

/* ===================================================================
   EXCEL (.xlsx) — 4 hojas: Registro / Proyecciones / Recurrentes / Tarjetas
   =================================================================== */
export function exportExcel() {
  if (!window.XLSX) {
    showToast("La librería Excel no está disponible. Recarga la página e intenta de nuevo.", "warning");
    return;
  }

  const month = appState.filterMonth;
  const alias = (appState.userAlias || "Foresee").replace(/[/\\?*[\]:]/g, "_");
  const fmtN = (v) => parseFloat(v) || 0;
  const CUR = "#,##0.00";
  const fmtDate = (d) => {
    if (!d) return "";
    const p = String(d).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  };
  const cv = (v, z) => {
    const cell = { v: v ?? "", t: typeof v === "number" ? "n" : "s" };
    if (z && typeof v === "number") cell.z = z;
    return cell;
  };
  const cf = (formula, preview, z) => {
    const cell = { f: formula, v: preview ?? 0, t: "n" };
    if (z) cell.z = z;
    return cell;
  };

  const wb = window.XLSX.utils.book_new();

  const txIdx = {};
  appState.transactions.forEach((t, i) => { txIdx[t.id] = i; });
  const allSorted = [...appState.transactions].sort((a, b) => {
    const dc = (a.date || "").localeCompare(b.date || "");
    return dc !== 0 ? dc : (txIdx[a.id] ?? 0) - (txIdx[b.id] ?? 0);
  });
  let gBal = appState.openingBalance;
  const balMap = {};
  allSorted.forEach((t) => {
    gBal = t.type === "income" ? roundMoney(gBal + fmtN(t.amount)) : roundMoney(gBal - fmtN(t.amount));
    balMap[t.id] = gBal;
  });
  const startBal = month
    ? allSorted.filter((t) => t.date && t.date.substring(0, 7) < month).reduce(
        (s, t) => (t.type === "income" ? roundMoney(s + fmtN(t.amount)) : roundMoney(s - fmtN(t.amount))),
        appState.openingBalance,
      )
    : appState.openingBalance;

  /* HOJA 1 — REGISTRO */
  const txRows = appState.transactions
    .filter((t) => t.date && (!month || t.date.startsWith(month)))
    .sort((a, b) => {
      const dc = (a.date || "").localeCompare(b.date || "");
      return dc !== 0 ? dc : (txIdx[a.id] ?? 0) - (txIdx[b.id] ?? 0);
    });
  const totIng = txRows.filter((t) => t.type === "income" && !t.transferLeg).reduce((s, t) => s + fmtN(t.amount), 0);
  const totGas = txRows.filter((t) => t.type === "expense").reduce((s, t) => s + fmtN(t.amount), 0);
  const balMes = totIng - totGas;

  const ws1Data = [
    ["Fecha", "Tipo", "Descripción", "Categoría", "Banco", "Monto", "Balance"],
    ...txRows.map((t, i) => {
      const isInc = t.type === "income";
      const isTrf = t.type === "transfer";
      const monto = isInc ? fmtN(t.amount) : -fmtN(t.amount);
      const tipo = isInc ? (t.transferLeg ? "Transferencia (entrada)" : "Ingreso") : isTrf ? "Transferencia (salida)" : "Gasto";
      const exRow = i + 2;
      const balFml = i === 0 ? `${startBal}+F${exRow}` : `G${exRow - 1}+F${exRow}`;
      return [cv(fmtDate(t.date)), cv(tipo), cv(t.description || ""), cv(t.category || ""), cv(t.bank || ""), cv(monto, CUR), cf(balFml, balMap[t.id] ?? 0, CUR)];
    }),
    ["", "", "", "", "", "", ""],
    ["", "Total Ingresos del Mes", "", "", "", cv(totIng, CUR), ""],
    ["", "Total Gastos del Mes", "", "", "", cv(-totGas, CUR), ""],
    ["", "Balance del Mes", "", "", "", cv(balMes, CUR), ""],
  ];
  const ws1 = window.XLSX.utils.aoa_to_sheet(ws1Data);
  ws1["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  ws1["!freeze"] = { xSplit: 0, ySplit: 1 };
  window.XLSX.utils.book_append_sheet(wb, ws1, "Registro");

  /* HOJA 2 — PROYECCIONES */
  const projRows = getDynamicProjections();
  const projInternalPairMap = buildInternalPairMap(appState.transactions);
  const projAddsToBalance = (t) => addsToBalance(t, projInternalPairMap);

  const ws2Data = [
    ["Fecha", "Tipo", "Descripción", "Categoría", "Banco", "Monto", "Balance Proy.", "Origen"],
    ...projRows.map((p, i) => {
      const isInc = projAddsToBalance(p);
      const monto = isInc ? fmtN(p.amount) : -fmtN(p.amount);
      const origen = p.isVirtual ? "Recurrente" : p.isPureProjection ? "Manual" : "Real";
      const exRow = i + 2;
      const balFml = i === 0 ? `${startBal}+F${exRow}` : `G${exRow - 1}+F${exRow}`;
      return [cv(fmtDate(p.date)), cv(isInc ? "Ingreso" : "Gasto"), cv(p.description || ""), cv(p.category || ""), cv(p.bank || ""), cv(monto, CUR), cf(balFml, 0, CUR), cv(origen)];
    }),
  ];
  const ws2 = window.XLSX.utils.aoa_to_sheet(ws2Data);
  ws2["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
  ws2["!freeze"] = { xSplit: 0, ySplit: 1 };
  window.XLSX.utils.book_append_sheet(wb, ws2, "Proyecciones");

  /* HOJA 3 — GASTOS RECURRENTES */
  const recRows = [...appState.recurringExpenses].sort((a, b) => a.day - b.day);
  const totRec = recRows.reduce((s, r) => s + fmtN(r.amount), 0);
  const lastRecRow = recRows.length + 1;
  const ws3Data = [
    ["Día del Mes", "Descripción", "Categoría", "Banco", "Monto Mensual"],
    ...recRows.map((r) => [cv(parseInt(r.day, 10)), cv(r.description || ""), cv(r.category || ""), cv(r.bank || ""), cv(fmtN(r.amount), CUR)]),
    ["", "", "", "", ""],
    ["", "Total Mensual", "", "", recRows.length > 0 ? cf(`SUM(E2:E${lastRecRow})`, totRec, CUR) : cv(totRec, CUR)],
  ];
  const ws3 = window.XLSX.utils.aoa_to_sheet(ws3Data);
  ws3["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];
  ws3["!freeze"] = { xSplit: 0, ySplit: 1 };
  window.XLSX.utils.book_append_sheet(wb, ws3, "Gastos Recurrentes");

  /* HOJA 4 — TARJETAS DE CRÉDITO */
  const cardRows = [...appState.creditCards].sort((a, b) => a.dueDate - b.dueDate);
  const now = new Date();
  let totDeuda = 0, totLimite = 0, totCuota = 0;
  const lastCcRow = cardRows.length + 1;
  const ws4Data = [
    ["Banco", "Vence Día", "Deuda", "Límite", "Disponible", "Tasa %", "Meses", "Cuota Mensual", "Días al Vence", "% Usado"],
    ...cardRows.map((card) => {
      const deuda = fmtN(card.amount);
      const limite = fmtN(card.limit);
      const disponible = limite - deuda;
      const cuota = calculateMonthlyPayment(deuda, card.rate, card.months);
      const dueDay = parseInt(card.dueDate, 10);
      const vence = new Date(now.getFullYear(), now.getMonth(), dueDay);
      if (now.getDate() > dueDay) vence.setMonth(vence.getMonth() + 1);
      const dias = Math.ceil((vence - now) / 86400000);
      const pct = limite > 0 ? (deuda / limite) * 100 : 0;
      if (!card.exclude) totDeuda += deuda;
      totLimite += limite;
      totCuota += cuota;
      return [cv(card.bank || ""), cv(dueDay), cv(deuda, CUR), cv(limite, CUR), cv(disponible, CUR), cv(fmtN(card.rate), "0.00"), cv(parseInt(card.months, 10) || 0), cv(cuota, CUR), cv(dias), cv(parseFloat(pct.toFixed(1)), "0.0")];
    }),
    ["", "", "", "", "", "", "", "", "", ""],
    [
      "TOTALES", "",
      cardRows.length > 0 ? cf(`SUM(C2:C${lastCcRow})`, totDeuda, CUR) : cv(totDeuda, CUR),
      cardRows.length > 0 ? cf(`SUM(D2:D${lastCcRow})`, totLimite, CUR) : cv(totLimite, CUR),
      cardRows.length > 0 ? cf(`SUM(E2:E${lastCcRow})`, totLimite - totDeuda, CUR) : cv(totLimite - totDeuda, CUR),
      "", "",
      cardRows.length > 0 ? cf(`SUM(H2:H${lastCcRow})`, totCuota, CUR) : cv(totCuota, CUR),
      "", "",
    ],
  ];
  const ws4 = window.XLSX.utils.aoa_to_sheet(ws4Data);
  ws4["!cols"] = [{ wch: 16 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  ws4["!freeze"] = { xSplit: 0, ySplit: 1 };
  window.XLSX.utils.book_append_sheet(wb, ws4, "Tarjetas");

  const filename = `Foresee_${alias}_${month || new Date().toISOString().slice(0, 7)}.xlsx`;
  window.XLSX.writeFile(wb, filename);
  showToast("Excel exportado (4 hojas — fórmulas activas en columna Balance).", "success");
}

/* ===================================================================
   PDF — transacciones del mes activo
   =================================================================== */
export function exportPDF() {
  if (!window.jspdf) {
    showToast("La librería PDF no está disponible. Recarga la página e intenta de nuevo.", "warning");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const month = appState.filterMonth || new Date().toISOString().slice(0, 7);
  const [y, mo] = month.split("-");
  const monthLabel = new Date(+y, +mo - 1, 1).toLocaleString("es", { month: "long", year: "numeric" });
  const alias = appState.userAlias || "Usuario";

  const txs = appState.transactions.filter((t) => t.date && t.date.substring(0, 7) === month).sort((a, b) => new Date(a.date) - new Date(b.date));
  if (txs.length === 0) {
    showToast("No hay transacciones en este período.", "warning");
    return;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Foresee Finances — ${alias}`, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Período: ${monthLabel}`, 40, 58);

  const body = txs.map((t) => [
    formatDate(t.date),
    t.type === "income" ? "Ingreso" : t.type === "expense" ? "Gasto" : "Transferencia",
    t.description || "—",
    t.category || "—",
    t.bank || "—",
    formatCurrency(t.amount, appState.currency),
  ]);
  const totalIncome = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  doc.autoTable({
    startY: 75,
    head: [["Fecha", "Tipo", "Descripción", "Categoría", "Banco", "Monto"]],
    body,
    foot: [
      ["", "", "", "", "Total Ingresos:", formatCurrency(totalIncome, appState.currency)],
      ["", "", "", "", "Total Gastos:", formatCurrency(totalExpenses, appState.currency)],
    ],
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [26, 29, 39], textColor: [232, 234, 240], fontStyle: "bold" },
    footStyles: { fillColor: [26, 29, 39], textColor: [232, 234, 240], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [34, 37, 58] },
    columnStyles: { 5: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  doc.save(`Foresee_${month}_${alias.replace(/\s+/g, "_")}.pdf`);
  showToast("PDF generado correctamente.", "success");
}
