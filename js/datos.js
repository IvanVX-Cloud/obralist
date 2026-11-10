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
//   gastos      → otros gastos: mano de obra, flete, renta de equipo…
//
// Cada cosa tiene un `id` único. Así se "relacionan": un producto guarda
// `categoriaId` en vez del nombre, igual que en una base de datos real.
// Esto nos va a facilitar pasar todo a la nube (Supabase) más adelante.
// =====================================================================

const CLAVE = "obralist-v2";
const CLAVE_V1 = "obralist-v1"; // la versión anterior, para no perder datos

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

// "Ivan (Electricista)", o sólo lo que haya.
export function quienSoy(nombre, ocupacion) {
  const n = String(nombre || "").trim();
  const o = String(ocupacion || "").trim();
  return n && o ? `${n} (${o})` : n || o;
}

export const TIPOS_GASTO = [
  "Mano de obra", "Flete / acarreo", "Renta de equipo", "Permisos y trámites",
  "Comida y viáticos", "Gasolina", "Otro",
];

// ---------- Datos iniciales (semilla) ----------
const CATEGORIAS_BASE = [
  ["⚡", "Eléctrico"], ["🧱", "Obra negra"], ["🚰", "Plomería"], ["🎨", "Acabados"],
  ["🔩", "Herrería"], ["🪚", "Carpintería"], ["🛠️", "Herramienta"], ["📦", "Otro"],
];

const UNIDADES_BASE = [
  ["Unidad", "und"], ["Metro", "m"], ["Metro cuadrado", "m²"], ["Metro cúbico", "m³"],
  ["Kilogramo", "kg"], ["Saco", "saco"], ["Rollo", "rollo"], ["Tubo / tira", "tubo"],
  ["Galón", "gal"], ["Cubeta", "cubeta"], ["Caja", "caja"], ["Litro", "L"],
];

// Tipo de cambio inicial (colones por 1 dólar). Se cambia en ⚙️ Más.
export const TIPO_CAMBIO_INICIAL = 505;

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

function vacio() {
  return {
    version: 3, perfil: { nombre: "", ocupacion: "", moneda: "CRC", tipoCambio: TIPO_CAMBIO_INICIAL },
    categorias: [], unidades: [], productos: [], proveedores: [],
    listas: [], compras: [], gastos: [],
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
  if (!c) { c = { id: nuevoId(), icono: "📦", nombre: n }; d.categorias.push(c); }
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

function actualizar(d) {
  if ((d.version || 2) < 3) migrarACostaRica(d);
  return d;
}

// ---------- Cargar y guardar ----------
function cargar() {
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) return actualizar({ ...vacio(), ...JSON.parse(t), version: JSON.parse(t).version || 2 });
    const v1 = localStorage.getItem(CLAVE_V1);
    if (v1) return migrarV1(JSON.parse(v1));
  } catch (e) { console.warn("No se pudieron leer los datos guardados", e); }
  return semilla();
}

// `export let` permite que otros archivos vean el valor nuevo si lo reemplazamos.
export let db = cargar();

export function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(db)); }
  catch (e) { console.warn("No se pudo guardar", e); }
}

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
export const categoria = (id) => buscar("categorias", id) || { icono: "📦", nombre: "Sin categoría" };
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
  return { total, comprado, carrito, pendiente: total - comprado, compras, otros, gastadoReal: compras + otros };
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
