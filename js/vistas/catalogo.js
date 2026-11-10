// =====================================================================
// Catálogo: tus materiales con su precio, y dónde salen más baratos.
// =====================================================================
import { db, guardar, nuevoId, buscar, categoria, unidad, historialPrecios, categoriasOrdenadas, esDeMiOficio } from "../datos.js";
import { icono } from "../iconos.js";
import { dinero, seguro, fecha, formulario, aviso, refrescar, opcionesDe, mostrar, simbolo, aMoneda, aColones, precioEditado } from "../ui.js";

let filtroCategoria = "";

export const vistaCatalogo = {
  tab: "catalogo",

  render() {
    const productos = db.productos
      .filter((p) => !filtroCategoria || p.categoriaId === filtroCategoria)
      // los materiales de tu oficio primero, luego en orden alfabético
      .sort((a, b) => (esDeMiOficio(b.categoriaId) - esDeMiOficio(a.categoriaId)) || a.nombre.localeCompare(b.nombre, "es"));
    return `
      <div class="encabezado">
        <h2>Catálogo de materiales</h2>
        <button class="principal" data-accion="nuevo">+ Producto</button>
      </div>
      <div class="fila filtros">
        <input type="search" placeholder="Buscar material…" data-entrada="buscar" aria-label="Buscar material">
        <select data-cambio="categoria" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          ${opcionesDe(categoriasOrdenadas(), filtroCategoria, (c) => c.nombre)}
        </select>
      </div>
      <section class="tarjeta">
        <p class="nota">${productos.length} productos · el precio se actualiza solo cada vez que registras una compra.</p>
        ${productos.length ? productos.map(filaProducto).join("") : `<p class="vacio">No hay productos aquí todavía.</p>`}
      </section>`;
  },

  entradas: {
    // Filtra en pantalla sin volver a dibujar (así no se pierde lo que escribes).
    buscar(el) {
      const q = el.value.toLowerCase().trim();
      document.querySelectorAll(".producto").forEach((fila) => {
        fila.hidden = !fila.dataset.texto.includes(q);
      });
    },
  },

  cambios: {
    categoria(el) { filtroCategoria = el.value; refrescar(); },
  },

  acciones: {
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
        </table>` : `<p class="nota">Todavía no lo has comprado. Cuando registres una compra con este material, aquí verás cómo cambia su precio en cada ferretería.</p>`);
    },

    async aLista(el) {
      const p = productoDe(el);
      const activas = db.listas.filter((l) => !l.archivada);
      if (!activas.length) return aviso("Primero crea una lista de obra");
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
      else l.items.push({ id: nuevoId(), productoId: p.id, nombre: p.nombre, categoriaId: p.categoriaId, unidadId: p.unidadId, cantidad: d.cantidad, precio: p.precio, estado: "pendiente" });
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
  const c = categoria(p.categoriaId);
  const u = unidad(p.unidadId);
  const barato = masBarato(p.id);
  return `
    <div class="producto" data-id="${p.id}" data-texto="${seguro(p.nombre.toLowerCase())}">
      <div>
        <div class="nombre">${icono(c.icono, "icono-acento")} ${seguro(p.nombre)}</div>
        <div class="detalle">${dinero(p.precio)} / ${seguro(u.abrev)}${barato ? ` · Más barato en ${seguro(barato.proveedor)}: ${dinero(barato.precio)}` : ""}</div>
      </div>
      <div class="botones">
        <button data-accion="aLista" title="Agregar a una lista" aria-label="Agregar a una lista">${icono("agregarLista")}</button>
        <button data-accion="precios" title="Historial de precios" aria-label="Historial de precios">${icono("tendencia")}</button>
        <button data-accion="editar" title="Editar" aria-label="Editar">${icono("editar")}</button>
        <button data-accion="borrar" title="Borrar" aria-label="Borrar">${icono("borrar")}</button>
      </div>
    </div>`;
}

async function editarProducto(p) {
  const d = await formulario({
    titulo: p ? "Editar producto" : "Nuevo producto",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", valor: p?.nombre, requerido: true, ancho: true, ayuda: "Ej. Cable THW calibre 12 (rollo 100 m)" },
      { nombre: "categoriaId", etiqueta: "Categoría", tipo: "select", valor: p?.categoriaId || filtroCategoria, opciones: categoriasOrdenadas().map((c) => ({ valor: c.id, texto: c.nombre })) },
      { nombre: "unidadId", etiqueta: "Unidad", tipo: "select", valor: p?.unidadId, opciones: db.unidades.map((u) => ({ valor: u.id, texto: `${u.nombre} (${u.abrev})` })) },
      { nombre: "precio", etiqueta: `Precio unitario (${simbolo()})`, tipo: "number", valor: p ? aMoneda(p.precio) : "" },
    ],
  });
  if (!d) return;
  d.precio = p ? precioEditado(d.precio, p.precio) : aColones(d.precio);
  if (p) Object.assign(p, d);
  else db.productos.push({ id: nuevoId(), ...d });
  guardar(); refrescar();
  aviso(p ? "Producto actualizado" : "Producto agregado");
}
