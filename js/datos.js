// =====================================================================
// datos.js — El "modelo": qué datos guarda la app y cómo se guardan.
//
// Todo vive en un solo objeto `db` (como una mini base de datos):
//   categorias  → Eléctrico, Obra negra, Plomería…
//   unidades    → pza, m, m², bulto, rollo…
//   productos   → tu catálogo de materiales con su último precio
//   proveedores → ferreterías / casas de materiales donde compras
//   listas      → cada obra con sus materiales (items)
//   compras     → historial: qué compraste, dónde, cuándo y a qué precio
//   gastos      → otros gastos: mano de obra, flete, permisos…
//   ventas      → materiales que vendiste: qué, a quién, a cuánto y lo que te costó
//
// Cada cosa tiene un `id` único. Así se "relacionan": un producto guarda
// `categoriaId` en vez del nombre, igual que en una base de datos real.
// Esto nos va a facilitar pasar todo a la nube (Supabase) más adelante.
// =====================================================================

import { iconoDesdeEmoji } from "./iconos.js";

const CLAVE = "obralist-v2";
const CLAVE_V1 = "obralist-v1"; // la versión anterior, para no perder datos
const CLAVE_RESCATE = "obralist-rescate-"; // copias de datos que no se pudieron leer (ver "rescatar")
export const CLAVE_SYNC = "obralist-sync"; // lo que nube.js recuerda de la última sincronización

export const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Fecha de hoy como "2026-11-09" en hora local.
export function hoy() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Sugerencias de oficio para el perfil (también se puede escribir otro).
export const OCUPACIONES = [
  "Electricista", "Maestro de obras", "Albañil", "Fontanero", "Pintor", "Soldador / Herrero",
  "Carpintero", "Enchapador", "Ingeniero/a", "Arquitecto/a", "Contratista", "Ayudante",
  "Ferretería / Proveedor", "Dueño/a de la obra",
];

// Oficios que se ofrecen al entrar por primera vez.
export const OFICIOS_RAPIDOS = [
  "Electricista", "Maestro de obras", "Albañil", "Fontanero", "Pintor",
  "Enchapador", "Soldador / Herrero", "Carpintero", "Contratista",
];

// Las categorías que más usa cada oficio: se muestran primero en toda la app.
export const CATEGORIAS_POR_OFICIO = {
  "Electricista": ["Eléctrico"],
  "Fontanero": ["Plomería"],
  "Pintor": ["Acabados"],
  "Enchapador": ["Acabados", "Obra negra"],
  "Albañil": ["Obra negra", "Acabados"],
  "Maestro de obras": ["Obra negra", "Acabados", "Plomería", "Eléctrico"],
  "Soldador / Herrero": ["Herrería"],
  "Carpintero": ["Carpintería"],
};

// Tus categorías, con las de tu oficio primero.
export function categoriasOrdenadas() {
  const prioridad = CATEGORIAS_POR_OFICIO[db.perfil.ocupacion] || [];
  const rango = (c) => { const i = prioridad.indexOf(c.nombre); return i < 0 ? 100 + db.categorias.indexOf(c) : i; };
  return [...db.categorias].sort((a, b) => rango(a) - rango(b));
}

// ¿Esta categoría es de las principales de mi oficio?
export const esDeMiOficio = (categoriaId) =>
  (CATEGORIAS_POR_OFICIO[db.perfil.ocupacion] || []).includes(categoria(categoriaId).nombre);

// "Ivan (Electricista)", o sólo lo que haya.
export function quienSoy(nombre, ocupacion) {
  const n = String(nombre || "").trim();
  const o = String(ocupacion || "").trim();
  return n && o ? `${n} (${o})` : n || o;
}

export const TIPOS_GASTO = [
  "Mano de obra", "Flete / acarreo", "Permisos y trámites",
  "Comida y viáticos", "Gasolina", "Otro",
];

// Gastos típicos de un negocio o emprendimiento.
const GASTOS_NEGOCIO = [
  "Materia prima", "Local", "Luz, agua e internet", "Salarios", "Envíos", "Empaque",
  "Publicidad", "Mantenimiento y reparaciones", "Gasolina", "Otro",
];

// Los tipos de gasto que se ofrecen, según lo que hace la persona.
// "actual" = el tipo de un gasto que se está editando (para no perderlo).
export function tiposGasto(actual = "") {
  const lista = usosSoloObras() ? TIPOS_GASTO
    : usa("obras") ? [...TIPOS_GASTO.slice(0, -1), ...GASTOS_NEGOCIO] : GASTOS_NEGOCIO;
  return [...new Set([...lista, actual].filter(Boolean))];
}

// ---------- Usos: para qué usa cada persona la app ----------
// Se pueden marcar los dos (alguien que hace obras y además vende).
// Según los usos, la app muestra u oculta secciones y cambia sus palabras.
export const USOS = {
  obras: { titulo: "Compro materiales para proyectos", detalle: "Listas por proyecto, presupuesto y bitácora", icono: "casco" },
  ventas: { titulo: "Vendo productos", detalle: "Tienda, ferretería, emprendimiento, reventa…", icono: "tienda" },
};

// Quien todavía no eligió, usa la app como siempre: para obras.
// (sólo cuentan los usos que existen: si alguien tenía marcado uno viejo, se ignora)
const usosGuardados = () => (db.perfil.usos || []).filter((u) => u in USOS);
export const usos = () => (usosGuardados().length ? usosGuardados() : ["obras"]);
export const usa = (uso) => usos().includes(uso);
export const usosElegidos = () => usosGuardados().length > 0;
const usosSoloObras = () => usos().length === 1 && usa("obras");

// Palabras que cambian según el uso: para obras se habla de "obra" y "material";
// para un negocio, de "lista" y "producto".
export function palabras() {
  if (usa("obras")) {
    return {
      obra: "proyecto", obras: "proyectos", Obra: "Proyecto", Obras: "Proyectos",
      misListas: "Mis listas de proyectos", nuevaLista: "Nueva lista de proyecto", nombreLista: "Nombre del proyecto",
      // Frases con artículo (proyecto es masculino y lista femenino, por eso van aparte).
      todas: "Todos los proyectos", nombreNueva: "Nombre del nuevo proyecto", presupuestoDe: "Presupuesto del proyecto",
      material: "material", materiales: "materiales", Material: "Material", Materiales: "Materiales",
    };
  }
  return {
    obra: "lista", obras: "listas", Obra: "Lista", Obras: "Listas",
    misListas: "Mis listas", nuevaLista: "Nueva lista", nombreLista: "Nombre de la lista",
    todas: "Todas las listas", nombreNueva: "Nombre de la nueva lista", presupuestoDe: "Presupuesto de la lista",
    material: "producto", materiales: "productos", Material: "Producto", Materiales: "Productos",
  };
}

// La frase debajo del logo.
export function lema() {
  if (usosSoloObras()) return "Materiales y gastos";
  return "Compras, ventas y gastos";
}

// Guarda los usos elegidos. Si deja de usar la app para obras, se quitan del catálogo
// los materiales de construcción DE EJEMPLO que nunca usó (no toca nada suyo).
// Si vuelve a marcar obras, regresan. Devuelve cuántos ejemplos quitó (-) o agregó (+).
export function cambiarUsos(nuevos) {
  const antes = usos();
  db.perfil.usos = nuevos;
  if (!nuevos.includes("obras")) return -quitarEjemplosDeObra();
  if (!antes.includes("obras")) return agregarEjemplosDeObra();
  return 0;
}

function quitarEjemplosDeObra() {
  const ejemplos = new Map(PRODUCTOS_BASE.map(([n, , , p]) => [n, p]));
  const usados = new Set();
  const categoriasUsadas = new Set();
  for (const l of db.listas) for (const i of l.items) { usados.add(i.productoId); categoriasUsadas.add(i.categoriaId); }
  for (const c of db.compras) for (const i of c.items) { usados.add(i.productoId); categoriasUsadas.add(i.categoriaId); }
  for (const v of db.ventas) for (const i of lineasVenta(v)) usados.add(i.productoId);
  const antes = db.productos.length;
  db.productos = db.productos.filter((p) => usados.has(p.id) || ejemplos.get(p.nombre) !== p.precio);
  // categorías de construcción que quedaron vacías (menos "Otro")
  const deObra = new Set(CATEGORIAS_BASE.map(([, n]) => n).filter((n) => n !== "Otro"));
  for (const p of db.productos) categoriasUsadas.add(p.categoriaId);
  db.categorias = db.categorias.filter((c) => !deObra.has(c.nombre) || categoriasUsadas.has(c.id));
  return antes - db.productos.length;
}

function agregarEjemplosDeObra() {
  let n = 0;
  for (const [icono, nombre] of CATEGORIAS_BASE) {
    if (!db.categorias.some((c) => c.nombre === nombre)) db.categorias.push({ id: nuevoId(), icono, nombre });
  }
  for (const [nombre, cat, uni, precio] of PRODUCTOS_BASE) {
    if (db.productos.some((p) => p.nombre === nombre)) continue;
    db.productos.push({ id: nuevoId(), nombre, precio, categoriaId: idCategoria(db, cat), unidadId: idUnidad(db, uni) });
    n++;
  }
  return n;
}

// ---------- Datos iniciales (semilla) ----------
const CATEGORIAS_BASE = [
  ["rayo", "Eléctrico"], ["ladrillos", "Obra negra"], ["gota", "Plomería"], ["rodillo", "Acabados"],
  ["llama", "Herrería"], ["martillo", "Carpintería"], ["llave", "Herramienta"], ["caja", "Otro"],
];

const UNIDADES_BASE = [
  ["Unidad", "und"], ["Metro", "m"], ["Metro cuadrado", "m²"], ["Metro cúbico", "m³"],
  ["Kilogramo", "kg"], ["Saco", "saco"], ["Rollo", "rollo"], ["Tubo / tira", "tubo"],
  ["Galón", "gal"], ["Cubeta", "cubeta"], ["Caja", "caja"], ["Litro", "L"], ["Paquete", "paq"],
];

// Unidades que casi sólo se usan en construcción. A quien no hace obras se le
// muestran al final, para que arriba queden las de un negocio (und, caja, paq, kg…).
const UNIDADES_DE_OBRA = ["m²", "m³", "saco", "rollo", "tubo", "cubeta", "gal"];
export function unidadesOrdenadas() {
  if (usa("obras")) return db.unidades;
  const deObra = (u) => (UNIDADES_DE_OBRA.includes(u.abrev) ? 1 : 0);
  return [...db.unidades].sort((a, b) => deObra(a) - deObra(b)); // el orden de lo demás no cambia
}

// Tipo de cambio inicial (colones por 1 dólar). Se cambia en Más > Moneda.
export const TIPO_CAMBIO_INICIAL = 450; // sólo hasta la primera consulta automática

// Catálogo de ejemplo para Costa Rica: [nombre, categoría, unidad, precio en COLONES].
// Los precios son aproximados; cada quien los ajusta a su ferretería.
const PRODUCTOS_BASE = [
  ["Cable THHN #12 (rollo 100 m)", "Eléctrico", "rollo", 42000],
  ["Cable THHN #14 (rollo 100 m)", "Eléctrico", "rollo", 29000],
  ["Cable THHN #10 (rollo 100 m)", "Eléctrico", "rollo", 65000],
  ["Tomacorriente doble", "Eléctrico", "und", 1800],
  ["Apagador sencillo", "Eléctrico", "und", 1500],
  ["Placa para toma/apagador", "Eléctrico", "und", 700],
  ["Centro de carga 4 espacios", "Eléctrico", "und", 16000],
  ["Breaker 20 A", "Eléctrico", "und", 4500],
  ["Tubo conduit PVC 1/2\" (3 m)", "Eléctrico", "tubo", 1200],
  ["Tubo flexible corrugado 1/2\" (rollo 50 m)", "Eléctrico", "rollo", 9500],
  ["Caja rectangular", "Eléctrico", "und", 350],
  ["Cinta de aislar", "Eléctrico", "und", 700],
  ["Bombillo LED 9 W", "Eléctrico", "und", 1200],
  ["Cemento gris (saco 50 kg)", "Obra negra", "saco", 7500],
  ["Mortero para pegar block (saco 40 kg)", "Obra negra", "saco", 5200],
  ["Repello fino (saco 40 kg)", "Obra negra", "saco", 5800],
  ["Varilla #3 (3/8\") 6 m", "Obra negra", "und", 2800],
  ["Varilla #4 (1/2\") 6 m", "Obra negra", "und", 4900],
  ["Alambre negro", "Obra negra", "kg", 1500],
  ["Block 15x20x40", "Obra negra", "und", 650],
  ["Block 12x20x40", "Obra negra", "und", 560],
  ["Arena", "Obra negra", "m³", 18000],
  ["Piedra quintilla", "Obra negra", "m³", 20000],
  ["Tubo PVC agua potable 1/2\" (6 m)", "Plomería", "tubo", 2500],
  ["Codo PVC 1/2\"", "Plomería", "und", 250],
  ["Llave de paso 1/2\"", "Plomería", "und", 4500],
  ["Tubo PVC sanitario 4\" (6 m)", "Plomería", "tubo", 14000],
  ["Pegamento para PVC (1/8 gal)", "Plomería", "und", 3500],
  ["Pintura látex (cubeta 5 gal)", "Acabados", "cubeta", 55000],
  ["Piso cerámico", "Acabados", "m²", 6500],
  ["Pegamento para cerámica (saco 20 kg)", "Acabados", "saco", 5000],
  ["Fragua (bolsa 2 kg)", "Acabados", "und", 1800],
  ["Disco de corte 4 1/2\"", "Herramienta", "und", 1200],
];

// Catálogo de la versión anterior (precios de México). Sólo se usa para
// reemplazarlo por el de Costa Rica si el usuario no le cambió el precio.
const PRODUCTOS_ANTERIORES = [
  ["Cable THW calibre 12 (rollo 100 m)", "Eléctrico", "rollo", 1450],
  ["Cable THW calibre 14 (rollo 100 m)", "Eléctrico", "rollo", 980],
  ["Cable THW calibre 10 (rollo 100 m)", "Eléctrico", "rollo", 2300],
  ["Contacto doble polarizado", "Eléctrico", "pza", 65],
  ["Apagador sencillo", "Eléctrico", "pza", 45],
  ["Placa para contacto/apagador", "Eléctrico", "pza", 25],
  ["Centro de carga 4 circuitos", "Eléctrico", "pza", 520],
  ["Interruptor termomagnético 20 A", "Eléctrico", "pza", 160],
  ["Tubo conduit PVC 1/2\" (3 m)", "Eléctrico", "tramo", 28],
  ["Poliducto naranja 1/2\" (rollo 100 m)", "Eléctrico", "rollo", 420],
  ["Caja chalupa", "Eléctrico", "pza", 9],
  ["Cinta de aislar", "Eléctrico", "pza", 22],
  ["Foco LED 9 W", "Eléctrico", "pza", 35],
  ["Cemento gris (bulto 50 kg)", "Obra negra", "bulto", 230],
  ["Mortero (bulto 50 kg)", "Obra negra", "bulto", 180],
  ["Cal hidratada (bulto 25 kg)", "Obra negra", "bulto", 95],
  ["Varilla 3/8\" (12 m)", "Obra negra", "pza", 155],
  ["Alambre recocido", "Obra negra", "kg", 38],
  ["Block 15x20x40", "Obra negra", "pza", 14],
  ["Tabique rojo", "Obra negra", "pza", 4.5],
  ["Arena", "Obra negra", "m³", 450],
  ["Grava", "Obra negra", "m³", 480],
  ["Tubo PVC hidráulico 1/2\" (6 m)", "Plomería", "tramo", 75],
  ["Codo PVC 1/2\"", "Plomería", "pza", 6],
  ["Llave de paso 1/2\"", "Plomería", "pza", 140],
  ["Tubo sanitario 4\" (6 m)", "Plomería", "tramo", 390],
  ["Pegamento PVC", "Plomería", "pza", 85],
  ["Pintura vinílica (cubeta 19 L)", "Acabados", "cubeta", 1300],
  ["Piso cerámico", "Acabados", "m²", 210],
  ["Pegazulejo (bulto 20 kg)", "Acabados", "bulto", 160],
  ["Boquilla (bulto 5 kg)", "Acabados", "bulto", 75],
  ["Disco de corte 4 1/2\"", "Herramienta", "pza", 30],
];

export function vacio() {
  return {
    version: 4, perfil: { nombre: "", ocupacion: "", moneda: "CRC", tipoCambio: TIPO_CAMBIO_INICIAL },
    categorias: [], unidades: [], productos: [], proveedores: [],
    listas: [], compras: [], gastos: [],
    ventas: [], // materiales que vendiste (sobrantes, reventa…)
    bitacora: [], // notas diarias de cada obra (las fotos van aparte, en fotos.js)
    plantillas: [], // tus plantillas: { id, titulo, creada, materiales: [{ nombre, cantidad, categoria, unidad, precio? }] }
  };
}

export function semilla() {
  const d = vacio();
  d.categorias = CATEGORIAS_BASE.map(([icono, nombre]) => ({ id: nuevoId(), icono, nombre }));
  d.unidades = UNIDADES_BASE.map(([nombre, abrev]) => ({ id: nuevoId(), nombre, abrev }));
  d.productos = PRODUCTOS_BASE.map(([nombre, cat, uni, precio]) => ({
    id: nuevoId(), nombre, precio,
    categoriaId: idCategoria(d, cat),
    unidadId: idUnidad(d, uni),
  }));
  return d;
}

// Busca una categoría por nombre; si no existe, la crea. Devuelve su id.
function idCategoria(d, nombre) {
  const n = String(nombre || "Otro").trim();
  let c = d.categorias.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (!c) { c = { id: nuevoId(), icono: "etiqueta", nombre: n }; d.categorias.push(c); }
  return c.id;
}

// Igual, para unidades (busca por abreviatura o por nombre).
function idUnidad(d, abrev) {
  const a = String(abrev || "pza").trim();
  let u = d.unidades.find((x) => x.abrev.toLowerCase() === a.toLowerCase() || x.nombre.toLowerCase() === a.toLowerCase());
  if (!u) { u = { id: nuevoId(), nombre: a, abrev: a }; d.unidades.push(u); }
  return u.id;
}

// Pasa los datos de la versión 1 (proyectos) al formato nuevo (listas).
function migrarV1(v1) {
  const d = semilla();
  for (const p of v1.proyectos || []) {
    d.listas.push({
      id: p.id, nombre: p.nombre, cliente: "", direccion: "", presupuesto: 0,
      creada: hoy(), archivada: false,
      items: (p.items || []).map((it) => ({
        id: it.id,
        productoId: d.productos.find((x) => x.nombre === it.nombre)?.id || null,
        nombre: it.nombre,
        categoriaId: idCategoria(d, it.categoria),
        unidadId: idUnidad(d, it.unidad),
        cantidad: Number(it.cantidad) || 0,
        precio: Number(it.precio) || 0,
        estado: it.comprado ? "comprado" : "pendiente",
      })),
    });
  }
  return d;
}

// Versión 2 → 3: adaptar a Costa Rica (moneda, unidades y catálogo).
function migrarACostaRica(d) {
  d.perfil = { moneda: "CRC", tipoCambio: TIPO_CAMBIO_INICIAL, ...d.perfil };
  for (const [nombre, abrev] of UNIDADES_BASE) {
    if (!d.unidades.some((u) => u.abrev === abrev)) d.unidades.push({ id: nuevoId(), nombre, abrev });
  }
  // Quitamos los productos de ejemplo viejos que sigan con su precio original…
  const viejos = new Map(PRODUCTOS_ANTERIORES.map(([n, , , p]) => [n, p]));
  d.productos = d.productos.filter((p) => !(viejos.has(p.nombre) && viejos.get(p.nombre) === p.precio));
  // …y agregamos los de Costa Rica que falten.
  for (const [nombre, cat, uni, precio] of PRODUCTOS_BASE) {
    if (!d.productos.some((p) => p.nombre === nombre)) {
      d.productos.push({ id: nuevoId(), nombre, precio, categoriaId: idCategoria(d, cat), unidadId: idUnidad(d, uni) });
    }
  }
  d.version = 3;
  return d;
}

// Versión 3 → 4: íconos de línea en vez de emojis, y la bitácora.
function migrarAIconos(d) {
  for (const c of d.categorias) c.icono = iconoDesdeEmoji(c.icono);
  d.bitacora = d.bitacora || [];
  d.version = 4;
}

// Versión 4 → 5: "usos" de la app. Quien ya la usaba, la usaba para obras.
// Versión 5 → 6: unidades nuevas de la lista base (ej. "Paquete") a quien ya tenía datos.
function agregarUnidadesNuevas(d) {
  for (const [nombre, abrev] of UNIDADES_BASE) {
    if (!d.unidades.some((u) => u.abrev === abrev)) d.unidades.push({ id: nuevoId(), nombre, abrev });
  }
  d.version = 6;
}

function migrarAUsos(d) {
  const yaLaUsaba = d.listas.length || d.compras.length || d.perfil.ocupacion || d.perfil.nombre;
  if (!d.perfil.usos?.length && yaLaUsaba) d.perfil.usos = ["obras"];
  d.version = 5;
}

function actualizar(d) {
  if ((d.version || 2) < 3) migrarACostaRica(d);
  if (d.version < 4) migrarAIconos(d);
  if (d.version < 5) migrarAUsos(d);
  if (d.version < 6) agregarUnidadesNuevas(d);
  return d;
}

// ---------- Cargar y guardar ----------
const COLECCIONES_DB = ["categorias", "unidades", "productos", "proveedores", "listas", "compras", "gastos", "ventas", "bitacora", "plantillas"];

// Revisa que lo guardado tenga la forma esperada. Si no, lanza un error
// (así se trata igual que un archivo dañado, en vez de dejar la app en blanco).
function revisarForma(g) {
  if (!g || typeof g !== "object" || Array.isArray(g)) throw new Error("Los datos guardados no tienen el formato esperado");
  if ("perfil" in g && (!g.perfil || typeof g.perfil !== "object")) throw new Error("El perfil guardado está dañado");
  for (const col of COLECCIONES_DB) {
    if (col in g && !Array.isArray(g[col])) throw new Error(`La colección "${col}" está dañada`);
  }
  return g;
}

// PROTECCIÓN: si lo guardado no se puede leer, la app abre "como nueva"… y al
// guardar escribiría encima, borrando para siempre lo que había. Por eso, ANTES
// de seguir, se guarda una copia de rescate del texto original, tal cual estaba.
// Si no hay espacio ni para la copia, se bloquea el guardado: lo dañado se queda
// intacto en su lugar hasta que la persona lo descargue.
let guardadoBloqueado = false;

function rescatar(texto, error) {
  console.warn("No se pudieron leer los datos guardados; se guarda una copia de rescate", error);
  // Con cuenta en la nube: se olvida la última sincronización. Si no, la nube creería
  // que todo "se borró aquí" y lo borraría también allá. Así, al sincronizar, se
  // vuelve a bajar todo lo de la cuenta.
  try { localStorage.removeItem(CLAVE_SYNC); } catch {}
  try {
    localStorage.setItem(CLAVE_RESCATE + Date.now(), JSON.stringify({ fecha: new Date().toISOString(), texto }));
  } catch {
    guardadoBloqueado = true;
  }
}

function cargar() {
  let texto = null;
  try { texto = localStorage.getItem(CLAVE); }
  catch (e) { console.warn("Este navegador no deja leer los datos guardados", e); }
  if (texto) {
    try {
      const g = revisarForma(JSON.parse(texto));
      return actualizar({ ...vacio(), ...g, version: g.version || 2 });
    } catch (e) {
      rescatar(texto, e);
      return semilla();
    }
  }
  try {
    const v1 = localStorage.getItem(CLAVE_V1);
    if (v1) return migrarV1(JSON.parse(v1));
  } catch (e) { console.warn("No se pudieron leer los datos de la versión anterior", e); }
  return semilla();
}

// La copia de rescate más reciente, o null si no hay: { fecha, texto, sinEspacio }.
// La pantalla de inicio la usa para avisar y dejar descargarla.
export function copiaDeRescate() {
  try {
    if (guardadoBloqueado) return { fecha: new Date().toISOString(), texto: localStorage.getItem(CLAVE) || "", sinEspacio: true };
    const claves = Object.keys(localStorage).filter((k) => k.startsWith(CLAVE_RESCATE)).sort();
    if (!claves.length) return null;
    return { ...JSON.parse(localStorage.getItem(claves[claves.length - 1])), sinEspacio: false };
  } catch { return null; }
}

// Cuando la persona ya descargó la copia (o no la necesita): se borra y todo sigue normal.
export function descartarRescate() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CLAVE_RESCATE)) localStorage.removeItem(k);
  } catch {}
  if (guardadoBloqueado) { guardadoBloqueado = false; guardar(); }
}

// `export let` permite que otros archivos vean el valor nuevo si lo reemplazamos.
export let db = cargar();

// Otros módulos pueden enterarse cada vez que se guarda (la nube lo usa
// para subir los cambios).
const oyentes = [];
export const alGuardar = (funcion) => oyentes.push(funcion);

// Si guardar falla (casi siempre porque el celular no tiene espacio), antes no
// pasaba nada visible: la persona creía que estaba guardado y al cerrar la app
// lo perdía. Ahora el error queda anotado aquí y se avisa con un evento; app.js
// muestra una barra roja hasta que se vuelva a poder guardar.
export let errorAlGuardar = null;

function avisarEstadoGuardado() {
  window.dispatchEvent(new CustomEvent("obralist:guardado"));
}

export function guardar() {
  if (guardadoBloqueado) return; // no escribir encima de datos dañados sin copia (ver "rescatar")
  try {
    localStorage.setItem(CLAVE, JSON.stringify(db));
    if (errorAlGuardar) { errorAlGuardar = null; avisarEstadoGuardado(); } // ya se pudo otra vez
  } catch (e) {
    console.warn("No se pudo guardar", e);
    errorAlGuardar = e;
    avisarEstadoGuardado();
  }
  for (const f of oyentes) f(); // la nube igual intenta subirlo: así no se pierde
}

// ¿El error fue por falta de espacio? (cada navegador lo llama un poco distinto)
export const esFaltaDeEspacio = (e) =>
  e?.name === "QuotaExceededError" || e?.name === "NS_ERROR_DOM_QUOTA_REACHED" || e?.code === 22 || /quota/i.test(e?.message || "");

guardar(); // guarda de una vez si hubo actualización de versión al cargar

export function reemplazarTodo(nuevo) {
  db = actualizar({ ...vacio(), ...nuevo, version: nuevo.version || 2 });
  guardar();
}

export function esRespaldoValido(o) {
  return o && ["categorias", "unidades", "productos", "listas"].every((k) => Array.isArray(o[k]));
}

// ---------- Consultas (atajos para buscar cosas) ----------
export const buscar = (coleccion, id) => db[coleccion].find((x) => x.id === id);
export const categoria = (id) => buscar("categorias", id) || { icono: "etiqueta", nombre: "Sin categoría" };
export const unidad = (id) => buscar("unidades", id) || { nombre: "?", abrev: "?" };
export const asegurarCategoria = (nombre) => idCategoria(db, nombre);
export const asegurarUnidad = (abrev) => idUnidad(db, abrev);

// Devuelve el id del proveedor con ese nombre (lo crea si es nuevo).
export function proveedorPorNombre(nombre) {
  const n = String(nombre || "").trim();
  if (!n) return null;
  let p = db.proveedores.find((x) => x.nombre.toLowerCase() === n.toLowerCase());
  if (!p) { p = { id: nuevoId(), nombre: n, telefono: "", notas: "" }; db.proveedores.push(p); }
  return p.id;
}

// Agrega varios materiales a una lista (lo usa la importación de Excel).
// materiales: [{ nombre, cantidad, categoria, unidad }]. Si el material está en el
// catálogo, toma de ahí su categoría, unidad y precio. Si ya está pendiente en la
// lista, suma la cantidad. Devuelve cuántos materiales agregó o actualizó.
export function agregarALista(lista, materiales) {
  let n = 0;
  for (const m of materiales) {
    if (!(m.cantidad > 0)) continue;
    const prod = db.productos.find((p) => p.nombre.toLowerCase() === m.nombre.toLowerCase());
    const existente = lista.items.find((i) => i.estado !== "comprado" && i.nombre.toLowerCase() === m.nombre.toLowerCase());
    if (existente) existente.cantidad += m.cantidad;
    else lista.items.push({
      id: nuevoId(), productoId: prod?.id || null, nombre: prod?.nombre || m.nombre,
      categoriaId: prod?.categoriaId || asegurarCategoria(m.categoria || "Otro"),
      unidadId: prod?.unidadId || asegurarUnidad(m.unidad || "und"),
      // si el material trae su propio precio (ej. importado de Excel) se usa ese
      // en un pedido de venta se usa el precio de venta y se recuerda lo que cuesta
      cantidad: m.cantidad, precio: m.precio ?? precioPara(lista, prod), estado: "pendiente",
      ...(esPedido(lista) && prod?.precio ? { costo: prod.precio } : {}),
    });
    n++;
  }
  return n;
}

// Cuánto lleva cada lista: total, comprado, en carrito y gasto real.
export function totalesLista(l) {
  let total = 0, comprado = 0, carrito = 0;
  for (const it of l.items) {
    const importe = it.cantidad * it.precio;
    total += importe;
    if (it.estado === "comprado") comprado += importe;
    if (it.estado === "carrito") carrito += importe;
  }
  const compras = db.compras.filter((c) => c.listaId === l.id).reduce((s, c) => s + c.total, 0);
  const otros = db.gastos.filter((g) => g.listaId === l.id).reduce((s, g) => s + g.monto, 0);
  // En un pedido: cuánto vas a ganar con los productos de los que sabes el costo.
  const conCosto = l.items.filter((i) => i.costo > 0);
  const ganancia = conCosto.length ? conCosto.reduce((s, i) => s + i.cantidad * (i.precio - i.costo), 0) : null;
  return { total, comprado, carrito, pendiente: total - comprado, compras, otros, gastadoReal: compras + otros, ganancia };
}

// ---------- Inventario ----------
// Un producto "lleva inventario" si tiene stock (un número): cuántos tienes en bodega.
// Si no lo tiene, la app no lo controla (así es para quien compra para obras).
// stockMinimo: cuando quedan esos o menos, la app avisa.
export const llevaInventario = (p) => typeof p?.stock === "number";

// Se muestra para quien vende, o si ya hay productos con inventario.
export const mostrarInventario = () => usa("ventas") || db.productos.some(llevaInventario);

// "agotado" (0 o menos), "poco" (en el mínimo o debajo), "bien", o null si no lleva inventario.
export function estadoStock(p) {
  if (!llevaInventario(p)) return null;
  if (p.stock <= 0) return "agotado";
  if (p.stock <= (p.stockMinimo || 0)) return "poco";
  return "bien";
}
export const conPocoStock = () => db.productos.filter((p) => ["agotado", "poco"].includes(estadoStock(p)));

// Suma (signo +1) o resta (signo -1) al inventario las cantidades de unas líneas
// de compra o de venta. Sólo toca productos que llevan inventario.
// Devuelve cuántos productos cambió (0 = no tocó nada).
export function moverInventario(lineas, signo) {
  let n = 0;
  for (const i of lineas) {
    const p = buscar("productos", i.productoId);
    if (!llevaInventario(p)) continue;
    p.stock = Math.round((p.stock + signo * i.cantidad) * 1000) / 1000; // sin decimales raros
    n++;
  }
  return n;
}

// Productos de unas líneas que NO alcanzan en bodega: [{ nombre, hay, pides }]
export function faltantes(lineas) {
  return lineas.map((i) => ({ i, p: buscar("productos", i.productoId) }))
    .filter(({ i, p }) => llevaInventario(p) && i.cantidad > p.stock)
    .map(({ i, p }) => ({ nombre: p.nombre, hay: p.stock, pides: i.cantidad }));
}

// Cuánto vale lo que tienes en bodega (a lo que te costó).
export const valorInventario = () => db.productos.filter(llevaInventario).reduce((s, p) => s + Math.max(0, p.stock) * (p.precio || 0), 0);

// ---------- Pedidos de venta ----------
// Una lista puede ser de COMPRA (lo que vas a comprar, como siempre) o un PEDIDO de
// venta (lo que te pidió un cliente): l.tipo === "venta". El pedido termina en una venta.
export const esPedido = (l) => l?.tipo === "venta";
// Lista simple: sólo para anotar cosas y marcarlas, sin precios ni compras.
export const esSimple = (l) => l?.tipo === "nota";

// Precio con el que un producto del catálogo entra a una lista:
// en un pedido, el precio al que lo vendes; en una compra, lo que te cuesta.
export function precioPara(lista, prod) {
  if (!prod) return 0;
  return esPedido(lista) ? prod.precioVenta || 0 : prod.precio || 0;
}

// Cuánto ganas con un producto del catálogo: ₡ y % sobre el precio de venta.
// Ej. me cuesta 1 200, lo vendo a 2 500 → ganas 1 300 (52 %).
export function margen(p) {
  if (!(p.precioVenta > 0 && p.precio > 0)) return null;
  const ganas = p.precioVenta - p.precio;
  return { ganas, pct: Math.round((ganas / p.precioVenta) * 100) };
}

// ---------- Ventas ----------
// Una venta guarda el precio al que vendiste (precio) y lo que te costó a ti
// (costo), los dos por unidad y en colones. Si no anotaste el costo, vale 0
// y no se puede saber cuánto ganaste.
// Una venta puede ser de UN producto (la de "+ Venta" en Cuentas) o de VARIOS
// (al registrar un pedido: v.items). lineasVenta() las trata igual.
export const lineasVenta = (v) => v.items || [v];
export const totalVenta = (v) => lineasVenta(v).reduce((s, i) => s + i.cantidad * i.precio, 0);
export function gananciaVenta(v) {
  const conCosto = lineasVenta(v).filter((i) => i.costo > 0);
  return conCosto.length ? conCosto.reduce((s, i) => s + i.cantidad * (i.precio - i.costo), 0) : null;
}

// Todas las veces que compraste un producto: fecha, proveedor y precio.
export function historialPrecios(productoId) {
  const h = [];
  for (const c of db.compras) {
    for (const it of c.items) {
      if (it.productoId === productoId) {
        h.push({ fecha: c.fecha, proveedor: buscar("proveedores", c.proveedorId)?.nombre || "Sin proveedor", precio: it.precio, cantidad: it.cantidad });
      }
    }
  }
  return h.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
