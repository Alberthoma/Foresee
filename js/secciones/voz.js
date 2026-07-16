// Foresee 2.0 — voz.js
// Entrada por voz: Web Speech API + parser NLP propio (voice-parser.js)
// + panel de confirmación editable antes de guardar.
import { db, collection, addDoc, DB_COL } from "../firebase.js";
import { appState } from "../state.js";
import { toTitleCase } from "../lib/utils.js";
import { fillSelect, showLoading, hideLoading, showToast } from "../lib/ui.js";
import { parseVoiceInput } from "../lib/voice-parser.js";

let voiceRecog = null;
let voiceActive = false;

function renderVoiceConfirmation(parsed) {
  fillSelect(document.getElementById("voice-category"), appState.categories, { value: (c) => c.name, label: (c) => c.name });
  document.getElementById("voice-category").value = parsed.category;
  fillSelect(document.getElementById("voice-bank"), appState.banks, { value: (b) => b, label: (b) => b });
  document.getElementById("voice-bank").value = parsed.bank;

  document.getElementById("voice-amount").value = parsed.amount ? parsed.amount.toFixed(2) : "";
  document.getElementById("voice-date").value = parsed.date || new Date().toISOString().split("T")[0];
  document.getElementById("voice-description").value = parsed.description || "";

  const btnInc = document.getElementById("voice-type-income");
  const btnExp = document.getElementById("voice-type-expense");
  btnInc.classList.toggle("voice-type--active-income", parsed.type === "income");
  btnInc.classList.remove("voice-type--active-expense");
  btnExp.classList.toggle("voice-type--active-expense", parsed.type === "expense");
  btnExp.classList.remove("voice-type--active-income");

  document.getElementById("voice-status-idle").classList.add("hidden");
  document.getElementById("voice-status-listening").classList.add("hidden");
  document.getElementById("voice-transcript-area").classList.remove("hidden");
  document.getElementById("voice-confirmation").classList.remove("hidden");
  document.getElementById("voice-hint-text").classList.add("hidden");
}

async function saveVoiceTransaction() {
  const user = appState.currentUser;
  if (!user) return;
  const type = document.getElementById("voice-type-income").classList.contains("voice-type--active-income") ? "income" : "expense";
  const amount = parseFloat(document.getElementById("voice-amount").value);
  const date = document.getElementById("voice-date").value;
  const description = document.getElementById("voice-description").value.trim();
  const category = document.getElementById("voice-category").value;
  const bank = document.getElementById("voice-bank").value;

  if (!amount || amount <= 0) { showToast("Ingresa un monto válido.", "warning"); return; }
  if (!date) { showToast("Selecciona una fecha.", "warning"); return; }

  const tx = {
    type, amount, date, bank: bank || "", category: category || "",
    description: description ? toTitleCase(description) : "",
    createdAt: new Date().toISOString(),
  };
  showLoading();
  try {
    await addDoc(collection(db, DB_COL(user.uid, "transactions")), tx);
    showToast("Transacción registrada por voz.", "success");
    resetVoicePanel();
  } catch (err) {
    console.error("[Voice]", err);
    showToast("Error al guardar. Intenta de nuevo.", "error");
  } finally {
    hideLoading();
  }
}

function resetVoicePanel() {
  document.getElementById("voice-confirmation").classList.add("hidden");
  document.getElementById("voice-transcript-area").classList.add("hidden");
  document.getElementById("voice-transcript-text").textContent = "";
  document.getElementById("voice-status-idle").classList.remove("hidden");
  document.getElementById("voice-status-listening").classList.add("hidden");
  document.getElementById("voice-mic-btn").classList.remove("listening");
  document.getElementById("voice-mic-label").textContent = "Hablar";
  document.getElementById("voice-hint-text").classList.remove("hidden");
  voiceActive = false;
  voiceRecog = null;
}

function toggleVoiceRecognition() {
  if (voiceActive) {
    if (voiceRecog) voiceRecog.stop();
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    showToast("Tu navegador no soporta reconocimiento de voz. Usa Chrome en escritorio.", "warning");
    return;
  }

  resetVoicePanel();
  voiceActive = true;

  const micBtn = document.getElementById("voice-mic-btn");
  const micLabel = document.getElementById("voice-mic-label");
  const txText = document.getElementById("voice-transcript-text");
  const txArea = document.getElementById("voice-transcript-area");
  const stIdle = document.getElementById("voice-status-idle");
  const stListen = document.getElementById("voice-status-listening");
  const hint = document.getElementById("voice-hint-text");

  micBtn.classList.add("listening");
  micLabel.textContent = "Detener";
  stIdle.classList.add("hidden");
  stListen.classList.remove("hidden");
  txArea.classList.remove("hidden");
  hint.classList.add("hidden");

  const recog = new SR();
  voiceRecog = recog;
  recog.lang = "es-ES";
  recog.interimResults = true;
  recog.continuous = true;
  recog.maxAlternatives = 1;

  let autoTriggered = false;

  recog.onresult = (event) => {
    let final = "", interim = "";
    for (const r of event.results) {
      if (r.isFinal) final += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    txText.textContent = (final + interim).trim();
    if ((final + interim).toLowerCase().includes("guardar") && !autoTriggered) {
      autoTriggered = true;
      recog.stop();
    }
  };

  recog.onend = () => {
    voiceActive = false;
    micBtn.classList.remove("listening");
    micLabel.textContent = "Hablar";
    stListen.classList.add("hidden");
    stIdle.classList.remove("hidden");
    const text = txText.textContent.trim();
    if (!text) return;
    const parsed = parseVoiceInput(text, {
      categories: appState.categories,
      banks: appState.banks,
      descriptions: appState.descriptions,
    });
    if (!parsed) {
      showToast("No detecté un monto válido. Intenta de nuevo.", "warning");
      return;
    }
    renderVoiceConfirmation(parsed);
  };

  recog.onerror = (e) => {
    voiceActive = false;
    micBtn.classList.remove("listening");
    micLabel.textContent = "Hablar";
    stListen.classList.add("hidden");
    stIdle.classList.remove("hidden");
    if (e.error !== "aborted") showToast("Error de micrófono: " + e.error, "warning");
  };

  recog.start();
}

export function initVoz() {
  document.getElementById("voice-mic-btn").addEventListener("click", toggleVoiceRecognition);
  document.getElementById("voice-save-btn").addEventListener("click", saveVoiceTransaction);
  document.getElementById("voice-new-btn").addEventListener("click", resetVoicePanel);
  document.getElementById("voice-cancel-btn").addEventListener("click", resetVoicePanel);

  document.getElementById("voice-type-income").addEventListener("click", () => {
    document.getElementById("voice-type-income").classList.add("voice-type--active-income");
    document.getElementById("voice-type-income").classList.remove("voice-type--active-expense");
    document.getElementById("voice-type-expense").classList.remove("voice-type--active-expense", "voice-type--active-income");
  });
  document.getElementById("voice-type-expense").addEventListener("click", () => {
    document.getElementById("voice-type-expense").classList.add("voice-type--active-expense");
    document.getElementById("voice-type-expense").classList.remove("voice-type--active-income");
    document.getElementById("voice-type-income").classList.remove("voice-type--active-income", "voice-type--active-expense");
  });
}
