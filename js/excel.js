// =====================================================================
// excel.js — Crear y leer archivos de Excel (.xlsx) sin librerías.
//
// Un .xlsx es en realidad un ZIP con varios archivos XML adentro:
//   [Content_Types].xml, xl/workbook.xml, xl/styles.xml, xl/worksheets/sheet1.xml…
// Aquí armamos ese ZIP a mano (así funciona sin internet) y también lo
// leemos para importar. Para leer archivos comprimidos se usa
// DecompressionStream, que ya viene en los navegadores.
// =====================================================================

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Estilos disponibles (el número es su posición en styles.xml → cellXfs)
export const ESTILO = {
  normal: 0, titulo: 1, subtitulo: 2, encabezado: 3, texto: 4, numero: 5,
  colones: 6, dolares: 7, totalTexto: 8, totalColones: 9, totalDolares: 10, totalNumero: 11, fecha: 12,
};

// Excel guarda las fechas como "días desde el 30/12/1899". "2026-11-10" → 46336
export function fechaExcel(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
}

// ---------------------------------------------------------------------
// ESCRIBIR
// hojas: [{ nombre, filas: [[celda…]…], anchos: [n…], congelar: nFilas, filtro: "A4:G20", altos: {fila0: pts} }]
// celda: null | { v: texto o número, s: ESTILO.x, f: "SUM(F5:F9)" }
// ---------------------------------------------------------------------
export function crearXlsx(hojas) {
  const nombres = hojas.map((h, i) => nombreHoja(h.nombre, i));
  const archivos = [
    { nombre: "[Content_Types].xml", texto: tiposContenido(hojas.length) },
    { nombre: "_rels/.rels", texto: `${XML}<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="${NS_DOC}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { nombre: "xl/workbook.xml", texto: libroXml(hojas, nombres) },
    { nombre: "xl/_rels/workbook.xml.rels", texto: relacionesLibro(hojas.length) },
    { nombre: "xl/styles.xml", texto: ESTILOS_XML },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, texto: hojaXml(h) })),
  ];
  return crearZip(archivos);
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const NS_DOC = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const esc = (s) => String(s)
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

// 0 → A, 25 → Z, 26 → AA…
export function letra(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function nombreHoja(nombre, i) {
  const limpio = String(nombre || `Hoja ${i + 1}`).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return limpio || `Hoja ${i + 1}`;
}

function tiposContenido(n) {
  const hojas = Array.from({ length: n }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    + `${hojas}</Types>`;
}

function libroXml(hojas, nombres) {
  const lista = nombres.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  // Excel necesita este "nombre definido" para recordar el filtro de cada hoja
  const filtros = hojas.map((h, i) => h.filtro
    ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(nombres[i].replace(/'/g, "''"))}'!${h.filtro.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")}</definedName>`
    : "").join("");
  return `${XML}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_DOC}"><sheets>${lista}</sheets>${filtros ? `<definedNames>${filtros}</definedNames>` : ""}</workbook>`;
}

function relacionesLibro(n) {
  const hojas = Array.from({ length: n }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="${NS_DOC}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
  return `${XML}<Relationships xmlns="${NS_REL}">${hojas}<Relationship Id="rId${n + 1}" Type="${NS_DOC}/styles" Target="styles.xml"/></Relationships>`;
}

function celdaXml(c, ref) {
  if (!c) return "";
  const s = c.s ? ` s="${c.s}"` : "";
  if (c.f) return `<c r="${ref}"${s}><f>${esc(c.f)}</f>${typeof c.v === "number" ? `<v>${c.v}</v>` : ""}</c>`;
  if (c.v === undefined || c.v === null || c.v === "") return s ? `<c r="${ref}"${s}/>` : "";
  if (typeof c.v === "number" && Number.isFinite(c.v)) return `<c r="${ref}"${s}><v>${c.v}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
}

function hojaXml(h) {
  const filas = h.filas.map((fila, i) => {
    const alto = h.altos?.[i] ? ` ht="${h.altos[i]}" customHeight="1"` : "";
    return `<row r="${i + 1}"${alto}>${(fila || []).map((c, j) => celdaXml(c, letra(j) + (i + 1))).join("")}</row>`;
  }).join("");
  const vista = h.congelar
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${h.congelar}" topLeftCell="A${h.congelar + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : "";
  const columnas = h.anchos?.length
    ? `<cols>${h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const filtro = h.filtro ? `<autoFilter ref="${h.filtro}"/>` : "";
  return `${XML}<worksheet xmlns="${NS_MAIN}">${vista}${columnas}<sheetData>${filas}</sheetData>${filtro}</worksheet>`;
}

// Fuentes, colores y formatos (₡ sin decimales, $ con 2 decimales)
const ESTILOS_XML = `${XML}<styleSheet xmlns="${NS_MAIN}">`
  + `<numFmts count="4"><numFmt numFmtId="164" formatCode="&quot;₡&quot;#,##0"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="#,##0.##"/><numFmt numFmtId="167" formatCode="dd/mm/yyyy"/></numFmts>`
  + `<fonts count="5">`
  + `<font><sz val="11"/><name val="Calibri"/></font>`
  + `<font><b/><sz val="15"/><color rgb="FF1B1300"/><name val="Calibri"/></font>`
  + `<font><i/><sz val="10"/><color rgb="FF6B6F76"/><name val="Calibri"/></font>`
  + `<font><b/><sz val="11"/><color rgb="FF1B1300"/><name val="Calibri"/></font>`
  + `<font><b/><sz val="11"/><name val="Calibri"/></font>`
  + `</fonts>`
  + `<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>`
  + `<fill><patternFill patternType="solid"><fgColor rgb="FFE8892B"/><bgColor indexed="64"/></patternFill></fill>`
  + `<fill><patternFill patternType="solid"><fgColor rgb="FFF4F1EC"/><bgColor indexed="64"/></patternFill></fill></fills>`
  + `<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border>`
  + `<border><left/><right/><top/><bottom style="thin"><color rgb="FFE2DDD5"/></bottom><diagonal/></border>`
  + `<border><left/><right/><top style="medium"><color rgb="FF1B1300"/></top><bottom/><diagonal/></border></borders>`
  + `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
  + `<cellXfs count="13">`
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`                                                    // 0 normal
  + `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>`                                      // 1 título
  + `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>`                                      // 2 subtítulo
  + `<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` // 3 encabezado
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` // 4 texto
  + `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>` // 5 número
  + `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>` // 6 colones
  + `<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>` // 7 dólares
  + `<xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>`           // 8 total (texto)
  + `<xf numFmtId="164" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` // 9 total ₡
  + `<xf numFmtId="165" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` // 10 total $
  + `<xf numFmtId="0" fontId="4" fillId="3" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` // 11 total número
  + `<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>` // 12 fecha
  + `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// ---------- ZIP (método "store": sin comprimir, más simple) ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function crearZip(archivos) {
  const cod = new TextEncoder();
  const partes = [], central = [];
  let posicion = 0;
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const a of archivos) {
    const nombre = cod.encode(a.nombre), datos = cod.encode(a.texto), crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(10, hora, true); local.setUint16(12, fecha, true); local.setUint32(14, crc, true);
    local.setUint32(18, datos.length, true); local.setUint32(22, datos.length, true); local.setUint16(26, nombre.length, true);
    partes.push(local.buffer, nombre, datos);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true); dir.setUint16(4, 20, true); dir.setUint16(6, 20, true); dir.setUint16(8, 0x0800, true);
    dir.setUint16(12, hora, true); dir.setUint16(14, fecha, true); dir.setUint32(16, crc, true);
    dir.setUint32(20, datos.length, true); dir.setUint32(24, datos.length, true); dir.setUint16(28, nombre.length, true);
    dir.setUint32(42, posicion, true);
    central.push(dir.buffer, nombre);
    posicion += 30 + nombre.length + datos.length;
  }
  const tamano = central.reduce((s, p) => s + p.byteLength, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamano, true); fin.setUint32(16, posicion, true);
  return new Blob([...partes, ...central, fin.buffer], { type: TIPO_XLSX });
}

// ---------------------------------------------------------------------
// LEER: devuelve las filas de la primera hoja como [[celda, celda…], …]
// ---------------------------------------------------------------------
export async function leerArchivo(archivo) {
  const nombre = archivo.name.toLowerCase();
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (nombre.endsWith(".xls") && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("Ese archivo es de un Excel antiguo (.xls). Ábrelo en Excel y guárdalo como «Libro de Excel (.xlsx)».");
  }
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return leerXlsx(bytes.buffer); // "PK" = es un ZIP
  return leerCsv(decodificar(bytes));
}

// Los CSV de Excel a veces vienen en UTF-8 y a veces en "ANSI" (Windows-1252)
function decodificar(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

function leerCsv(texto) {
  texto = texto.replace(/^﻿/, "");
  const primera = texto.split(/\r?\n/)[0] || "";
  const sep = [";", ",", "\t"].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else comillas = false; }
      else campo += ch;
    } else if (ch === '"' && campo === "") comillas = true; // comillas sólo al inicio del campo (3/8" es texto normal)
    else if (ch === sep) { fila.push(campo); campo = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

async function leerZip(buffer) {
  const v = new DataView(buffer);
  let fin = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("No pude leer el archivo de Excel (parece dañado).");
  const total = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const dec = new TextDecoder();
  const archivos = {};
  for (let n = 0; n < total; n++) {
    const metodo = v.getUint16(p + 10, true), tamano = v.getUint32(p + 20, true);
    const lnom = v.getUint16(p + 28, true), lext = v.getUint16(p + 30, true), lcom = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(new Uint8Array(buffer, p + 46, lnom));
    const inicio = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    archivos[nombre] = { metodo, datos: new Uint8Array(buffer, inicio, tamano) };
    p += 46 + lnom + lext + lcom;
  }
  return async (nombre) => {
    const a = archivos[nombre];
    if (!a) return null;
    let datos = a.datos;
    if (a.metodo === 8) {
      const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      datos = new Uint8Array(await new Response(flujo).arrayBuffer());
    } else if (a.metodo !== 0) throw new Error("Formato de Excel no soportado.");
    return dec.decode(datos);
  };
}

async function leerXlsx(buffer) {
  const leer = await leerZip(buffer);
  const xml = async (n) => { const t = await leer(n); return t ? new DOMParser().parseFromString(t, "application/xml") : null; };
  const todos = (doc, etiqueta) => [...doc.getElementsByTagNameNS("*", etiqueta)];

  // ¿Cuál es la primera hoja?
  let ruta = "xl/worksheets/sheet1.xml";
  const libro = await xml("xl/workbook.xml"), rels = await xml("xl/_rels/workbook.xml.rels");
  const hoja1 = libro && todos(libro, "sheet")[0];
  const rid = hoja1?.getAttributeNS(NS_DOC, "id") || hoja1?.getAttribute("r:id");
  const rel = rels && todos(rels, "Relationship").find((r) => r.getAttribute("Id") === rid);
  if (rel) { const t = rel.getAttribute("Target"); ruta = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`; }

  // Textos compartidos (Excel guarda cada texto una sola vez)
  const compartidos = [];
  const ss = await xml("xl/sharedStrings.xml");
  if (ss) for (const si of todos(ss, "si")) compartidos.push(todos(si, "t").map((t) => t.textContent).join(""));

  const hoja = await xml(ruta);
  if (!hoja) throw new Error("No encontré la hoja dentro del archivo.");
  const filas = [];
  for (const fila of todos(hoja, "row")) {
    const datos = [];
    let col = 0;
    for (const c of todos(fila, "c")) {
      const ref = c.getAttribute("r");
      if (ref) col = indiceColumna(ref);
      const tipo = c.getAttribute("t");
      const v = todos(c, "v")[0]?.textContent;
      let valor;
      if (tipo === "s") valor = compartidos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = todos(c, "t").map((t) => t.textContent).join("");
      else if (tipo === "str" || tipo === "e") valor = v ?? "";
      else if (tipo === "b") valor = v === "1" ? "Sí" : "No";
      else valor = v === undefined ? "" : Number(v);
      datos[col] = valor;
      col++;
    }
    const r = Number(fila.getAttribute("r")) - 1;
    filas[Number.isInteger(r) && r >= 0 ? r : filas.length] = Array.from(datos, (x) => x ?? "");
  }
  return Array.from(filas, (f) => f || []);
}

function indiceColumna(ref) {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/i)[0].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// "₡1 500,50", "1,500.50", "$12.5" → número (o null si no es número)
export function aNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  let s = String(valor ?? "").replace(/[₡$¢\s ]|CRC|USD|colones?/gi, "").trim();
  if (!s) return null;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    // el último separador es el de los decimales
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma >= 0) {
    // "1,500" o "1,500,000" = miles; "2,5" = decimal
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, ""); // "1.500.000"
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
