// =====================================================================
// Gastos y reportes: lo que no es material (mano de obra, flete, renta
// de equipo…) y gráficas de en qué se va el dinero.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, categoria, totalesLista, TIPOS_GASTO } from "../datos.js";
import { dinero, seguro, fecha, formulario, aviso, refrescar, opcionesDe, barras } from "../ui.js";

let filtroLista = "";

// Se exporta para poder registrar un gasto también desde una lista.
export async function nuevoGasto(listaId = "") {
  const d = await formulario({
    titulo: "Registrar gasto",
    boton: "Guardar gasto",
    campos: [
      { nombre: "tipo", etiqueta: "Tipo", tipo: "select", valor: TIPOS_GASTO[0], opciones: TIPOS_GASTO.map((t) => ({ valor: t, texto: t })) },
      { nombre: "monto", etiqueta: "Monto ($)", tipo: "number", valor: "", requerido: true },
      { nombre: "listaId", etiqueta: "Obra", tipo: "select", valor: listaId, opciones: [{ valor: "", texto: "— Sin obra —" }, ...db.listas.map((l) => ({ valor: l.id, texto: l.nombre }))] },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: hoy(), requerido: true },
      { nombre: "descripcion", etiqueta: "Descripción", ancho: true, ayuda: "Ej. Raya semanal del ayudante" },
    ],
  });
  if (!d) return;
  db.gastos.unshift({ id: nuevoId(), tipo: d.tipo, monto: d.monto, listaId: d.listaId || null, fecha: d.fecha, descripcion: d.descripcion });
  guardar(); refrescar();
  aviso("Gasto guardado ✓");
}

export const vistaGastos = {
  tab: "gastos",

  render() {
    const compras = db.compras.filter((c) => !filtroLista || c.listaId === filtroLista);
    const gastos = db.gastos.filter((g) => !filtroLista || g.listaId === filtroLista).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const totMateriales = compras.reduce((s, c) => s + c.total, 0);
    const totOtros = gastos.reduce((s, g) => s + g.monto, 0);

    // Sumas para cada reporte (Map = diccionario etiqueta → monto)
    const sumar = (mapa, clave, monto) => mapa.set(clave, (mapa.get(clave) || 0) + monto);
    const porCategoria = new Map(), porTipo = new Map(), porMes = new Map(), porProveedor = new Map();
    for (const c of compras) {
      for (const i of c.items) { const cat = categoria(i.categoriaId); sumar(porCategoria, `${cat.icono} ${cat.nombre}`, i.cantidad * i.precio); }
      sumar(porProveedor, buscar("proveedores", c.proveedorId)?.nombre || "Sin proveedor", c.total);
      sumar(porMes, c.fecha.slice(0, 7), c.total);
    }
    for (const g of gastos) { sumar(porTipo, g.tipo, g.monto); sumar(porMes, g.fecha.slice(0, 7), g.monto); }
    const meses = [...porMes].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
      .map(([m, v]) => [new Date(m + "-15").toLocaleDateString("es-MX", { month: "short", year: "numeric" }), v]);

    return `
      <div class="encabezado">
        <h2>Gastos y reportes</h2>
        <button class="principal" data-accion="nuevo">+ Gasto</button>
      </div>
      <div class="fila filtros">
        <select data-cambio="filtro" aria-label="Filtrar por obra">
          <option value="">Todas las obras</option>
          ${opcionesDe(db.listas, filtroLista)}
        </select>
      </div>

      <section class="resumen">
        <div class="dato"><span>Materiales</span><strong>${dinero(totMateriales)}</strong></div>
        <div class="dato"><span>Otros gastos</span><strong>${dinero(totOtros)}</strong></div>
        <div class="dato"><span>Total</span><strong>${dinero(totMateriales + totOtros)}</strong></div>
      </section>

      ${filtroLista ? "" : `
        <section class="tarjeta"><h3>🏗️ Por obra</h3>${reportePorObra()}</section>`}
      <section class="tarjeta"><h3>🧱 Materiales por categoría</h3>${barras([...porCategoria])}</section>
      <section class="tarjeta"><h3>💸 Otros gastos por tipo</h3>${barras([...porTipo])}</section>
      <section class="tarjeta"><h3>🏪 Por proveedor</h3>${barras([...porProveedor])}</section>
      <section class="tarjeta"><h3>📅 Por mes (últimos 6)</h3>${barras(meses, { ordenar: false })}</section>

      <section class="tarjeta">
        <h3>Otros gastos registrados</h3>
        ${gastos.length ? gastos.map(filaGasto).join("") : `<p class="nota">Registra aquí mano de obra, fletes, renta de revolvedora, permisos…</p>`}
      </section>`;
  },

  cambios: {
    filtro(el) { filtroLista = el.value; refrescar(); },
  },

  acciones: {
    nuevo() { nuevoGasto(filtroLista); },
    borrar(el) {
      const id = el.closest("[data-id]").dataset.id;
      if (!confirm("¿Borrar este gasto?")) return;
      db.gastos = db.gastos.filter((g) => g.id !== id);
      guardar(); refrescar();
    },
  },
};

function reportePorObra() {
  if (!db.listas.length) return `<p class="nota">Sin obras todavía.</p>`;
  return db.listas.map((l) => {
    const t = totalesLista(l);
    const pasado = l.presupuesto > 0 && t.gastadoReal > l.presupuesto;
    return `
      <div class="producto">
        <div>
          <div class="nombre">${seguro(l.nombre)}</div>
          <div class="detalle">Materiales ${dinero(t.compras)} · Otros ${dinero(t.otros)}${l.presupuesto > 0 ? ` · Presupuesto ${dinero(l.presupuesto)}` : ""}</div>
        </div>
        <strong class="${pasado ? "rojo" : ""}">${dinero(t.gastadoReal)}</strong>
      </div>`;
  }).join("");
}

function filaGasto(g) {
  const obra = buscar("listas", g.listaId)?.nombre;
  return `
    <div class="producto" data-id="${g.id}">
      <div>
        <div class="nombre">${seguro(g.tipo)}${g.descripcion ? ` · ${seguro(g.descripcion)}` : ""}</div>
        <div class="detalle">${fecha(g.fecha)}${obra ? ` · ${seguro(obra)}` : ""}</div>
      </div>
      <div class="botones"><strong>${dinero(g.monto)}</strong><button data-accion="borrar" aria-label="Borrar gasto">🗑️</button></div>
    </div>`;
}
