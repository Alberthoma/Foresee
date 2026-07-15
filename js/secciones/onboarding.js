// Foresee 2.0 — onboarding.js
// Bienvenida de usuario nuevo (3 pasos), datos de ejemplo, y el
// tutorial de 7 videos (accesible en cualquier momento desde el botón
// flotante, no solo durante el onboarding).
import { db, doc, collection, setDoc, DB_PREF, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { showToast, openModal, closeModal } from "../lib/ui.js";
import { commitInChunks } from "../lib/month-transition.js";

const ONBOARDING_KEY = "foresee-onboarding-done";

const TUTORIAL_VIDEOS = [
  { title: "Paso 1: Empieza Fuerte", desc: "Tu primera configuración: categorías y bancos en minutos. La base que hace que todo funcione.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758512589/Paso_1_Bienvenida_y_Gestion_de_Categoria_y_Bancos_plya2u.mp4" },
  { title: "Paso 2: Automatiza tu Tranquilidad", desc: "Gastos fijos en piloto automático. Recibe alertas antes de que venza cada pago.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758512570/Paso_2_Gastos_Recurrentes_mboofi.mp4" },
  { title: "Paso 3: Domina tus Deudas", desc: "Convierte tus tarjetas de crédito en una herramienta, no en un problema. Controla límites y pagos.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758512577/Paso_3_Targetas_de_Credito_krqk9f.mp4" },
  { title: "Paso 4: El Hábito que Cambia Todo", desc: "Registra ingresos y gastos en segundos. Cada registro es un paso hacia el control total.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758512590/Paso_4_Registro_Diaro_cujs8c.mp4" },
  { title: "Paso 5: Conoce tu Dinero", desc: "Reportes, presupuestos y tablas: descubre a dónde va tu dinero y cómo mejorar mes a mes.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758512588/Paso_5_Reportes_Presupuesto_y_Tablas_p0zj9b.mp4" },
  { title: "Paso 6: Viaja al Futuro", desc: "Proyecta tu saldo. Anticipa cuánto puedes gastar — y cuánto puedes ahorrar.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1758514065/Paso_6_Proyeccion_bhrr1a.mp4" },
  { title: "Paso 7: Divide sin Conflictos", desc: "Gastos compartidos sin incomodidad. Registra, divide y cobra tu parte a cada persona.", url: "https://res.cloudinary.com/datwdagbf/video/upload/v1759005488/Gastos_comunes_kvozqf.mp4" },
];

/* ===================================================================
   TUTORIAL
   =================================================================== */
function buildTutorialList() {
  const list = document.getElementById("tutorial-list");
  if (!list || list.dataset.built) return;
  const frag = document.createDocumentFragment();
  TUTORIAL_VIDEOS.forEach((v, i) => {
    const item = document.createElement("div");
    item.className = "tutorial-item";
    item.dataset.index = i;
    const h5 = document.createElement("h5");
    h5.textContent = v.title;
    const p = document.createElement("p");
    p.textContent = v.desc;
    item.appendChild(h5);
    item.appendChild(p);
    item.addEventListener("click", () => playTutorialVideo(i));
    frag.appendChild(item);
  });
  list.appendChild(frag);
  list.dataset.built = "1";
}

function playTutorialVideo(index) {
  const v = TUTORIAL_VIDEOS[index];
  if (!v) return;
  const player = document.getElementById("tutorial-player");
  const titleEl = document.getElementById("tutorial-video-title");
  if (player) { player.src = v.url; player.load(); }
  if (titleEl) titleEl.textContent = v.title;
  document.querySelectorAll(".tutorial-item").forEach((el) => {
    el.classList.toggle("active", Number(el.dataset.index) === index);
  });
}

export function openTutorialModal(startIndex = 0) {
  const modal = document.getElementById("tutorial-modal");
  if (!modal) return;
  buildTutorialList();
  playTutorialVideo(startIndex);
  openModal("tutorial-modal");
}

function closeTutorialModal() {
  const player = document.getElementById("tutorial-player");
  if (player) { player.pause(); player.src = ""; }
  closeModal("tutorial-modal");
}

/* ===================================================================
   ONBOARDING
   =================================================================== */
function setOnboardingStep(step) {
  document.querySelectorAll(".onboarding-step").forEach((el, i) => el.classList.toggle("active", i === step));
  document.querySelectorAll(".onboarding-dot").forEach((el, i) => el.classList.toggle("done", i <= step));
}

export function showOnboarding() {
  setOnboardingStep(0);
  openModal("onboarding-modal");
}

function closeOnboarding() {
  closeModal("onboarding-modal");
  localStorage.setItem(ONBOARDING_KEY, "1");
}

export function shouldShowOnboarding() {
  return !localStorage.getItem(ONBOARDING_KEY);
}

async function onboardingSaveAlias() {
  const input = document.getElementById("onboarding-alias");
  const alias = input ? input.value.trim() : "";
  if (!alias) return;
  const user = appState.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, DB_PREF(user.uid)), { userAlias: alias }, { merge: true });
  } catch (err) {
    console.error("[Onboarding] alias:", err);
  }
}

/* ===================================================================
   DATOS DE DEMO
   =================================================================== */
async function loadDemoData() {
  const user = appState.currentUser;
  if (!user) return;
  const uid = user.uid;
  const month = appState.filterMonth;

  const demoCategories = [
    { name: "Alimentación", icon: "🛒" },
    { name: "Transporte", icon: "🚗" },
    { name: "Entretenimiento", icon: "🎬" },
    { name: "Salud", icon: "💊" },
    { name: "Vivienda", icon: "🏠" },
  ];
  const demoBanks = ["Mi Banco", "Efectivo"];
  const d = (day) => `${month}-${String(day).padStart(2, "0")}`;

  const demoTx = [
    { type: "income", amount: 3500, description: "Salario", category: "Vivienda", bank: "Mi Banco", date: d(1) },
    { type: "expense", amount: 850, description: "Alquiler", category: "Vivienda", bank: "Mi Banco", date: d(2) },
    { type: "expense", amount: 120, description: "Supermercado", category: "Alimentación", bank: "Efectivo", date: d(5) },
    { type: "expense", amount: 45, description: "Gasolina", category: "Transporte", bank: "Efectivo", date: d(8) },
    { type: "expense", amount: 30, description: "Cine + cena", category: "Entretenimiento", bank: "Mi Banco", date: d(12) },
    { type: "expense", amount: 60, description: "Farmacia", category: "Salud", bank: "Efectivo", date: d(15) },
  ];
  const demoRecurring = { description: "Netflix", amount: 15.99, category: "Entretenimiento", bank: "Mi Banco", day: 20 };

  try {
    await setDoc(doc(db, DB_PREF(uid)), {
      categories: demoCategories,
      banks: demoBanks,
      openingBalance: 2000,
      userAlias: appState.userAlias || "",
      currency: appState.currency || "USD",
    }, { merge: true });

    const txRef = collection(db, DB_COL(uid, "transactions"));
    const recRef = collection(db, DB_COL(uid, "recurringExpenses"));
    const ops = [
      ...demoTx.map((tx) => (b) => b.set(doc(txRef), { ...tx, createdAt: new Date().toISOString() })),
      (b) => b.set(doc(recRef), { ...demoRecurring, createdAt: new Date().toISOString() }),
    ];
    await commitInChunks(ops);
    showToast("Datos de ejemplo cargados.", "success");
  } catch (err) {
    console.error("[Demo] loadDemoData:", err);
    showToast("Error al cargar datos de ejemplo.", "error");
  }
}

/* ===================================================================
   WIRING
   =================================================================== */
export function initOnboarding() {
  document.getElementById("tutorial-fab").addEventListener("click", () => openTutorialModal(0));
  document.getElementById("tutorial-modal-close").addEventListener("click", closeTutorialModal);
  document.getElementById("tutorial-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("tutorial-modal")) closeTutorialModal();
  });

  document.getElementById("onboarding-next-0").addEventListener("click", async () => {
    await onboardingSaveAlias();
    setOnboardingStep(1);
  });
  document.getElementById("onboarding-demo-yes").addEventListener("click", async () => {
    await loadDemoData();
    setOnboardingStep(2);
  });
  document.getElementById("onboarding-demo-no").addEventListener("click", () => setOnboardingStep(2));
  document.getElementById("onboarding-watch-tutorial").addEventListener("click", () => {
    closeOnboarding();
    openTutorialModal(0);
  });
  document.getElementById("onboarding-finish").addEventListener("click", closeOnboarding);
  document.getElementById("onboarding-skip-all").addEventListener("click", closeOnboarding);
}
