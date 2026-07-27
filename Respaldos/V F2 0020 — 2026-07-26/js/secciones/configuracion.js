// Foresee 2.0 — configuracion.js
// Categorías/bancos/descripciones, datos de usuario, notificaciones,
// acciones de período y zona de peligro.
import {
  db, doc, setDoc, writeBatch, collection, getDocs,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser,
  loadMessaging, FCM_VAPID_KEY, DB_COL, DB_PREF, DB_GASTOS_COMUNES,
} from "../firebase.js";
import { appState, DEFAULT_ICON } from "../state.js";
import { toTitleCase } from "../lib/utils.js";
import { showLoading, hideLoading, showToast, openModal, closeModal, openConfirmModal } from "../lib/ui.js";
import { initiateNewMonth, recoverFromArchive, resetPeriod } from "../lib/month-transition.js";
import { cfgExportJson, cfgImportJson, exportExcel, exportPDF } from "../lib/exports.js";

const PRESET_ICONS = [
  DEFAULT_ICON,
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514703/vivienda_bsyk94.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/v1756889458/AA7C0FC4-9F29-48D3-BA63-CDF884DA716B_uwkqfp.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514702/viajes_duy42o.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514701/transporte_kv5zty.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514700/transferencia-interna_wjuhnq.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514700/telefonia_tfmo9l.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514698/tecnologia_zzpzjl.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514698/tarjetas-de-credito_maojob.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514671/entretenimiento2_uxheb0.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514697/tarjetas2_z3jokx.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514696/tarjetas_ngrqvg.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514695/servicios3_wq8cno.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514694/servicios2_lrrt0u.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514694/servicios_vd3ljj.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514693/salud_qt9xjk.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514692/saldos_lntcfz.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514691/saldo_src7bv.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514690/ropa_lneukc.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514690/reportes_qisw3e.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514689/registro_mc8ed8.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514688/regalos_nlhx7g.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514687/recurrentes1_jllpdf.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514686/recurrentes_euwfqq.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514686/proyeccion2_iqtpug.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514685/proyeccion_hh3xyt.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514684/presupuesto_r7qkr9.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514683/otros_gg6l1e.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514682/ocio_reehch.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514682/mascotas_puroqw.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514679/inversion2_yedas0.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514678/inversion_qyl3ly.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514678/ingresos_ci7j4p.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514677/ingreso_yhpbrn.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514676/impuestos2_l8lyx8.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514675/impuestos_anoyd1.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514674/gym_lihk76.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514673/gastos-recurrentes2_udrbey.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514673/gastos-recurrentes_fhbneu.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514672/gasto_dowgd2.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514670/entretenimiento_ltr2qc.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514670/educacion_jyz87e.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514668/deudas_jcqhez.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514668/configuracion_puo2ap.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514667/compras_u7wb1e.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514666/comida_ecusji.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514665/celebraciones_pivh9h.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514665/categoria-default_mmpfg4.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514664/calculadora_k1j5hk.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514664/Banco_u87u1e.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514663/ahorro2_xugr6g.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/f_auto,q_auto/v1756514663/ahorro_vhwhw7.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/v1756889218/51B410C2-D58E-47D8-9ECC-000296533E2C_udpy1y.png",
  "https://res.cloudinary.com/datwdagbf/image/upload/v1756767509/comunes_xjuxxt.png",
];

/* ===================================================================
   RENDER
   =================================================================== */
export function renderConfigurationLists() {
  const user = appState.currentUser;
  if (!user) return;

  const aliasInput = document.getElementById("cfg-alias");
  if (aliasInput && !aliasInput.dataset.dirty) aliasInput.value = appState.userAlias || "";

  const balInput = document.getElementById("cfg-opening-balance");
  if (balInput && !balInput.dataset.dirty) balInput.value = appState.openingBalance || "";

  const currencySelect = document.getElementById("cfg-currency");
  if (currencySelect) currencySelect.value = appState.currency || "USD";

  renderNotificationToggle();
  renderEmailReminderToggle();
  renderPushReminderToggle();

  buildCfgList("cfg-cat-list", appState.categories, "No hay categorías añadidas.", (cat) => ({
    icon: cat.icon || DEFAULT_ICON, label: cat.name, action: "del-cat", name: cat.name,
  }));
  buildCfgList("cfg-bank-list", appState.banks, "No hay bancos/cuentas añadidos.", (bank) => ({
    label: bank, action: "del-bank", name: bank,
  }));
  buildCfgList("cfg-desc-list", appState.descriptions, "No hay descripciones guardadas.", (desc) => ({
    label: desc, action: "del-desc", name: desc,
  }));
}

function buildCfgList(listId, items, emptyText, mapFn) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.textContent = "";
  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "cfg-placeholder";
    p.textContent = emptyText;
    list.appendChild(p);
    return;
  }
  items.forEach((raw) => {
    const { icon, label, action, name } = mapFn(raw);
    const li = document.createElement("li");
    li.className = "cfg-item";
    const left = document.createElement("div");
    left.className = "cfg-item-left";
    if (icon) {
      const img = document.createElement("img");
      img.src = icon;
      img.alt = "";
      img.className = "cfg-item-icon";
      left.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = label;
    left.appendChild(span);
    const del = document.createElement("button");
    del.className = "cfg-btn-del";
    del.dataset.action = action;
    del.dataset.name = name;
    del.textContent = "✕";
    del.setAttribute("aria-label", `Eliminar ${label}`);
    li.appendChild(left);
    li.appendChild(del);
    list.appendChild(li);
  });
}

/* ===================================================================
   ALIAS / SALDO INICIAL / DIVISA
   =================================================================== */
async function handleSaveAlias() {
  const user = appState.currentUser;
  if (!user) return;
  const input = document.getElementById("cfg-alias");
  const errEl = document.getElementById("cfg-alias-error");
  const alias = input.value.trim();
  errEl.textContent = "";
  if (!alias) { errEl.textContent = "El alias no puede estar vacío."; return; }
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { userAlias: alias }, { merge: true });
    delete input.dataset.dirty;
    showToast("Alias guardado.", "success");
  } catch (err) {
    console.error("[Firestore] Alias:", err);
    showToast("Error al guardar el alias.", "error");
  }
}

async function handleSaveOpeningBalance() {
  const user = appState.currentUser;
  if (!user) return;
  const input = document.getElementById("cfg-opening-balance");
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) { showToast("Ingresa un saldo válido.", "warning"); return; }
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { openingBalance: val }, { merge: true });
    delete input.dataset.dirty;
    showToast("Saldo inicial guardado.", "success");
  } catch (err) {
    console.error("[Firestore] Saldo inicial:", err);
    showToast("Error al guardar el saldo.", "error");
  }
}

async function handleSaveCurrency() {
  const user = appState.currentUser;
  if (!user) return;
  const val = document.getElementById("cfg-currency")?.value;
  if (!val) return;
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { currency: val }, { merge: true });
    showToast("Divisa guardada.", "success");
  } catch (err) {
    console.error("[Firestore] Divisa:", err);
    showToast("Error al guardar la divisa.", "error");
  }
}

/* ===================================================================
   CONTRASEÑA
   =================================================================== */
async function handleChangePassword(e) {
  e.preventDefault();
  const user = appState.currentUser;
  if (!user) return;

  const current = document.getElementById("cfg-pwd-current").value;
  const newPwd = document.getElementById("cfg-pwd-new").value;
  const confirm = document.getElementById("cfg-pwd-confirm").value;

  ["cfg-pwd-current-error", "cfg-pwd-new-error", "cfg-pwd-confirm-error"].forEach((id) => {
    document.getElementById(id).textContent = "";
  });

  let valid = true;
  if (!current) { document.getElementById("cfg-pwd-current-error").textContent = "Requerido."; valid = false; }
  if (newPwd.length < 6) { document.getElementById("cfg-pwd-new-error").textContent = "Mínimo 6 caracteres."; valid = false; }
  if (newPwd !== confirm) { document.getElementById("cfg-pwd-confirm-error").textContent = "Las contraseñas no coinciden."; valid = false; }
  if (current === newPwd) { document.getElementById("cfg-pwd-new-error").textContent = "La nueva contraseña debe ser distinta."; valid = false; }
  if (!valid) return;

  const btn = document.getElementById("cfg-pwd-btn");
  btn.disabled = true;
  try {
    const credential = EmailAuthProvider.credential(user.email, current);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPwd);
    document.getElementById("cfg-password-form").reset();
    showToast("Contraseña actualizada correctamente.", "success");
  } catch (err) {
    console.error("[Auth] Cambiar contraseña:", err);
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      document.getElementById("cfg-pwd-current-error").textContent = "Contraseña actual incorrecta.";
    } else if (err.code === "auth/weak-password") {
      document.getElementById("cfg-pwd-new-error").textContent = "La contraseña es demasiado débil.";
    } else {
      showToast("Error al cambiar la contraseña.", "error");
    }
  } finally {
    btn.disabled = false;
  }
}

/* ===================================================================
   NOTIFICACIONES DEL NAVEGADOR
   =================================================================== */
async function handleNotificationToggle() {
  const user = appState.currentUser;
  if (!user) return;

  if (appState.notificationsEnabled) {
    try {
      await setDoc(doc(db, DB_PREF(user.uid)), { notificationsEnabled: false }, { merge: true });
      showToast("Notificaciones desactivadas.", "success");
    } catch (err) {
      console.error("[Firestore] notificaciones:", err);
      showToast("Error al guardar preferencia.", "error");
    }
    return;
  }

  if (!("Notification" in window)) { showToast("Este navegador no soporta notificaciones.", "warning"); return; }
  if (Notification.permission === "denied") {
    showToast("Notificaciones bloqueadas. Actívalas en la configuración del sitio.", "warning");
    renderNotificationToggle();
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") { renderNotificationToggle(); return; }
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { notificationsEnabled: true }, { merge: true });
    showToast("Notificaciones activadas.", "success");
  } catch (err) {
    console.error("[Firestore] notificaciones:", err);
    showToast("Error al guardar preferencia.", "error");
  }
}

function renderNotificationToggle() {
  const statusEl = document.getElementById("cfg-notif-status");
  const btnEl = document.getElementById("cfg-notif-btn");
  if (!statusEl || !btnEl) return;

  if (!("Notification" in window)) {
    statusEl.textContent = "No soportado por este navegador.";
    statusEl.className = "cfg-notif-status";
    btnEl.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    statusEl.textContent = "Bloqueadas en la configuración del navegador.";
    statusEl.className = "cfg-notif-status notif-blocked";
    btnEl.textContent = "Bloqueadas";
    btnEl.disabled = true;
    return;
  }
  btnEl.disabled = false;
  if (appState.notificationsEnabled && Notification.permission === "granted") {
    statusEl.textContent = "Activas — recibirás alertas de vencimientos y tarjetas.";
    statusEl.className = "cfg-notif-status notif-on";
    btnEl.textContent = "Desactivar";
  } else {
    statusEl.textContent = "Inactivas.";
    statusEl.className = "cfg-notif-status";
    btnEl.textContent = "Activar";
  }
}

/* ===================================================================
   RECORDATORIOS POR CORREO (solo preferencia — el envío lo hace la
   Cloud Function programada existente, no se toca)
   =================================================================== */
async function handleEmailReminderToggle() {
  const user = appState.currentUser;
  if (!user) return;
  const next = !appState.emailRemindersEnabled;
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { emailRemindersEnabled: next }, { merge: true });
    showToast(next ? "Recordatorios por correo activados." : "Recordatorios por correo desactivados.", "success");
  } catch (err) {
    console.error("[Firestore] emailReminders:", err);
    showToast("Error al guardar preferencia.", "error");
  }
}

function renderEmailReminderToggle() {
  const statusEl = document.getElementById("cfg-email-status");
  const btnEl = document.getElementById("cfg-email-btn");
  if (!statusEl || !btnEl) return;
  if (appState.emailRemindersEnabled) {
    statusEl.textContent = "Activos — recibirás correos de vencimientos.";
    statusEl.className = "cfg-notif-status notif-on";
    btnEl.textContent = "Desactivar";
  } else {
    statusEl.textContent = "Inactivos.";
    statusEl.className = "cfg-notif-status";
    btnEl.textContent = "Activar";
  }
}

/* ===================================================================
   RECORDATORIOS PUSH (FCM)
   =================================================================== */
async function handlePushReminderToggle() {
  const user = appState.currentUser;
  if (!user) return;

  if (appState.pushRemindersEnabled) {
    try {
      await setDoc(doc(db, DB_PREF(user.uid)), { pushRemindersEnabled: false }, { merge: true });
      showToast("Recordatorios push desactivados.", "success");
    } catch (err) {
      console.error("[Firestore] pushReminders:", err);
      showToast("Error al guardar preferencia.", "error");
    }
    return;
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    showToast("Este navegador no soporta notificaciones push.", "warning");
    return;
  }
  if (Notification.permission === "denied") {
    showToast("Notificaciones bloqueadas. Actívalas en la configuración del sitio.", "warning");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const swReg = await navigator.serviceWorker.ready;
    const { getMessaging, getToken } = await loadMessaging();
    const { firebaseApp } = await import("../firebase.js");
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, { vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) throw new Error("No se obtuvo token FCM");

    await setDoc(doc(db, DB_COL(user.uid, "fcmTokens"), token), { token, createdAt: new Date().toISOString(), userAgent: navigator.userAgent });
    await setDoc(doc(db, DB_PREF(user.uid)), { pushRemindersEnabled: true }, { merge: true });
    showToast("Recordatorios push activados.", "success");
  } catch (err) {
    console.error("[FCM] Error al activar push:", err);
    showToast("No se pudo activar el push en este dispositivo.", "error");
  }
}

function renderPushReminderToggle() {
  const statusEl = document.getElementById("cfg-push-status");
  const btnEl = document.getElementById("cfg-push-btn");
  if (!statusEl || !btnEl) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    statusEl.textContent = "No soportado por este navegador.";
    statusEl.className = "cfg-notif-status";
    btnEl.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    statusEl.textContent = "Bloqueadas en la configuración del navegador.";
    statusEl.className = "cfg-notif-status notif-blocked";
    btnEl.textContent = "Bloqueadas";
    btnEl.disabled = true;
    return;
  }
  btnEl.disabled = false;
  if (appState.pushRemindersEnabled) {
    statusEl.textContent = "Activos en este dispositivo.";
    statusEl.className = "cfg-notif-status notif-on";
    btnEl.textContent = "Desactivar";
  } else {
    statusEl.textContent = "Inactivos.";
    statusEl.className = "cfg-notif-status";
    btnEl.textContent = "Activar";
  }
}

/* ===================================================================
   CATEGORÍAS
   =================================================================== */
function cfgAddCategory() {
  const nameInput = document.getElementById("cfg-cat-name");
  const errEl = document.getElementById("cfg-cat-error");
  const name = toTitleCase(nameInput.value.trim());
  errEl.textContent = "";
  if (!name) { errEl.textContent = "El nombre es obligatorio."; nameInput.focus(); return; }
  if (appState.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = `La categoría "${name}" ya existe.`;
    return;
  }
  openCatIconModal(name);
}

function openCatIconModal(categoryName) {
  const grid = document.getElementById("cfg-cat-icon-grid");
  grid.textContent = "";
  PRESET_ICONS.forEach((url) => {
    const div = document.createElement("div");
    div.className = "icon-option";
    if (url === DEFAULT_ICON) div.classList.add("icon-option--selected");
    div.dataset.icon = url;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Ícono";
    div.appendChild(img);
    grid.appendChild(div);
  });
  document.getElementById("cfg-cat-icon-modal").dataset.pendingName = categoryName;
  openModal("cfg-cat-icon-modal");
}

function closeCatIconModal() {
  closeModal("cfg-cat-icon-modal");
}

async function saveCategoryWithIcon() {
  const user = appState.currentUser;
  if (!user) return;
  const modal = document.getElementById("cfg-cat-icon-modal");
  const name = modal.dataset.pendingName;
  const selected = document.querySelector("#cfg-cat-icon-grid .icon-option--selected");
  const icon = selected ? selected.dataset.icon : DEFAULT_ICON;

  const updated = [...appState.categories, { name, icon }].sort((a, b) => a.name.localeCompare(b.name));
  const saveBtn = document.getElementById("cfg-cat-icon-save-btn");
  saveBtn.disabled = true;
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { categories: updated }, { merge: true });
    document.getElementById("cfg-cat-name").value = "";
    closeCatIconModal();
    showToast(`Categoría "${name}" añadida.`, "success");
  } catch (err) {
    console.error("[Firestore] Añadir categoría:", err);
    showToast("Error al añadir categoría.", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

async function cfgDeleteCategory(name) {
  const user = appState.currentUser;
  if (!user) return;
  openConfirmModal(
    "Eliminar Categoría",
    `¿Eliminar "${name}"? Las transacciones existentes con esta categoría no se verán afectadas.`,
    async () => {
      showLoading();
      try {
        const updated = appState.categories.filter((c) => c.name !== name);
        await setDoc(doc(db, DB_PREF(user.uid)), { categories: updated }, { merge: true });
        showToast(`Categoría "${name}" eliminada.`, "success");
      } catch (err) {
        console.error("[Firestore] Eliminar categoría:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

/* ===================================================================
   BANCOS
   =================================================================== */
async function cfgAddBank() {
  const user = appState.currentUser;
  if (!user) return;
  const input = document.getElementById("cfg-bank-name");
  const errEl = document.getElementById("cfg-bank-error");
  const name = toTitleCase(input.value.trim());
  errEl.textContent = "";
  if (!name) { errEl.textContent = "El nombre es obligatorio."; return; }
  if (appState.banks.some((b) => b.toLowerCase() === name.toLowerCase())) {
    errEl.textContent = `"${name}" ya existe.`;
    return;
  }
  const updated = [...appState.banks, name].sort((a, b) => a.localeCompare(b));
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { banks: updated }, { merge: true });
    input.value = "";
    showToast(`Banco "${name}" añadido.`, "success");
  } catch (err) {
    console.error("[Firestore] Añadir banco:", err);
    showToast("Error al añadir banco.", "error");
  }
}

async function cfgDeleteBank(name) {
  const user = appState.currentUser;
  if (!user) return;
  openConfirmModal(
    "Eliminar Banco/Cuenta",
    `¿Eliminar "${name}"? También se eliminará la tarjeta de crédito asociada, si existe.`,
    async () => {
      showLoading();
      try {
        const batch = writeBatch(db);
        const updatedBanks = appState.banks.filter((b) => b !== name);
        batch.update(doc(db, DB_PREF(user.uid)), { banks: updatedBanks });
        appState.creditCards.filter((cc) => cc.bank === name).forEach((cc) => batch.delete(doc(db, DB_COL(user.uid, "creditCards"), cc.id)));
        await batch.commit();
        showToast(`Banco "${name}" eliminado.`, "success");
      } catch (err) {
        console.error("[Firestore] Eliminar banco:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

/* ===================================================================
   DESCRIPCIONES
   =================================================================== */
async function cfgDeleteDescription(name) {
  const user = appState.currentUser;
  if (!user) return;
  openConfirmModal(
    "Eliminar Descripción",
    `¿Eliminar la descripción guardada "${name}"?`,
    async () => {
      showLoading();
      try {
        const updated = appState.descriptions.filter((d) => d !== name);
        await setDoc(doc(db, DB_PREF(user.uid)), { descriptions: updated }, { merge: true });
        showToast("Descripción eliminada.", "success");
      } catch (err) {
        console.error("[Firestore] Eliminar descripción:", err);
        showToast("Error al eliminar.", "error");
      } finally {
        hideLoading();
      }
    },
  );
}

/* ===================================================================
   ZONA DE PELIGRO
   =================================================================== */
function initiateResetPeriod() {
  openConfirmModal(
    "Reiniciar Período",
    "¡ADVERTENCIA! Se eliminarán todas las transacciones y proyecciones. El saldo inicial volverá a cero. Toda la configuración (categorías, bancos, recurrentes, tarjetas) se conservará.",
    resetPeriod,
  );
}

async function handleDeleteAccount() {
  const user = appState.currentUser;
  if (!user) return;

  const password = document.getElementById("delete-account-password").value;
  const errorEl = document.getElementById("delete-account-error");
  const spinner = document.getElementById("delete-account-spinner");
  const confirmBtn = document.getElementById("delete-account-confirm-btn");
  errorEl.textContent = "";

  if (!password) { errorEl.textContent = "Introduce tu contraseña para confirmar."; return; }

  confirmBtn.disabled = true;
  spinner.classList.remove("hidden");

  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    const uid = user.uid;
    const COLLECTIONS = ["transactions", "recurringExpenses", "creditCards", "projections"];
    for (const colName of COLLECTIONS) {
      const snap = await getDocs(collection(db, DB_COL(uid, colName)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    }

    const batch = writeBatch(db);
    batch.delete(doc(db, DB_GASTOS_COMUNES(uid)));
    batch.delete(doc(db, DB_PREF(uid)));
    await batch.commit();

    await deleteUser(user);
  } catch (err) {
    confirmBtn.disabled = false;
    spinner.classList.add("hidden");
    const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" ? "Contraseña incorrecta." : "Error al eliminar la cuenta. Intenta de nuevo.";
    errorEl.textContent = msg;
    console.error("[Auth] Error al eliminar cuenta:", err);
  }
}

/* ===================================================================
   LISTA / DETALLE — Configuración se ve como una lista de ajustes; tocar
   uno abre solo ese bloque (mismo patrón que Reportes).
   =================================================================== */
export function showCfgList() {
  document.getElementById("cfg-detail-view").classList.add("hidden");
  document.getElementById("cfg-list-view").classList.remove("hidden");
}

function showCfgDetail(cfgId) {
  document.getElementById("cfg-list-view").classList.add("hidden");
  document.getElementById("cfg-detail-view").classList.remove("hidden");
  document.querySelectorAll("#cfg-detail-view [data-cfg]").forEach((el) => {
    el.classList.toggle("hidden", el.dataset.cfg !== cfgId);
  });
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initConfiguracion() {
  document.querySelectorAll("#cfg-list-view .cfg-list-item[data-cfg]").forEach((btn) => {
    btn.addEventListener("click", () => showCfgDetail(btn.dataset.cfg));
  });
  document.getElementById("cfg-open-privacy").addEventListener("click", () => openModal("privacy-modal"));
  document.getElementById("cfg-open-terms").addEventListener("click", () => openModal("terms-modal"));
  document.getElementById("cfg-open-cookies").addEventListener("click", () => openModal("cookies-modal"));

  document.getElementById("cfg-alias").addEventListener("input", (e) => { e.target.dataset.dirty = "1"; });
  document.getElementById("cfg-alias-btn").addEventListener("click", handleSaveAlias);
  document.getElementById("cfg-opening-balance").addEventListener("input", (e) => { e.target.dataset.dirty = "1"; });
  document.getElementById("cfg-balance-btn").addEventListener("click", handleSaveOpeningBalance);
  document.getElementById("cfg-currency-btn").addEventListener("click", handleSaveCurrency);

  document.getElementById("cfg-notif-btn").addEventListener("click", handleNotificationToggle);
  document.getElementById("cfg-email-btn").addEventListener("click", handleEmailReminderToggle);
  document.getElementById("cfg-push-btn").addEventListener("click", handlePushReminderToggle);

  document.getElementById("cfg-password-form").addEventListener("submit", handleChangePassword);

  const cfgBody = document.querySelector(".cfg-body");
  cfgBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, name } = btn.dataset;
    if (action === "del-cat") cfgDeleteCategory(name);
    if (action === "del-bank") cfgDeleteBank(name);
    if (action === "del-desc") cfgDeleteDescription(name);
  });

  document.getElementById("cfg-cat-add-btn").addEventListener("click", cfgAddCategory);
  document.getElementById("cfg-cat-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); cfgAddCategory(); }
  });
  document.getElementById("cfg-cat-icon-close-btn").addEventListener("click", closeCatIconModal);
  document.getElementById("cfg-cat-icon-cancel-btn").addEventListener("click", closeCatIconModal);
  document.getElementById("cfg-cat-icon-modal").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCatIconModal();
  });
  document.getElementById("cfg-cat-icon-save-btn").addEventListener("click", saveCategoryWithIcon);
  document.getElementById("cfg-cat-icon-grid").addEventListener("click", (e) => {
    const opt = e.target.closest(".icon-option");
    if (!opt) return;
    document.querySelectorAll("#cfg-cat-icon-grid .icon-option--selected").forEach((el) => el.classList.remove("icon-option--selected"));
    opt.classList.add("icon-option--selected");
  });

  document.getElementById("cfg-bank-add-btn").addEventListener("click", cfgAddBank);
  document.getElementById("cfg-bank-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); cfgAddBank(); }
  });

  document.getElementById("cfg-export-btn").addEventListener("click", cfgExportJson);
  document.getElementById("cfg-import-btn").addEventListener("click", () => document.getElementById("cfg-import-file").click());
  document.getElementById("cfg-import-file").addEventListener("change", (e) => {
    cfgImportJson(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("cfg-pdf-btn").addEventListener("click", exportPDF);
  document.getElementById("cfg-export-excel-btn").addEventListener("click", exportExcel);

  document.getElementById("cfg-new-month-btn").addEventListener("click", () => {
    openConfirmModal(
      "Iniciar Nuevo Mes",
      "Creará una copia de seguridad del mes actual y cambiará el filtro al mes siguiente. Las transacciones históricas se conservan. ¿Continuar?",
      () => initiateNewMonth(() => document.querySelector('.tab-btn[data-tab="registros"]')?.click()),
    );
  });
  document.getElementById("cfg-recover-archive-btn").addEventListener("click", () => {
    openConfirmModal("Recuperar Datos Archivados", "Se restaurarán las transacciones del último archivo de cambio de mes. ¿Continuar?", recoverFromArchive);
  });
  document.getElementById("cfg-reset-btn").addEventListener("click", initiateResetPeriod);

  const deleteAccountModal = document.getElementById("delete-account-modal");
  document.getElementById("cfg-delete-account-btn").addEventListener("click", () => {
    document.getElementById("delete-account-password").value = "";
    document.getElementById("delete-account-error").textContent = "";
    openModal("delete-account-modal");
    document.getElementById("delete-account-password").focus();
  });
  document.getElementById("delete-account-close-btn").addEventListener("click", () => closeModal("delete-account-modal"));
  document.getElementById("delete-account-cancel-btn").addEventListener("click", () => closeModal("delete-account-modal"));
  document.getElementById("delete-account-confirm-btn").addEventListener("click", handleDeleteAccount);
  deleteAccountModal.addEventListener("click", (e) => {
    if (e.target === deleteAccountModal) closeModal("delete-account-modal");
  });
}
