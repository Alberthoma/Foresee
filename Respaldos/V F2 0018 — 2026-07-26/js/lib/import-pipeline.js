// Foresee 2.0 — import-pipeline.js
// Pipeline de importación CSV/Excel: parseo, detección de banco, limpieza
// de descripción, emparejamiento de Zelle y detección de duplicados. Ver
// Proyecto-Anterior/MD/Pipeline de Importación CSV — Referencia.md para el
// flujo completo función por función — este módulo replica ese pipeline
// sin alterar el orden ni los criterios (el orden de limpieza de ruido vs.
// extracción de código importa, ver lecciones aprendidas en ese documento).
import { appState } from "../state.js";
import { sharesRefToken } from "./balances.js";
import { sharesDescriptionWord, withinDays } from "./utils.js";

export const IMPORT_ALIASES = {
  date: ["date", "fecha", "posting date", "transaction date"],
  descripcion: ["description", "descripcion", "descripción", "memo", "narrative"],
  monto: ["amount", "monto", "importe", "transaction amount"],
};

export function parseCSVImport(text) {
  const rows = [];
  let row = [], field = "", inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuote) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else field += ch;
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && next === "\n")) {
        if (ch === "\r") i++;
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

function findHeaderIdxImport(rows) {
  const dateKeys = IMPORT_ALIASES.date;
  const descKeys = IMPORT_ALIASES.descripcion;
  const amtKeys = IMPORT_ALIASES.monto;
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const norm = rows[i].map((c) => c.toLowerCase().replace(/['"]/g, "").trim());
    if (
      norm.some((c) => dateKeys.includes(c)) &&
      norm.some((c) => descKeys.includes(c)) &&
      norm.some((c) => amtKeys.includes(c))
    )
      return i;
  }
  return 0;
}

function buildColMapImport(headerRow) {
  const map = { date: -1, descripcion: -1, monto: -1 };
  headerRow.forEach((cell, idx) => {
    const norm = cell.toLowerCase().replace(/['"]/g, "").trim();
    for (const key of Object.keys(IMPORT_ALIASES)) {
      if (map[key] === -1 && IMPORT_ALIASES[key].includes(norm)) map[key] = idx;
    }
  });
  return map;
}

// Lógica de matching compartida entre el nombre de archivo (CSV/XLSX) y el
// texto reconocido por OCR (foto) — mismo criterio, distinta fuente.
export function detectBankFromText(text) {
  const n = (text || "").toLowerCase();
  for (const b of appState.banks) {
    if (b && n.includes(b.toLowerCase())) return b;
  }
  const abbrevMap = [
    { re: /\bboa\b/, re2: /\bbofa\b/, canonical: "bank of america" },
    { re: /\bwf\b/, re2: /wellsfargo/, canonical: "wells fargo" },
  ];
  for (const { re, re2, canonical } of abbrevMap) {
    if (re.test(n) || re2.test(n)) {
      const match = appState.banks.find((b) => (b || "").toLowerCase() === canonical);
      if (match) return match;
    }
  }
  return null;
}

function detectBankImport(filename) {
  return detectBankFromText(filename);
}

function normalizeImportDate(str) {
  if (!str) return "";
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

function normalizeImportAmount(str) {
  if (!str && str !== 0) return null;
  const s = String(str).trim().replace(/,/g, "").replace(/^\((.+)\)$/, "-$1");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

export function bankBadgeClass(banco) {
  const n = (banco || "").toLowerCase();
  if (n.includes("bank of america")) return "import-bank-boa";
  if (n.includes("chase")) return "import-bank-chase";
  if (n.includes("wells fargo")) return "import-bank-wells";
  return "import-bank-other";
}

let importNextId = 0;
export function setImportNextId(n) { importNextId = n; }
export function nextImportId() { return importNextId++; }

export function processImportRows(rawRows, filename) {
  const headerIdx = findHeaderIdxImport(rawRows);
  const colMap = buildColMapImport(rawRows[headerIdx]);
  const banco = detectBankImport(filename);
  if (!banco) {
    const err = new Error(
      `No se pudo identificar el banco desde el nombre del archivo "${filename}". Renómbralo para incluir el nombre de uno de tus bancos configurados (${appState.banks.join(", ")}) y vuelve a subirlo.`,
    );
    err.bankNotDetected = true;
    throw err;
  }
  const result = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    const fechaRaw = colMap.date >= 0 ? String(r[colMap.date] || "").trim() : "";
    const fecha = normalizeImportDate(fechaRaw);
    if (!fecha) continue;
    const descripcionRaw = colMap.descripcion >= 0 ? String(r[colMap.descripcion] || "").trim() : "";
    const montoRaw =
      colMap.monto >= 0
        ? typeof r[colMap.monto] === "number"
          ? r[colMap.monto]
          : String(r[colMap.monto] || "")
        : "";
    const monto = normalizeImportAmount(montoRaw);
    if (monto === null) continue;
    const descripcion = cleanBankDescription(descripcionRaw) || descripcionRaw;
    const isZelleCandidate = descripcionRaw.toLowerCase().includes("zelle");
    result.push({
      _id: nextImportId(),
      fecha,
      descripcion,
      descripcionRaw,
      categoria: "",
      banco,
      bankDetected: true,
      monto,
      type: monto < 0 ? "expense" : "income",
      isZelleCandidate,
      duplicado: false,
    });
  }
  return result;
}

export async function parseXLSXImport(arrayBuffer, filename) {
  const wb = window.XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  return processImportRows(rawRows, filename);
}

export function pairZelleRows(rows) {
  const candidates = rows.filter((r) => r.isZelleCandidate);
  const paired = new Set();
  for (let i = 0; i < candidates.length; i++) {
    if (paired.has(candidates[i]._id)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      if (paired.has(candidates[j]._id)) continue;
      const a = candidates[i], b = candidates[j];
      if (Math.abs(a.monto) !== Math.abs(b.monto)) continue;
      if (!withinDays(a.fecha, b.fecha, 1)) continue;
      if ((a.banco || "") === (b.banco || "")) continue;
      if (!sharesRefToken(a.descripcionRaw || a.descripcion, b.descripcionRaw || b.descripcion)) continue;
      const aOut = a.monto < 0;
      a.type = "transfer";
      a.transferDirection = aOut ? "out" : "in";
      b.type = "transfer";
      b.transferDirection = aOut ? "in" : "out";
      paired.add(a._id);
      paired.add(b._id);
      break;
    }
  }
  candidates.forEach((r) => {
    if (paired.has(r._id)) return;
    const amt = Math.abs(r.monto);
    const dbMatch = appState.transactions.find((tx) => {
      if (tx.type !== "transfer") return false;
      if (!(tx.description || "").toLowerCase().includes("zelle")) return false;
      if (Math.abs(tx.amount) !== amt) return false;
      if (!withinDays(tx.date, r.fecha, 1)) return false;
      if ((tx.bank || "") === (r.banco || "")) return false;
      return sharesRefToken(tx.description || "", r.descripcionRaw || r.descripcion);
    });
    if (dbMatch) {
      r.type = "transfer";
      r.transferDirection = r.monto < 0 ? "out" : "in";
    }
  });
}

export function cleanBankDescription(raw) {
  if (!raw) return raw;
  let s = raw.trim();
  s = s.replace(/^.*?\bAuthorized\s+On\s+\d{1,2}\/\d{1,2}\s*/i, "");
  s = s.replace(/^(Pos\s+Purchase|Pos\s+Debit|Pre-Auth\s+Purchase)\s*/i, "");
  s = s.replace(/^Payment\s+To\s*/i, "");
  s = s.replace(/^Zelle\s+(Payment\s+)?(To|From)\s*/i, "");
  s = s.replace(/^Recurring\s+Transfer\s+(To|From)\s*/i, "");
  s = s.replace(/^(Purchase|Debit|Credit|Withdrawal)\s+/i, "");
  s = s.trim();
  s = s.replace(/^\S+\s+-\s+/, "");
  s = s.trim();
  s = s.replace(/\bCard\s*\d+\b/gi, "");
  s = s.replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, "");
  // "ID" se excluye a propósito: en descripciones bancarias casi siempre es
  // "Identification" (Web Id, PPD ID), no el estado Idaho.
  s = s.replace(
    /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/gi,
    "",
  );
  s = s.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, "");
  s = s.replace(/\bA\/[RP]\b/gi, "");
  s = s.replace(/\bEnding\s+In\s+\d+\b/gi, "");
  s = s.replace(/\*/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  s = s.replace(/^[-\s]+|[-\s]+$/g, "").trim();
  let code = null;
  const sCodeMatch = s.match(/\bS\d{12,}\b/);
  if (sCodeMatch) {
    code = sCodeMatch[0];
    s = s.replace(sCodeMatch[0], "");
  }
  if (!code) {
    const webIdMatch = s.match(/\bID[:\s]+(\d{8,})\b/i);
    if (webIdMatch) {
      code = webIdMatch[1];
      s = s.replace(webIdMatch[0], "");
    }
  }
  if (!code) {
    const refMatch = s.match(/\b(?:REF\s*#|Conf\s*#)\s*([A-Za-z0-9]{5,})\b/i);
    if (refMatch) {
      code = refMatch[1];
      s = s.replace(refMatch[0], "");
    }
  }
  if (!code) {
    const confMatch = s.match(/\b([A-Z0-9]{12,})\b/);
    if (confMatch) {
      code = confMatch[1];
      s = s.replace(confMatch[1], "");
    }
  }
  if (!code) {
    const mixedTokens = s.match(/\b[a-zA-Z0-9]{6,}\b/g) || [];
    const mixedCode = mixedTokens.find((t) => /\d/.test(t) && /[a-zA-Z]/.test(t));
    if (mixedCode) {
      code = mixedCode;
      s = s.replace(mixedCode, "");
    }
  }
  s = s.replace(/\s{2,}/g, " ").trim();
  const rawWords = s
    .split(/\s+/)
    .map((w) => w.split(/[^A-Za-z0-9-]/)[0])
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w));
  const words = [];
  for (const w of rawWords) {
    if (words.length && words[words.length - 1].toLowerCase() === w.toLowerCase()) continue;
    words.push(w);
  }
  let merchant = "";
  if (words.length > 0) merchant = words.slice(0, 2).join(" ");
  merchant = merchant.toLowerCase().replace(/(^|[\s\-*])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
  if (!merchant && !code) return raw;
  if (merchant && code) return `${merchant} - ${code}`;
  return merchant || code || raw;
}

export function extractImportCode(desc) {
  if (!desc) return null;
  const sCode = (desc || "").match(/\bS\d{12,}\b/);
  if (sCode) return sCode[0].toLowerCase();
  const webId = (desc || "").match(/\b(\d{8,})\b/);
  if (webId) return webId[1];
  return null;
}

export function detectImportDuplicates(rows) {
  rows.forEach((row) => {
    const amt = Math.abs(row.monto);
    const rowCode = extractImportCode(row.descripcion);
    row.duplicado = appState.transactions.some((tx) => {
      if (Math.abs(tx.amount) !== amt || tx.date !== row.fecha) return false;
      if (rowCode) {
        const txCode = extractImportCode(tx.description || "");
        if (txCode && txCode === rowCode) return true;
      }
      const sameBank = (tx.bank || "").toLowerCase().trim() === (row.banco || "").toLowerCase().trim();
      if (sameBank && (tx.description || "").toLowerCase().trim() === (row.descripcion || "").toLowerCase().trim())
        return true;
      // Palabra compartida solo cuenta como duplicado si es el mismo banco:
      // dos lados de una transferencia entre bancos distintos NO son duplicados.
      return sameBank && sharesDescriptionWord(tx.description, row.descripcion);
    });
  });
}
