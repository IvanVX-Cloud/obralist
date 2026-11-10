// =====================================================================
// voz.js — Dictar materiales: "10 sacos de cemento" → busca "Cemento gris
// (saco 50 kg)" en tu catálogo y pone cantidad 10.
//
// Usa el reconocimiento de voz del navegador (Web Speech API). En Chrome el
// audio lo procesa el servicio de voz de Google, igual que el micrófono del teclado.
// =====================================================================

const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
export const vozDisponible = Boolean(Reconocimiento);

// Escucha una frase y devuelve el texto (Promesa).
export function escuchar() {
  return new Promise((resolver, rechazar) => {
    const r = new Reconocimiento();
    r.lang = "es-CR";
    r.interimResults = false;
    r.maxAlternatives = 1;
    let terminado = false;
    r.onresult = (e) => { terminado = true; resolver(e.results[0][0].transcript); };
    r.onerror = (e) => {
      terminado = true;
      rechazar(new Error(e.error === "not-allowed" ? "Permite el uso del micrófono para dictar" : "No te escuché bien, intenta de nuevo"));
    };
    r.onend = () => { if (!terminado) rechazar(new Error("No escuché nada, intenta de nuevo")); };
    r.start();
  });
}

const NUMEROS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, veinte: 20,
  veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100, ciento: 100, media: 0.5, medio: 0.5,
};

// Palabras que no ayudan a encontrar el material
const RELLENO = new Set([
  "de", "del", "la", "el", "los", "las", "unos", "unas", "para", "con", "y", "a", "por", "favor",
  "saco", "sacos", "bolsa", "bolsas", "metro", "metros", "m", "rollo", "rollos", "unidad", "unidades",
  "und", "tubo", "tubos", "cubeta", "cubetas", "galon", "galones", "kilo", "kilos", "kg", "pieza", "piezas",
  "agrega", "agregar", "ocupo", "necesito", "pon", "poner",
]);

// Antes de estas palabras, un número es parte del nombre (ej. "cable número 12")
const ANTES_DE_MEDIDA = new Set(["numero", "calibre", "#", "no", "no."]);

export const normalizar = (t) =>
  String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9#.,\s/"]/g, " ").trim();

function aNumero(palabra) {
  if (/^\d+([.,]\d+)?$/.test(palabra)) return parseFloat(palabra.replace(",", "."));
  return NUMEROS[palabra] ?? null;
}

const singular = (p) => (p.endsWith("es") && p.length > 4 ? p.slice(0, -2) : p.endsWith("s") ? p.slice(0, -1) : p);

// "10 sacos de cemento" → { cantidad: 10, producto: {…}, resto: "sacos de cemento" }
export function interpretar(texto, productos) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  let cantidad = null;
  const resto = [];
  palabras.forEach((p, i) => {
    const n = aNumero(p);
    const esMedida = i > 0 && ANTES_DE_MEDIDA.has(palabras[i - 1]);
    if (n !== null && cantidad === null && !esMedida) cantidad = n;
    // Ya con cantidad, "media" es una medida: "varilla de media" = 1/2"
    else if (cantidad !== null && (p === "media" || p === "medio")) resto.push("1/2");
    else resto.push(p);
  });

  const claves = resto.filter((p) => !RELLENO.has(p) && p !== "numero" && p !== "calibre");
  let mejor = null, mejorPuntaje = 0;
  for (const prod of productos) {
    const nombre = normalizar(prod.nombre);
    const aciertos = claves.filter((c) => nombre.includes(c) || nombre.includes(singular(c))).length;
    const puntaje = claves.length ? aciertos / claves.length : 0;
    const empate = puntaje === mejorPuntaje && mejor && prod.nombre.length < mejor.nombre.length;
    if (puntaje > mejorPuntaje || (puntaje > 0 && empate)) { mejor = prod; mejorPuntaje = puntaje; }
  }
  return { cantidad, producto: mejorPuntaje >= 0.5 ? mejor : null, resto: resto.join(" ") };
}
