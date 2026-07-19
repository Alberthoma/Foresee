// Foresee 2.0 — main.js
// Arranque de la app: Firebase auth, navegación, wiring global. Cada
// fase agrega su import de sección y su entrada en SECTION_RENDERERS.
import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "./firebase.js";
import {
  appState,
  loadUserData,
  unloadUserData,
  onStateChange,
} from "./state.js";
import {
  showLoading,
  hideLoading,
  initThemeBtn,
  toggleTheme,
  initModalSystem,
  openModal,
  closeModal,
  runConfirmCallback,
  closeConfirmModal,
  initTooltip,
} from "./lib/ui.js";
import { initCalcModal, openCalcModal } from "./lib/calc-modal.js";
import { initCategoryModal } from "./lib/category-modal.js";
import { tryProcessRecurringExpenses, checkRecurringPaymentReminders, resetRecurringEngineState } from "./lib/recurring-engine.js";
import { renderDashboard } from "./secciones/dashboard.js";
import { renderTransactionsTable, initRegistros, editSelectedItem, deleteSelectedItems, saveTransaction } from "./secciones/registros.js";
import { renderRecurringTable, initRecurrentes, editSelectedRecurring, deleteSelectedRecurring } from "./secciones/recurrentes.js";
import { renderProyeccionTable, initProyeccion, editSelectedProjection, deleteSelectedProjection } from "./secciones/proyeccion.js";
import { renderBankBalances } from "./secciones/saldos.js";
import { renderReportes, initReportes } from "./secciones/reportes.js";
import { renderBudgetTable, initPresupuesto, checkBudgetLimits } from "./secciones/presupuesto.js";
import { renderCreditCardsTable, initTarjetas, checkCreditCardNotifications } from "./secciones/tarjetas.js";
import { renderGastosComunesTable, initComunes } from "./secciones/comunes.js";
import { renderConfigurationLists, initConfiguracion } from "./secciones/configuracion.js";
import { initOnboarding, showOnboarding, shouldShowOnboarding } from "./secciones/onboarding.js";
import { initVoz } from "./secciones/voz.js";
import { initImportar } from "./secciones/importar.js";
import { requestFullscreen, exitFullscreen, setupPullToRefresh } from "./lib/pwa.js";
import { tryCheckMonthTransition, resetMonthTransitionState } from "./lib/month-transition.js";

/* ===================================================================
   RENDER — dashboard siempre; cada fase agrega su sección aquí
   =================================================================== */
const SECTION_RENDERERS = {
  registros: renderTransactionsTable,
  recurrentes: renderRecurringTable,
  proyeccion: renderProyeccionTable,
  saldos: renderBankBalances,
  reportes: renderReportes,
  presupuesto: renderBudgetTable,
  tarjetas: renderCreditCardsTable,
  "gastos-comunes": renderGastosComunesTable,
  configuracion: renderConfigurationLists,
};
onStateChange(tryProcessRecurringExpenses);
onStateChange(checkRecurringPaymentReminders);
onStateChange(checkBudgetLimits);
onStateChange(tryCheckMonthTransition);
onStateChange(checkCreditCardNotifications);

/* ===================================================================
   SELECCIÓN MÚLTIPLE — botones compartidos, dispatch según pestaña
   =================================================================== */
const EDIT_SELECTED_HANDLERS = {
  registros: editSelectedItem,
  recurrentes: editSelectedRecurring,
  proyeccion: editSelectedProjection,
};
const DELETE_SELECTED_HANDLERS = {
  registros: deleteSelectedItems,
  recurrentes: deleteSelectedRecurring,
  proyeccion: deleteSelectedProjection,
};

function renderAll() {
  renderDashboard();
  const fn = SECTION_RENDERERS[appState.currentTab];
  if (fn) fn();
}
onStateChange(renderAll);

/* ===================================================================
   ACTION BAR — botones visibles según la pestaña activa. Cada fase
   agrega sus propios ids a TAB_ACTIONS.
   =================================================================== */
const TAB_ACTIONS = {
  registros: ["btn-add-transaction", "btn-transfer", "reg-filter-group"],
  recurrentes: ["btn-add-rec"],
  proyeccion: ["btn-add-projection", "proj-filter-group"],
  reportes: ["rep-filter-group"],
  "gastos-comunes": ["btn-add-comun"],
  tarjetas: ["btn-add-card"],
};
const ALL_ACTION_IDS = [
  "btn-add-transaction", "btn-transfer", "btn-edit-selected",
  "btn-delete-selected", "reg-filter-group", "btn-add-rec",
  "btn-add-projection", "proj-filter-group", "rep-filter-group",
  "btn-add-comun", "btn-add-card",
];

function updateActionBar(tabName) {
  const visible = TAB_ACTIONS[tabName] || [];
  ALL_ACTION_IDS.forEach((id) => {
    document.getElementById(id)?.classList.toggle("hidden", !visible.includes(id));
  });
  // btn-edit-selected/btn-delete-selected se muestran según selección real,
  // no según la pestaña — se ocultan al cambiar de tab hasta que se seleccione algo.
  document.getElementById("btn-edit-selected")?.classList.add("hidden");
  document.getElementById("btn-delete-selected")?.classList.add("hidden");
}

/* ===================================================================
   NAVEGACIÓN
   =================================================================== */
function showDashboardView() {
  document.body.classList.remove("view-content");
  document.body.classList.add("view-dashboard");
  document.querySelectorAll(".tab-btn[data-tab]").forEach((b) => {
    b.classList.remove("tab-btn--active");
    b.setAttribute("aria-selected", "false");
  });
  appState.currentTab = null;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn[data-tab]").forEach((btn) => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle("tab-btn--active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.toggle("tab-pane--active", pane.dataset.section === tabName);
  });
  document.body.classList.remove("view-dashboard");
  document.body.classList.add("view-content");
  appState.currentTab = tabName;
  updateActionBar(tabName);
  renderAll();
}

function renderHeaderAlias() {
  const el = document.getElementById("user-alias");
  if (!el) return;
  el.textContent = appState.userAlias || (appState.currentUser ? appState.currentUser.uid.substring(0, 8) + "…" : "Usuario");
}

/* ===================================================================
   AUTH
   =================================================================== */
function setAuthLoading(isLoading) {
  document.getElementById("login-btn").disabled = isLoading;
  document.getElementById("register-btn").disabled = isLoading;
  document.getElementById("login-spinner").classList.toggle("hidden", !isLoading);
  document.getElementById("register-spinner").classList.toggle("hidden", !isLoading);
}

function clearAuthErrors() {
  document.getElementById("auth-email-error").textContent = "";
  document.getElementById("auth-password-error").textContent = "";
}

let authInProgress = false;

async function handleLogin(email, password) {
  if (authInProgress) return;
  clearAuthErrors();
  authInProgress = true;
  setAuthLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    const msg =
      err.code === "auth/invalid-credential" || err.code === "auth/wrong-password"
        ? "Correo o contraseña incorrectos."
        : err.code === "auth/too-many-requests"
          ? "Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo."
          : "Error al iniciar sesión. Intenta de nuevo.";
    document.getElementById("auth-password-error").textContent = msg;
  } finally {
    authInProgress = false;
    setAuthLoading(false);
  }
}

async function handleRegister(email, password) {
  if (authInProgress) return;
  clearAuthErrors();
  if (!email || !password) {
    document.getElementById("auth-email-error").textContent = "Completa ambos campos.";
    return;
  }
  authInProgress = true;
  setAuthLoading(true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    localStorage.setItem("foresee-new-user", "1");
  } catch (err) {
    let msg = "Error al registrarse.";
    if (err.code === "auth/email-already-in-use") msg = "Este correo ya está registrado.";
    if (err.code === "auth/weak-password") msg = "La contraseña debe tener al menos 6 caracteres.";
    if (err.code === "auth/invalid-email") msg = "Correo electrónico inválido.";
    document.getElementById("auth-email-error").textContent = msg;
  } finally {
    authInProgress = false;
    setAuthLoading(false);
  }
}

async function handleForgotPassword() {
  const email = document.getElementById("auth-email").value.trim();
  const msgEl = document.getElementById("auth-reset-msg");
  msgEl.className = "auth-reset-msg";
  if (!email) {
    msgEl.textContent = "Escribe tu correo arriba y vuelve a intentarlo.";
    msgEl.classList.add("error");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    msgEl.textContent = "Correo enviado. Revisa tu bandeja de entrada.";
    msgEl.classList.add("success");
  } catch (err) {
    const msg =
      err.code === "auth/user-not-found" || err.code === "auth/invalid-email"
        ? "No existe una cuenta con ese correo."
        : "Error al enviar el correo. Intenta de nuevo.";
    msgEl.textContent = msg;
    msgEl.classList.add("error");
  }
}

async function handleLogout() {
  try {
    exitFullscreen();
    unloadUserData();
    resetRecurringEngineState();
    resetMonthTransitionState();
    await signOut(auth);
  } catch (err) {
    console.error("[Auth] Error al cerrar sesión:", err);
  }
}

/* ===================================================================
   WIRING
   =================================================================== */
function setupEventListeners() {
  document.getElementById("auth-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    handleLogin(email, password);
  });
  document.getElementById("register-btn").addEventListener("click", () => {
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    handleRegister(email, password);
  });
  document.getElementById("forgot-password-btn").addEventListener("click", handleForgotPassword);

  document.getElementById("tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (btn) switchTab(btn.dataset.tab);
  });
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("logout-tab-btn").addEventListener("click", handleLogout);
  document.getElementById("btn-to-dashboard").addEventListener("click", showDashboardView);

  document.getElementById("dashboard").addEventListener("click", (e) => {
    const card = e.target.closest(".dash-card[data-goto]");
    if (!card) return;
    if (card.id === "dash-income") {
      switchTab("registros");
      openCalcModal({ onFinalize: saveTransaction, initialTipo: "income" });
    } else if (card.id === "dash-expense") {
      switchTab("registros");
      openCalcModal({ onFinalize: saveTransaction, initialTipo: "expense" });
    } else {
      switchTab(card.dataset.goto);
    }
  });

  document.getElementById("btn-edit-selected").addEventListener("click", () => {
    EDIT_SELECTED_HANDLERS[appState.currentTab]?.();
  });
  document.getElementById("btn-delete-selected").addEventListener("click", () => {
    DELETE_SELECTED_HANDLERS[appState.currentTab]?.();
  });

  initThemeBtn();
  document.getElementById("btn-theme-toggle").addEventListener("click", toggleTheme);
  document.getElementById("cfg-theme-btn").addEventListener("click", toggleTheme);

  // Confirm modal genérico (usado desde la Fase 2 en adelante)
  document.getElementById("confirm-close-btn").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-cancel-btn").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeConfirmModal();
  });
  document.getElementById("confirm-ok-btn").addEventListener("click", runConfirmCallback);

  // Indicador online/offline
  const offlineDot = document.getElementById("offline-dot");
  function syncDotState() {
    if (!offlineDot) return;
    const isOnline = navigator.onLine;
    offlineDot.classList.toggle("offline", !isOnline);
    offlineDot.title = isOnline ? "Conectado" : "Sin conexión — los cambios se sincronizarán al reconectar";
  }
  window.addEventListener("offline", syncDotState);
  window.addEventListener("online", syncDotState);
  syncDotState();

  // Pantalla completa
  document.getElementById("btn-fullscreen").addEventListener("click", requestFullscreen);
  document.getElementById("btn-exit-fullscreen").addEventListener("click", exitFullscreen);
  document.getElementById("btn-enter-fullscreen").addEventListener("click", () => {
    closeModal("fullscreen-prompt");
    requestFullscreen();
  });

  // Modales informativos (filosofía, privacidad, términos, cookies)
  const INFO_MODALS = [
    ["btn-philosophy", "philosophy-modal", "philosophy-modal-close"],
    ["btn-privacy", "privacy-modal", "privacy-modal-close"],
    ["btn-terms", "terms-modal", "terms-modal-close"],
    ["btn-cookies", "cookies-modal", "cookies-modal-close"],
  ];
  INFO_MODALS.forEach(([openBtnId, modalId, closeBtnId]) => {
    document.getElementById(openBtnId).addEventListener("click", () => openModal(modalId));
    document.getElementById(closeBtnId).addEventListener("click", () => closeModal(modalId));
    document.getElementById(modalId).addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal(modalId);
    });
  });

  // Pull-to-refresh (mobile)
  setupPullToRefresh(renderAll);

  initTooltip();
  initCalcModal();
  initCategoryModal();
  initRegistros();
  initRecurrentes();
  initProyeccion();
  initReportes();
  initPresupuesto();
  initTarjetas();
  initComunes();
  initConfiguracion();
  initOnboarding();
  initVoz();
  initImportar();

  initModalSystem([
    "auth-modal", "confirm-modal", "calc-modal", "cat-modal", "transfer-modal",
    "rec-modal", "cc-modal", "dist-input-modal", "shared-bank-modal",
    "cfg-cat-icon-modal", "delete-account-modal", "onboarding-modal", "tutorial-modal",
    "philosophy-modal", "privacy-modal", "terms-modal", "cookies-modal",
  ]);
}

/* ===================================================================
   INIT
   =================================================================== */
setupEventListeners();

let _showFullscreenOnLoad = false;

onAuthStateChanged(auth, (user) => {
  if (user) {
    appState.currentUser = user;
    closeModal("auth-modal");
    showLoading();
    _showFullscreenOnLoad = true;
    loadUserData(user.uid, () => {
      renderHeaderAlias();
      hideLoading();
      if (_showFullscreenOnLoad && !document.fullscreenElement) {
        _showFullscreenOnLoad = false;
        openModal("fullscreen-prompt");
      }
      if (localStorage.getItem("foresee-new-user") === "1") {
        localStorage.removeItem("foresee-new-user");
        if (shouldShowOnboarding()) setTimeout(showOnboarding, 800);
      }
    });
  } else {
    appState.currentUser = null;
    unloadUserData();
    showDashboardView();
    openModal("auth-modal", "#auth-email");
    hideLoading();
  }
});
