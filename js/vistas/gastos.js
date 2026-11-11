// =====================================================================
// Gastos: TODO el dinero que sale de las obras en un solo lugar.
//   • Movimientos → compras de materiales + otros gastos (mano de obra,
//     flete, renta de equipo…), del más reciente al más viejo.
//   • Reportes    → gráficas de en qué se va el dinero.
// Filtros por obra, por mes y por tipo, y exportación a Excel.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, categoria, unidad, totalesLista, TIPOS_GASTO } from "../datos.js";
import { icono } from "../iconos.js";
import { dinero, seguro, fecha, formulario, aviso, refrescar, opcionesDe, barras, simbolo, aColones, aMoneda, precioEditado } from "../ui.js";
import { exportarMovimientos } from "../excel-datos.js";

// Filtros (se recuerdan mientras la app está abierta)
let seccion = "movimientos"; // o "reportes"
let filtroLista = "";
let filtroMes = "";          // "2026-11" o "" = todos
let filtroTipo = "todo";     // "todo" | "materiales" | "otros"

// Registrar o editar un gasto. Se exporta para usarlo también desde una lista.
export async function nuevoGasto(listaId = "", gasto = null) {
  const d = await formulario({
    titulo: gasto ? "Editar gasto" : "Registrar gasto",
    boton: "Guardar gasto",
    campos: [
      { nombre: "tipo", etiqueta: "Tipo", tipo: "select", valor: gasto?.tipo || TIPOS_GASTO[0], opciones: TIPOS_GASTO.map((t) => ({ valor: t, texto: t })) },
      { nombre: "monto", etiqueta: `Monto (${simbolo()})`, tipo: "number", valor: gasto ? aMoneda(gasto.monto) : "", requerido: true },
      { nombre: "listaId", etiqueta: "Obra", tipo: "select", valor: gasto ? gasto.listaId || "" : listaId, opciones: [{ valor: "", texto: "— Sin obra —" }, ...db.listas.map((l) => ({ valor: l.id, texto: l.nombre }))] },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: gasto?.fecha || hoy(), requerido: true },
      { nombre: "descripcion", etiqueta: "Descripción", ancho: true, valor: gasto?.descripcion || "", ayuda: "Ej. Pago semanal del ayudante" },
    ],
  });
  if (!d) return;
  const datos = {
    tipo: d.tipo, listaId: d.listaId || null, fecha: d.fecha, descripcion: d.descripcion,
    monto: gasto ? precioEditado(d.monto, gasto.monto) : aColones(d.monto),
  };
  if (gasto) Object.assign(gasto, datos);
  else db.gastos.unshift({ id: nuevoId(), ...datos });
  guardar(); refrescar();
  aviso(gasto ? "Gasto actualizado" : "Gasto guardado");
}

// Compras y gastos que pasan los filtros de obra y mes
function filtrados() {
  const pasa = (x) => (!filtroLista || x.listaId === filtroLista) && (!filtroMes || x.fecha.startsWith(filtroMes));
  return { compras: db.compras.filter(pasa), gastos: db.gastos.filter(pasa) };
}

// Una sola lista ordenada: [{ clase: "compra"|"gasto", fecha, monto, obj }]
function movimientos(compras, gastos) {
  const todos = [
    ...(filtroTipo === "otros" ? [] : compras.map((c) => ({ clase: "compra", fecha: c.fecha, monto: c.total, obj: c }))),
    ...(filtroTipo === "materiales" ? [] : gastos.map((g) => ({ clase: "gasto", fecha: g.fecha, monto: g.monto, obj: g }))),
  ];
  return todos.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const nombreMes = (m) => {
  const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const vistaGastos = {
  tab: "gastos",

  render() {
    const { compras, gastos } = filtrados();
    const totMateriales = compras.reduce((s, c) => s + c.total, 0);
    const totOtros = gastos.reduce((s, g) => s + g.monto, 0);
    const meses = [...new Set([...db.compras, ...db.gastos].map((x) => x.fecha.slice(0, 7)))].sort().reverse();
    const opcion = (v, t, actual) => `<option value="${v}" ${v === actual ? "selected" : ""}>${t}</option>`;

    return `
      <div class="encabezado">
        <h2>${icono("gastos")}Gastos</h2>
        <button class="principal" data-accion="nuevo">+ Gasto</button>
      </div>

      <div class="segmentos" role="tablist">
        <button role="tab" class="${seccion === "movimientos" ? "activo" : ""}" data-accion="seccion" data-s="movimientos">Movimientos</button>
        <button role="tab" class="${seccion === "reportes" ? "activo" : ""}" data-accion="seccion" data-s="reportes">Reportes</button>
      </div>

      <div class="fila filtros">
        <select data-cambio="obra" aria-label="Filtrar por obra">
          <option value="">Todas las obras</option>
          ${opcionesDe(db.listas, filtroLista)}
        </select>
        <select data-cambio="mes" aria-label="Filtrar por mes">
          ${opcion("", "Todos los meses", filtroMes)}
          ${meses.map((m) => opcion(m, nombreMes(m), filtroMes)).join("")}
        </select>
      </div>

      <section class="resumen">
        <div class="dato"><span>Materiales</span><strong>${dinero(totMateriales)}</strong></div>
        <div class="dato"><span>Otros gastos</span><strong>${dinero(totOtros)}</strong></div>
        <div class="dato"><span>Total</span><strong>${dinero(totMateriales + totOtros)}</strong></div>
      </section>

      ${seccion === "movimientos" ? vistaMovimientos(compras, gastos) : vistaReportes(compras, gastos)}`;
  },

  cambios: {
    obra(el) { filtroLista = el.value; refrescar(); },
    mes(el) { filtroMes = el.value; refrescar(); },
    tipo(el) { filtroTipo = el.value; refrescar(); },
  },

  acciones: {
    seccion(el) { seccion = el.dataset.s; refrescar(); },

    nuevo() { nuevoGasto(filtroLista); },

    editarGasto(el) {
      const g = buscar("gastos", el.closest("[data-id]").dataset.id);
      if (g) nuevoGasto("", g);
    },

    borrarGasto(el) {
      const id = el.closest("[data-id]").dataset.id;
      if (!confirm("¿Borrar este gasto?")) return;
      db.gastos = db.gastos.filter((g) => g.id !== id);
      guardar(); refrescar();
      aviso("Gasto borrado");
    },

    borrarCompra(el) {
      const id = el.closest("[data-id]").dataset.id;
      if (!confirm("¿Borrar esta compra?\nSus materiales regresan a \"por comprar\" en la lista.")) return;
      db.compras = db.compras.filter((c) => c.id !== id);
      for (const l of db.listas) {
        for (const i of l.items) {
          if (i.compraId === id) { i.estado = "pendiente"; delete i.compraId; }
        }
      }
      guardar(); refrescar();
      aviso("Compra borrada");
    },

    excel() {
      const { compras, gastos } = filtrados();
      const lista = movimientos(compras, gastos);
      if (!lista.length) return aviso("No hay movimientos con esos filtros.");
      const filtros = [
        filtroLista ? `Obra: ${buscar("listas", filtroLista)?.nombre}` : "Todas las obras",
        filtroMes ? nombreMes(filtroMes) : "Todos los meses",
        filtroTipo === "materiales" ? "Sólo materiales" : filtroTipo === "otros" ? "Sólo otros gastos" : "",
      ].filter(Boolean).join("   ·   ");
      exportarMovimientos(lista, filtros);
      aviso("Excel descargado");
    },
  },
};

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------
function vistaMovimientos(compras, gastos) {
  const lista = movimientos(compras, gastos);
  const op = (v, t) => `<option value="${v}" ${filtroTipo === v ? "selected" : ""}>${t}</option>`;
  return `
    <div class="fila entre">
      <select data-cambio="tipo" aria-label="Tipo de movimiento" class="selector-corto">
        ${op("todo", "Todo")}${op("materiales", "Sólo materiales")}${op("otros", "Sólo otros gastos")}
      </select>
      <button data-accion="excel">${icono("tabla")}Exportar a Excel</button>
    </div>
    ${lista.length ? lista.map((m) => (m.clase === "compra" ? tarjetaCompra(m.obj) : tarjetaGasto(m.obj))).join("")
      : `<p class="vacio">No hay movimientos${filtroLista || filtroMes || filtroTipo !== "todo" ? " con estos filtros" : " todavía"}.
         Las compras se registran desde una lista con "Finalizar compra"; la mano de obra, fletes y demás con "+ Gasto".</p>`}`;
}

function tarjetaCompra(c) {
  const prov = buscar("proveedores", c.proveedorId)?.nombre || "Compra de materiales";
  const obra = buscar("listas", c.listaId)?.nombre || "Obra borrada";
  return `
    <details class="tarjeta movimiento" data-id="${c.id}">
      <summary>
        <div>
          <strong>${seguro(prov)}</strong>
          <div class="nota">${fecha(c.fecha)} · ${seguro(obra)} · ${c.items.length} ${c.items.length === 1 ? "material" : "materiales"}</div>
          <span class="etiqueta-tipo materiales">${icono("carrito")} Materiales</span>
        </div>
        <strong>${dinero(c.total)}</strong>
      </summary>
      <table>
        <thead><tr><th>Material</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
        <tbody>
          ${c.items.map((i) => `
            <tr>
              <td>${seguro(i.nombre)}</td>
              <td class="num">${i.cantidad} ${seguro(unidad(i.unidadId).abrev)}</td>
              <td class="num">${dinero(i.precio)}</td>
              <td class="num">${dinero(i.cantidad * i.precio)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${c.nota ? `<p class="nota">Nota: ${seguro(c.nota)}</p>` : ""}
      <div class="fila fin"><button class="peligro" data-accion="borrarCompra">${icono("borrar")}Borrar compra</button></div>
    </details>`;
}

function tarjetaGasto(g) {
  const obra = buscar("listas", g.listaId)?.nombre;
  return `
    <div class="tarjeta movimiento" data-id="${g.id}">
      <div class="resumen-movimiento">
        <button class="nombre-item" data-accion="editarGasto" title="Editar gasto">
          <strong>${seguro(g.descripcion || g.tipo)}</strong>
          <span class="nota">${fecha(g.fecha)}${obra ? ` · ${seguro(obra)}` : " · Sin obra"}</span>
          <span class="etiqueta-tipo">${icono("billetera")} ${seguro(g.tipo)}</span>
        </button>
        <div class="botones">
          <strong>${dinero(g.monto)}</strong>
          <button data-accion="borrarGasto" aria-label="Borrar gasto">${icono("borrar")}</button>
        </div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------
function vistaReportes(compras, gastos) {
  const sumar = (mapa, clave, monto) => mapa.set(clave, (mapa.get(clave) || 0) + monto);
  const porCategoria = new Map(), porTipo = new Map(), porMes = new Map(), porProveedor = new Map();
  for (const c of compras) {
    for (const i of c.items) sumar(porCategoria, categoria(i.categoriaId).nombre, i.cantidad * i.precio);
    sumar(porProveedor, buscar("proveedores", c.proveedorId)?.nombre || "Sin proveedor", c.total);
    sumar(porMes, c.fecha.slice(0, 7), c.total);
  }
  for (const g of gastos) { sumar(porTipo, g.tipo, g.monto); sumar(porMes, g.fecha.slice(0, 7), g.monto); }
  const meses = [...porMes].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
    .map(([m, v]) => [new Date(`${m}-15T12:00:00`).toLocaleDateString("es-CR", { month: "short", year: "numeric" }), v]);
  return `
    ${filtroLista || filtroMes ? "" : `<section class="tarjeta"><h3>${icono("casco")}Por obra</h3>${reportePorObra()}</section>`}
    <section class="tarjeta"><h3>${icono("ladrillos")}Materiales por categoría</h3>${barras([...porCategoria])}</section>
    <section class="tarjeta"><h3>${icono("billetera")}Otros gastos por tipo</h3>${barras([...porTipo])}</section>
    <section class="tarjeta"><h3>${icono("tienda")}Por proveedor</h3>${barras([...porProveedor])}</section>
    ${filtroMes ? "" : `<section class="tarjeta"><h3>${icono("gastos")}Por mes (últimos 6)</h3>${barras(meses, { ordenar: false })}</section>`}`;
}

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
