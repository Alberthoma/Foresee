// Foresee 2.0 — voice-parser.js
// Parser NLP propio en español para dictado por voz: tipo, fecha,
// monto (5 estrategias), banco, categoría y descripción — a partir de
// una transcripción libre ("El quince compré queso en Walmart por
// quince con cuarenta y cinco, usé Wells Fargo, categoría Alimentación").
import { toTitleCase } from "./utils.js";
import { wordValues, parseSpanishNumber } from "./number-parser.js";

const VOICE_INCOME_KW = [
  "ingreso", "gané", "gane", "ganancia", "recibí", "recibi", "recibo",
  "cobré", "cobre", "cobro", "sueldo", "salario", "depósito", "deposito",
  "venta", "vendí", "vendi", "vendo", "facturé", "facture", "entrada",
  "entró", "entro", "dividendo", "comisión", "comision", "honorario",
  "bono", "aguinaldo", "reembolso", "devolución", "devolucion", "reintegro",
  "me pagaron", "me dieron", "prestaron", "gano", "ganó", "me depositaron",
  "obtuve", "percibi", "ingrese",
];
const VOICE_EXPENSE_KW = [
  "gasté", "gaste", "gasto", "pagué", "pague", "pago", "compré", "compre",
  "compra", "factura", "perdí", "perdi", "pérdida", "perdida", "presté",
  "preste", "préstamo", "doné", "done", "donación", "donacion", "invertí",
  "inverti", "inversión", "inversion", "salió", "salio", "salida",
  "cargué", "cargue", "cargo", "debité", "debite", "débito", "debito",
  "consumí", "consumi", "consumo", "retiré", "retire", "retiro", "renta",
  "alquiler", "suscripción", "suscripcion", "membresía", "membresia",
  "transferí", "transferi", "cuota", "abono", "servicio",
];

const VOICE_CAT_HINTS = {
  gasolina: ["Transporte", "Combustible"], combustible: ["Transporte"],
  uber: ["Transporte"], taxi: ["Transporte"], metro: ["Transporte"], bus: ["Transporte"],
  vuelo: ["Transporte", "Viajes"], avion: ["Transporte", "Viajes"], viaje: ["Viajes"],
  hotel: ["Viajes", "Hospedaje"], comida: ["Alimentación", "Comida"], almuerzo: ["Alimentación"],
  cena: ["Alimentación"], desayuno: ["Alimentación"], restaurante: ["Alimentación"],
  supermercado: ["Alimentación"], mercado: ["Alimentación"], walmart: ["Alimentación"],
  costco: ["Alimentación"], farmacia: ["Salud"], medicina: ["Salud"], médico: ["Salud"],
  medico: ["Salud"], doctor: ["Salud"], hospital: ["Salud"], gym: ["Salud", "Entretenimiento"],
  gimnasio: ["Salud"], netflix: ["Entretenimiento"], spotify: ["Entretenimiento"],
  cine: ["Entretenimiento"], ropa: ["Vestimenta", "Ropa"], zapatos: ["Vestimenta"],
  electricidad: ["Servicios"], internet: ["Servicios"], telefono: ["Servicios"],
  celular: ["Servicios", "Teléfono"], alquiler: ["Vivienda"], renta: ["Vivienda"],
  hipoteca: ["Vivienda"], sueldo: ["Sueldo", "Ingresos"], salario: ["Sueldo", "Ingresos"],
};

// Palabras de día del mes derivadas del mismo diccionario que los montos
// (1-31 únicamente) + "primero" — el origen mantenía una segunda lista
// casi idéntica a mano; aquí es una sola fuente de verdad.
const VOICE_DAY_WORDS = { primero: 1 };
for (const [word, val] of Object.entries(wordValues)) {
  if (val >= 1 && val <= 31) VOICE_DAY_WORDS[word] = val;
}

function voiceLev(a, b) {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) {
    m[i] = [i];
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = i === 0 ? j : Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1));
    }
  }
  return m[b.length][a.length];
}

function voiceBestMatch(list, words, maxDist) {
  let best = { name: null, dist: maxDist, phrase: "" };
  for (const item of list) {
    const itemL = item.toLowerCase();
    const wc = itemL.split(" ").length;
    for (let i = 0; i <= words.length - wc; i++) {
      const phrase = words.slice(i, i + wc).join(" ");
      const dist = voiceLev(phrase, itemL);
      if (dist < best.dist) best = { name: item, dist, phrase };
    }
  }
  return best;
}

const STOP_WORDS = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "al", "en", "a", "por",
  "para", "con", "que", "se", "no", "es", "fue", "son", "era", "mi", "su",
  "me", "te", "le", "nos", "les", "ayer", "hoy", "anteayer", "guardar",
  "gasto", "ingreso", "pago", "compra", "venta", "dolares", "dolar", "euros",
  "euro", "pesos", "peso", "bolivares", "bolivar", "recibi", "gane", "compre",
  "pague", "gaste", "cobre", "y", "o", "e", "ni", "pero", "sino", "use",
  "estoy", "bien", "ok", "soles", "sol", "queso", "leche", "pan", "tarjeta",
  "credito", "debito", "efectivo", "cuenta", "banco", "categoria",
]);

export function parseVoiceInput(rawText, { categories, banks, descriptions }) {
  const norm = rawText
    .toLowerCase()
    .replace(/\bguardar\b/g, "")
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u").replace(/ñ/g, "n")
    .replace(/\s+/g, " ").trim();

  const result = { type: "expense", amount: null, date: null, description: "", category: "", bank: "" };
  let rem = " " + norm + " ";

  /* 1. TIPO */
  const kwPos = (text, kwList) => {
    let best = -1;
    for (const kw of kwList) {
      let idx;
      if (kw.includes(" ")) idx = text.indexOf(kw);
      else { const m = new RegExp(`\\b${kw}\\b`).exec(text); idx = m ? m.index : -1; }
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    }
    return best;
  };
  const incPos = kwPos(norm, VOICE_INCOME_KW);
  const expPos = kwPos(norm, VOICE_EXPENSE_KW);
  result.type = incPos !== -1 && (expPos === -1 || incPos <= expPos) ? "income" : "expense";

  /* 2. FECHA */
  const today = new Date();
  result.date = today.toISOString().split("T")[0];
  if (/\banteayer\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 2);
    result.date = d.toISOString().split("T")[0];
    rem = rem.replace(/\banteayer\b/, " ");
  } else if (/\bayer\b/.test(norm)) {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    result.date = d.toISOString().split("T")[0];
    rem = rem.replace(/\bayer\b/, " ");
  } else {
    const numDayM = norm.match(/\b(?:el|dia|el dia)\s+(\d{1,2})\b/);
    if (numDayM) {
      const day = parseInt(numDayM[1], 10);
      if (day >= 1 && day <= 31) {
        const d = new Date(today.getFullYear(), today.getMonth(), day);
        if (d > today) d.setMonth(d.getMonth() - 1);
        result.date = d.toISOString().split("T")[0];
        rem = rem.replace(numDayM[0], " ");
      }
    } else {
      for (const [word, day] of Object.entries(VOICE_DAY_WORDS)) {
        const pat = new RegExp(`\\b(?:el|dia)\\s+${word}\\b`);
        if (pat.test(norm)) {
          const d = new Date(today.getFullYear(), today.getMonth(), day);
          if (d > today) d.setMonth(d.getMonth() - 1);
          result.date = d.toISOString().split("T")[0];
          rem = rem.replace(pat, " ");
          break;
        }
      }
    }
  }

  /* 3. MONTO */
  rem = rem.replace(/\b(\d{1,3}(?:\.\d{3})+),(\d{1,2})\b/g, (_, int, dec) => int.replace(/\./g, "") + "." + dec);
  rem = rem.replace(/\b(\d{1,3}(?:\.\d{3})+)\b/g, (m) => m.replace(/\./g, ""));
  rem = rem.replace(/\b(\d{1,3}(?:,\d{3})+)\b/g, (m) => m.replace(/,/g, ""));

  let amountFound = false;
  const spM = rem.match(/(?:de|del|por|son|cuesta|vale|fueron|costo)\s+([\w\s]+?)\s+(?:dolares?|euros?|pesos?|bolivares?|soles?|colones?)/i);
  if (spM) {
    const pv = parseSpanishNumber(spM[1].trim());
    if (pv) { result.amount = pv; rem = rem.replace(spM[0], " "); amountFound = true; }
  }
  if (!amountFound) {
    const hM = rem.match(/(\d+)\s*(?:con|punto|coma)\s*(\d+)/);
    if (hM) { result.amount = parseFloat(`${hM[1]}.${hM[2].padStart(2, "0")}`); rem = rem.replace(hM[0], " "); amountFound = true; }
  }
  if (!amountFound) {
    const dM = rem.match(/(\d+[.,]\d+)/);
    if (dM) { result.amount = parseFloat(dM[1].replace(",", ".")); rem = rem.replace(dM[0], " "); amountFound = true; }
  }
  if (!amountFound) {
    const iM = rem.match(/(\d+)\s*(?:dolares?|euros?|pesos?|bolivares?|soles?)?/i);
    if (iM && parseInt(iM[1]) > 0) { result.amount = parseFloat(iM[1]); rem = rem.replace(iM[0], " "); amountFound = true; }
  }
  if (!amountFound) {
    // rem (no norm): para este punto ya se quitó la frase de fecha ("el
    // quince" → día 15). Usar norm aquí sumaría ese "quince" una segunda
    // vez sobre el monto real (bug verificado con la frase de ejemplo
    // propia de la app: "el quince ... por quince con cuarenta y cinco"
    // daba 30.45 en vez de 15.45).
    const pv = parseSpanishNumber(rem);
    if (pv) { result.amount = pv; amountFound = true; }
  }

  /* 4. BANCO */
  const words = rem.trim().split(/\s+/);
  if (banks.length > 0) {
    const bm = voiceBestMatch(banks, words, 3);
    if (bm.name) {
      result.bank = bm.name;
      rem = rem.replace(new RegExp(`\\b${bm.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
  }

  /* 5. CATEGORÍA */
  const catNames = categories.map((c) => c.name || c);
  if (!result.category) {
    for (const [hint, cands] of Object.entries(VOICE_CAT_HINTS)) {
      if (norm.includes(hint)) {
        for (const cand of cands) {
          const match = catNames.find((n) => n.toLowerCase().includes(cand.toLowerCase()));
          if (match) { result.category = match; break; }
        }
        if (result.category) break;
      }
    }
  }
  if (!result.category && catNames.length > 0) {
    const remWords = rem.trim().split(/\s+/);
    const cm = voiceBestMatch(catNames, remWords, 3);
    if (cm.name) {
      result.category = cm.name;
      rem = rem.replace(new RegExp(`\\b${cm.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
    }
  }

  /* 6. DESCRIPCIÓN */
  const detectedCatLow = (result.category || "").toLowerCase();
  const eM = rem.match(/\b(?:en|a|para)\s+([a-z]{3,})/i);
  if (eM) {
    const entity = eM[1].toLowerCase();
    const isCat = catNames.some((n) => n.toLowerCase() === entity);
    const isBank = banks.some((b) => b.toLowerCase() === entity);
    if (!STOP_WORDS.has(entity) && !isCat && !isBank && entity !== detectedCatLow) {
      result.description = toTitleCase(eM[1]);
    }
  }
  if (!result.description) {
    const savedD = [...descriptions].sort((a, b) => b.length - a.length);
    for (const desc of savedD) {
      const dLow = desc.toLowerCase();
      if (dLow !== detectedCatLow && norm.includes(dLow)) { result.description = desc; break; }
    }
  }
  if (!result.description) {
    const cands = rem.trim().split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && w !== detectedCatLow && !catNames.some((n) => n.toLowerCase() === w) && !banks.some((b) => b.toLowerCase() === w))
      .sort((a, b) => b.length - a.length);
    if (cands.length) result.description = toTitleCase(cands[0]);
  }

  /* 7. DEFAULTS */
  if (!result.amount) return null;
  if (!result.category) {
    result.category = result.type === "income"
      ? catNames.find((n) => /ingreso|sueldo|entrada/i.test(n)) || catNames[0] || ""
      : catNames.find((n) => /gasto|compra|general/i.test(n)) || catNames[0] || "";
  }
  if (!result.bank && banks.length > 0) result.bank = banks[0];
  if (!result.description) result.description = result.type === "income" ? "Ingreso" : "Gasto";

  return result;
}
