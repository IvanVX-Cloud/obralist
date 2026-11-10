// =====================================================================
// Pantallas de listas: "Mis listas" y el detalle de una lista de obra.
// =====================================================================
import {
  db, guardar, nuevoId, hoy, buscar, categoria, unidad, totalesLista,
  asegurarCategoria, asegurarUnidad, proveedorPorNombre,
} from "../datos.js";
import {
  $, dinero, seguro, fecha, formulario, aviso, refrescar, descargar, opcionesDe, ir,
  simbolo, aMoneda, aColones, precioEditado,
} from "../ui.js";
import { nuevoGasto } from "./gastos.js";

// ---------------------------------------------------------------------
// Pantalla 1: todas las listas
// ---------------------------------------------------------------------
export const vistaListas = {
  tab: "listas",

  render() {
    const propias = db.listas.filter((l) => !l.archivada && !l.recibida);
    const recibidas = db.listas.filter((l) => !l.archivada && l.recibida);
    const archivadas = db.listas.filter((l) => l.archivada);
    return `
      <div class="encabezado">
        <h2>Mis listas de obra</h2>
        <button class="principal" data-accion="nueva">+ Nueva lista</button>
      </div>
      ${propias.length
        ? `<div class="tarjetas">${propias.map(tarjetaLista).join("")}</div>`
        : `<p class="vacio">Crea tu primera lista, por ejemplo "Instalación eléctrica Casa López".</p>`}

      <div class="encabezado">
        <h2>📥 Recibidas</h2>
        <label class="boton">Importar lista<input type="file" accept=".json,application/json" data-cambio="importar" hidden></label>
      </div>
      ${recibidas.length
        ? `<div class="tarjetas">${recibidas.map(tarjetaLista).join("")}</div>`
        : `<p class="nota">Cuando alguien te mande una lista de ObraList (archivo .json), impórtala aquí.</p>`}

      ${archivadas.length ? `
        <details class="tarjeta">
          <summary>🗄️ Archivadas (${archivadas.length})</summary>
          <div class="tarjetas">${archivadas.map(tarjetaLista).join("")}</div>
        </details>` : ""}`;
  },

  acciones: {
    async nueva() {
      const d = await formulario({
        titulo: "Nueva lista de obra",
        boton: "Crear lista",
        campos: [
          { nombre: "nombre", etiqueta: "Nombre de la obra", requerido: true, ancho: true, ayuda: "Ej. Instalación eléctrica Casa López" },
          { nombre: "cliente", etiqueta: "Cliente" },
          { nombre: "presupuesto", etiqueta: `Presupuesto máximo (${simbolo()})`, tipo: "number", valor: "" },
          { nombre: "direccion", etiqueta: "Dirección", ancho: true },
          {
            nombre: "plantilla", etiqueta: "Copiar materiales de otra lista", tipo: "select", ancho: true,
            opciones: [{ valor: "", texto: "— Empezar en blanco —" }, ...db.listas.map((l) => ({ valor: l.id, texto: l.nombre }))],
          },
        ],
      });
      if (!d) return;
      const base = buscar("listas", d.plantilla);
      const lista = {
        id: nuevoId(), nombre: d.nombre, cliente: d.cliente, direccion: d.direccion,
        presupuesto: aColones(d.presupuesto), creada: hoy(), archivada: false,
        items: base ? base.items.map((it) => ({ ...it, id: nuevoId(), estado: "pendiente", compraId: undefined })) : [],
      };
      db.listas.unshift(lista);
      guardar();
      ir(`#/lista/${lista.id}`);
    },
  },

  cambios: {
    // Leer un archivo .json que te mandaron y agregarlo como "Recibida".
    async importar(el) {
      const archivo = el.files[0];
      if (!archivo) return;
      try {
        const o = JSON.parse(await archivo.text());
        if (o.tipo !== "obralist-lista" || !Array.isArray(o.lista?.items)) throw new Error("formato");
        const l = o.lista;
        db.listas.unshift({
          id: nuevoId(), nombre: String(l.nombre || "Lista recibida"), cliente: String(l.cliente || ""),
          direccion: String(l.direccion || ""), presupuesto: Number(l.presupuesto) || 0,
          creada: hoy(), archivada: false,
          recibida: { de: String(o.de || "Alguien"), fecha: hoy() },
          items: l.items.map((it) => ({
            id: nuevoId(),
            productoId: db.productos.find((p) => p.nombre === it.nombre)?.id || null,
            nombre: String(it.nombre || "Material"),
            categoriaId: asegurarCategoria(it.categoria),
            unidadId: asegurarUnidad(it.unidad),
            cantidad: Number(it.cantidad) || 0,
            precio: Number(it.precio) || 0,
            estado: "pendiente",
          })),
        });
        guardar();
        aviso("Lista importada ✓");
        refrescar();
      } catch {
        aviso("Ese archivo no es una lista de ObraList");
      }
    },
  },
};

function tarjetaLista(l) {
  const t = totalesLista(l);
  const pct = t.total ? Math.round((t.comprado / t.total) * 100) : 0;
  const sub = [l.recibida ? `📥 De ${l.recibida.de}` : "", l.cliente, `${l.items.length} materiales`].filter(Boolean);
  return `
    <a class="tarjeta lista-tarjeta" href="#/lista/${l.id}">
      <strong>${seguro(l.nombre)}</strong>
      <span class="nota">${sub.map(seguro).join(" · ")}</span>
      <div class="barra-progreso"><div style="width:${pct}%"></div></div>
      <span class="fila entre"><span class="nota">${pct}% comprado</span><strong>${dinero(t.total)}</strong></span>
    </a>`;
}

// ---------------------------------------------------------------------
// Pantalla 2: una lista de obra
// ---------------------------------------------------------------------
let lista = null; // la lista que se está viendo

const itemDe = (el) => lista.items.find((i) => i.id === el.closest("[data-id]").dataset.id);

export const vistaLista = {
  tab: "listas",

  render(id) {
    lista = buscar("listas", id);
    if (!lista) return `<p class="vacio">No encontré esa lista. <a href="#/listas">Volver</a></p>`;
    const l = lista;
    const t = totalesLista(l);
    const porComprar = l.items.filter((i) => i.estado !== "comprado");
    const comprados = l.items.filter((i) => i.estado === "comprado");
    const enCarrito = l.items.filter((i) => i.estado === "carrito");
    const info = [l.cliente, l.direccion, l.recibida ? `📥 Recibida de ${l.recibida.de}` : ""].filter(Boolean);

    return `
      <a href="#/listas" class="volver">← Mis listas</a>
      <div>
        <h2 class="titulo-lista">${seguro(l.nombre)}</h2>
        ${info.length ? `<p class="nota">${info.map(seguro).join(" · ")}</p>` : ""}
      </div>

      <div class="acciones-lista">
        <button data-accion="editar">✏️ Editar</button>
        <button data-accion="compartirTexto">💬 Compartir</button>
        <button data-accion="compartirArchivo">💾 Enviar archivo</button>
        <button data-accion="csv">📄 Excel</button>
        <button data-accion="gasto">💸 Otro gasto</button>
        <button data-accion="archivar">${l.archivada ? "↩️ Desarchivar" : "🗄️ Archivar"}</button>
        <button data-accion="borrar" class="peligro">🗑️ Borrar</button>
      </div>

      <section class="resumen">
        <div class="dato"><span>Total materiales</span><strong>${dinero(t.total)}</strong></div>
        <div class="dato"><span>Comprado</span><strong>${dinero(t.comprado)}</strong></div>
        <div class="dato"><span>Por comprar</span><strong>${dinero(t.pendiente)}</strong></div>
      </section>

      ${bloquePresupuesto(l, t)}

      <section class="tarjeta">
        <h3>Agregar material</h3>
        <form data-form="agregar" class="formulario">
          <label class="ancho">Material
            <input name="nombre" list="dl-productos" required autocomplete="off" data-entrada="material"
                   placeholder="Busca en tu catálogo o escribe uno nuevo">
            <datalist id="dl-productos">${db.productos.map((p) => `<option value="${seguro(p.nombre)}">`).join("")}</datalist>
          </label>
          <label>Categoría<select name="categoriaId">${opcionesDe(db.categorias, null, (c) => `${c.icono} ${c.nombre}`)}</select></label>
          <label>Unidad<select name="unidadId">${opcionesDe(db.unidades, null, (u) => u.abrev)}</select></label>
          <label>Cantidad<input name="cantidad" type="number" min="0" step="any" inputmode="decimal" value="1" required></label>
          <label>Precio unitario (${simbolo()})<input name="precio" type="number" min="0" step="any" inputmode="decimal" value="0" required></label>
          <label class="ancho check"><input type="checkbox" name="guardarCatalogo" checked> Guardar en mi catálogo si es nuevo</label>
          <button class="ancho principal">Agregar a la lista</button>
        </form>
      </section>

      <section class="tarjeta">
        <h3>Por comprar (${porComprar.length})</h3>
        <p class="nota">Marca ☑️ lo que vas metiendo al carrito y al final toca "Finalizar compra".</p>
        ${porComprar.length ? grupos(porComprar, false) : `<p class="vacio">${l.items.length ? "¡Todo comprado! 🎉" : "Aún no agregas materiales."}</p>`}
      </section>

      ${comprados.length ? `
        <details class="tarjeta">
          <summary>✅ Comprados (${comprados.length}) · ${dinero(t.comprado)}</summary>
          ${grupos(comprados, true)}
        </details>` : ""}

      ${enCarrito.length ? `
        <div class="barra-carrito">
          <span>🛒 ${enCarrito.length} en carrito · <strong>${dinero(t.carrito)}</strong></span>
          <button class="principal" data-accion="finalizar">Finalizar compra</button>
        </div>` : ""}`;
  },

  entradas: {
    // Al escoger un material del catálogo, llenamos categoría, unidad y precio.
    material(el) {
      const p = db.productos.find((x) => x.nombre === el.value);
      if (!p) return;
      const f = el.form;
      f.categoriaId.value = p.categoriaId;
      f.unidadId.value = p.unidadId;
      f.precio.value = aMoneda(p.precio);
    },
  },

  formularios: {
    agregar(form, d) {
      const nombre = d.nombre.trim();
      if (!nombre) return;
      const cantidad = Number(d.cantidad) || 0;
      const precio = aColones(d.precio); // lo escrito está en la moneda elegida
      let prod = db.productos.find((p) => p.nombre.toLowerCase() === nombre.toLowerCase());
      if (!prod && d.guardarCatalogo) {
        prod = { id: nuevoId(), nombre, categoriaId: d.categoriaId, unidadId: d.unidadId, precio };
        db.productos.push(prod);
      }
      // Si ese material ya está pendiente en la lista, sumamos la cantidad.
      const existente = lista.items.find((i) => i.estado !== "comprado" && i.nombre.toLowerCase() === nombre.toLowerCase());
      if (existente) {
        existente.cantidad += cantidad;
        aviso(`Sumé ${cantidad} al material que ya estaba`);
      } else {
        lista.items.push({
          id: nuevoId(), productoId: prod?.id || null, nombre,
          categoriaId: d.categoriaId, unidadId: d.unidadId, cantidad, precio, estado: "pendiente",
        });
      }
      guardar();
      refrescar();
      $('[data-form="agregar"] [name="nombre"]')?.focus();
    },
  },

  cambios: {
    carrito(el) { itemDe(el).estado = el.checked ? "carrito" : "pendiente"; guardar(); refrescar(); },
    cantidad(el) { itemDe(el).cantidad = Math.max(0, Number(el.value) || 0); guardar(); refrescar(); },
  },

  acciones: {
    async editarItem(el) {
      const it = itemDe(el);
      const d = await formulario({
        titulo: "Editar material",
        campos: [
          { nombre: "nombre", etiqueta: "Material", valor: it.nombre, requerido: true, ancho: true },
          { nombre: "categoriaId", etiqueta: "Categoría", tipo: "select", valor: it.categoriaId, opciones: db.categorias.map((c) => ({ valor: c.id, texto: `${c.icono} ${c.nombre}` })) },
          { nombre: "unidadId", etiqueta: "Unidad", tipo: "select", valor: it.unidadId, opciones: db.unidades.map((u) => ({ valor: u.id, texto: u.abrev })) },
          { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", valor: it.cantidad },
          { nombre: "precio", etiqueta: `Precio unitario (${simbolo()})`, tipo: "number", valor: aMoneda(it.precio) },
        ],
      });
      if (!d) return;
      d.precio = precioEditado(d.precio, it.precio);
      Object.assign(it, d);
      guardar(); refrescar();
    },

    quitarItem(el) {
      const it = itemDe(el);
      lista.items = lista.items.filter((i) => i !== it);
      guardar(); refrescar();
      aviso(`Quitado: ${it.nombre}`);
    },

    // Pasar lo que está en el carrito al historial de compras.
    async finalizar() {
      const enCarrito = lista.items.filter((i) => i.estado === "carrito");
      const total = enCarrito.reduce((s, i) => s + i.cantidad * i.precio, 0);
      const d = await formulario({
        titulo: `Registrar compra · ${dinero(total)}`,
        boton: "Registrar compra",
        campos: [
          { nombre: "proveedor", etiqueta: "¿Dónde compraste?", ancho: true, ayuda: "Ej. Ferretería El Martillo", sugerencias: db.proveedores.map((p) => p.nombre) },
          { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: hoy(), requerido: true },
          { nombre: "nota", etiqueta: "Nota (folio, factura…)" },
        ],
      });
      if (!d) return;
      const compra = {
        id: nuevoId(), fecha: d.fecha, listaId: lista.id, proveedorId: proveedorPorNombre(d.proveedor),
        nota: d.nota, total,
        items: enCarrito.map((i) => ({
          productoId: i.productoId, nombre: i.nombre, categoriaId: i.categoriaId,
          unidadId: i.unidadId, cantidad: i.cantidad, precio: i.precio,
        })),
      };
      db.compras.unshift(compra);
      for (const i of enCarrito) {
        i.estado = "comprado";
        i.compraId = compra.id;
        const p = buscar("productos", i.productoId);
        if (p) p.precio = i.precio; // el catálogo recuerda el último precio
      }
      guardar(); refrescar();
      aviso("Compra guardada en el historial ✓");
    },

    async editar() {
      const d = await formulario({
        titulo: "Editar lista",
        campos: [
          { nombre: "nombre", etiqueta: "Nombre de la obra", valor: lista.nombre, requerido: true, ancho: true },
          { nombre: "cliente", etiqueta: "Cliente", valor: lista.cliente },
          { nombre: "presupuesto", etiqueta: `Presupuesto máximo (${simbolo()})`, tipo: "number", valor: aMoneda(lista.presupuesto) || "" },
          { nombre: "direccion", etiqueta: "Dirección", valor: lista.direccion, ancho: true },
        ],
      });
      if (!d) return;
      d.presupuesto = precioEditado(d.presupuesto, lista.presupuesto);
      Object.assign(lista, d);
      guardar(); refrescar();
    },

    gasto() { nuevoGasto(lista.id); },

    archivar() {
      lista.archivada = !lista.archivada;
      guardar();
      aviso(lista.archivada ? "Lista archivada" : "Lista restaurada");
      ir("#/listas");
    },

    borrar() {
      if (!confirm(`¿Borrar la lista "${lista.nombre}"?\nLas compras y gastos ya registrados se quedan en el historial.`)) return;
      db.listas = db.listas.filter((l) => l !== lista);
      guardar();
      ir("#/listas");
    },

    csv() {
      const s = simbolo();
      const filas = [["Material", "Categoría", "Unidad", "Cantidad", `Precio (${s})`, `Importe (${s})`, "Estado"]];
      for (const i of lista.items) {
        filas.push([i.nombre, categoria(i.categoriaId).nombre, unidad(i.unidadId).abrev, i.cantidad, aMoneda(i.precio), aMoneda(i.cantidad * i.precio), i.estado]);
      }
      const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      descargar(`${lista.nombre}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
    },

    // Texto listo para WhatsApp.
    async compartirTexto() {
      const texto = textoLista(lista);
      try {
        if (navigator.share) { await navigator.share({ title: lista.nombre, text: texto }); return; }
        await navigator.clipboard.writeText(texto);
        aviso("Lista copiada: pégala en WhatsApp");
      } catch (e) {
        if (e.name !== "AbortError") aviso("No se pudo compartir");
      }
    },

    // Archivo que la otra persona importa en su ObraList (queda en "Recibidas").
    async compartirArchivo() {
      if (!db.perfil.nombre) {
        const d = await formulario({ titulo: "¿Cómo te llamas?", boton: "Continuar", campos: [
          { nombre: "nombre", etiqueta: "Tu nombre (para que sepan quién manda la lista)", requerido: true, ancho: true },
        ] });
        if (!d) return;
        db.perfil.nombre = d.nombre;
        guardar();
      }
      const datos = {
        // Los precios del archivo van en colones (la moneda base), sin importar
        // cuál tengas elegida, para que quien lo reciba no mezcle monedas.
        tipo: "obralist-lista", version: 1, moneda: "CRC", de: db.perfil.nombre, fecha: hoy(),
        lista: {
          nombre: lista.nombre, cliente: lista.cliente, direccion: lista.direccion, presupuesto: lista.presupuesto,
          items: lista.items.map((i) => ({
            nombre: i.nombre, categoria: categoria(i.categoriaId).nombre, unidad: unidad(i.unidadId).abrev,
            cantidad: i.cantidad, precio: i.precio,
          })),
        },
      };
      const json = JSON.stringify(datos, null, 2);
      const nombreArchivo = `${lista.nombre}.obralist.json`.replace(/[\\/:*?"<>|]/g, "-");
      const archivo = new File([json], nombreArchivo, { type: "application/json" });
      try {
        if (navigator.canShare?.({ files: [archivo] })) {
          await navigator.share({ files: [archivo], title: lista.nombre });
          return;
        }
      } catch (e) {
        if (e.name === "AbortError") return;
      }
      descargar(nombreArchivo, json, "application/json");
      aviso("Archivo descargado: mándalo por WhatsApp o correo");
    },
  },
};

function bloquePresupuesto(l, t) {
  if (!(l.presupuesto > 0)) return "";
  const pasado = t.gastadoReal > l.presupuesto;
  const pct = Math.min(100, (t.gastadoReal / l.presupuesto) * 100);
  return `
    <section class="tarjeta">
      <div class="fila entre">
        <span>Gastado real <span class="nota">(compras ${dinero(t.compras)} + otros ${dinero(t.otros)})</span></span>
        <strong class="${pasado ? "rojo" : ""}">${dinero(t.gastadoReal)} de ${dinero(l.presupuesto)}</strong>
      </div>
      <div class="barra-progreso ${pasado ? "pasado" : ""}"><div style="width:${pct}%"></div></div>
      ${pasado ? `<p class="rojo">⚠️ Te pasaste del presupuesto por ${dinero(t.gastadoReal - l.presupuesto)}</p>` : ""}
    </section>`;
}

// Agrupa materiales por categoría, en el orden de tus categorías.
function grupos(items, sonComprados) {
  const orden = (id) => { const i = db.categorias.findIndex((c) => c.id === id); return i < 0 ? 999 : i; };
  const porCat = new Map();
  for (const it of items) {
    if (!porCat.has(it.categoriaId)) porCat.set(it.categoriaId, []);
    porCat.get(it.categoriaId).push(it);
  }
  return [...porCat].sort((a, b) => orden(a[0]) - orden(b[0])).map(([catId, its]) => {
    const c = categoria(catId);
    const subtotal = its.reduce((s, i) => s + i.cantidad * i.precio, 0);
    return `
      <div class="grupo">
        <h4><span>${c.icono} ${seguro(c.nombre)}</span><span>${dinero(subtotal)}</span></h4>
        ${its.map((it) => filaItem(it, sonComprados)).join("")}
      </div>`;
  }).join("");
}

function filaItem(it, comprado) {
  const u = unidad(it.unidadId);
  let extra = "";
  if (comprado && it.compraId) {
    const c = buscar("compras", it.compraId);
    const p = c && buscar("proveedores", c.proveedorId);
    if (c) extra = ` · ${fecha(c.fecha)}${p ? ` en ${seguro(p.nombre)}` : ""}`;
  }
  return `
    <div class="item ${it.estado}" data-id="${it.id}">
      ${comprado ? `<span class="palomita">✓</span>`
                 : `<input type="checkbox" data-cambio="carrito" ${it.estado === "carrito" ? "checked" : ""} aria-label="En el carrito">`}
      <button class="nombre-item" data-accion="editarItem" title="Editar">
        <span class="nombre">${seguro(it.nombre)}</span>
        <span class="detalle">${dinero(it.precio)} / ${seguro(u.abrev)}${extra}</span>
      </button>
      ${comprado ? `<span class="cant">${it.cantidad} ${seguro(u.abrev)}</span>`
                 : `<input type="number" min="0" step="any" inputmode="decimal" value="${it.cantidad}" data-cambio="cantidad" aria-label="Cantidad">`}
      <span class="importe">${dinero(it.cantidad * it.precio)}</span>
      <button data-accion="quitarItem" aria-label="Quitar" class="quitar">✕</button>
    </div>`;
}

function textoLista(l) {
  const lineas = [`🧱 *${l.nombre}*`];
  if (l.cliente) lineas.push(`Cliente: ${l.cliente}`);
  if (l.direccion) lineas.push(`Dirección: ${l.direccion}`);
  const pendientes = l.items.filter((i) => i.estado !== "comprado");
  for (const c of db.categorias) {
    const its = pendientes.filter((i) => i.categoriaId === c.id);
    if (!its.length) continue;
    lineas.push("", `${c.icono} *${c.nombre}*`);
    for (const i of its) lineas.push(`• ${i.cantidad} ${unidad(i.unidadId).abrev} — ${i.nombre}`);
  }
  const total = pendientes.reduce((s, i) => s + i.cantidad * i.precio, 0);
  lineas.push("", `Total estimado: ${dinero(total)}`, "", "Hecha con ObraList");
  return lineas.join("\n");
}
