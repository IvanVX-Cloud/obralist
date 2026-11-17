// =====================================================================
// Cuentas: el dinero que ENTRA y el que SALE, en un solo lugar.
//   • Movimientos → ventas de materiales (entra) + compras de materiales y
//     otros gastos como mano de obra, flete o permisos (sale).
//   • Reportes    → gráficas de en qué se va el dinero y qué vendiste.
// Filtros por obra, por mes y por tipo, y exportación a Excel.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, categoria, unidad, tiposGasto, totalVenta, gananciaVenta, lineasVenta, palabras, usa, moverInventario, esSimple, unidadesOrdenadas } from "../datos.js";
import { icono } from "../iconos.js";
import { dinero, seguro, fecha, formulario, aviso, refrescar, simbolo, aColones, aMoneda, precioEditado } from "../ui.js";
import { exportarMovimientos } from "../excel-datos.js";

// Filtros (se recuerdan mientras la app está abierta)
let seccion = "movimientos"; // o "reportes"
let filtroLista = "";
let filtroMes = "";          // "2026-11" o "" = todos
let filtroTipo = "todo";     // "todo" | "ventas" | "materiales" (compras) | "otros" (gastos)

// ¿Se muestra este tipo de movimiento con el filtro elegido?
const ver = (tipo) => filtroTipo === "todo" || filtroTipo === tipo;

// Registrar o editar un gasto. Se exporta para usarlo también desde una lista.
export async function nuevoGasto(listaId = "", gasto = null) {
  const d = await formulario({
    titulo: gasto ? "Editar gasto" : "Registrar gasto",
    boton: "Guardar gasto",
    quitar: gasto ? "Borrar" : "",
    campos: [
      { nombre: "tipo", etiqueta: "Tipo", tipo: "select", valor: gasto?.tipo || tiposGasto()[0], opciones: tiposGasto(gasto?.tipo).map((t) => ({ valor: t, texto: t })) },
      { nombre: "monto", etiqueta: `Monto (${simbolo()})`, tipo: "number", valor: gasto ? aMoneda(gasto.monto) : "", requerido: true },
      { nombre: "listaId", etiqueta: palabras().Obra, tipo: "select", valor: gasto ? gasto.listaId || "" : listaId, opciones: [{ valor: "", texto: `— Sin ${palabras().obra} —` }, ...db.listas.map((l) => ({ valor: l.id, texto: l.nombre }))] },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: gasto?.fecha || hoy(), requerido: true },
      { nombre: "descripcion", etiqueta: "Descripción", ancho: true, valor: gasto?.descripcion || "", ayuda: "Ej. Pago semanal del ayudante" },
    ],
  });
  if (!d) return;
  if (d._quitar) return borrarGastoDe(gasto);
  const datos = {
    tipo: d.tipo, listaId: d.listaId || null, fecha: d.fecha, descripcion: d.descripcion,
    monto: gasto ? precioEditado(d.monto, gasto.monto) : aColones(d.monto),
  };
  if (gasto) Object.assign(gasto, datos);
  else db.gastos.unshift({ id: nuevoId(), ...datos });
  guardar(); refrescar();
  aviso(gasto ? "Gasto actualizado" : "Gasto guardado");
}

function borrarGastoDe(g) {
  if (!g || !confirm("¿Borrar este gasto?")) return;
  db.gastos = db.gastos.filter((x) => x.id !== g.id);
  guardar(); refrescar();
  aviso("Gasto borrado");
}

// Registrar o editar una venta de material.
export async function nuevaVenta(listaId = "", venta = null) {
  const und = db.unidades.find((u) => u.abrev === "und")?.id || db.unidades[0]?.id || "";
  const d = await formulario({
    titulo: venta ? "Editar venta" : "Registrar venta",
    boton: "Guardar venta",
    quitar: venta ? "Borrar" : "",
    campos: [
      { nombre: "nombre", etiqueta: "¿Qué vendiste?", requerido: true, ancho: true, valor: venta?.nombre || "",
        ayuda: "Busca en tu catálogo o escribe", sugerencias: db.productos.map((p) => p.nombre) },
      { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", valor: venta?.cantidad ?? 1, requerido: true },
      { nombre: "unidadId", etiqueta: "Unidad", tipo: "select", valor: venta?.unidadId || und, opciones: unidadesOrdenadas().map((u) => ({ valor: u.id, texto: u.abrev })) },
      { nombre: "precio", etiqueta: `Precio de venta c/u (${simbolo()})`, tipo: "number", valor: venta ? aMoneda(venta.precio) : "", requerido: true },
      { nombre: "costo", etiqueta: `Lo que te costó c/u (${simbolo()})`, tipo: "number", valor: venta?.costo ? aMoneda(venta.costo) : "", ayuda: "Opcional" },
      { tipo: "html", html: `Si anotas lo que te costó, ObraList te dice cuánto ganaste. Si el ${palabras().material} está en tu catálogo, los precios se llenan solos.` },
      { nombre: "cliente", etiqueta: "¿A quién?", valor: venta?.cliente || "", ayuda: "Opcional", sugerencias: clientesConocidos() },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: venta?.fecha || hoy(), requerido: true },
      { nombre: "listaId", etiqueta: `${palabras().Obra} (opcional)`, tipo: "select", ancho: true, valor: venta ? venta.listaId || "" : listaId,
        opciones: [{ valor: "", texto: `— Sin ${palabras().obra} —` }, ...db.listas.map((l) => ({ valor: l.id, texto: l.nombre }))] },
      { nombre: "nota", etiqueta: "Nota", ancho: true, valor: venta?.nota || "", ayuda: usa("obras") ? "Ej. Sobrante del proyecto" : "Ej. Pagó con SINPE" },
    ],
    // Al escoger un material del catálogo: se llenan la unidad y lo que costó.
    alEscribir(form, campo) {
      if (campo.name !== "nombre") return;
      const p = db.productos.find((x) => x.nombre === campo.value);
      if (!p) return;
      form.unidadId.value = p.unidadId;
      form.costo.value = aMoneda(p.precio);
      if (p.precioVenta > 0) form.precio.value = aMoneda(p.precioVenta);
    },
  });
  if (!d) return;
  if (d._quitar) return vistaGastos.acciones.borrarVenta({ closest: () => ({ dataset: { id: venta.id } }) });
  if (!(d.cantidad > 0)) return aviso("La cantidad tiene que ser mayor que cero.");
  const prod = db.productos.find((p) => p.nombre.toLowerCase() === d.nombre.toLowerCase());
  const datos = {
    nombre: prod?.nombre || d.nombre, productoId: prod?.id || null, unidadId: d.unidadId,
    cantidad: d.cantidad, cliente: d.cliente, fecha: d.fecha, listaId: d.listaId || null, nota: d.nota,
    // los montos se escriben en la moneda elegida y se guardan en colones
    precio: venta ? precioEditado(d.precio, venta.precio) : aColones(d.precio),
    costo: venta ? precioEditado(d.costo, venta.costo || 0) : aColones(d.costo),
  };
  // Inventario: se devuelve lo de antes (si se estaba editando) y se resta lo nuevo.
  if (venta?.inventario) moverInventario([venta], +1);
  const obj = venta ? Object.assign(venta, datos) : { id: nuevoId(), ...datos };
  obj.inventario = moverInventario([obj], -1) > 0;
  if (!venta) db.ventas.unshift(obj);
  guardar(); refrescar();
  aviso(venta ? "Venta actualizada" : `Venta guardada: ${dinero(totalVenta(datos))}`);
}

// Nombres de clientes que ya usaste (para sugerirlos al escribir).
function clientesConocidos() {
  return [...new Set([...db.ventas.map((v) => v.cliente), ...db.listas.map((l) => l.cliente)].filter(Boolean))];
}

// Ventas, compras y gastos que pasan los filtros de obra y mes
function filtrados() {
  const pasa = (x) => (!filtroLista || x.listaId === filtroLista) && (!filtroMes || x.fecha.startsWith(filtroMes));
  return { compras: db.compras.filter(pasa), gastos: db.gastos.filter(pasa), ventas: db.ventas.filter(pasa) };
}

// Una sola lista ordenada del más reciente al más viejo:
// [{ clase: "venta"|"compra"|"gasto", fecha, monto, obj }]
function movimientos(compras, gastos, ventas) {
  return [
    ...(ver("ventas") ? ventas.map((v) => ({ clase: "venta", fecha: v.fecha, monto: totalVenta(v), obj: v })) : []),
    ...(ver("materiales") ? compras.map((c) => ({ clase: "compra", fecha: c.fecha, monto: c.total, obj: c })) : []),
    ...(ver("otros") ? gastos.map((g) => ({ clase: "gasto", fecha: g.fecha, monto: g.monto, obj: g })) : []),
  ].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

const nombreMes = (m) => {
  const t = new Date(`${m}-15T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const vistaGastos = {
  tab: "gastos",

  render() {
    const { compras, gastos, ventas } = filtrados();
    const totMateriales = compras.reduce((s, c) => s + c.total, 0);
    const totOtros = gastos.reduce((s, g) => s + g.monto, 0);
    const totVentas = ventas.reduce((s, v) => s + totalVenta(v), 0);

    // Resumen: lo que gastaste y (si vendes) lo que vendiste, cada uno por separado.
    // No se restan: hay quien sólo compra para sus obras y quien sólo vende.
    const periodo = filtroMes ? `en ${nombreMes(filtroMes).toLowerCase()}` : "en total";
    const conGanancia = ventas.map(gananciaVenta).filter((g) => g !== null);
    const ganancia = conGanancia.reduce((s, g) => s + g, 0);
    const vende = usa("ventas") || db.ventas.length;
    const resumen = `
      <section class="resumen-separado ${vende ? "dos" : ""}">
        <div class="tarjeta cifra">
          <span class="nota">${icono("carrito")}Gastaste ${periodo}</span>
          <strong>${dinero(totMateriales + totOtros)}</strong>
          <span class="nota">Compras ${dinero(totMateriales)} · Otros gastos ${dinero(totOtros)}</span>
        </div>
        ${vende ? `
        <div class="tarjeta cifra">
          <span class="nota">${icono("etiqueta")}Vendiste ${periodo}</span>
          <strong class="entrada">${dinero(totVentas)}</strong>
          <span class="nota">${conGanancia.length ? (ganancia >= 0 ? `Ganaste ${dinero(ganancia)} con esas ventas` : `Perdiste ${dinero(-ganancia)} con esas ventas`) : `${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"}`}</span>
        </div>` : ""}
      </section>`;

    const hayVentas = usa("ventas") || db.ventas.length;
    const filtros = [
      filtroLista && buscar("listas", filtroLista)?.nombre,
      filtroMes && nombreMes(filtroMes),
      { ventas: "Sólo ventas", materiales: "Sólo compras", otros: "Sólo gastos" }[filtroTipo],
    ].filter(Boolean);

    return `
      <div class="encabezado">
        <h2>Cuentas</h2>
        <button data-accion="filtrar" class="${filtros.length ? "con-filtro" : ""}">${icono("buscar")}${filtros.length ? "Filtros" : "Filtrar"}</button>
      </div>
      ${filtros.length ? `
        <p class="filtros-activos">Viendo: <strong>${filtros.map(seguro).join(" · ")}</strong>
          <button class="boton-enlace" data-accion="quitarFiltros">Quitar</button></p>` : ""}

      ${resumen}

      <div class="acciones-cuentas">
        ${hayVentas ? `<button class="principal" data-accion="venta">${icono("etiqueta")}Registrar venta</button>` : ""}
        <button class="${hayVentas ? "" : "principal"}" data-accion="nuevo">${icono("billetera")}Registrar gasto</button>
      </div>

      <div class="segmentos" role="tablist">
        <button role="tab" class="${seccion === "movimientos" ? "activo" : ""}" data-accion="seccion" data-s="movimientos">Historial</button>
        <button role="tab" class="${seccion === "reportes" ? "activo" : ""}" data-accion="seccion" data-s="reportes">Gráficos</button>
      </div>

      ${seccion === "movimientos" ? vistaMovimientos(compras, gastos, ventas) : vistaReportes(compras, gastos, ventas)}`;
  },

  cambios: {
    obra(el) { filtroLista = el.value; refrescar(); },
    mes(el) { filtroMes = el.value; refrescar(); },
    tipo(el) { filtroTipo = el.value; refrescar(); },
  },

  acciones: {
    seccion(el) { seccion = el.dataset.s; refrescar(); },

    // Una sola ventana para todos los filtros (así la pantalla queda limpia)
    async filtrar() {
      const meses = [...new Set([...db.compras, ...db.gastos, ...db.ventas].map((x) => x.fecha.slice(0, 7)))].sort().reverse();
      const d = await formulario({
        titulo: "Filtrar", boton: "Aplicar",
        campos: [
          { nombre: "lista", etiqueta: palabras().Obra, tipo: "select", ancho: true, valor: filtroLista,
            opciones: [{ valor: "", texto: palabras().todas }, ...db.listas.filter((l) => !esSimple(l)).map((l) => ({ valor: l.id, texto: l.nombre }))] },
          { nombre: "mes", etiqueta: "Mes", tipo: "select", valor: filtroMes,
            opciones: [{ valor: "", texto: "Todos los meses" }, ...meses.map((m) => ({ valor: m, texto: nombreMes(m) }))] },
          { nombre: "tipo", etiqueta: "Mostrar", tipo: "select", valor: filtroTipo,
            opciones: [{ valor: "todo", texto: "Todo" }, (usa("ventas") || db.ventas.length) && { valor: "ventas", texto: "Sólo ventas" },
              { valor: "materiales", texto: "Sólo compras" }, { valor: "otros", texto: "Sólo gastos" }].filter(Boolean) },
        ],
      });
      if (!d) return;
      filtroLista = d.lista; filtroMes = d.mes; filtroTipo = d.tipo;
      refrescar();
    },

    quitarFiltros() { filtroLista = ""; filtroMes = ""; filtroTipo = "todo"; refrescar(); },

    nuevo() { nuevoGasto(filtroLista); },

    venta() { nuevaVenta(filtroLista); },

    editarVenta(el) {
      const v = buscar("ventas", el.closest("[data-id]").dataset.id);
      if (v) nuevaVenta("", v);
    },

    borrarVenta(el) {
      const id = el.closest("[data-id]").dataset.id;
      const deUnPedido = Boolean(buscar("ventas", id)?.items);
      if (!confirm(deUnPedido ? "¿Borrar esta venta?\nSus productos regresan a \"por entregar\" en el pedido." : "¿Borrar esta venta?")) return;
      const v = buscar("ventas", id);
      if (v?.inventario) moverInventario(lineasVenta(v), +1); // regresa a la bodega
      db.ventas = db.ventas.filter((x) => x.id !== id);
      for (const l of db.listas) {
        for (const i of l.items) {
          if (i.ventaId === id) { i.estado = "pendiente"; delete i.ventaId; }
        }
      }
      guardar(); refrescar();
      aviso("Venta borrada");
    },

    editarGasto(el) {
      const g = buscar("gastos", el.closest("[data-id]").dataset.id);
      if (g) nuevoGasto("", g);
    },

    borrarGasto(el) { borrarGastoDe(buscar("gastos", el.closest("[data-id]").dataset.id)); },

    borrarCompra(el) {
      const id = el.closest("[data-id]").dataset.id;
      if (!confirm("¿Borrar esta compra?\nSus materiales regresan a \"por comprar\" en la lista.")) return;
      const c = buscar("compras", id);
      if (c?.alInventario) moverInventario(c.items, -1); // se quita lo que había sumado
      db.compras = db.compras.filter((x) => x.id !== id);
      for (const l of db.listas) {
        for (const i of l.items) {
          if (i.compraId === id) { i.estado = "pendiente"; delete i.compraId; }
        }
      }
      guardar(); refrescar();
      aviso("Compra borrada");
    },

    excel() {
      const { compras, gastos, ventas } = filtrados();
      const lista = movimientos(compras, gastos, ventas);
      if (!lista.length) return aviso("No hay movimientos con esos filtros.");
      const filtros = [
        filtroLista ? `${palabras().Obra}: ${buscar("listas", filtroLista)?.nombre}` : palabras().todas,
        filtroMes ? nombreMes(filtroMes) : "Todos los meses",
        { ventas: "Sólo ventas", materiales: "Sólo compras", otros: "Sólo gastos" }[filtroTipo] || "",
      ].filter(Boolean).join("   ·   ");
      exportarMovimientos(lista, filtros);
      aviso("Excel descargado");
    },
  },
};

// ---------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------
function vistaMovimientos(compras, gastos, ventas) {
  const lista = movimientos(compras, gastos, ventas);
  if (!lista.length) {
    return `
      <div class="vacio-grande">
        ${icono("gastos", "icono-grande icono-acento")}
        <strong>${filtroLista || filtroMes || filtroTipo !== "todo" ? "Nada con esos filtros" : "Todavía no hay nada aquí"}</strong>
        <span class="nota">Las compras aparecen solas cuando tocas «Pagar y registrar compra» en una lista. Los gastos${usa("ventas") ? " y las ventas" : ""} los registras con los botones de arriba.</span>
      </div>`;
  }
  // Un solo historial, separado por mes
  const tarjeta = { venta: tarjetaVenta, compra: tarjetaCompra, gasto: tarjetaGasto };
  let mesActual = "";
  const filas = lista.map((m) => {
    const mes = m.fecha.slice(0, 7);
    const titulo = mes !== mesActual ? `<h3 class="titulo-mes">${nombreMes(mes)}</h3>` : "";
    mesActual = mes;
    return titulo + tarjeta[m.clase](m.obj);
  }).join("");
  return `
    ${filas}
    <p class="centro"><button class="boton-enlace" data-accion="excel">${icono("tabla")}Descargar en Excel</button></p>`;
}

function tarjetaCompra(c) {
  const prov = buscar("proveedores", c.proveedorId)?.nombre || "Compra de materiales";
  const obra = buscar("listas", c.listaId)?.nombre || `${palabras().Obra} que ya no existe`;
  return `
    <details class="tarjeta movimiento" data-id="${c.id}">
      <summary>
        <div>
          <strong>${seguro(prov)}</strong>
          <div class="nota">${fecha(c.fecha)} · ${seguro(obra)} · ${c.items.length} ${c.items.length === 1 ? palabras().material : palabras().materiales}</div>
          <span class="etiqueta-tipo materiales">${icono("carrito")} Compra</span>
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

function tarjetaVenta(v) {
  if (v.items) return tarjetaVentaPedido(v);
  const obra = buscar("listas", v.listaId)?.nombre;
  const ganancia = gananciaVenta(v);
  const detalles = [fecha(v.fecha), v.cliente && `a ${seguro(v.cliente)}`, obra && seguro(obra)].filter(Boolean).join(" · ");
  const resultado = ganancia === null ? ""
    : ganancia >= 0 ? ` · ganaste ${dinero(ganancia)}` : ` · perdiste ${dinero(-ganancia)}`;
  return `
    <div class="tarjeta movimiento" data-id="${v.id}">
      <div class="resumen-movimiento">
        <button class="nombre-item" data-accion="editarVenta" title="Toca para cambiar o borrar">
          <strong>${v.cantidad} ${seguro(unidad(v.unidadId).abrev)} · ${seguro(v.nombre)}</strong>
          <span class="nota">${detalles}</span>
          ${v.nota ? `<span class="nota">${seguro(v.nota)}</span>` : ""}
          <span class="etiqueta-tipo venta">${icono("etiqueta")} Venta${resultado}</span>
        </button>
        <div class="botones">
          <strong class="entrada">+${dinero(totalVenta(v))}</strong>
        </div>
      </div>
    </div>`;
}

// Venta que salió de un pedido (varios productos): se abre como una compra.
function tarjetaVentaPedido(v) {
  const lista = buscar("listas", v.listaId)?.nombre;
  const ganancia = gananciaVenta(v);
  const resultado = ganancia === null ? ""
    : ganancia >= 0 ? ` · ganaste ${dinero(ganancia)}` : ` · perdiste ${dinero(-ganancia)}`;
  return `
    <details class="tarjeta movimiento" data-id="${v.id}">
      <summary>
        <div>
          <strong>${seguro(v.cliente || "Venta")}</strong>
          <div class="nota">${[fecha(v.fecha), lista && seguro(lista), `${v.items.length} ${v.items.length === 1 ? "producto" : "productos"}`].filter(Boolean).join(" · ")}</div>
          <span class="etiqueta-tipo venta">${icono("etiqueta")} Venta${resultado}</span>
        </div>
        <strong class="entrada">+${dinero(totalVenta(v))}</strong>
      </summary>
      <table>
        <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
        <tbody>
          ${v.items.map((i) => `
            <tr>
              <td>${seguro(i.nombre)}</td>
              <td class="num">${i.cantidad} ${seguro(unidad(i.unidadId).abrev)}</td>
              <td class="num">${dinero(i.precio)}</td>
              <td class="num">${dinero(i.cantidad * i.precio)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${v.nota ? `<p class="nota">Nota: ${seguro(v.nota)}</p>` : ""}
      <div class="fila fin"><button class="peligro" data-accion="borrarVenta">${icono("borrar")}Borrar venta</button></div>
    </details>`;
}

function tarjetaGasto(g) {
  const obra = buscar("listas", g.listaId)?.nombre;
  return `
    <div class="tarjeta movimiento" data-id="${g.id}">
      <div class="resumen-movimiento">
        <button class="nombre-item" data-accion="editarGasto" title="Toca para cambiar o borrar">
          <strong>${seguro(g.descripcion || g.tipo)}</strong>
          <span class="nota">${fecha(g.fecha)}${obra ? ` · ${seguro(obra)}` : ` · Sin ${palabras().obra}`}</span>
          <span class="etiqueta-tipo">${icono("billetera")} ${seguro(g.tipo)}</span>
        </button>
        <div class="botones"><strong>${dinero(g.monto)}</strong></div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------
// Gráficos: tres tarjetas simples, con montos completos y sin porcentajes.
//   1. ¿En qué gastaste?  → barras acostadas, de mayor a menor
//   2. Tus ventas         → cobraste – te costó = ganaste (y por producto)
//   3. Mes por mes        → una lista en palabras, sólo meses con algo
// Usan los mismos filtros que el historial.
// ---------------------------------------------------------------------

// Materiales por categoría + otros gastos por tipo, en un solo mapa, de mayor a menor.
function distribucion(compras, gastos) {
  const m = new Map();
  const sumar = (k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const c of compras) for (const i of c.items) sumar(categoria(i.categoriaId).nombre, i.cantidad * i.precio);
  for (const g of gastos) sumar(g.tipo, g.monto);
  return [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

function vistaReportes(compras, gastos, ventas) {
  if (!compras.length && !gastos.length && !ventas.length) {
    return `
      <div class="vacio-grande">
        ${icono("gastos", "icono-grande icono-acento")}
        <strong>Todavía no hay nada que mostrar</strong>
        <span class="nota">Cuando registres compras, gastos${usa("ventas") ? " o ventas" : ""}, aquí verás en qué se va la plata.</span>
      </div>`;
  }
  return `${tarjetaGastado(compras, gastos)}${reporteVentas(ventas)}${mesPorMes(compras, gastos, ventas)}`;
}

// 1. ¿En qué gastaste? Si hay más de 5 cosas, las más chicas se juntan en "Otras".
function tarjetaGastado(compras, gastos) {
  const reparto = distribucion(compras, gastos);
  if (!reparto.length) return "";
  const total = reparto.reduce((s, [, v]) => s + v, 0);
  const periodo = filtroMes ? `en ${nombreMes(filtroMes).toLowerCase()}` : "en total";
  if (reparto.length === 1) {
    return `
    <section class="tarjeta">
      <h3>${icono("gastos")}¿En qué gastaste?</h3>
      <p>Gastaste <strong>${dinero(total)}</strong> ${periodo}, todo en <strong>${seguro(reparto[0][0])}</strong>.</p>
    </section>`;
  }
  const filas = reparto.length > 5
    ? [...reparto.slice(0, 4), [`Otras ${reparto.length - 4} cosas`, reparto.slice(4).reduce((s, [, v]) => s + v, 0), true]]
    : reparto;
  const max = Math.max(...filas.map(([, v]) => v));
  return `
    <section class="tarjeta">
      <h3>${icono("gastos")}¿En qué gastaste?</h3>
      <p class="nota">${dinero(total)} ${periodo}</p>
      <div class="barras-simples">
        ${filas.map(([nombre, v, otras]) => `
          <div>
            <div class="fila entre"><span>${seguro(nombre)}</span><strong>${dinero(v)}</strong></div>
            <div class="barra-grafica ${otras ? "gris" : ""}"><div style="width:${(v / max) * 100}%"></div></div>
          </div>`).join("")}
      </div>
    </section>`;
}

// 2. Tus ventas: la cuenta (cobraste – te costó = ganaste) y cuánto dejó cada producto.
function reporteVentas(ventas) {
  if (!ventas.length) return "";
  const total = ventas.reduce((s, v) => s + totalVenta(v), 0);
  const porProducto = new Map();
  let vendidoConCosto = 0, costoTotal = 0, sinCosto = 0;
  for (const v of ventas) {
    for (const i of lineasVenta(v)) {
      const x = porProducto.get(i.nombre) || { monto: 0, unidades: 0, ganancia: 0, conCosto: false };
      x.monto += i.cantidad * i.precio; x.unidades += i.cantidad;
      if (i.costo > 0) {
        x.ganancia += i.cantidad * (i.precio - i.costo); x.conCosto = true;
        vendidoConCosto += i.cantidad * i.precio; costoTotal += i.cantidad * i.costo;
      } else sinCosto++;
      porProducto.set(i.nombre, x);
    }
  }
  const ganancia = vendidoConCosto - costoTotal;
  const productos = [...porProducto].sort((a, b) => b[1].monto - a[1].monto);
  const periodo = filtroMes ? `en ${nombreMes(filtroMes).toLowerCase()}` : "en total";

  const cuenta = costoTotal ? `
      <div class="cuenta-venta">
        <div class="linea-cuenta"><span>Cobraste</span><strong>${dinero(vendidoConCosto)}</strong></div>
        <div class="linea-cuenta"><span>Te había costado</span><strong>− ${dinero(costoTotal)}</strong></div>
        <div class="linea-cuenta total"><span>${ganancia >= 0 ? "Ganaste" : "Perdiste"}</span>
          <strong class="${ganancia >= 0 ? "entrada" : "rojo"}">${dinero(Math.abs(ganancia))}</strong></div>
      </div>
      ${ganancia < 0 ? `<p class="nota">Perdiste porque vendiste más barato de lo que te costó. Revisa el precio de venta en el Catálogo.</p>` : ""}
      ${sinCosto ? `<p class="nota">La cuenta sólo incluye los productos donde anotaste lo que te costaron.</p>` : ""}`
    : `<p class="nota">Para saber cuánto ganas, anota en el Catálogo lo que te cuesta cada producto.</p>`;

  const detalle = (x) => `${x.unidades} ${x.unidades === 1 ? "vendido" : "vendidos"}${x.conCosto ? ` · ${x.ganancia >= 0 ? "ganaste" : "perdiste"} ${dinero(Math.abs(x.ganancia))}` : ""}`;
  return `
    <section class="tarjeta">
      <h3>${icono("etiqueta")}Tus ventas</h3>
      <p>Vendiste <strong class="entrada">${dinero(total)}</strong> ${periodo}
        (${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"}).</p>
      ${cuenta}
      <div class="lista-simple-datos">
        ${productos.map(([n, x]) => `
          <div class="renglon">
            <div class="fila entre"><span>${seguro(n)}</span><strong>${dinero(x.monto)}</strong></div>
            <span class="nota">${detalle(x)}</span>
          </div>`).join("")}
      </div>
    </section>`;
}

// "Noviembre" si es de este año; "Noviembre de 2025" si es de otro.
const mesEnPalabras = (m) => {
  const n = nombreMes(m);
  return m.slice(0, 4) === hoy().slice(0, 4) ? n.replace(/ de \d{4}$/, "") : n;
};

// 3. Mes por mes, en palabras. Sólo los meses que tienen algo, del más nuevo al más viejo.
//    Con un solo mes no se muestra (no hay nada que comparar).
function mesPorMes(compras, gastos, ventas) {
  const meses = new Map();
  const dato = (fechaTexto) => {
    const m = fechaTexto.slice(0, 7);
    if (!meses.has(m)) meses.set(m, { gastado: 0, vendido: 0 });
    return meses.get(m);
  };
  for (const c of compras) dato(c.fecha).gastado += c.total;
  for (const g of gastos) dato(g.fecha).gastado += g.monto;
  for (const v of ventas) dato(v.fecha).vendido += totalVenta(v);
  if (meses.size < 2) return "";
  const filas = [...meses].sort((a, b) => b[0].localeCompare(a[0]));
  return `
    <section class="tarjeta">
      <h3>${icono("tendencia")}Mes por mes</h3>
      <div class="lista-simple-datos">
        ${filas.map(([m, d]) => `
          <div class="renglon fila entre">
            <strong>${mesEnPalabras(m)}</strong>
            <span class="montos-mes">
              ${d.gastado ? `<span>Gastaste <strong>${dinero(d.gastado)}</strong></span>` : ""}
              ${d.vendido ? `<span>Vendiste <strong class="entrada">${dinero(d.vendido)}</strong></span>` : ""}
            </span>
          </div>`).join("")}
      </div>
    </section>`;
}
