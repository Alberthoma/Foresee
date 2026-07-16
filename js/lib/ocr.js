// Foresee 2.0 — ocr.js
// OCR client-side (Tesseract.js, carga lazy vía CDN) para dos flujos
// independientes: foto de extracto bancario (processImportImage, N filas)
// y escaneo de un recibo suelto (processReceiptImage, 1 sola transacción).
// Ver Proyecto-Anterior/MD/Pipeline de Importación CSV — Referencia.md
// sección 2.2 y 3 para el detalle función por función — este módulo
// replica ese pipeline sin alterar el orden ni los criterios.
import { appState } from "../state.js";
import { showLoading, hideLoading } from "./ui.js";
import { toTitleCase } from "./utils.js";
import { detectBankFromText, cleanBankDescription, nextImportId } from "./import-pipeline.js";

export function looksLikeAmountToken(text) {
  return /^[-+(]?\s*[\$S5]?\s*[0-9][0-9,]*\.[0-9]{2}[)]?$/.test((text || "").trim());
}

export function parseOcrAmount(rawText) {
  if (!rawText) return null;
  let s = rawText.trim().replace(/\s+/g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.charAt(0) === "-") {
    negative = true;
    s = s.slice(1);
  } else if (s.charAt(0) === "+") {
    s = s.slice(1); // signo positivo explícito — se descarta, el número queda positivo
  }
  s = s.replace(/^[\$S5]/, "");
  if (s.charAt(0) === "-") {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/,/g, "");
  if (!/^[0-9]+\.[0-9]{2}$/.test(s)) return null;
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -n : n;
}

const OCR_MONTH_MAP = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const OCR_DATE_PREFIX_RE = /^([A-Za-z]{3,9})[.]?\s+([0-9OIl]{1,2}),?\s*([0-9]{4})\b/;

function tryParseOcrDateLine(monthStr, dayStr, yearStr) {
  const month3 = monthStr.slice(0, 3).toLowerCase();
  if (!(month3 in OCR_MONTH_MAP)) return null;
  const dayFixed = dayStr.replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
  const day = parseInt(dayFixed, 10);
  const year = parseInt(yearStr, 10);
  if (isNaN(day) || day < 1 || day > 31) return null;
  if (isNaN(year) || year < 2000 || year > 2100) return null;
  const mm = String(OCR_MONTH_MAP[month3] + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function extractLeadingOcrDate(text) {
  const m = (text || "").trim().match(OCR_DATE_PREFIX_RE);
  if (!m) return null;
  const fecha = tryParseOcrDateLine(m[1], m[2], m[3]);
  if (!fecha) return null;
  return { fecha, restOfLine: text.slice(m[0].length).trim() };
}

// Formato numérico "MM/DD/YYYY" (ej. Wells Fargo). Año de 2 o 4 dígitos —
// algunas vistas de Wells Fargo muestran "MM/DD/YY".
const OCR_NUMERIC_DATE_PREFIX_RE = /^([0-9OIl]{1,2})\/([0-9OIl]{1,2})\/([0-9]{2,4})\b/;

function extractLeadingNumericDate(text) {
  const m = (text || "").trim().match(OCR_NUMERIC_DATE_PREFIX_RE);
  if (!m) return null;
  const mFixed = m[1].replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
  const dFixed = m[2].replace(/[Oo]/g, "0").replace(/[Il]/g, "1");
  const month = parseInt(mFixed, 10);
  const day = parseInt(dFixed, 10);
  const yearStr = m[3].length === 2 ? "20" + m[3] : m[3];
  const year = parseInt(yearStr, 10);
  if (isNaN(month) || month < 1 || month > 12) return null;
  if (isNaN(day) || day < 1 || day > 31) return null;
  if (isNaN(year) || year < 2000 || year > 2100) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return { fecha: `${year}-${mm}-${dd}`, restOfLine: text.slice(m[0].length).trim() };
}

const OCR_SKIP_LINE_RE = /(fecha de registro|saldo diario final|beginning balance|ending balance|total credits|total debits)/i;

// Encabezados de sección de Wells Fargo — a diferencia de OCR_SKIP_LINE_RE,
// no tienen una línea de valor asociada después, así que no deben arrastrar
// la línea siguiente al eliminarse (esa sí es una transacción real).
const OCR_SKIP_STANDALONE_LINE_RE = /(transacciones pendientes|transacciones autorizadas|transacciones registradas)/i;

// Estados de "transacción en proceso" (ej. BoA): la fecha real no aparece
// como línea separada — se usa la fecha de hoy en su lugar.
const OCR_PENDING_LABEL_RE = /^(en proceso|pendiente|pending|processing|posted)\b/i;

// Cuando el monto no trae signo explícito, se infiere por palabras clave.
const OCR_EXPENSE_KEYWORDS_RE = /\b(purchase(?: authorized)?|withdrawal|debit|checkcard|payment to|transfer to)\b/i;
const OCR_INCOME_KEYWORDS_RE = /\b(deposit|credit|refund|payment from|transfer from)\b/i;

export function clusterWordsIntoLines(words) {
  const withCenter = words
    .filter((w) => (w.text || "").trim().length > 0)
    .map((w) => ({
      text: w.text,
      yCenter: (w.bbox.y0 + w.bbox.y1) / 2,
      height: w.bbox.y1 - w.bbox.y0,
      xLeft: w.bbox.x0,
    }))
    .sort((a, b) => a.yCenter - b.yCenter);
  if (!withCenter.length) return [];
  const avgHeight = withCenter.reduce((s, w) => s + w.height, 0) / withCenter.length;
  const yTolerance = Math.max(avgHeight * 0.6, 6);

  const lines = [];
  for (const w of withCenter) {
    let line = lines.find((l) => Math.abs(l.yCenter - w.yCenter) <= yTolerance);
    if (!line) {
      line = { yCenter: w.yCenter, words: [] };
      lines.push(line);
    }
    line.words.push(w);
    line.yCenter = line.words.reduce((s, x) => s + x.yCenter, 0) / line.words.length;
  }
  lines.forEach((l) => l.words.sort((a, b) => a.xLeft - b.xLeft));
  lines.sort((a, b) => a.yCenter - b.yCenter);
  return lines;
}

function findColumnSplit(lines, imageWidth) {
  const amountLikeXs = [];
  lines.forEach((line) =>
    line.words.forEach((w) => {
      if (looksLikeAmountToken(w.text)) amountLikeXs.push(w.xLeft);
    }),
  );
  if (!amountLikeXs.length) return imageWidth * 0.6;
  return Math.min(...amountLikeXs) - 10;
}

function classifyRightToken(block, rightText) {
  // Una línea puede traer más de un monto — se clasifica cada token por
  // separado en vez de exigir que todo el texto derecho sea un único monto.
  const tokens = rightText.split(/\s+/).filter((t) => looksLikeAmountToken(t));
  for (const t of tokens) {
    if (block.amountTexts.length === 0) block.amountTexts.push(t);
    else block.balanceTexts.push(t);
  }
}

// Elimina por completo las líneas de resumen diario antes de reconstruir
// bloques. Si la etiqueta y su valor vienen en líneas separadas, se
// elimina también la línea siguiente (el valor).
export function stripDividerLines(lines) {
  const toRemove = new Set();
  lines.forEach((line, i) => {
    const text = line.words.map((w) => w.text).join(" ");
    if (OCR_SKIP_STANDALONE_LINE_RE.test(text)) {
      toRemove.add(i);
      return;
    }
    if (!OCR_SKIP_LINE_RE.test(text)) return;
    toRemove.add(i);
    const hasDate = /\d{1,2}\/\d{1,2}\/\d{4}/.test(text);
    const hasAmount = /\$?\s*[0-9][0-9,]*\.[0-9]{2}/.test(text);
    if (!(hasDate && hasAmount) && i + 1 < lines.length) toRemove.add(i + 1);
  });
  return lines.filter((_, i) => !toRemove.has(i));
}

function reconstructTransactionBlocks(lines, xSplit) {
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const leftWords = line.words.filter((w) => w.xLeft < xSplit);
    const rightWords = line.words.filter((w) => w.xLeft >= xSplit);
    const leftText = leftWords.map((w) => w.text).join(" ").trim();
    const rightText = rightWords.map((w) => w.text).join(" ").trim();
    // Los íconos junto a la fecha a veces el OCR los lee como un carácter
    // suelto (ej. "@") antes de la fecha real.
    const leftTextClean = leftText.replace(/^[^A-Za-z0-9]+\s*/, "").trim();

    const dateHit =
      (leftTextClean && extractLeadingOcrDate(leftTextClean)) ||
      (leftTextClean && extractLeadingNumericDate(leftTextClean));

    if (dateHit) {
      if (current) blocks.push(current);
      current = {
        fecha: dateHit.fecha,
        descLines: dateHit.restOfLine ? [dateHit.restOfLine] : [],
        amountTexts: [],
        balanceTexts: [],
      };
      if (rightText) classifyRightToken(current, rightText);
    } else if (leftTextClean && OCR_PENDING_LABEL_RE.test(leftTextClean)) {
      if (current) blocks.push(current);
      current = {
        fecha: new Date().toISOString().slice(0, 10),
        descLines: [],
        amountTexts: [],
        balanceTexts: [],
      };
      if (rightText) classifyRightToken(current, rightText);
    } else if (current) {
      const rightTokens = rightText ? rightText.split(/\s+/).filter((t) => looksLikeAmountToken(t)) : [];
      // Segunda transacción del mismo día sin fecha repetida (ej. Chase
      // desktop): solo se trata como nueva si el bloque vigente ya tiene
      // descripción — si está vacío, el monto derecho es el saldo de
      // cuenta (BofA móvil) y debe ir a balanceTexts.
      if (current.amountTexts.length > 0 && rightTokens.length > 0 && current.descLines.length > 0) {
        blocks.push(current);
        current = {
          fecha: current.fecha,
          descLines: leftText ? [leftText] : [],
          amountTexts: [],
          balanceTexts: [],
        };
        if (rightText) classifyRightToken(current, rightText);
      } else {
        if (leftText) current.descLines.push(leftText);
        if (rightText) classifyRightToken(current, rightText);
      }
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

// Formato de app móvil: una fecha-encabezado aplica a varias transacciones
// debajo, y el monto trae el saldo y el monto real juntos en cualquier
// orden — por eso reconstructTransactionBlocks (2 columnas fijas) devuelve
// 0 bloques con este layout. Parser aparte para no arriesgar el de escritorio.
function isMobileDateOnlyLine(text) {
  const hit = extractLeadingOcrDate(text) || extractLeadingNumericDate(text);
  return hit && !hit.restOfLine ? hit.fecha : null;
}

// Texto de interfaz que nunca es una transacción — se descarta antes de
// acumular descripción.
const MOBILE_UI_NOISE_RE = new RegExp(
  [
    "^\\d{1,2}:\\d{2}\\b",
    "\\(\\.\\.\\.\\d+\\)",
    "buscar.*filtrar",
    "mostrar detalles",
    "^(pagar|transferir|m[aá]s|pay|transfer|more)\\b",
    "administra la cuenta",
    "accede a herramientas",
    "ver todas las transacciones",
    "saldo disponible|saldo presente|available balance|present balance",
    "detalles de cuenta",
  ].join("|"),
  "i",
);

// El saldo y el monto real pueden venir en cualquier orden en la misma
// línea — se prioriza el que tiene signo explícito; si ninguno o ambos lo
// tienen, se asume que el monto real es el último (más a la derecha).
function pickMobileAmountToken(tokens) {
  if (tokens.length <= 1) return tokens[0] || null;
  const signed = tokens.filter((t) => /^[-(]/.test(t.trim()));
  if (signed.length === 1) return signed[0];
  return tokens[tokens.length - 1];
}

function reconstructMobileTransactionBlocks(lines) {
  const blocks = [];
  let lastDate = null;
  let pendingDescLines = [];

  for (const line of lines) {
    const text = line.words.map((w) => w.text).join(" ").trim();
    if (!text || MOBILE_UI_NOISE_RE.test(text)) continue;

    const dateOnly = isMobileDateOnlyLine(text);
    if (dateOnly) {
      lastDate = dateOnly;
      for (const b of blocks) {
        if (b.fecha === null) b.fecha = lastDate;
      }
      pendingDescLines = [];
      continue;
    }

    const amountTokens = line.words.map((w) => w.text).filter((t) => looksLikeAmountToken(t));

    if (amountTokens.length > 0) {
      if (pendingDescLines.length > 0) {
        const chosen = pickMobileAmountToken(amountTokens);
        blocks.push({
          fecha: lastDate,
          descLines: [...pendingDescLines],
          amountTexts: chosen ? [chosen] : [],
          balanceTexts: [],
        });
      }
      pendingDescLines = [];
    } else {
      pendingDescLines.push(text);
    }
  }
  return blocks.filter((b) => b.fecha !== null);
}

function buildDescripcionRaw(block) {
  return block.descLines.join(" ").replace(/\s{2,}/g, " ").trim();
}

function ocrBlocksToImportRows(blocks, banco, bankDetected) {
  const result = [];
  for (const block of blocks) {
    if (!block.fecha) continue;
    if (!block.amountTexts.length) {
      // Respaldo: si ningún monto cayó del lado derecho, se busca dentro
      // de la descripción.
      for (let i = 0; i < block.descLines.length; i++) {
        const tokens = block.descLines[i].split(/\s+/);
        const found = tokens.find((t) => looksLikeAmountToken(t));
        if (found) {
          block.amountTexts.push(found);
          block.descLines[i] = tokens.filter((t) => t !== found).join(" ");
          break;
        }
      }
    }
    const descripcionRaw = buildDescripcionRaw(block);
    if (!descripcionRaw) continue;
    const amountText = block.amountTexts[0];
    const parsedMonto = amountText ? parseOcrAmount(amountText) : null;
    const hasExplicitSign = !!(amountText && /^[-(]/.test(amountText.trim()));
    const isZelleCandidate = descripcionRaw.toLowerCase().includes("zelle");
    const descripcion = cleanBankDescription(descripcionRaw) || descripcionRaw || "(sin descripción)";

    let monto = null;
    let needsReview = parsedMonto === null;
    if (parsedMonto !== null) {
      if (hasExplicitSign) {
        monto = parsedMonto;
      } else {
        const magnitude = Math.abs(parsedMonto);
        const looksExpense = OCR_EXPENSE_KEYWORDS_RE.test(descripcionRaw);
        const looksIncome = OCR_INCOME_KEYWORDS_RE.test(descripcionRaw);
        if (looksExpense && !looksIncome) {
          monto = -magnitude;
        } else if (looksIncome && !looksExpense) {
          monto = magnitude;
        } else {
          monto = magnitude;
          needsReview = true;
        }
      }
    }

    result.push({
      _id: nextImportId(),
      fecha: block.fecha,
      descripcion,
      descripcionRaw,
      categoria: "",
      banco,
      bankDetected,
      monto: monto ?? 0,
      type: monto !== null && monto < 0 ? "expense" : "income",
      isZelleCandidate,
      duplicado: false,
      needsReview,
    });
  }
  return result;
}

let _tesseractLoadPromise = null;

function loadTesseractLib() {
  if (window.Tesseract) return Promise.resolve();
  if (_tesseractLoadPromise) return _tesseractLoadPromise;
  _tesseractLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el motor OCR. Verifica tu conexión."));
    document.head.appendChild(script);
  });
  return _tesseractLoadPromise;
}

export async function processImportImage(file) {
  await loadTesseractLib();
  showLoading("Leyendo imagen...");
  try {
    const ocrResult = await window.Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          showLoading(`Leyendo imagen... ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    const words = ocrResult.data.words || [];
    if (!words.length) return [];
    const lines = stripDividerLines(clusterWordsIntoLines(words));
    // Detecta el banco por el texto ya reconstruido (lines), no por
    // ocrResult.data.text — el texto "crudo" de Tesseract reordena la
    // lectura con su propia lógica y puede mezclar columnas en layouts de
    // escritorio (causó el bug "Wells Fargo detectado como Chase").
    const linesText = lines.map((l) => l.words.map((w) => w.text).join(" ")).join(" ");
    const detectedBanco = detectBankFromText(linesText);
    const banco = detectedBanco || appState.banks[0] || "Banco";
    const imageWidth = Math.max(1, ...words.map((w) => w.bbox.x1));
    const xSplit = findColumnSplit(lines, imageWidth);
    let blocks = reconstructTransactionBlocks(lines, xSplit);
    // Formato de app móvil no encaja con el parser de 2 columnas — si no
    // devolvió nada, se reintenta con el parser de carry-forward de fecha.
    if (!blocks.length) {
      const mobileBlocks = reconstructMobileTransactionBlocks(lines);
      if (mobileBlocks.length) blocks = mobileBlocks;
    }
    return ocrBlocksToImportRows(blocks, banco, !!detectedBanco);
  } finally {
    hideLoading();
  }
}

/* ===================================================================
 ESCANEAR RECIBO — OCR de un solo ticket de compra (no extracto bancario)
 Reutiliza loadTesseractLib/clusterWordsIntoLines; extractor propio porque
 un recibo es 1 sola transacción con layout vertical, no N filas con fecha.
 =================================================================== */

const RECEIPT_DATE_DMY_RE = /\b([0-9OIl]{1,2})[-\/]([A-Za-z]{3,9})[-\/]([0-9]{4})\b/;

function extractReceiptDateDMY(text) {
  const m = (text || "").match(RECEIPT_DATE_DMY_RE);
  if (!m) return null;
  return tryParseOcrDateLine(m[2], m[1], m[3]);
}

function lineText(line) {
  return line.words.map((w) => w.text).join(" ").trim();
}

// Limpia el OCR de ruido (caracteres sueltos del fondo de la foto) para
// comparar solo letras — así "| Total" o "Tota1)" igual matchean "total".
function receiptCleanWord(text) {
  return (text || "").toLowerCase().replace(/[^a-z]/g, "");
}

// Busca por palabra (no por línea completa) porque el ruido del OCR agrega
// caracteres antes de la etiqueta y un regex anclado al inicio de línea
// nunca matchea. "Subtotal" no choca porque limpia a "subtotal", no a "total".
function extractReceiptTotal(lines) {
  for (const line of lines) {
    const words = line.words;
    for (let i = 0; i < words.length; i++) {
      const clean = receiptCleanWord(words[i].text);
      const prevClean = receiptCleanWord(words[i - 1]?.text);
      const isLabel =
        clean === "total" ||
        clean === "importe" ||
        (clean === "due" && (prevClean === "amount" || prevClean === "balance")) ||
        (clean === "pagar" && prevClean === "a");
      if (!isLabel) continue;
      for (let j = i + 1; j < words.length; j++) {
        if (!looksLikeAmountToken(words[j].text)) continue;
        const parsed = parseOcrAmount(words[j].text);
        if (parsed !== null) return Math.abs(parsed);
      }
    }
  }
  return null;
}

// Preprocesa la foto (gris + más contraste) antes del OCR — mejora la
// lectura cuando el fondo de la foto introduce ruido visual.
function preprocessReceiptImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const contrast = 1.4;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const adjusted = (gray - 128) * contrast + 128;
        const clamped = Math.max(0, Math.min(255, adjusted));
        data[i] = data[i + 1] = data[i + 2] = clamped;
      }
      ctx.putImageData(imgData, 0, 0);
      URL.revokeObjectURL(img.src);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function extractReceiptData(lines) {
  const amount = extractReceiptTotal(lines);

  let fecha = null;
  for (const line of lines) {
    const text = lineText(line);
    if (!text) continue;
    fecha = extractReceiptDateDMY(text) || extractLeadingOcrDate(text)?.fecha || extractLeadingNumericDate(text)?.fecha || null;
    if (fecha) break;
  }

  const comercio = extractReceiptMerchant(lines);

  return { amount, fecha, comercio };
}

// El ruido del fondo de la foto a veces se lee como texto ANTES de que
// empiece el recibo real. Se ancla en el sufijo legal (LLC/Inc/Corp) que
// casi todo comercio en EE.UU. imprime en el encabezado, y recorta hacia
// atrás hasta la primera palabra real (4+ letras).
const RECEIPT_LEGAL_SUFFIX_RE = /^(llc|inc|corp|co|ltd)$/i;

function extractReceiptMerchant(lines) {
  for (let li = 0; li < Math.min(lines.length, 10); li++) {
    const words = lines[li].words;
    for (let i = 0; i < words.length; i++) {
      const clean = (words[i].text || "").replace(/[.,]/g, "");
      if (!RECEIPT_LEGAL_SUFFIX_RE.test(clean)) continue;
      let start = i;
      for (let j = 0; j < i; j++) {
        const w = (words[j].text || "").replace(/[^a-zA-Z]/g, "");
        if (w.length >= 4) {
          start = j;
          break;
        }
      }
      return toTitleCase(words.slice(start, i + 1).map((w) => w.text).join(" ").trim());
    }
  }
  const firstLine = lines.find((l) => lineText(l).length > 0);
  return firstLine ? toTitleCase(lineText(firstLine)) : null;
}

export async function processReceiptImage(file) {
  await loadTesseractLib();
  showLoading("Leyendo recibo...");
  try {
    const source = await preprocessReceiptImage(file).catch(() => file);
    const ocrResult = await window.Tesseract.recognize(source, "eng+spa", {
      logger: (m) => {
        if (m.status === "recognizing text" && typeof m.progress === "number") {
          showLoading(`Leyendo recibo... ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    const words = ocrResult.data.words || [];
    if (!words.length) return null;
    const lines = clusterWordsIntoLines(words);
    return extractReceiptData(lines);
  } finally {
    hideLoading();
  }
}
