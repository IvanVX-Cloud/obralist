// =====================================================================
// excel-datos.js — Qué se exporta a Excel y cómo se importa desde Excel.
// (La parte técnica de armar/leer el archivo está en excel.js)
// =====================================================================
import { db, categoria, unidad, categoriasOrdenadas, hoy, buscar } from "./datos.js";
import { crearXlsx, leerArchivo, aNumero, letra, ESTILO, TIPO_XLSX, fechaExcel } from "./excel.js";
import { aMoneda, aColones, moneda, tipoCambio, simbolo, descargar, formulario, seguro, fecha } from "./ui.js";

const ESTADOS = { pendiente: "Pendiente", carrito: "En carrito", comprado: "Comprado" };
const redondo = (n) => Math.round(n * 100) / 100;
const nombreArchivo = (t) => `${String(t).replace(/[\\/:*?"<>|]/g, "-").trim() || "ObraList"}.xlsx`;

function estilosDinero() {
  const usd = moneda() === "USD";
  return { dinero: usd ? ESTILO.dolares : ESTILO.colones, total: usd ? ESTILO.totalDolares : ESTILO.totalColones };
}

function lineaMoneda() {
  return moneda() === "USD" ? `Precios en dólares (tipo de cambio ₡${tipoCambio()})` : "Precios en colones";
}

// ---------------------------------------------------------------------
// EXPORTAR una lista de obra
// ---------------------------------------------------------------------
export function exportarLista(l) {
  const { dinero, total } = estilosDinero();
  const orden = categoriasOrdenadas();
  const pos = (id) => { const i = orden.findIndex((c) => c.id === id); return i < 0 ? 999 : i; };
  const items = [...l.items].sort((a, b) => pos(a.categoriaId) - pos(b.categoriaId) || a.nombre.localeCompare(b.nombre, "es"));

  const info = [l.cliente && `Cliente: ${l.cliente}`, l.direccion && `Dirección: ${l.direccion}`, `Fecha: ${fecha(hoy())}`, lineaMoneda()]
    .filter(Boolean).join("   ·   ");
  const encabezados = ["Categoría", "Material", "Cantidad", "Unidad", "Precio unitario", "Importe", "Estado"];
  const filas = [
    [{ v: `ObraList — ${l.nombre}`, s: ESTILO.titulo }],
    [{ v: info, s: ESTILO.subtitulo }],
    [],
    encabezados.map((v) => ({ v, s: ESTILO.encabezado })),
  ];
  const primera = filas.length + 1; // número de fila (1, 2, 3…) del primer material

  items.forEach((it, k) => {
    const r = primera + k;
    const precio = aMoneda(it.precio);
    filas.push([
      { v: categoria(it.categoriaId).nombre, s: ESTILO.texto },
      { v: it.nombre, s: ESTILO.texto },
      { v: it.cantidad, s: ESTILO.numero },
      { v: unidad(it.unidadId).abrev, s: ESTILO.texto },
      { v: precio, s: dinero },
      { f: `C${r}*E${r}`, v: redondo(it.cantidad * precio), s: dinero }, // fórmula: cantidad × precio
      { v: ESTADOS[it.estado] || it.estado, s: ESTILO.texto },
    ]);
  });

  const ultima = primera + items.length - 1;
  if (items.length) {
    const suma = redondo(items.reduce((s, it) => s + it.cantidad * aMoneda(it.precio), 0));
    const comprado = redondo(items.filter((i) => i.estado === "comprado").reduce((s, it) => s + it.cantidad * aMoneda(it.precio), 0));
    const t = ultima + 1;
    const vacias = (estilo) => Array.from({ length: 4 }, () => ({ s: estilo }));
    filas.push([{ v: "Total", s: ESTILO.totalTexto }, ...vacias(ESTILO.totalTexto), { f: `SUM(F${primera}:F${ultima})`, v: suma, s: total }, { s: ESTILO.totalTexto }]);
    filas.push([{ v: "Ya comprado", s: ESTILO.texto }, ...vacias(ESTILO.texto), { f: `SUMIF(G${primera}:G${ultima},"Comprado",F${primera}:F${ultima})`, v: comprado, s: dinero }, { s: ESTILO.texto }]);
    filas.push([{ v: "Por comprar", s: ESTILO.texto }, ...vacias(ESTILO.texto), { f: `F${t}-F${t + 1}`, v: redondo(suma - comprado), s: dinero }, { s: ESTILO.texto }]);
  }

  const archivo = crearXlsx([{
    nombre: "Materiales", filas,
    anchos: [16, 44, 11, 9, 17, 17, 13],
    congelar: 4,                                   // el encabezado queda fijo al bajar
    filtro: items.length ? `A4:G${ultima}` : null, // flechitas para filtrar/ordenar
    altos: { 0: 26, 3: 22 },
  }]);
  descargar(nombreArchivo(l.nombre), archivo, TIPO_XLSX);
}

// ---------------------------------------------------------------------
// EXPORTAR el catálogo (sirve también como plantilla para importar precios)
// ---------------------------------------------------------------------
export function exportarCatalogo() {
  const { dinero } = estilosDinero();
  const orden = categoriasOrdenadas();
  const pos = (id) => { const i = orden.findIndex((c) => c.id === id); return i < 0 ? 999 : i; };
  const productos = [...db.productos].sort((a, b) => pos(a.categoriaId) - pos(b.categoriaId) || a.nombre.localeCompare(b.nombre, "es"));
  const filas = [
    [{ v: "ObraList — Catálogo de materiales", s: ESTILO.titulo }],
    [{ v: `${fecha(hoy())}   ·   ${lineaMoneda()}`, s: ESTILO.subtitulo }],
    ["Categoría", "Material", "Unidad", "Precio unitario"].map((v) => ({ v, s: ESTILO.encabezado })),
    ...productos.map((p) => [
      { v: categoria(p.categoriaId).nombre, s: ESTILO.texto },
      { v: p.nombre, s: ESTILO.texto },
      { v: unidad(p.unidadId).abrev, s: ESTILO.texto },
      { v: aMoneda(p.precio), s: dinero },
    ]),
  ];
  const archivo = crearXlsx([{
    nombre: "Catálogo", filas, anchos: [16, 46, 9, 17], congelar: 3,
    filtro: productos.length ? `A3:D${productos.length + 3}` : null, altos: { 0: 26, 2: 22 },
  }]);
  descargar(nombreArchivo(`Catálogo ObraList ${hoy()}`), archivo, TIPO_XLSX);
}

// ---------------------------------------------------------------------
// EXPORTAR movimientos de gastos (para llevar las cuentas o el contador)
//   Hoja 1 "Movimientos": una fila por compra o gasto, con totales.
//   Hoja 2 "Detalle de compras": cada material comprado.
// movimientos: [{ clase: "compra"|"gasto", fecha, monto, obj }]
// ---------------------------------------------------------------------
export function exportarMovimientos(movimientos, textoFiltros) {
  const { dinero, total } = estilosDinero();
  const obra = (id) => buscar("listas", id)?.nombre || "";
  const proveedor = (id) => buscar("proveedores", id)?.nombre || "";
  const subtitulo = [textoFiltros, `Generado: ${fecha(hoy())}`, lineaMoneda()].filter(Boolean).join("   ·   ");

  // Hoja 1
  const filas = [
    [{ v: "ObraList — Compras y gastos", s: ESTILO.titulo }],
    [{ v: subtitulo, s: ESTILO.subtitulo }],
    [],
    ["Fecha", "Obra", "Tipo", "Detalle", "Monto"].map((v) => ({ v, s: ESTILO.encabezado })),
  ];
  const primera = filas.length + 1;
  for (const m of movimientos) {
    const esCompra = m.clase === "compra";
    const detalle = esCompra
      ? [proveedor(m.obj.proveedorId), `${m.obj.items.length} ${m.obj.items.length === 1 ? "material" : "materiales"}`, m.obj.nota].filter(Boolean).join(" · ")
      : m.obj.descripcion || "";
    filas.push([
      { v: fechaExcel(m.fecha), s: ESTILO.fecha },
      { v: obra(m.obj.listaId), s: ESTILO.texto },
      { v: esCompra ? "Compra" : m.obj.tipo, s: ESTILO.texto },
      { v: detalle, s: ESTILO.texto },
      { v: aMoneda(m.monto), s: dinero },
    ]);
  }
  const ultima = primera + movimientos.length - 1;
  const totalMat = redondo(movimientos.filter((m) => m.clase === "compra").reduce((s, m) => s + aMoneda(m.monto), 0));
  const totalTodo = redondo(movimientos.reduce((s, m) => s + aMoneda(m.monto), 0));
  const vacias = (n, estilo) => Array.from({ length: n }, () => ({ s: estilo }));
  filas.push([{ v: "Compras", s: ESTILO.texto }, ...vacias(3, ESTILO.texto), { f: `SUMIF(C${primera}:C${ultima},"Compra",E${primera}:E${ultima})`, v: totalMat, s: dinero }]);
  filas.push([{ v: "Gastos", s: ESTILO.texto }, ...vacias(3, ESTILO.texto), { f: `E${ultima + 3}-E${ultima + 1}`, v: redondo(totalTodo - totalMat), s: dinero }]);
  filas.push([{ v: "Total", s: ESTILO.totalTexto }, ...vacias(3, ESTILO.totalTexto), { f: `SUM(E${primera}:E${ultima})`, v: totalTodo, s: total }]);

  // Hoja 2
  const compras = movimientos.filter((m) => m.clase === "compra");
  const detalle = [
    [{ v: "ObraList — Detalle de compras", s: ESTILO.titulo }],
    [{ v: subtitulo, s: ESTILO.subtitulo }],
    [],
    ["Fecha", "Obra", "Proveedor", "Material", "Cantidad", "Unidad", "Precio unitario", "Importe"].map((v) => ({ v, s: ESTILO.encabezado })),
  ];
  const p2 = detalle.length + 1;
  for (const m of compras) {
    for (const it of m.obj.items) {
      const r = detalle.length + 1;
      const precio = aMoneda(it.precio);
      detalle.push([
        { v: fechaExcel(m.fecha), s: ESTILO.fecha },
        { v: obra(m.obj.listaId), s: ESTILO.texto },
        { v: proveedor(m.obj.proveedorId), s: ESTILO.texto },
        { v: it.nombre, s: ESTILO.texto },
        { v: it.cantidad, s: ESTILO.numero },
        { v: unidad(it.unidadId).abrev, s: ESTILO.texto },
        { v: precio, s: dinero },
        { f: `E${r}*G${r}`, v: redondo(it.cantidad * precio), s: dinero },
      ]);
    }
  }
  const u2 = detalle.length;
  if (u2 >= p2) {
    const suma = redondo(compras.reduce((s, m) => s + m.obj.items.reduce((t, it) => t + it.cantidad * aMoneda(it.precio), 0), 0));
    detalle.push([{ v: "Total", s: ESTILO.totalTexto }, ...vacias(6, ESTILO.totalTexto), { f: `SUM(H${p2}:H${u2})`, v: suma, s: total }]);
  }

  const hojas = [{
    nombre: "Compras y gastos", filas, anchos: [12, 24, 18, 46, 16], congelar: 4,
    filtro: `A4:E${ultima}`, altos: { 0: 26, 3: 22 },
  }];
  if (compras.length) hojas.push({
    nombre: "Detalle de compras", filas: detalle, anchos: [12, 22, 22, 40, 10, 8, 15, 15], congelar: 4,
    filtro: u2 >= p2 ? `A4:H${u2}` : null, altos: { 0: 26, 3: 22 },
  });
  descargar(nombreArchivo(`Compras y gastos ObraList ${hoy()}`), crearXlsx(hojas), TIPO_XLSX);
}

// ---------------------------------------------------------------------
// IMPORTAR: lee el archivo, adivina las columnas y deja que el usuario
// las confirme. Devuelve [{ nombre, cantidad, unidad, precio, categoria }].
// ---------------------------------------------------------------------
const CLAVES = {
  nombre: ["material", "materiales", "producto", "descripcion", "articulo", "nombre", "item", "detalle", "concepto"],
  cantidad: ["cantidad", "cant", "qty", "unid. requeridas"],
  unidad: ["unidad", "und", "u/m", "um", "medida", "presentacion"],
  precio: ["precio", "costo", "valor unitario", "p. unit", "p.unit", "unitario", "valor"],
  categoria: ["categoria", "familia", "rubro", "tipo", "departamento"],
};
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export function detectarColumnas(filas) {
  let mejor = { fila: -1, mapa: {}, puntos: 0 };
  for (let i = 0; i < Math.min(filas.length, 25); i++) {
    const mapa = {};
    let puntos = 0;
    (filas[i] || []).forEach((celda, j) => {
      const t = norm(celda);
      if (!t || typeof celda === "number") return;
      for (const [campo, claves] of Object.entries(CLAVES)) {
        if (mapa[campo] === undefined && claves.some((k) => t === k || t.startsWith(`${k} `) || t.startsWith(`${k}.`) || t === `${k}s`)) {
          mapa[campo] = j; puntos++; break;
        }
      }
    });
    if (puntos > mejor.puntos) mejor = { fila: i, mapa, puntos };
  }
  return mejor;
}

// Unidades escritas de muchas formas → las de la app
const UNIDADES = {
  und: ["und", "unidad", "unidades", "u", "un", "pza", "pieza", "piezas", "c/u", "cu", "ud"],
  m: ["m", "mt", "mts", "metro", "metros", "ml"], "m²": ["m2", "m²", "mt2", "metro cuadrado", "metros cuadrados"],
  "m³": ["m3", "m³", "mt3", "metro cubico", "metros cubicos"], kg: ["kg", "kilo", "kilos", "kilogramo", "kilogramos"],
  saco: ["saco", "sacos", "bulto", "bultos", "bolsa"], rollo: ["rollo", "rollos"], tubo: ["tubo", "tubos", "tira", "tiras", "tramo", "tramos"],
  gal: ["gal", "galon", "galones"], cubeta: ["cubeta", "cubetas", "balde"], caja: ["caja", "cajas"], L: ["l", "lt", "litro", "litros"],
};
function unidadDe(texto) {
  const t = norm(texto).replace(/\.$/, "");
  if (!t) return null;
  for (const [abrev, formas] of Object.entries(UNIDADES)) if (formas.includes(t)) return abrev;
  return String(texto).trim();
}

export async function leerMateriales(archivo, { conCantidad = true } = {}) {
  const filas = await leerArchivo(archivo);
  if (!filas.some((f) => f.some((x) => String(x).trim()))) throw new Error("El archivo está vacío.");
  const { fila, mapa } = detectarColumnas(filas);
  const datos = filas.slice(fila + 1).filter((f) => f.some((x) => String(x).trim()));
  const columnas = Math.max(0, ...filas.slice(Math.max(0, fila), fila + 60).map((f) => f.length));
  const titulo = (j) => (fila >= 0 && String(filas[fila][j] ?? "").trim() ? `: ${String(filas[fila][j]).trim()}` : "");
  const opciones = [{ valor: "", texto: "— No usar —" }, ...Array.from({ length: columnas }, (_, j) => ({ valor: String(j), texto: `Columna ${letra(j)}${titulo(j)}` }))];
  const ejemplo = datos.slice(0, 3).map((f) => seguro(String(f[mapa.nombre ?? 0] ?? ""))).filter(Boolean).join(", ");

  const d = await formulario({
    titulo: "Importar desde Excel",
    boton: "Importar",
    campos: [
      { tipo: "html", html: `Encontré <strong>${datos.length}</strong> filas en <strong>${seguro(archivo.name)}</strong>${ejemplo ? ` (por ejemplo: ${ejemplo}…)` : ""}. Revisa qué columna tiene cada dato:` },
      { nombre: "nombre", etiqueta: "Material (obligatorio)", tipo: "select", ancho: true, valor: mapa.nombre ?? "", opciones },
      conCantidad && { nombre: "cantidad", etiqueta: "Cantidad", tipo: "select", valor: mapa.cantidad ?? "", opciones },
      { nombre: "unidad", etiqueta: "Unidad", tipo: "select", valor: mapa.unidad ?? "", opciones },
      { nombre: "precio", etiqueta: `Precio unitario (en ${simbolo()})`, tipo: "select", valor: mapa.precio ?? "", opciones },
      { nombre: "categoria", etiqueta: "Categoría", tipo: "select", valor: mapa.categoria ?? "", opciones },
    ].filter(Boolean),
  });
  if (!d) return null;
  if (d.nombre === "") throw new Error("Elige cuál columna tiene el nombre del material.");
  const col = (k) => (d[k] === undefined || d[k] === "" ? null : Number(d[k]));
  const c = { nombre: col("nombre"), cantidad: col("cantidad"), unidad: col("unidad"), precio: col("precio"), categoria: col("categoria") };

  const materiales = [];
  for (const f of datos) {
    const nombre = String(f[c.nombre] ?? "").trim();
    if (!nombre || /^(sub)?total|^por comprar|^ya comprado/i.test(nombre)) continue; // se salta filas de totales
    const cantidad = c.cantidad !== null ? aNumero(f[c.cantidad]) : null;
    const precio = c.precio !== null ? aNumero(f[c.precio]) : null;
    materiales.push({
      nombre,
      cantidad: cantidad && cantidad > 0 ? cantidad : 1,
      unidad: c.unidad !== null ? unidadDe(f[c.unidad]) : null,
      precio: precio !== null && precio >= 0 ? aColones(precio) : null, // se guarda en colones
      categoria: c.categoria !== null ? String(f[c.categoria] ?? "").trim() || null : null,
    });
  }
  return materiales;
}
