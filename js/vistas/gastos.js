// =====================================================================
// Gastos: TODO el dinero que sale de las obras en un solo lugar.
//   • Movimientos → compras de materiales + otros gastos (mano de obra,
//     flete, renta de equipo…), del más reciente al más viejo.
//   • Reportes    → gráficas de en qué se va el dinero.
// Filtros por obra, por mes y por tipo, y exportación a Excel.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, categoria, unidad, totalesLista, TIPOS_GASTO } from "../datos.js";
import { icono } from "../iconos.js";
import { dinero, seguro, fecha, formulario, aviso, refrescar, opcionesDe, simbolo, aColones, aMoneda, precioEditado, estadoPresupuesto } from "../ui.js";
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
// Primero todas las compras y después todos los gastos, cada grupo del más reciente al más viejo.
function movimientos(compras, gastos) {
  const recientes = (a, b) => b.fecha.localeCompare(a.fecha);
  return [
    ...(filtroTipo === "otros" ? [] : compras.map((c) => ({ clase: "compra", fecha: c.fecha, monto: c.total, obj: c })).sort(recientes)),
    ...(filtroTipo === "materiales" ? [] : gastos.map((g) => ({ clase: "gasto", fecha: g.fecha, monto: g.monto, obj: g })).sort(recientes)),
  ];
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
        <h2>${icono("gastos")}Compras y gastos</h2>
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
        <div class="dato"><span>Compras</span><strong>${dinero(totMateriales)}</strong></div>
        <div class="dato"><span>Gastos</span><strong>${dinero(totOtros)}</strong></div>
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
        filtroTipo === "materiales" ? "Sólo compras" : filtroTipo === "otros" ? "Sólo gastos" : "",
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
  const deCompras = lista.filter((m) => m.clase === "compra");
  const deGastos = lista.filter((m) => m.clase === "gasto");
  const suma = (l) => l.reduce((s, m) => s + m.monto, 0);
  const op = (v, t) => `<option value="${v}" ${filtroTipo === v ? "selected" : ""}>${t}</option>`;
  const conFiltros = filtroLista || filtroMes;
  return `
    <div class="fila entre">
      <select data-cambio="tipo" aria-label="Qué mostrar" class="selector-corto">
        ${op("todo", "Compras y gastos")}${op("materiales", "Sólo compras")}${op("otros", "Sólo gastos")}
      </select>
      <button data-accion="excel">${icono("tabla")}Exportar a Excel</button>
    </div>

    ${filtroTipo === "otros" ? "" : `
      <div class="encabezado-grupo">
        <h3>${icono("carrito")}Compras <span class="nota">(${deCompras.length})</span></h3>
        <strong>${dinero(suma(deCompras))}</strong>
      </div>
      ${deCompras.length ? deCompras.map((m) => tarjetaCompra(m.obj)).join("")
        : `<p class="nota">No hay compras${conFiltros ? " con estos filtros" : " todavía"}. Se registran desde una lista: marca los materiales y toca "Finalizar compra".</p>`}`}

    ${filtroTipo === "materiales" ? "" : `
      <div class="encabezado-grupo">
        <h3>${icono("billetera")}Gastos <span class="nota">(${deGastos.length})</span></h3>
        <strong>${dinero(suma(deGastos))}</strong>
      </div>
      ${deGastos.length ? deGastos.map((m) => tarjetaGasto(m.obj)).join("")
        : `<p class="nota">No hay gastos${conFiltros ? " con estos filtros" : " todavía"}. Mano de obra, fletes, renta de equipo y demás se registran con "+ Gasto".</p>`}`}`;
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
// Reportes: que EXPLIQUEN, no sólo muestren barras.
//   1. Resumen en palabras del mes (y comparación con el mes anterior)
//   2. Dona: ¿en qué se va la plata? (con porcentajes)
//   3. Columnas por mes (compras + gastos)
//   4. Barras con porcentaje y cuántas veces
//   5. Presupuesto de cada obra con mensaje
// Las gráficas se dibujan con SVG: funcionan sin internet.
// ---------------------------------------------------------------------
const PALETA = ["#e8892b", "#2a9d8f", "#4c78c9", "#9b5de5", "#3fa34d", "#d9534f", "#c9a227", "#8a8f98"];

const mesAnterior = (m) => { const [a, n] = m.split("-").map(Number); return n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`; };
const mesCorto = (m) => new Date(`${m}-15T12:00:00`).toLocaleDateString("es-CR", { month: "short" }).replace(".", "");
const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : 0);
// "₡227 mil" para que quepa en el centro de la dona
const corto = (colones) => `${simbolo()}${aMoneda(colones).toLocaleString("es-CR", { notation: "compact", maximumFractionDigits: 1 })}`;

// Compras y gastos de un mes, respetando el filtro de obra
function delMes(mes) {
  const pasa = (x) => (!filtroLista || x.listaId === filtroLista) && x.fecha.startsWith(mes);
  const compras = db.compras.filter(pasa), gastos = db.gastos.filter(pasa);
  return { compras, gastos, total: compras.reduce((s, c) => s + c.total, 0) + gastos.reduce((s, g) => s + g.monto, 0) };
}

// ¿En qué se fue la plata? Materiales por categoría + gastos por tipo, en un solo mapa.
function distribucion(compras, gastos) {
  const m = new Map();
  const sumar = (k, v) => m.set(k, (m.get(k) || 0) + v);
  for (const c of compras) for (const i of c.items) sumar(categoria(i.categoriaId).nombre, i.cantidad * i.precio);
  for (const g of gastos) sumar(g.tipo, g.monto);
  return [...m].sort((a, b) => b[1] - a[1]);
}

function vistaReportes(compras, gastos) {
  if (!compras.length && !gastos.length && !db.compras.length && !db.gastos.length) {
    return `<p class="vacio">Todavía no hay compras ni gastos. Cuando registres algunos, aquí verás en qué se va la plata.</p>`;
  }
  return `
    ${resumenEnPalabras()}
    <section class="tarjeta"><h3>${icono("gastos")}¿En qué se va la plata?</h3>${dona(distribucion(compras, gastos))}</section>
    ${filtroMes ? "" : `<section class="tarjeta"><h3>${icono("tendencia")}Mes a mes</h3>${columnasPorMes()}</section>`}
    <section class="tarjeta"><h3>${icono("tienda")}Por proveedor</h3>${barrasDetalle(porProveedor(compras), "compra", "compras")}</section>
    <section class="tarjeta"><h3>${icono("billetera")}Gastos por tipo</h3>${barrasDetalle(porTipo(gastos), "gasto", "gastos")}</section>
    ${filtroLista || filtroMes ? "" : `<section class="tarjeta"><h3>${icono("casco")}Presupuesto por obra</h3>${reportePorObra()}</section>`}`;
}

// 1. Resumen en palabras
function resumenEnPalabras() {
  const mes = filtroMes || hoy().slice(0, 7);
  const ahora = delMes(mes), antes = delMes(mesAnterior(mes));
  const obra = filtroLista ? ` · ${seguro(buscar("listas", filtroLista)?.nombre || "")}` : "";
  if (!ahora.total) {
    return `<section class="tarjeta resumen-palabras"><h3>${nombreMes(mes)}${obra}</h3>
      <p>No hay compras ni gastos este mes${antes.total ? `. En ${nombreMes(mesAnterior(mes)).toLowerCase()} fueron ${dinero(antes.total)}` : ""}.</p></section>`;
  }
  let comparacion = "";
  if (antes.total) {
    const cambio = Math.round(((ahora.total - antes.total) / antes.total) * 100);
    const sube = cambio > 0;
    comparacion = `<p class="${sube ? "sube" : "baja"}">${icono(sube ? "tendencia" : "check")} ${Math.abs(cambio)} % ${sube ? "más" : "menos"} que en ${nombreMes(mesAnterior(mes)).toLowerCase()} (${dinero(antes.total)})</p>`;
  }
  const [masCaro] = distribucion(ahora.compras, ahora.gastos);
  const proveedores = porProveedor(ahora.compras).filter(([n]) => n !== "Sin proveedor");
  const totalGastos = ahora.gastos.reduce((s, g) => s + g.monto, 0);
  const puntos = [
    masCaro && `Lo que más te costó: <strong>${seguro(masCaro[0])}</strong> (${porcentaje(masCaro[1], ahora.total)} %)`,
    proveedores[0] && `Donde más compraste: <strong>${seguro(proveedores[0][0])}</strong> (${proveedores[0][1].veces} ${proveedores[0][1].veces === 1 ? "compra" : "compras"}, ${dinero(proveedores[0][1].monto)})`,
    totalGastos && `Gastos que no son materiales: <strong>${dinero(totalGastos)}</strong> (${porcentaje(totalGastos, ahora.total)} %)`,
  ].filter(Boolean);
  return `
    <section class="tarjeta resumen-palabras">
      <h3>${nombreMes(mes)}${obra}</h3>
      <p class="grande">Gastaste <strong>${dinero(ahora.total)}</strong> en total.</p>
      ${comparacion}
      ${puntos.length ? `<ul>${puntos.map((p) => `<li>${p}</li>`).join("")}</ul>` : ""}
    </section>`;
}

// 2. Dona con leyenda y porcentajes
function dona(entradas) {
  if (!entradas.length) return `<p class="nota">Sin datos con estos filtros.</p>`;
  const total = entradas.reduce((s, [, v]) => s + v, 0);
  const principales = entradas.slice(0, 6);
  const resto = entradas.slice(6).reduce((s, [, v]) => s + v, 0);
  if (resto > 0) principales.push(["Otros", resto]);
  let acumulado = 0;
  const arcos = principales.map(([, v], i) => {
    const pct = (v / total) * 100;
    // círculo de circunferencia 100: cada tramo mide su porcentaje; empieza arriba (25)
    const arco = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${PALETA[i % PALETA.length]}" stroke-width="6"
      stroke-dasharray="${Math.max(pct - 0.4, 0.1)} ${100 - Math.max(pct - 0.4, 0.1)}" stroke-dashoffset="${25 - acumulado}"/>`;
    acumulado += pct;
    return arco;
  }).join("");
  return `
    <div class="dona">
      <svg viewBox="0 0 42 42" role="img" aria-label="Distribución de lo gastado">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--borde)" stroke-width="6"/>
        ${arcos}
        <text x="21" y="20.5" text-anchor="middle" class="dona-total">${corto(total)}</text>
        <text x="21" y="25.5" text-anchor="middle" class="dona-etiqueta">total</text>
      </svg>
      <ul class="leyenda">
        ${principales.map(([n, v], i) => `
          <li><span class="punto" style="background:${PALETA[i % PALETA.length]}"></span>
            <span class="leyenda-nombre">${seguro(n)}</span>
            <span class="leyenda-monto">${dinero(v)}</span>
            <strong>${porcentaje(v, total)} %</strong></li>`).join("")}
      </ul>
    </div>`;
}

// 3. Columnas de los últimos 6 meses (compras abajo, gastos arriba)
function columnasPorMes() {
  const meses = [];
  for (let m = hoy().slice(0, 7), i = 0; i < 6; i++, m = mesAnterior(m)) meses.unshift(m);
  const datos = meses.map((m) => {
    const d = delMes(m);
    return { m, compras: d.compras.reduce((s, c) => s + c.total, 0), gastos: d.gastos.reduce((s, g) => s + g.monto, 0) };
  });
  const max = Math.max(1, ...datos.map((d) => d.compras + d.gastos));
  const alto = 100, ancho = 300, paso = ancho / datos.length, barra = paso * 0.55;
  const cols = datos.map((d, i) => {
    const x = i * paso + (paso - barra) / 2;
    const hC = (d.compras / max) * alto, hG = (d.gastos / max) * alto;
    const total = d.compras + d.gastos;
    return `
      <rect x="${x}" y="${12 + alto - hC}" width="${barra}" height="${hC}" fill="${PALETA[0]}" rx="2"/>
      <rect x="${x}" y="${12 + alto - hC - hG}" width="${barra}" height="${hG}" fill="${PALETA[1]}" rx="2"/>
      ${total ? `<text x="${x + barra / 2}" y="${8 + alto - hC - hG}" text-anchor="middle" class="valor-col">${corto(total)}</text>` : ""}
      <text x="${x + barra / 2}" y="${alto + 26}" text-anchor="middle" class="mes-col">${mesCorto(d.m)}</text>`;
  }).join("");
  const [penultimo, ultimo] = datos.slice(-2).map((d) => d.compras + d.gastos);
  const cambio = penultimo ? Math.round(((ultimo - penultimo) / penultimo) * 100) : null;
  return `
    <svg class="columnas" viewBox="0 0 ${ancho} ${alto + 32}" role="img" aria-label="Gastos de los últimos 6 meses">${cols}</svg>
    <div class="fila entre">
      <span class="nota"><span class="punto" style="background:${PALETA[0]}"></span> Compras &nbsp; <span class="punto" style="background:${PALETA[1]}"></span> Gastos</span>
      ${cambio !== null ? `<strong class="${cambio > 0 ? "sube" : "baja"}">${cambio > 0 ? "+" : ""}${cambio} % vs. el mes pasado</strong>` : ""}
    </div>`;
}

// 4. Barras con porcentaje y cuántas veces
function porProveedor(compras) {
  const m = new Map();
  for (const c of compras) {
    const n = buscar("proveedores", c.proveedorId)?.nombre || "Sin proveedor";
    const x = m.get(n) || { monto: 0, veces: 0 };
    x.monto += c.total; x.veces++;
    m.set(n, x);
  }
  return [...m].sort((a, b) => b[1].monto - a[1].monto);
}
function porTipo(gastos) {
  const m = new Map();
  for (const g of gastos) {
    const x = m.get(g.tipo) || { monto: 0, veces: 0 };
    x.monto += g.monto; x.veces++;
    m.set(g.tipo, x);
  }
  return [...m].sort((a, b) => b[1].monto - a[1].monto);
}
function barrasDetalle(entradas, singular, plural) {
  if (!entradas.length) return `<p class="nota">Sin ${plural} con estos filtros.</p>`;
  const total = entradas.reduce((s, [, x]) => s + x.monto, 0);
  const max = Math.max(...entradas.map(([, x]) => x.monto), 1);
  return entradas.map(([n, x]) => `
    <div class="barra-detalle">
      <div class="fila entre"><span>${seguro(n)}</span><strong>${dinero(x.monto)}</strong></div>
      <div class="barra-grafica"><div style="width:${(x.monto / max) * 100}%"></div></div>
      <span class="nota">${porcentaje(x.monto, total)} % del total · ${x.veces} ${x.veces === 1 ? singular : plural}</span>
    </div>`).join("");
}

// 5. Presupuesto de cada obra
function reportePorObra() {
  if (!db.listas.length) return `<p class="nota">Sin obras todavía.</p>`;
  return db.listas.map((l) => {
    const t = totalesLista(l);
    return `
      <div class="obra-presupuesto">
        <div class="fila entre"><strong>${seguro(l.nombre)}</strong><span class="nota">${l.presupuesto > 0 ? `Presupuesto ${dinero(l.presupuesto)}` : "Sin presupuesto"}</span></div>
        ${l.presupuesto > 0 ? estadoPresupuesto(t.gastadoReal, l.presupuesto)
          : `<p class="nota">Gastado: ${dinero(t.gastadoReal)} (compras ${dinero(t.compras)} + gastos ${dinero(t.otros)}). Ponle un presupuesto en la lista para ver cómo vas.</p>`}
      </div>`;
  }).join("");
}
