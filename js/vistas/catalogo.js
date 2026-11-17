// =====================================================================
// Catálogo: tus materiales con su precio, y dónde salen más baratos.
// =====================================================================
import { db, guardar, nuevoId, buscar, categoria, unidad, historialPrecios, categoriasOrdenadas, asegurarCategoria, asegurarUnidad, usa, esPedido, precioPara, margen, palabras, llevaInventario, mostrarInventario, estadoStock, valorInventario, unidadesOrdenadas } from "../datos.js";
import { icono } from "../iconos.js";
import { exportarCatalogo, leerMateriales } from "../excel-datos.js";
import { menu, elegirArchivo, dinero, seguro, fecha, formulario, aviso, refrescar, mostrar, simbolo, aMoneda, aColones, precioEditado} from "../ui.js";

let filtroCategoria = "";

export const vistaCatalogo = {
  tab: "catalogo",

  render(param) {
    if (param === "poco") filtroCategoria = "poco"; // viene del aviso del inicio
    const inventario = mostrarInventario();
    const conInventario = db.productos.filter(llevaInventario);
    const pasa = (p) => !filtroCategoria
      || (filtroCategoria === "poco" ? ["agotado", "poco"].includes(estadoStock(p)) : p.categoriaId === filtroCategoria);
    const productos = db.productos
      .filter(pasa)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    // Agrupar por categoría (las de tu oficio primero)
    const grupos = categoriasOrdenadas()
      .map((c) => ({ c, productos: productos.filter((p) => p.categoriaId === c.id) }))
      .filter((g) => g.productos.length);
    const sinCategoria = productos.filter((p) => !buscar("categorias", p.categoriaId));
    if (sinCategoria.length) grupos.push({ c: { id: "sin", icono: "etiqueta", nombre: "Sin categoría" }, productos: sinCategoria });
    const m = palabras();
    const pocos = inventario ? db.productos.filter((p) => ["agotado", "poco"].includes(estadoStock(p))).length : 0;
    // Filtros como botones (se ve de un vistazo en cuál estás)
    const chip = (valor, texto, extra = "") => `
      <button class="chip ${filtroCategoria === valor ? "activo" : ""} ${extra}" data-accion="filtro" data-cat="${valor}">${texto}</button>`;
    return `
      <div class="encabezado">
        <h2>Catálogo</h2>
        <button class="principal" data-accion="nuevo">+ Nuevo ${m.material}</button>
      </div>
      <p class="nota">Tus ${m.materiales} con su precio. Al armar una lista, los eliges de aquí y el precio se pone solo.
        ${usa("ventas") ? "" : "Cada compra que registras actualiza el precio."}</p>

      <input type="search" class="buscador-grande" placeholder="Buscar ${m.material}…" data-entrada="buscar" aria-label="Buscar ${m.material}">

      <div class="chips" role="group" aria-label="Filtrar por categoría">
        ${chip("", `Todos (${db.productos.length})`)}
        ${pocos ? chip("poco", `${icono("alerta")}Por reponer (${pocos})`, "aviso") : ""}
        ${categoriasOrdenadas().filter((c) => db.productos.some((p) => p.categoriaId === c.id)).map((c) => chip(c.id, seguro(c.nombre))).join("")}
      </div>

      ${conInventario.length ? `
        <div class="dato-ancho">${icono("caja", "icono-grande icono-acento")}
          <span>Lo que tienes en bodega vale <strong>${dinero(valorInventario())}</strong>
          <span class="nota">Contando lo que te costó cada producto (${conInventario.length} ${conInventario.length === 1 ? "lleva" : "llevan"} inventario)</span></span>
        </div>` : ""}

      ${grupos.length ? grupos.map(({ c, productos: ps }) => `
        <section class="tarjeta grupo-catalogo">
          <h3>${icono(c.icono)}${seguro(c.nombre)} <span class="nota">${ps.length}</span></h3>
          ${ps.map(filaProducto).join("")}
        </section>`).join("") : `
        <div class="vacio-grande">
          ${icono("catalogo", "icono-grande icono-acento")}
          <strong>${filtroCategoria ? "Nada con ese filtro" : "Tu catálogo está vacío"}</strong>
          <span class="nota">${filtroCategoria ? "Toca «Todos» para ver todo." : `Agrega tus ${m.materiales} con su precio para armar listas más rápido.`}</span>
        </div>`}
      <p class="vacio" id="sin-resultados" hidden>No encontré nada con ese nombre.</p>

      <p class="centro"><button class="boton-enlace" data-accion="excelMenu">${icono("tabla")}Descargar o cargar con Excel</button></p>`;
  },

  entradas: {
    // Filtra en pantalla sin volver a dibujar (así no se pierde lo que escribes).
    // Al buscar, se abren sólo las categorías que tienen coincidencias.
    buscar(el) {
      const q = el.value.toLowerCase().trim();
      let total = 0;
      document.querySelectorAll(".grupo-catalogo").forEach((grupo) => {
        let hay = 0;
        grupo.querySelectorAll(".producto").forEach((fila) => {
          fila.hidden = !fila.dataset.texto.includes(q);
          if (!fila.hidden) hay++;
        });
        grupo.hidden = !hay; // se esconden las categorías sin coincidencias
        total += hay;
      });
      const nada = document.querySelector("#sin-resultados");
      if (nada) nada.hidden = total > 0 || !q;
    },
  },

  cambios: {
    // Actualiza precios de los materiales que ya existen y agrega los nuevos
    async importarExcel(el) {
      const archivo = el.files[0];
      el.value = "";
      if (!archivo) return;
      try {
        const materiales = await leerMateriales(archivo, { conCantidad: false });
        if (!materiales) return;
        let actualizados = 0, nuevos = 0;
        for (const m of materiales) {
          const p = db.productos.find((x) => x.nombre.toLowerCase() === m.nombre.toLowerCase());
          if (p) {
            if (m.precio !== null) p.precio = m.precio;
            if (m.unidad) p.unidadId = asegurarUnidad(m.unidad);
            if (m.categoria) p.categoriaId = asegurarCategoria(m.categoria);
            actualizados++;
          } else {
            db.productos.push({
              id: nuevoId(), nombre: m.nombre, precio: m.precio ?? 0,
              categoriaId: asegurarCategoria(m.categoria || "Otro"), unidadId: asegurarUnidad(m.unidad || "und"),
            });
            nuevos++;
          }
        }
        guardar(); refrescar();
        aviso(`Catálogo: ${actualizados} actualizados, ${nuevos} nuevos`);
      } catch (e) {
        aviso(e.message || "No se pudo leer el archivo.");
      }
    },

    categoria(el) { filtroCategoria = el.value; refrescar(); },
  },

  acciones: {
    filtro(el) { filtroCategoria = el.dataset.cat; refrescar(); },

    // Menú con nombres claros (en vez de íconos sueltos)
    async opciones(el) {
      const p = productoDe(el);
      const elegido = await menu(p.nombre, [
        { valor: "aLista", icono: "agregarLista", titulo: "Agregar a una lista", detalle: "Elige la lista y la cantidad" },
        { valor: "editar", icono: "editar", titulo: "Editar", detalle: mostrarInventario() ? "Nombre, precios, unidad, inventario" : "Nombre, precio, unidad" },
        { valor: "precios", icono: "tendencia", titulo: "Ver precios anteriores", detalle: "Cuánto pagaste y dónde, cada vez" },
        { valor: "borrar", icono: "borrar", titulo: "Quitar del catálogo", detalle: "Las listas que ya lo tienen no cambian", peligro: true },
      ]);
      if (elegido) vistaCatalogo.acciones[elegido](el);
    },

    async excelMenu() {
      const elegido = await menu("Excel", [
        { valor: "excel", icono: "descargar", titulo: "Descargar el catálogo en Excel", detalle: "Con todos los precios" },
        { valor: "cargar", icono: "enviar", titulo: "Cargar precios de un Excel", detalle: "Actualiza los que ya tienes y agrega los nuevos" },
      ]);
      if (elegido === "excel") vistaCatalogo.acciones.excel();
      if (elegido === "cargar") {
        const archivo = await elegirArchivo(".xlsx,.xls,.csv");
        if (archivo) vistaCatalogo.cambios.importarExcel({ files: [archivo], value: "" });
      }
    },

    excel() {
      exportarCatalogo();
      aviso("Excel descargado");
    },

    nuevo() { editarProducto(null); },
    editar(el) { editarProducto(productoDe(el)); },

    borrar(el) {
      const p = productoDe(el);
      if (!confirm(`¿Quitar "${p.nombre}" del catálogo?\n(Las listas y compras que ya lo tienen no cambian.)`)) return;
      db.productos = db.productos.filter((x) => x !== p);
      guardar(); refrescar();
    },

    precios(el) {
      const p = productoDe(el);
      const h = historialPrecios(p.id);
      const u = unidad(p.unidadId).abrev;
      mostrar(`Historial de precios: ${p.nombre}`, h.length ? `
        <table>
          <thead><tr><th>Fecha</th><th>Dónde</th><th class="num">Precio / ${seguro(u)}</th></tr></thead>
          <tbody>${h.map((x) => `<tr><td>${fecha(x.fecha)}</td><td>${seguro(x.proveedor)}</td><td class="num">${dinero(x.precio)}</td></tr>`).join("")}</tbody>
        </table>` : `<p class="nota">Todavía no lo has comprado. Cuando registres una compra con este ${palabras().material}, aquí verás cómo cambia su precio en cada lugar donde lo compras.</p>`);
    },

    async aLista(el) {
      const p = productoDe(el);
      const activas = db.listas.filter((l) => !l.archivada);
      if (!activas.length) return aviso("Primero crea una lista");
      const d = await formulario({
        titulo: `Agregar a una lista`,
        boton: "Agregar",
        campos: [
          { nombre: "listaId", etiqueta: "Lista", tipo: "select", ancho: true, opciones: activas.map((l) => ({ valor: l.id, texto: l.nombre })) },
          { nombre: "cantidad", etiqueta: `Cantidad (${unidad(p.unidadId).abrev})`, tipo: "number", valor: 1 },
        ],
      });
      if (!d) return;
      const l = buscar("listas", d.listaId);
      const existente = l.items.find((i) => i.estado !== "comprado" && i.productoId === p.id);
      if (existente) existente.cantidad += d.cantidad;
      else l.items.push({
        id: nuevoId(), productoId: p.id, nombre: p.nombre, categoriaId: p.categoriaId, unidadId: p.unidadId,
        cantidad: d.cantidad, precio: precioPara(l, p), estado: "pendiente",
        ...(esPedido(l) && p.precio > 0 ? { costo: p.precio } : {}),
      });
      guardar();
      aviso(`Agregado a "${l.nombre}"`);
    },
  },
};

const productoDe = (el) => buscar("productos", el.closest("[data-id]").dataset.id);

// El precio más bajo según la última compra en cada proveedor.
function masBarato(productoId) {
  const ultimoPorProveedor = new Map();
  for (const x of historialPrecios(productoId)) {
    if (x.proveedor !== "Sin proveedor" && !ultimoPorProveedor.has(x.proveedor)) ultimoPorProveedor.set(x.proveedor, x);
  }
  if (ultimoPorProveedor.size < 2) return null; // sólo tiene sentido comparar 2 o más
  return [...ultimoPorProveedor.values()].sort((a, b) => a.precio - b.precio)[0];
}

function filaProducto(p) {
  const u = unidad(p.unidadId);
  const barato = masBarato(p.id);
  const m = margen(p);
  const vende = usa("ventas");
  // A la derecha, el precio bien visible. Quien vende ve costo y venta lado a lado.
  const precios = vende ? `
      <div class="precios-prod">
        <span class="par"><span>Te cuesta</span><strong>${p.precio > 0 ? dinero(p.precio) : "—"}</strong></span>
        <span class="par"><span>Lo vendes</span><strong>${p.precioVenta > 0 ? dinero(p.precioVenta) : "—"}</strong></span>
      </div>` : `
      <div class="precios-prod uno">
        <strong>${dinero(p.precio)}</strong><span class="detalle">por ${seguro(u.abrev)}</span>
      </div>`;
  const notas = [
    vende ? `por ${seguro(u.abrev)}` : "",
    m ? `<span class="${m.ganas >= 0 ? "entrada" : "rojo"}">${m.ganas >= 0 ? "Ganas" : "Pierdes"} ${dinero(Math.abs(m.ganas))} (${m.pct} %)</span>` : "",
    barato ? `Más barato en ${seguro(barato.proveedor)}: ${dinero(barato.precio)}` : "",
  ].filter(Boolean).join(" · ");
  return `
    <div class="producto tocable" data-id="${p.id}" data-accion="opciones" data-texto="${seguro(p.nombre.toLowerCase())}" role="button" tabindex="0" aria-label="Opciones de ${seguro(p.nombre)}">
      <div class="info-prod">
        <div class="nombre">${seguro(p.nombre)}</div>
        ${notas ? `<div class="detalle">${notas}</div>` : ""}
        ${bodega(p, u)}
      </div>
      ${precios}
      <span class="flecha-fila">${icono("adelante")}</span>
    </div>`;
}

// "En bodega: 12 und" (rojo si se agotó, naranja si quedan pocos).
function bodega(p, u) {
  const estado = estadoStock(p);
  if (!estado) return "";
  const texto = estado === "agotado" ? "Agotado"
    : estado === "poco" ? `Quedan ${p.stock} ${seguro(u.abrev)}` : `En bodega: ${p.stock} ${seguro(u.abrev)}`;
  return `<span class="chip-stock ${estado}">${icono(estado === "bien" ? "caja" : "alerta")}${texto}</span>`;
}

async function editarProducto(p) {
  const d = await formulario({
    titulo: p ? "Editar producto" : "Nuevo producto",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", valor: p?.nombre, requerido: true, ancho: true, ayuda: "Ej. Cable THW calibre 12 (rollo 100 m)" },
      { nombre: "categoria", etiqueta: "Categoría", ayuda: "Escribe o elige. Vacío = Otro",
        valor: p ? categoria(p.categoriaId).nombre : (buscar("categorias", filtroCategoria)?.nombre || ""),
        sugerencias: categoriasOrdenadas().map((c) => c.nombre) },
      { nombre: "unidadId", etiqueta: "Unidad", tipo: "select", valor: p?.unidadId, opciones: unidadesOrdenadas().map((u) => ({ valor: u.id, texto: `${u.nombre} (${u.abrev})` })) },
      { nombre: "precio", etiqueta: `${usa("ventas") ? "Me cuesta" : "Precio unitario"} (${simbolo()})`, tipo: "number", valor: p ? aMoneda(p.precio) : "",
        ayuda: usa("ventas") ? "Lo que pagas tú (o lo que te cuesta hacerlo)" : "" },
      usa("ventas") && { nombre: "precioVenta", etiqueta: `Lo vendo a (${simbolo()})`, tipo: "number", valor: p?.precioVenta ? aMoneda(p.precioVenta) : "",
        ayuda: "Con los dos precios, ObraList te dice cuánto ganas" },
      // Inventario (opcional, por producto)
      mostrarInventario() && { nombre: "llevar", tipo: "checkbox", valor: llevaInventario(p), etiqueta: "Llevar inventario de este producto" },
      mostrarInventario() && { nombre: "stock", etiqueta: "Cantidad que tienes ahora", tipo: "text", valor: llevaInventario(p) ? p.stock : "",
        ayuda: "Ej. 12" },
      mostrarInventario() && { nombre: "stockMinimo", etiqueta: "Avisarme cuando queden", tipo: "number", valor: p?.stockMinimo || "", ayuda: "Ej. 3" },
    ].filter(Boolean),
  });
  if (!d) return;
  // La categoría escrita se busca por nombre (si es nueva, se crea)
  d.categoriaId = asegurarCategoria(d.categoria || "Otro");
  delete d.categoria;
  // Inventario: con la casilla marcada se guarda la cantidad; sin marcar, se deja de controlar.
  if ("llevar" in d) {
    const n = Number(String(d.stock).replace(",", "."));
    if (d.llevar && !Number.isFinite(n)) return aviso("Escribe la cantidad que tienes en bodega, con números.");
    if (d.llevar) { d.stock = n; d.stockMinimo = d.stockMinimo || 0; }
    else { delete d.stock; delete d.stockMinimo; if (p) { delete p.stock; delete p.stockMinimo; } }
    delete d.llevar;
  }
  d.precio = p ? precioEditado(d.precio, p.precio) : aColones(d.precio);
  if ("precioVenta" in d) d.precioVenta = p ? precioEditado(d.precioVenta, p.precioVenta || 0) : aColones(d.precioVenta);
  if (p) Object.assign(p, d);
  else db.productos.push({ id: nuevoId(), ...d });
  guardar(); refrescar();
  aviso(p ? "Producto actualizado" : "Producto agregado");
}
