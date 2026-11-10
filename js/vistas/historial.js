// =====================================================================
// Historial de compras: cada vez que "finalizas una compra" queda aquí.
// =====================================================================
import { db, guardar, buscar, unidad } from "../datos.js";
import { dinero, seguro, fecha, refrescar, opcionesDe, aviso } from "../ui.js";

let filtroLista = "";

export const vistaHistorial = {
  tab: "historial",

  render() {
    const compras = db.compras
      .filter((c) => !filtroLista || c.listaId === filtroLista)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = compras.reduce((s, c) => s + c.total, 0);
    return `
      <div class="encabezado"><h2>Historial de compras</h2></div>
      <div class="fila filtros">
        <select data-cambio="filtro" aria-label="Filtrar por obra">
          <option value="">Todas las obras</option>
          ${opcionesDe(db.listas, filtroLista)}
        </select>
      </div>
      <section class="resumen dos">
        <div class="dato"><span>Compras</span><strong>${compras.length}</strong></div>
        <div class="dato"><span>Total gastado en materiales</span><strong>${dinero(total)}</strong></div>
      </section>
      ${compras.length ? compras.map(tarjetaCompra).join("")
        : `<p class="vacio">Aún no hay compras. Dentro de una lista, marca ☑️ los materiales y toca "Finalizar compra".</p>`}`;
  },

  cambios: {
    filtro(el) { filtroLista = el.value; refrescar(); },
  },

  acciones: {
    borrar(el) {
      const id = el.closest("[data-id]").dataset.id;
      if (!confirm("¿Borrar esta compra del historial?\nSus materiales regresan a \"por comprar\" en la lista.")) return;
      db.compras = db.compras.filter((c) => c.id !== id);
      for (const l of db.listas) {
        for (const i of l.items) {
          if (i.compraId === id) { i.estado = "pendiente"; delete i.compraId; }
        }
      }
      guardar(); refrescar();
      aviso("Compra borrada");
    },
  },
};

function tarjetaCompra(c) {
  const prov = buscar("proveedores", c.proveedorId)?.nombre || "Sin proveedor";
  const obra = buscar("listas", c.listaId)?.nombre || "Obra borrada";
  return `
    <details class="tarjeta compra" data-id="${c.id}">
      <summary>
        <div>
          <strong>${fecha(c.fecha)} · ${seguro(prov)}</strong>
          <div class="nota">${seguro(obra)} · ${c.items.length} materiales</div>
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
      ${c.nota ? `<p class="nota">📝 ${seguro(c.nota)}</p>` : ""}
      <div class="fila fin"><button class="peligro" data-accion="borrar">🗑️ Borrar compra</button></div>
    </details>`;
}
