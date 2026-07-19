// Foresee 2.0 — state.js
// Estado global de la app + suscripciones a Firestore + scheduler de
// render. Mismas 6 colecciones/documentos que el origen, mismas rutas
// (artifacts/wittfinances-282f1/users/{uid}/...) — compatibilidad total
// con los datos reales del usuario y con las Cloud Functions existentes.
import {
  db,
  DB_COL,
  DB_PREF,
  DB_GASTOS_COMUNES,
  doc,
  collection,
  onSnapshot,
  setDoc,
} from "./firebase.js";
import { getCurrentMonthStr } from "./lib/utils.js";

export const DEFAULT_ICON =
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514669/dinero_hgnyz4.png";

export const appState = {
  transactions: [],
  projections: [],
  recurringExpenses: [],
  creditCards: [],
  gastosComunes: { items: [] },
  categories: [],
  banks: [],
  descriptions: [],
  categoryBudgets: {},
  openingBalance: 0,
  userAlias: "",
  currency: "USD",
  notificationsEnabled: false,
  emailRemindersEnabled: false,
  pushRemindersEnabled: false,
  lastMonthProcessed: null,
  currentTab: null,
  currentUser: null,
  budgetAlertsShown: {},
  filterMonth: getCurrentMonthStr(),
  filterBank: "",
  filterCategory: "",
};

let unsubscribers = [];
let initialTransactionsLoaded = false;
let initialRecurringLoaded = false;
let initialPrefsLoaded = false;

const renderers = new Set();
export function onStateChange(fn) {
  renderers.add(fn);
}

let renderTimer = null;
export function scheduleRenderAll() {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => renderers.forEach((fn) => fn()), 50);
}

export function isDataReady() {
  return initialTransactionsLoaded && initialPrefsLoaded;
}

// Gate del motor de recurrentes (js/lib/recurring-engine.js): necesita
// transacciones Y recurrentes cargados antes de poder detectar huecos.
export function isRecurringReady() {
  return initialTransactionsLoaded && initialRecurringLoaded;
}

export function loadUserData(userId, onFirstPrefsLoad) {
  const prefRef = doc(db, DB_PREF(userId));
  const txCol = collection(db, DB_COL(userId, "transactions"));
  const recurCol = collection(db, DB_COL(userId, "recurringExpenses"));
  const cardsCol = collection(db, DB_COL(userId, "creditCards"));
  const projCol = collection(db, DB_COL(userId, "projections"));
  const gComunRef = doc(db, DB_GASTOS_COMUNES(userId));

  unsubscribers.push(
    onSnapshot(
      prefRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          appState.categories = (d.categories || []).map((c) =>
            typeof c === "string" ? { name: c, icon: DEFAULT_ICON } : c,
          );
          appState.banks = d.banks || [];
          appState.descriptions = d.descriptions || [];
          appState.openingBalance = d.openingBalance || 0;
          appState.userAlias = d.userAlias || "";
          appState.currency = d.currency || "USD";
          appState.notificationsEnabled = d.notificationsEnabled || false;
          appState.emailRemindersEnabled = d.emailRemindersEnabled || false;
          appState.pushRemindersEnabled = d.pushRemindersEnabled || false;
          appState.categoryBudgets = d.categoryBudgets || {};
          appState.lastMonthProcessed = d.lastMonthProcessed || null;
        }
        const wasFirstLoad = !initialPrefsLoaded;
        initialPrefsLoaded = true;
        scheduleRenderAll();
        if (wasFirstLoad && onFirstPrefsLoad) onFirstPrefsLoad();
      },
      (err) => console.error("[Firestore] preferencias:", err),
    ),

    onSnapshot(
      txCol,
      (snap) => {
        appState.transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        initialTransactionsLoaded = true;
        scheduleRenderAll();
      },
      (err) => console.error("[Firestore] transacciones:", err),
    ),

    onSnapshot(
      recurCol,
      (snap) => {
        appState.recurringExpenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        initialRecurringLoaded = true;
        scheduleRenderAll();
      },
      (err) => console.error("[Firestore] recurrentes:", err),
    ),

    onSnapshot(
      cardsCol,
      (snap) => {
        appState.creditCards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        scheduleRenderAll();
      },
      (err) => console.error("[Firestore] tarjetas:", err),
    ),

    onSnapshot(
      projCol,
      (snap) => {
        appState.projections = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        scheduleRenderAll();
      },
      (err) => console.error("[Firestore] proyecciones:", err),
    ),

    onSnapshot(
      gComunRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          // Migración: formato antiguo tenía people[] global en vez de por ítem.
          if (d.people && d.people.length > 0) {
            d.items = (d.items || []).map((item) => ({
              ...item,
              people: item.people || [...d.people],
            }));
          }
          appState.gastosComunes = { items: d.items || [] };
        } else {
          setDoc(gComunRef, { items: [] });
        }
        scheduleRenderAll();
      },
      (err) => console.error("[Firestore] gastosComunes:", err),
    ),
  );
}

// Guarda una descripción nueva en la lista de autocompletar (Registros,
// Recurrentes y — desde la Fase 3 — Proyección la reutilizan; antes
// cada uno reimplementaba este mismo guardado por su cuenta).
export async function saveNewDescriptionIfNeeded(description) {
  const user = appState.currentUser;
  if (!user || !description || appState.descriptions.includes(description)) return;
  const newDescs = [...appState.descriptions, description];
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { descriptions: newDescs }, { merge: true });
  } catch (err) {
    console.error("[Firestore] Guardar descripción:", err);
  }
}

export function unloadUserData() {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
  initialTransactionsLoaded = false;
  initialRecurringLoaded = false;
  initialPrefsLoaded = false;
  Object.assign(appState, {
    transactions: [],
    projections: [],
    recurringExpenses: [],
    creditCards: [],
    gastosComunes: { items: [] },
    categories: [],
    banks: [],
    descriptions: [],
    categoryBudgets: {},
    openingBalance: 0,
    userAlias: "",
    currency: "USD",
    lastMonthProcessed: null,
    currentTab: null,
    currentUser: null,
    budgetAlertsShown: {},
    filterMonth: getCurrentMonthStr(),
    filterBank: "",
    filterCategory: "",
  });
}
