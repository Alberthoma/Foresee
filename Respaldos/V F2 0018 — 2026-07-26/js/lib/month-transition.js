// Foresee 2.0 — month-transition.js
// Cambio de mes automático: archiva una copia del mes cerrado a
// user_data/archive_YYYY-MM SIN BORRAR las transacciones históricas
// (fix crítico del origen tras una pérdida de datos real — ver V FSA
// 0060) + recuperación manual desde ese archivo.
import { db, doc, collection, setDoc, updateDoc, getDoc, getDocs, writeBatch, DB_COL, DB_PREF, APP_ID } from "../firebase.js";
import { appState, isDataReady } from "../state.js";
import { getCurrentMonthStr, formatMonthLabel } from "./utils.js";
import { showLoading, hideLoading, showToast } from "./ui.js";
import { saveGastosComunesState } from "../secciones/comunes.js";

let monthTransitionChecked = false;

export function resetMonthTransitionState() {
  monthTransitionChecked = false;
}

export function tryCheckMonthTransition() {
  if (!isDataReady() || monthTransitionChecked) return;
  monthTransitionChecked = true;

  const currentMonth = getCurrentMonthStr();
  const lastProcessed = appState.lastMonthProcessed;

  if (!lastProcessed) {
    const user = appState.currentUser;
    if (user) {
      updateDoc(doc(db, DB_PREF(user.uid)), { lastMonthProcessed: currentMonth }).catch((err) =>
        console.error("[Firestore] Guardar lastMonthProcessed inicial:", err),
      );
    }
    return;
  }
  if (currentMonth > lastProcessed) runMonthTransition(currentMonth);
}

export async function runMonthTransition(newMonth) {
  const user = appState.currentUser;
  if (!user) return;
  showLoading();
  try {
    const archiveMonth = appState.lastMonthProcessed || getCurrentMonthStr();

    if (appState.transactions.length > 0 || appState.projections.length > 0) {
      const archiveRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/user_data/archive_${archiveMonth}`);
      await setDoc(archiveRef, {
        month: archiveMonth,
        archivedAt: new Date().toISOString(),
        openingBalance: appState.openingBalance,
        finalBalance: appState.transactions.reduce((bal, t) => (t.type === "income" ? bal + t.amount : bal - t.amount), appState.openingBalance),
        transactions: appState.transactions.map((t) => ({ ...t })),
        projections: appState.projections.map((p) => ({ ...p })),
      });
    }

    await updateDoc(doc(db, DB_PREF(user.uid)), { lastMonthProcessed: newMonth });

    // Nuevo mes → nadie ha pagado todavía su parte de los gastos comunes.
    if (appState.gastosComunes?.items?.length > 0) {
      appState.gastosComunes.items.forEach((item) => {
        if (item.distribution) {
          Object.keys(item.distribution).forEach((key) => { delete item.distribution[key].paidDay; });
        }
      });
      await saveGastosComunesState();
    }

    appState.filterMonth = newMonth;
    showToast(`${formatMonthLabel(archiveMonth)} archivado. Bienvenido a ${formatMonthLabel(newMonth)}.`, "success");
  } catch (err) {
    console.error("[Firestore] Transición de mes:", err);
    showToast("Error en la transición de mes.", "error");
  } finally {
    hideLoading();
  }
}

export async function initiateNewMonth(onDone) {
  const now = new Date();
  const nextMonthStr = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 7);
  await runMonthTransition(nextMonthStr);
  if (onDone) onDone();
}

export async function recoverFromArchive() {
  const user = appState.currentUser;
  if (!user) return;
  showLoading();
  try {
    const now = new Date();
    const archiveDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const archiveMonthStr = `${archiveDate.getFullYear()}-${String(archiveDate.getMonth() + 1).padStart(2, "0")}`;
    const archiveRef = doc(db, `artifacts/${APP_ID}/users/${user.uid}/user_data/archive_${archiveMonthStr}`);
    const archiveSnap = await getDoc(archiveRef);
    if (!archiveSnap.exists()) {
      showToast("No se encontró archivo de recuperación.", "error");
      return;
    }
    const found = archiveSnap.data();
    const transactions = found.transactions || [];
    const projections = found.projections || [];
    if (!transactions.length && !projections.length) {
      showToast("El archivo no contiene datos.", "error");
      return;
    }
    const txRef = collection(db, DB_COL(user.uid, "transactions"));
    const projRef = collection(db, DB_COL(user.uid, "projections"));
    const ops = [
      ...transactions.map((t) => (b) => b.set(doc(txRef, t.id), t)),
      ...projections.map((p) => (b) => b.set(doc(projRef, p.id), p)),
      (b) => b.update(doc(db, DB_PREF(user.uid)), { openingBalance: found.openingBalance, lastMonthProcessed: getCurrentMonthStr() }),
    ];
    await commitInChunks(ops);
    appState.filterMonth = archiveMonthStr;
    showToast(`${transactions.length} transacciones recuperadas de ${formatMonthLabel(archiveMonthStr)}.`, "success");
  } catch (err) {
    console.error("[Firestore] Recuperar archivo:", err);
    showToast("Error al recuperar los datos archivados.", "error");
  } finally {
    hideLoading();
  }
}

// Firestore limita los batch a 500 operaciones — se trocea por si acaso.
export async function commitInChunks(ops) {
  const CHUNK = 499;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const b = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((fn) => fn(b));
    await b.commit();
  }
}

export async function resetPeriod() {
  const user = appState.currentUser;
  if (!user) return;
  showLoading();
  try {
    const txRef = collection(db, DB_COL(user.uid, "transactions"));
    const projRef = collection(db, DB_COL(user.uid, "projections"));
    const [txSnap, projSnap] = await Promise.all([getDocs(txRef), getDocs(projRef)]);
    const ops = [
      ...txSnap.docs.map((d) => (b) => b.delete(doc(txRef, d.id))),
      ...projSnap.docs.map((d) => (b) => b.delete(doc(projRef, d.id))),
      (b) => b.update(doc(db, DB_PREF(user.uid)), { openingBalance: 0, categoryBudgets: {} }),
    ];
    await commitInChunks(ops);
    showToast("Período reiniciado. Configuración conservada.", "success");
  } catch (err) {
    console.error("[Firestore] Reiniciar período:", err);
    showToast("Error al reiniciar el período.", "error");
  } finally {
    hideLoading();
  }
}
