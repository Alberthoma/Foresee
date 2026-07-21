// Foresee 2.0 — number-parser.js
// Convierte números escritos en español a valor numérico ("quince con
// cuarenta y cinco" → 15.45), con encadenamiento de "mil"/"millón".
// Se exporta también el diccionario base (wordValues) para que
// voice-parser.js derive de él las palabras válidas de día del mes,
// en vez de mantener una segunda lista de números escritos aparte
// (el origen tenía dos diccionarios casi idénticos por separado).
export const wordValues = {
  cero: 0, un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciséis: 16, dieciseis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veintiún: 21, veintiuno: 21, veintidós: 22, veintidos: 22,
  veintitrés: 23, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiséis: 26, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

function parseChunk(words) {
  return words.reduce((n, w) => n + (wordValues[w] || 0), 0);
}

export function parseSpanishNumber(text) {
  if (!text || typeof text !== "string") return null;
  const clean = text.toLowerCase().trim();
  let intStr = clean, decStr = "";
  for (const sep of [" con ", " punto ", " coma "]) {
    if (clean.includes(sep)) {
      const p = clean.split(sep);
      intStr = p[0];
      decStr = p.slice(1).join(sep);
      break;
    }
  }
  const words = intStr.split(/\s+/).filter((w) => w !== "y" && w);
  let total = 0, chunk = [];
  for (const w of words) {
    if (w === "mil") {
      total += (parseChunk(chunk) || 1) * 1000;
      chunk = [];
    } else if (w === "millon" || w === "millones") {
      total += (parseChunk(chunk) || 1) * 1000000;
      chunk = [];
    } else chunk.push(w);
  }
  total += parseChunk(chunk);
  if (decStr) {
    const dv = parseChunk(decStr.split(/\s+/).filter((w) => w !== "y" && w));
    if (dv > 0) total = parseFloat(`${total}.${String(dv).padStart(2, "0")}`);
  }
  return total > 0 ? total : null;
}
