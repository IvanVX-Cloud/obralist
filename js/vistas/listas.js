// =====================================================================
// Pantallas de listas: "Mis listas" y el detalle de una lista de obra.
// =====================================================================
import {
  db, guardar, nuevoId, hoy, buscar, categoria, unidad, totalesLista,
  asegurarCategoria, asegurarUnidad, proveedorPorNombre, quienSoy, OCUPACIONES, agregarALista,
  categoriasOrdenadas, OFICIOS_RAPIDOS, copiaDeRescate, descartarRescate,
  USOS, usa, usos, usosElegidos, palabras, cambiarUsos, esPedido, esSimple, precioPara, llevaInventario, moverInventario, faltantes, conPocoStock, unidadesOrdenadas } from "../datos.js";
import { SOPORTE } from "../config.js";
import { icono } from "../iconos.js";
import { registrosDe, ultimoAvance } from "./bitacora.js";
import { borrarFoto } from "../fotos.js";
import { exportarLista, leerMateriales } from "../excel-datos.js";
import { compartir, esCompartidaConmigo, categoriaDeItem, unidadDeItem } from "../compartir.js";
import { nube, invitarALista, quitarDeLista, salirDeListaCompartida } from "../nube.js";
import {
  $, dinero, seguro, fecha, formulario, aviso, refrescar, descargar, opcionesDe, ir, estadoPresupuesto, aplicarApariencia,
  menu, elegirArchivo,
  simbolo, aMoneda, aColones, precioEditado,
} from "../ui.js";
import { nuevoGasto } from "./gastos.js";

// ---------------------------------------------------------------------
// Pantalla 1: todas las listas
// ---------------------------------------------------------------------
export const vistaListas = {
  tab: "listas",

  render() {
    const propias = db.listas.filter((l) => !l.archivada && !l.recibida && !esCompartidaConmigo(l));
    const recibidas = db.listas.filter((l) => !l.archivada && l.recibida && !esCompartidaConmigo(l));
    const archivadas = db.listas.filter((l) => l.archivada && !esCompartidaConmigo(l));
    const conmigo = db.listas.filter(esCompartidaConmigo);
    const { nombre } = db.perfil;
    const p = palabras();
    // Si ya hay nombre, el saludo va en la franja naranja de arriba (app.js → saludoDeLaBarra).
    const saludo = nombre ? "" : `<p class="nota"><a href="#/mas">Completa tu perfil</a> con tu nombre y ocupación.</p>`;
    return `
      ${bloqueRescate()}
      ${saludo}
      ${bloqueBienvenida()}
      ${bloqueStock()}
      <div class="encabezado">
        <h2>${p.misListas}</h2>
        <button class="principal" data-accion="nueva">+ Nueva lista</button>
      </div>
      ${propias.length
        ? `<div class="tarjetas">${propias.map(tarjetaLista).join("")}</div>`
        : `<div class="vacio-grande">
            ${icono("agregarLista", "icono-grande icono-acento")}
            <strong>Crea tu primera lista</strong>
            <span class="nota">Una lista para cada ${usa("ventas") && !usa("obras") ? "pedido o compra" : palabras().obra}.</span>
            <button class="principal" data-accion="nueva">+ Nueva lista</button>
          </div>`}

      ${conmigo.length ? `
        <div class="encabezado"><h2>${icono("usuario")}Compartidas conmigo</h2></div>
        <div class="tarjetas">${conmigo.map(tarjetaLista).join("")}</div>` : ""}

      ${recibidas.length ? `
        <div class="encabezado"><h2>${icono("recibida")}Recibidas</h2></div>
        <div class="tarjetas">${recibidas.map(tarjetaLista).join("")}</div>` : ""}
      <p class="nota centro">¿Te mandaron un archivo de ObraList?
        <label class="enlace">Ábrelo aquí<input type="file" accept=".json,application/json" data-cambio="importar" hidden></label></p>

      ${archivadas.length ? `
        <details class="tarjeta">
          <summary>${icono("archivar")} Archivadas (${archivadas.length})</summary>
          <div class="tarjetas">${archivadas.map(tarjetaLista).join("")}</div>
        </details>` : ""}`;
  },

  acciones: {
    // Bajar la copia de los datos que no se pudieron leer (ver "rescatar" en datos.js)
    descargarRescate() {
      const copia = copiaDeRescate();
      if (!copia) return;
      descargar(`ObraList-rescate-${copia.fecha.slice(0, 10)}.json`, copia.texto, "application/json");
      aviso("Copia descargada. Guárdala bien.");
    },

    quitarRescate() {
      if (!confirm("¿Borrar la copia de rescate de este dispositivo?\nHazlo sólo si ya la descargaste o si ya recuperaste tus datos.")) return;
      descartarRescate();
      refrescar();
    },


    // Primera vez: elegir el oficio con un toque.
    elegirOficio(el) {
      db.perfil.ocupacion = el.dataset.oficio;
      guardar(); refrescar();
      aviso(`Listo: ObraList se ajustó para ${el.dataset.oficio}`);
    },

    // Nueva lista: primero se elige el tipo y después se piden sólo los datos que sirven.
    async nueva() {
      const p = palabras();
      const tipo = await menu("¿Qué lista quieres hacer?", [
        usa("ventas") && { valor: "venta", icono: "etiqueta", titulo: "Pedido de un cliente", detalle: "Lo que te pidieron. Al final tocas «Registrar venta»" },
        { valor: "compra", icono: "carrito", titulo: usa("obras") ? "Lista de materiales para comprar" : "Lista de compra",
          detalle: "Con precios, y si quieres, un presupuesto" },
        { valor: "nota", icono: "check", titulo: "Lista simple", detalle: "Sólo para anotar cosas y marcarlas. Sin precios" },
      ]);
      if (!tipo) return;
      const campos = {
        venta: [
          { nombre: "nombre", etiqueta: "Nombre del pedido", requerido: true, ancho: true, ayuda: "Nombre del proyecto" },
          { nombre: "cliente", etiqueta: "Cliente", ancho: true, ayuda: "Opcional" },
        ],
        compra: [
          { nombre: "nombre", etiqueta: p.nombreLista, requerido: true, ancho: true, ayuda: "Nombre del proyecto" },
          { nombre: "cliente", etiqueta: "Cliente", ayuda: "Opcional" },
          { nombre: "presupuesto", etiqueta: `Presupuesto (${simbolo()})`, tipo: "number", valor: "", ayuda: "Opcional" },
          { nombre: "direccion", etiqueta: "Dirección", ancho: true, ayuda: "Opcional" },
          { tipo: "html", html: "Si no tienes un presupuesto fijo, déjalo vacío. Lo puedes poner después en Opciones." },
        ],
        nota: [
          { nombre: "nombre", etiqueta: "Nombre de la lista", requerido: true, ancho: true, ayuda: "Nombre del proyecto" },
        ],
      }[tipo];
      const d = await formulario({ titulo: { venta: "Nuevo pedido", compra: p.nuevaLista, nota: "Nueva lista simple" }[tipo], boton: "Crear", campos });
      if (!d) return;
      const lista = {
        id: nuevoId(), nombre: d.nombre, cliente: d.cliente || "", direccion: d.direccion || "",
        presupuesto: aColones(d.presupuesto || 0), creada: hoy(), archivada: false,
        ...(tipo !== "compra" ? { tipo } : {}),
        items: [],
      };
      db.listas.unshift(lista);
      guardar();
      ir(`#/lista/${lista.id}`);
    },
  },

  formularios: {
    // "¿Qué haces?" (primera vez). Se puede marcar más de uno.
    usos(form) {
      const elegidos = new FormData(form).getAll("uso");
      if (!elegidos.length) return aviso("Marca al menos una opción");
      const cambio = cambiarUsos(elegidos);
      guardar(); aplicarApariencia(); refrescar();
      aviso(cambio < 0 ? `Listo. Quité del catálogo ${-cambio} materiales de construcción de ejemplo.` : "Listo: ObraList se ajustó a lo que haces");
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
          recibida: { de: String(o.de || "Alguien"), ocupacion: String(o.ocupacion || ""), fecha: hoy() },
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
        aviso("Lista importada");
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
  const enVivo = esCompartidaConmigo(l) ? `En vivo · de ${l._compartida.email}`
    : compartir.mias[l.id]?.length ? `En vivo con ${compartir.mias[l.id].length}` : "";
  const sub = [esPedido(l) ? "Pedido de venta" : "", enVivo, l.recibida ? `De ${quienSoy(l.recibida.de, l.recibida.ocupacion)}` : "", l.cliente, esSimple(l) ? `${l.items.length} ${l.items.length === 1 ? "cosa" : "cosas"}` : `${l.items.length} ${l.items.length === 1 ? palabras().material : palabras().materiales}`].filter(Boolean);
  const ped = esPedido(l), simple = esSimple(l);
  const hechos = l.items.filter((i) => i.estado === "comprado").length;
  const avance = simple ? (l.items.length ? Math.round((hechos / l.items.length) * 100) : 0) : pct;
  const chip = ped ? `<span class="chip-tipo venta">${icono("etiqueta")}Pedido</span>`
    : simple ? `<span class="chip-tipo">${icono("check")}Lista simple</span>`
    : usa("ventas") ? `<span class="chip-tipo">${icono("carrito")}Compra</span>` : "";
  return `
    <a class="tarjeta lista-tarjeta" href="#/lista/${l.id}">
      <span class="fila entre arriba"><strong>${seguro(l.nombre)}</strong>${chip}</span>
      <span class="nota">${sub.filter((x) => x !== "Pedido de venta").map(seguro).join(" · ")}</span>
      ${ped ? "" : `<div class="barra-progreso"><div style="width:${avance}%"></div></div>`}
      <span class="fila entre"><span class="estado-lista">${estadoEnPalabras(l)}</span>${simple ? "" : `<strong>${dinero(t.total)}</strong>`}</span>
    </a>`;
}

// Id de la categoría "Otro" (se crea si no existe). Es la que se usa si no eliges otra.
const idOtro = () => asegurarCategoria("Otro");

// Cómo va una lista, en una frase: "Faltan 8 por comprar", "3 agarrados: falta registrar el pago"…
function estadoEnPalabras(l) {
  const ped = esPedido(l);
  const cuenta = (estado) => l.items.filter((i) => i.estado === estado).length;
  const pendientes = cuenta("pendiente"), marcados = cuenta("carrito");
  if (!l.items.length) return `<span class="nota">Vacía: agrega ${esSimple(l) ? "cosas" : palabras().materiales}</span>`;
  if (esSimple(l)) {
    const hechos = cuenta("comprado");
    return hechos === l.items.length ? `<span class="entrada">${icono("check")} Todo marcado</span>`
      : `<span class="nota">${hechos} de ${l.items.length} marcados</span>`;
  }
  if (ped && pendientes + marcados) return `<span class="acento">Falta cobrar</span>`;
  if (marcados) return `<span class="acento">${marcados} ${ped ? (marcados === 1 ? "listo" : "listos") : (marcados === 1 ? "agarrado" : "agarrados")}: falta ${ped ? "cobrar" : "registrar el pago"}</span>`;
  if (pendientes) return `<span class="nota">Faltan ${pendientes} por ${ped ? "entregar" : "comprar"}</span>`;
  return `<span class="entrada">${icono("check")} ${ped ? "Cobrado" : "Todo comprado"}</span>`;
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
    // En un pedido no hay que marcar nada: todo lo que falta se cobra de una vez.
    const simple = esSimple(l);
    const enCarrito = simple ? [] : esPedido(l) ? porComprar : l.items.filter((i) => i.estado === "carrito");
    const p = palabras();
    // En un pedido de venta cambian las palabras: "entregar" en vez de "comprar".
    const ped = esPedido(l);
    const w = textosLista(l);
    const info = [ped ? "Pedido de venta" : simple ? "Lista simple" : "", l.cliente, l.direccion, l.recibida ? `Recibida de ${quienSoy(l.recibida.de, l.recibida.ocupacion)}` : ""].filter(Boolean);
    const deOtro = esCompartidaConmigo(l);
    const invitados = compartir.mias[l.id] || [];
    const avisoVivo = deOtro
      ? `<p class="en-vivo">${icono("usuario")} Compartida contigo por <strong>${seguro(l._compartida.email)}</strong>. Los cambios se ven al instante para los dos.</p>`
      : invitados.length
        ? `<p class="en-vivo">${icono("usuario")} En vivo con ${invitados.map(seguro).join(", ")}</p>` : "";

    return `
      <a href="#/listas" class="volver">${icono("volver")} Mis listas</a>
      <div class="cabecera-lista">
        <div>
          <h2 class="titulo-lista">${seguro(l.nombre)}</h2>
          ${info.length ? `<p class="nota">${info.map(seguro).join(" · ")}</p>` : ""}
          ${avisoVivo}
        </div>
        <button class="atajo-herramientas" data-accion="opciones">${icono("mas")}Opciones</button>
      </div>

      ${simple ? "" : resumenLista(l, t, w)}

      ${ped || simple ? "" : pasosLista(l, w)}

      ${usa("obras") ? bloqueBitacora(l) : ""}

      <section class="tarjeta agregar">
        <form data-form="agregar" class="agregar-form">
          <label class="etiqueta-grande" for="campo-material">${icono("agregarLista")}Agregar ${simple ? "a la lista" : p.material}</label>
          <span class="con-boton">
            <input id="campo-material" name="nombre" list="dl-productos" required autocomplete="off" data-entrada="material"
                   placeholder="${usa("obras") ? "Ej. 10 sacos de cemento" : "Ej. 3 jabones"}">
          </span>
          <datalist id="dl-productos">${db.productos.map((x) => `<option value="${seguro(x.nombre)}">`).join("")}</datalist>
          ${simple ? "" : `<p class="pista" id="pista-material">Si ya está en tu catálogo, el precio y la unidad se ponen solos.</p>`}
          <div class="agregar-fila">
            <label>Cantidad<input name="cantidad" type="number" min="0" step="any" inputmode="decimal" value="1" required></label>
            <label>Unidad<select name="unidadId">${opcionesDe(unidadesOrdenadas(), null, (u) => u.abrev)}</select></label>
            <button class="principal">${icono("check")}Agregar</button>
          </div>
          <details class="mas-detalles" ${simple ? "hidden" : ""}>
            <summary>Precio y categoría</summary>
            <div class="agregar-fila dos">
              <label>${ped ? "Precio de venta" : "Precio"} c/u (${simbolo()})<input name="precio" type="number" min="0" step="any" inputmode="decimal" value="0"></label>
              <label>Categoría<select name="categoriaId">${opcionesDe(categoriasOrdenadas(), idOtro(), (c) => c.nombre)}</select></label>
            </div>
            <label class="check"><input type="checkbox" name="guardarCatalogo" ${simple ? "" : "checked"}> Guardar en mi catálogo si es nuevo</label>
          </details>
        </form>
      </section>

      ${simple ? `
      <section class="tarjeta">
        <h3>En la lista <span class="contador">${l.items.length}</span></h3>
        ${l.items.length ? `<p class="nota">Toca el círculo para marcar lo que ya está. Toca el nombre para cambiarlo o quitarlo.</p>
          ${[...porComprar, ...comprados].map((it) => filaItem(it, false)).join("")}`
          : `<p class="vacio">Todavía no hay nada. Agrégalo arriba.</p>`}
      </section>` : `
      <section class="tarjeta">
        <h3>${w.falta} <span class="contador">${porComprar.length}</span></h3>
        ${porComprar.length ? `<p class="nota">${w.ayuda}</p>${grupos(porComprar, false)}`
          : `<p class="vacio">${l.items.length ? w.todo : `Todavía no hay ${p.materiales}. Agrégalos arriba.`}</p>`}
      </section>`}

      ${comprados.length && !simple ? `
        <details class="tarjeta">
          <summary>${icono("check")} ${w.hechos} (${comprados.length}) · ${dinero(t.comprado)} <span class="nota">· toca para ver</span></summary>
          ${grupos(comprados, true)}
        </details>` : ""}


      ${enCarrito.length ? `
        <div class="barra-carrito">
          <span><strong>${enCarrito.length} ${enCarrito.length === 1 ? w.carritoUno : w.carrito}</strong><br><span class="suave-claro">${dinero(ped ? t.pendiente : t.carrito)}</span></span>
          <button class="principal" data-accion="finalizar">${w.boton}${icono("adelante")}</button>
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
      f.precio.value = aMoneda(precioPara(lista, p)); // en un pedido, el precio de venta
      const pista = document.querySelector("#pista-material");
      if (pista) pista.innerHTML = `${icono("check")} Del catálogo: ${dinero(precioPara(lista, p))} por ${seguro(unidad(p.unidadId).abrev)} · ${seguro(categoria(p.categoriaId).nombre)}`;
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
        // nuevo en el catálogo: en un pedido, lo escrito es el precio de venta (el costo queda en 0)
        prod = esPedido(lista)
          ? { id: nuevoId(), nombre, categoriaId: d.categoriaId, unidadId: d.unidadId, precio: 0, precioVenta: precio }
          : { id: nuevoId(), nombre, categoriaId: d.categoriaId, unidadId: d.unidadId, precio };
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
          ...(esPedido(lista) && prod?.precio > 0 ? { costo: prod.precio } : {}),
        });
      }
      if (esPedido(lista) && llevaInventario(prod) && cantidad > prod.stock) aviso(`Ojo: en bodega sólo hay ${prod.stock} de ${prod.nombre}`);
      guardar();
      refrescar();
      $('[data-form="agregar"] [name="nombre"]')?.focus();
    },
  },

  cambios: {
    // Agregar a esta lista los materiales de un archivo de Excel
    async importarExcel(el) {
      const archivo = el.files[0];
      el.value = "";
      if (!archivo) return;
      try {
        const materiales = await leerMateriales(archivo, { conCantidad: true });
        if (!materiales) return;
        if (!materiales.length) return aviso("No encontré materiales en ese archivo.");
        const n = agregarALista(lista, materiales);
        guardar(); refrescar();
        aviso(`${n} materiales importados a la lista`);
      } catch (e) {
        aviso(e.message || "No se pudo leer el archivo.");
      }
    },

    carrito(el) {
      // En una lista simple, marcar = listo. En una de compra, marcar = lo agarré (falta pagar).
      itemDe(el).estado = el.checked ? (esSimple(lista) ? "comprado" : "carrito") : "pendiente";
      guardar(); refrescar();
    },
    cantidad(el) { itemDe(el).cantidad = Math.max(0, Number(el.value) || 0); guardar(); refrescar(); },
  },

  acciones: {
    async editarItem(el) {
      const it = itemDe(el);
      const d = await formulario({
        titulo: `Cambiar ${palabras().material}`,
        campos: [
          { nombre: "nombre", etiqueta: "Material", valor: it.nombre, requerido: true, ancho: true },
          { nombre: "categoriaId", etiqueta: "Categoría", tipo: "select", valor: it.categoriaId, opciones: categoriasOrdenadas().map((c) => ({ valor: c.id, texto: c.nombre })) },
          { nombre: "unidadId", etiqueta: "Unidad", tipo: "select", valor: it.unidadId, opciones: unidadesOrdenadas().map((u) => ({ valor: u.id, texto: u.abrev })) },
          { nombre: "cantidad", etiqueta: "Cantidad", tipo: "number", valor: it.cantidad },
          { nombre: "precio", etiqueta: `${esPedido(lista) ? "Precio de venta" : "Precio unitario"} (${simbolo()})`, tipo: "number", valor: aMoneda(it.precio) },
          esPedido(lista) && { nombre: "costo", etiqueta: `Lo que te cuesta (${simbolo()})`, tipo: "number", valor: it.costo ? aMoneda(it.costo) : "", ayuda: "Para calcular la ganancia" },
        ].filter(Boolean),
        quitar: "Quitar de la lista",
      });
      if (!d) return;
      if (d._quitar) return vistaLista.acciones.quitarItem(el);
      d.precio = precioEditado(d.precio, it.precio);
      if ("costo" in d) d.costo = precioEditado(d.costo, it.costo || 0);
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
      if (esPedido(lista)) return registrarVenta();
      const enCarrito = lista.items.filter((i) => i.estado === "carrito");
      // Lo que no tiene precio se pregunta aquí: es cuando ya sabes cuánto pagaste
      const sinPrecio = enCarrito.filter((i) => !(i.precio > 0));
      const conPrecio = enCarrito.reduce((s, i) => s + i.cantidad * i.precio, 0);
      // ¿algo de lo comprado lleva inventario? (ej. mercadería para vender)
      const conInventario = enCarrito.filter((i) => llevaInventario(buscar("productos", i.productoId))).length;
      const d = await formulario({
        titulo: sinPrecio.length ? "Registrar compra" : `Registrar compra · ${dinero(conPrecio)}`,
        boton: "Registrar compra",
        campos: [
          { tipo: "html", html: `Se guarda la compra en <strong>Cuentas</strong>, esos ${palabras().materiales} pasan a "Comprados" y el catálogo recuerda el precio que pagaste.` },
          ...(sinPrecio.length ? [{ tipo: "html", html: `<strong>¿Cuánto pagaste?</strong> ${sinPrecio.length === 1 ? "Esto no tenía" : "Estas cosas no tenían"} precio. Escribe el precio de cada unidad (si lo dejas vacío, queda en ${dinero(0)}).` }] : []),
          ...sinPrecio.map((i) => ({ nombre: `precio_${i.id}`, tipo: "number", ancho: true,
            etiqueta: `${i.nombre} · ${i.cantidad} ${unidadDeItem(i).abrev} · precio c/u (${simbolo()})` })),
          { nombre: "proveedor", etiqueta: "¿Dónde compraste?", ancho: true, ayuda: "Ej. Ferretería El Martillo", sugerencias: db.proveedores.map((p) => p.nombre) },
          { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: hoy(), requerido: true },
          { nombre: "nota", etiqueta: "Nota (folio, factura…)" },
          conInventario && { nombre: "alInventario", tipo: "checkbox", valor: true,
            etiqueta: `Sumar al inventario (${conInventario} ${conInventario === 1 ? "producto lleva" : "productos llevan"} inventario)` },
        ].filter(Boolean),
      });
      if (!d) return;
      for (const i of sinPrecio) i.precio = aColones(d[`precio_${i.id}`] || 0);
      const total = enCarrito.reduce((s, i) => s + i.cantidad * i.precio, 0);
      const compra = {
        id: nuevoId(), fecha: d.fecha, listaId: lista.id, proveedorId: proveedorPorNombre(d.proveedor),
        nota: d.nota, total,
        items: enCarrito.map((i) => ({
          productoId: i.productoId, nombre: i.nombre, categoriaId: i.categoriaId,
          unidadId: i.unidadId, cantidad: i.cantidad, precio: i.precio,
        })),
      };
      if (d.alInventario && moverInventario(compra.items, +1)) compra.alInventario = true;
      db.compras.unshift(compra);
      for (const i of enCarrito) {
        i.estado = "comprado";
        i.compraId = compra.id;
        const p = buscar("productos", i.productoId);
        if (p && i.precio > 0) p.precio = i.precio; // el catálogo recuerda el último precio
      }
      guardar(); refrescar();
      aviso(`Compra guardada en Cuentas: ${dinero(total)}`);
    },

    async editar() {
      const simple = esSimple(lista), ped = esPedido(lista);
      const d = await formulario({
        titulo: "Cambiar datos",
        campos: [
          { nombre: "nombre", etiqueta: simple ? "Nombre de la lista" : ped ? "Nombre del pedido" : palabras().nombreLista, valor: lista.nombre, requerido: true, ancho: true },
          !simple && { nombre: "cliente", etiqueta: "Cliente", valor: lista.cliente },
          !simple && !ped && { nombre: "presupuesto", etiqueta: `Presupuesto (${simbolo()})`, tipo: "number", valor: aMoneda(lista.presupuesto) || "", ayuda: "Vacío = sin presupuesto" },
          !simple && !ped && { nombre: "direccion", etiqueta: "Dirección", valor: lista.direccion, ancho: true },
        ].filter(Boolean),
      });
      if (!d) return;
      if ("presupuesto" in d) d.presupuesto = d.presupuesto ? precioEditado(d.presupuesto, lista.presupuesto) : 0;
      Object.assign(lista, d);
      guardar(); refrescar();
    },

    gasto() { nuevoGasto(lista.id); },

    // Otra lista igual para una obra nueva: mismos materiales y cantidades, todo "por comprar".
    async duplicar() {
      const d = await formulario({
        titulo: "Duplicar lista",
        boton: "Duplicar",
        campos: [
          { tipo: "html", html: `Se crea una lista nueva con los <strong>mismos materiales y cantidades</strong>, todos como "por comprar". Las compras, los gastos y la bitácora no se copian.` },
          { nombre: "nombre", etiqueta: palabras().nombreNueva, requerido: true, ancho: true, valor: `${lista.nombre} (copia)` },
          { nombre: "cliente", etiqueta: "Cliente", valor: lista.cliente || "" },
          { nombre: "direccion", etiqueta: "Dirección", valor: lista.direccion || "" },
        ],
      });
      if (!d) return;
      const nueva = {
        id: nuevoId(), nombre: d.nombre, cliente: d.cliente, direccion: d.direccion,
        presupuesto: lista.presupuesto || 0, creada: hoy(), archivada: false,
        ...(lista.tipo ? { tipo: lista.tipo } : {}),
        items: lista.items.map(copiarItem),
      };
      db.listas.unshift(nueva);
      guardar();
      aviso("Lista duplicada");
      ir(`#/lista/${nueva.id}`);
    },

    // Todo lo que se puede hacer con la lista, en un solo menú.
    async opciones() {
      const deOtro = esCompartidaConmigo(lista);
      const obras = usa("obras") && !esPedido(lista);
      const elegido = await menu(lista.nombre, [
        obras && { valor: "bitacora", icono: "bitacora", titulo: "Bitácora de obra", detalle: "Notas, avance y fotos de cada día" },
        { valor: "compartirMenu", icono: "compartir", titulo: "Compartir", detalle: "En vivo, por WhatsApp o como archivo" },
        !esSimple(lista) && { valor: "gasto", icono: "billetera", titulo: "Registrar otro gasto", detalle: "Flete, mano de obra… de esta lista" },
        { valor: "excelMenu", icono: "tabla", titulo: "Excel", detalle: "Descargar la lista o cargar materiales" },
        { valor: "editar", icono: "editar", titulo: "Cambiar nombre y datos", detalle: esSimple(lista) ? "El nombre de la lista" : esPedido(lista) ? "Nombre y cliente" : "Cliente, dirección, presupuesto" },
        { valor: "duplicar", icono: "agregarLista", titulo: "Duplicar", detalle: "Otra lista igual para empezar de nuevo" },
        !deOtro && { valor: "archivar", icono: lista.archivada ? "restaurar" : "archivar", titulo: lista.archivada ? "Desarchivar" : "Archivar",
          detalle: lista.archivada ? "Que vuelva a Mis listas" : "Guardarla aparte, sin borrarla" },
        deOtro ? { valor: "salirCompartida", icono: "cerrar", titulo: "Salir de la lista", detalle: "Dejarás de verla", peligro: true }
               : { valor: "borrar", icono: "borrar", titulo: "Borrar lista", detalle: "Se borra para siempre", peligro: true },
      ]);
      if (elegido === "bitacora") return ir(`#/bitacora/${lista.id}`);
      if (elegido) vistaLista.acciones[elegido]();
    },

    async excelMenu() {
      const elegido = await menu("Excel", [
        { valor: "excel", icono: "descargar", titulo: "Descargar en Excel", detalle: "Para imprimir, mandar o revisar en la compu" },
        { valor: "cargar", icono: "enviar", titulo: "Cargar materiales de un Excel", detalle: "Se agregan a esta lista (.xlsx o .csv)" },
      ]);
      if (elegido === "excel") vistaLista.acciones.excel();
      if (elegido === "cargar") {
        const archivo = await elegirArchivo(".xlsx,.xls,.csv");
        if (archivo) vistaLista.cambios.importarExcel({ files: [archivo], value: "" });
      }
    },

    // Un solo botón "Compartir" con las tres formas juntas
    async compartirMenu() {
      const elegido = await menu("Compartir lista", [
        !esCompartidaConmigo(lista) && { valor: "enVivo", icono: "usuario", titulo: "Compartir en vivo", detalle: "La otra persona la edita contigo y los cambios se ven al instante" },
        { valor: "compartirTexto", icono: "mensaje", titulo: "Mandar por WhatsApp", detalle: "Como texto, para que la lean o la lleven a la tienda" },
        { valor: "compartirArchivo", icono: "enviar", titulo: "Enviar archivo de ObraList", detalle: "La otra persona la importa en su app" },
      ]);
      if (elegido) vistaLista.acciones[elegido]();
    },

    // Invitar o quitar personas que editan esta lista en tiempo real
    async enVivo() {
      if (!nube.usuario) return aviso("Primero inicia sesión en Más > Mi cuenta. La otra persona también necesita una cuenta de ObraList.");
      const invitados = compartir.mias[lista.id] || [];
      const d = await formulario({
        titulo: "Compartir en vivo",
        boton: "Guardar",
        campos: [
          { tipo: "html", html: `La otra persona podrá ver y editar <strong>sólo esta lista</strong> desde su ObraList, y los cambios se ven al instante para los dos. Necesita tener cuenta con ese correo.` },
          { nombre: "correo", etiqueta: "Invitar a (correo)", tipo: "email", ancho: true, ayuda: "correo@ejemplo.com" },
          invitados.length && { nombre: "quitar", etiqueta: "Quitar acceso a", tipo: "select", ancho: true, valor: "",
            opciones: [{ valor: "", texto: "— Nadie —" }, ...invitados.map((c) => ({ valor: c, texto: c }))] },
        ].filter(Boolean),
      });
      if (!d) return;
      try {
        if (d.correo) {
          aviso("Compartiendo…");
          await invitarALista(lista.id, d.correo);
          aviso(`Listo: ${d.correo.toLowerCase()} ya puede ver y editar esta lista`);
        }
        if (d.quitar) {
          await quitarDeLista(lista.id, d.quitar);
          aviso(`${d.quitar} ya no tiene acceso`);
        }
        refrescar();
      } catch (e) {
        aviso(e.message || "No se pudo compartir");
      }
    },

    async salirCompartida() {
      if (!confirm(`¿Salir de "${lista.nombre}"?\nDejarás de verla; la lista sigue siendo de ${lista._compartida.email}.`)) return;
      try {
        await salirDeListaCompartida(lista);
        aviso("Saliste de la lista");
        ir("#/listas");
      } catch (e) {
        aviso(e.message || "No se pudo salir de la lista");
      }
    },

    archivar() {
      lista.archivada = !lista.archivada;
      guardar();
      aviso(lista.archivada ? "Lista archivada" : "Lista restaurada");
      ir("#/listas");
    },

    borrar() {
      if (!confirm(`¿Borrar la lista "${lista.nombre}"?\nLas compras y gastos ya registrados se quedan en Cuentas.`)) return;
      db.listas = db.listas.filter((l) => l !== lista);
      // también su bitácora y fotos
      for (const r of registrosDe(lista.id)) for (const id of r.fotos) borrarFoto(id).catch(() => {});
      db.bitacora = db.bitacora.filter((r) => r.listaId !== lista.id);
      guardar();
      ir("#/listas");
    },

    excel() {
      exportarLista(lista);
      aviso("Excel descargado");
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
        const d = await formulario({ titulo: "¿Quién manda la lista?", boton: "Continuar", campos: [
          { nombre: "nombre", etiqueta: "Tu nombre", requerido: true, ancho: true },
          { nombre: "ocupacion", etiqueta: "Tu ocupación", ancho: true, ayuda: "Ej. Electricista", sugerencias: OCUPACIONES },
        ] });
        if (!d) return;
        db.perfil.nombre = d.nombre;
        db.perfil.ocupacion = d.ocupacion;
        guardar();
      }
      const datos = {
        // Los precios del archivo van en colones (la moneda base), sin importar
        // cuál tengas elegida, para que quien lo reciba no mezcle monedas.
        tipo: "obralist-lista", version: 1, moneda: "CRC",
        de: db.perfil.nombre, ocupacion: db.perfil.ocupacion || "", fecha: hoy(),
        lista: {
          nombre: lista.nombre, cliente: lista.cliente, direccion: lista.direccion, presupuesto: lista.presupuesto,
          items: lista.items.map((i) => ({
            nombre: i.nombre, categoria: categoriaDeItem(i).nombre, unidad: unidadDeItem(i).abrev,
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

// Aviso cuando la app no pudo leer lo que estaba guardado y tuvo que abrir "como nueva".
// La copia de lo que había sigue en el celular hasta que la persona la descargue.
function bloqueRescate() {
  const copia = copiaDeRescate();
  if (!copia) return "";
  return `
    <section class="tarjeta aviso-rescate">
      <h3>${icono("alerta")}No se pudieron leer tus datos guardados</h3>
      <p>Por eso ObraList abrió como nueva. <strong>Lo que tenías no se borró:</strong> hay una copia guardada en este dispositivo.</p>
      <ol class="pasos">
        <li>Descarga la copia y guárdala.</li>
        <li>Si tienes cuenta, entra en <a href="#/mas">Más &gt; Mi cuenta</a>: tus datos se bajan solos de la nube.</li>
        <li>Si no tienes cuenta, prueba <a href="#/mas">Más &gt; Respaldo &gt; Restaurar respaldo</a> con la copia${SOPORTE.correo ? `, o mándala a <a href="mailto:${seguro(SOPORTE.correo)}">${seguro(SOPORTE.correo)}</a> y te ayudamos` : ""}.</li>
      </ol>
      ${copia.sinEspacio ? `<p class="rojo">${icono("alerta")} El dispositivo no tiene espacio: mientras no descargues la copia y toques "Ya no la necesito", lo nuevo que hagas no se guarda.</p>` : ""}
      <div class="acciones-lista">
        <button class="principal" data-accion="descargarRescate">${icono("descargar")}Descargar copia</button>
        <button data-accion="quitarRescate">Ya no la necesito</button>
      </div>
    </section>`;
}

// Aviso en el inicio cuando algo se está acabando en bodega.
function bloqueStock() {
  const pocos = conPocoStock();
  if (!pocos.length) return "";
  const agotados = pocos.filter((p) => p.stock <= 0).length;
  const nombres = pocos.slice(0, 3).map((p) => `${seguro(p.nombre)} (${p.stock})`).join(", ");
  return `
    <a class="atajo aviso-stock" href="#/catalogo/poco">
      <span class="calc-icono">${icono("alerta", "icono-grande")}</span>
      <span><strong>${agotados ? `${agotados} agotado${agotados === 1 ? "" : "s"} · ` : ""}${pocos.length} por reponer</strong>
        <span class="nota">${nombres}${pocos.length > 3 ? "…" : ""}</span></span>
      ${icono("adelante")}
    </a>`;
}

// Arriba en el inicio: primero "¿Qué haces?"; si hace obras, después el oficio.
function bloqueBienvenida() {
  if (!usosElegidos()) return bloqueUsos();
  if (db.perfil.ocupacion || !usa("obras")) return "";
  return `
    <section class="tarjeta bienvenida">
      <h3>${icono("casco")}¿A qué te dedicas?</h3>
      <p class="nota">Así ObraList te muestra primero los materiales de tu oficio.</p>
      <div class="oficios">
        ${OFICIOS_RAPIDOS.map((o) => `<button data-accion="elegirOficio" data-oficio="${seguro(o)}">${seguro(o)}</button>`).join("")}
        <a class="boton" href="#/mas">Otro…</a>
      </div>
    </section>`;
}

// "¿Qué haces?": casillas grandes (se puede marcar más de una).
// También se usa en Más para cambiarlo después.
export function opcionesDeUso(marcados = usos()) {
  return Object.entries(USOS).map(([clave, u]) => `
    <label class="opcion-uso">
      <input type="checkbox" name="uso" value="${clave}" ${marcados.includes(clave) ? "checked" : ""}>
      ${icono(u.icono, "icono-grande icono-acento")}
      <span><strong>${u.titulo}</strong><span class="nota">${u.detalle}</span></span>
    </label>`).join("");
}

function bloqueUsos() {
  return `
    <section class="tarjeta bienvenida">
      <h3>${icono("casco")}¿Qué haces?</h3>
      <p class="nota">Marca todo lo que aplique. Así ObraList te muestra sólo lo que usas. Lo puedes cambiar después en Más.</p>
      <form data-form="usos" class="opciones-uso">
        ${opcionesDeUso([])}
        <button class="principal">Listo</button>
      </form>
    </section>`;
}

// Resumen de la bitácora dentro de la lista (último registro y avance).
function bloqueBitacora(l) {
  const registros = registrosDe(l.id);
  if (!registros.length) return "";
  const avance = ultimoAvance(l.id);
  return `
    <a class="atajo" href="#/bitacora/${l.id}">
      <span class="calc-icono">${icono("bitacora", "icono-grande icono-acento")}</span>
      <span><strong>Bitácora: ${registros.length} ${registros.length === 1 ? "registro" : "registros"}</strong>
        <span class="nota">Último: ${fecha(registros[0].fecha)}${avance !== null ? ` · Avance ${avance} %` : ""}</span>
        ${avance !== null ? `<span class="barra-progreso"><span style="display:block;height:100%;width:${avance}%;background:var(--ok)"></span></span>` : ""}
      </span>
      ${icono("adelante")}
    </a>`;
}

// Palabras de la pantalla según sea compra o pedido de venta.
function textosLista(l) {
  const p = palabras();
  return esPedido(l)
    ? {
        falta: "Por cobrar", hechos: "Vendidos", todo: "Todo está vendido. La venta quedó en Cuentas.",
        ayuda: "Cuando te paguen, toca «Registrar venta» abajo. Toca un producto para cambiarlo.",
        carrito: "por cobrar", carritoUno: "por cobrar", boton: "Registrar venta",
        llevas: "Llevas vendido", faltan: "por cobrar",
        mitad: "Sigue marcando lo que esté listo. Si ya te pagaron lo marcado, toca «Cobrar y registrar venta» abajo.",
        pasos: ["Arma el pedido", "Prepáralo", "Cobra"],
        instrucciones: [
          "Agrega lo que te pidió el cliente.",
          "Toca el círculo de cada cosa que ya está lista o entregada.",
          "Cuando te paguen, toca «Cobrar y registrar venta» abajo.",
          "Listo: el pedido está vendido y la venta quedó en Cuentas.",
        ],
      }
    : {
        falta: "Por comprar", hechos: "Comprados", todo: "Ya compraste todo. Las compras quedaron en Cuentas.",
        ayuda: "En la tienda o ferretería, toca el círculo de cada cosa que agarras.",
        carrito: "agarrados", carritoUno: "agarrado", boton: "Pagar y registrar compra",
        llevas: "Llevas comprado", faltan: "por comprar",
        mitad: "Sigue marcando lo que agarras. Si ya pagaste lo marcado, toca «Pagar y registrar compra» abajo.",
        pasos: ["Arma la lista", "Compra", "Registra el pago"],
        instrucciones: [
          `Agrega los ${p.materiales} que vas a ocupar.`,
          "En la tienda o ferretería, toca el círculo de cada cosa que agarras.",
          "Cuando pagues, toca «Pagar y registrar compra» abajo.",
          "Listo: ya compraste todo y quedó guardado en Cuentas.",
        ],
      };
}

// En qué paso va la lista: 0 armar, 1 comprar/preparar, 2 registrar, 3 terminado.
function pasoActual(l) {
  if (!l.items.length) return 0;
  if (l.items.some((i) => i.estado === "pendiente")) return 1; // todavía falta marcar cosas
  if (l.items.some((i) => i.estado === "carrito")) return 2;
  return 3;
}

// Los 3 pasos arriba, con el de ahora resaltado y qué hacer en una línea.
function pasosLista(l, w) {
  const actual = pasoActual(l);
  return `
    <section class="pasos-lista" aria-label="Pasos">
      <ol>
        ${w.pasos.map((texto, i) => `
          <li class="${i < actual ? "hecho" : i === actual ? "actual" : ""}">
            <span class="num">${i < actual ? icono("check") : i + 1}</span>${texto}
          </li>`).join("")}
      </ol>
      <p class="instruccion">${icono(actual === 3 ? "check" : "info")}${actual === 1 && l.items.some((i) => i.estado === "carrito") ? w.mitad : w.instrucciones[actual]}</p>
    </section>`;
}

// Resumen en palabras: cuánto llevas, cuánto falta, y el presupuesto o la ganancia.
function resumenLista(l, t, w) {
  if (!l.items.length) return "";
  const pct = t.total ? Math.round((t.comprado / t.total) * 100) : 0;
  const ped = esPedido(l);
  // Un pedido no es "avance": se dice cuánto vale, si falta cobrar y cuánto ganas.
  // (Sin barra ni %, que en un pedido de una sola venta siempre daría 0 % o 100 %.)
  if (ped) {
    const ganancia = t.ganancia === null ? "" : `
      <p class="ganancia">${icono("tendencia")}${t.ganancia >= 0 ? "Con este pedido ganas" : "Con este pedido pierdes"}
        <strong class="${t.ganancia >= 0 ? "entrada" : "rojo"}">${dinero(Math.abs(t.ganancia))}</strong></p>
      ${t.ganancia < 0 ? `<p class="nota">Lo estás vendiendo más barato de lo que te cuesta.</p>` : ""}
      ${l.items.some((i) => !(i.costo > 0)) ? `<p class="nota">Sólo cuenta los productos que tienen costo en tu catálogo.</p>` : ""}`;
    return `
    <section class="tarjeta resumen-lista">
      <p class="grande">Este pedido vale <strong>${dinero(t.total)}</strong></p>
      <p class="nota">${t.pendiente <= 0 ? `${icono("check")}Ya está cobrado y quedó guardado en Cuentas.`
        : t.comprado > 0 ? `Ya cobraste ${dinero(t.comprado)}. Falta cobrar <strong>${dinero(t.pendiente)}</strong>.`
        : "Todavía no lo has cobrado. Cuando te paguen, toca «Registrar venta»."}</p>
      ${ganancia}
    </section>`;
  }
  // Lista de compra. Se cuenta por COSAS (no por plata) para no decir "no falta
  // nada" cuando todavía faltan cosas que aún no tienen precio.
  const hechas = l.items.filter((i) => i.estado === "comprado").length;
  const faltan = l.items.length - hechas;
  const sinPrecio = l.items.filter((i) => i.estado !== "comprado" && !(i.precio > 0)).length;
  // Con precios completos se cuenta en plata; si a algo le falta precio, en cosas.
  const enPlata = t.total > 0 && !sinPrecio;
  const avance = enPlata ? pct : Math.round((hechas / l.items.length) * 100);
  const cosas = (n) => `${n} ${n === 1 ? "cosa" : "cosas"}`;
  const falta = (n) => `${n === 1 ? "Falta" : "Faltan"} ${cosas(n)}`;
  return `
    <section class="tarjeta resumen-lista">
      ${enPlata
        ? `<p class="grande">${w.llevas} <strong>${dinero(t.comprado)}</strong> de ${dinero(t.total)}</p>`
        : `<p class="grande">Compraste <strong>${hechas} de ${l.items.length}</strong> ${l.items.length === 1 ? "cosa" : "cosas"}</p>
           ${t.comprado > 0 ? `<p class="nota">Llevas gastado ${dinero(t.comprado)}</p>` : ""}`}
      <div class="barra-progreso"><div style="width:${avance}%"></div></div>
      <p class="nota">${!faltan ? "Ya compraste todo"
        : enPlata ? `${falta(faltan)}: ${dinero(t.pendiente)} ${w.faltan}`
        : `${falta(faltan)} por comprar`}</p>
      ${sinPrecio ? `<p class="nota">${sinPrecio === 1 ? "1 cosa no tiene" : `${sinPrecio} cosas no tienen`} precio todavía: lo anotas cuando pagues.</p>` : ""}
      ${l.presupuesto > 0 ? `
        <div class="separador"></div>
        <p class="fila entre"><span>${palabras().presupuestoDe}</span><strong>${dinero(l.presupuesto)}</strong></p>
        ${estadoPresupuesto(t.gastadoReal, l.presupuesto)}
        <p class="nota">Cuenta las compras (${dinero(t.compras)}) y los otros gastos (${dinero(t.otros)}).</p>` : ""}
    </section>`;
}

// Pedido de venta: lo marcado como "listo" se registra como UNA venta con varios
// productos (en Cuentas). Cada producto guarda su precio de venta y su costo.
async function registrarVenta() {
  const listos = lista.items.filter((i) => i.estado !== "comprado"); // todo lo que falta cobrar
  const total = listos.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const noAlcanza = faltantes(listos);
  const d = await formulario({
    titulo: `Registrar venta · ${dinero(total)}`,
    boton: "Registrar venta",
    campos: [
      { tipo: "html", html: `Se guarda la venta en <strong>Cuentas</strong> (con la ganancia) y esos productos pasan a "Vendidos".` },
      ...(noAlcanza.length ? [{ tipo: "html", html: `<span class="rojo">${icono("alerta")} No alcanza el inventario de: ${noAlcanza.map((f) => `${seguro(f.nombre)} (hay ${f.hay}, vendes ${f.pides})`).join(", ")}. Si sigues, quedará en negativo; revísalo en el Catálogo.</span>` }] : []),
      { nombre: "cliente", etiqueta: "Cliente", valor: lista.cliente || "", ancho: true },
      { nombre: "fecha", etiqueta: "Fecha", tipo: "date", valor: hoy(), requerido: true },
      { nombre: "nota", etiqueta: "Nota", ayuda: "Ej. Pagó con SINPE" },
    ],
  });
  if (!d) return;
  const venta = {
    id: nuevoId(), fecha: d.fecha, listaId: lista.id, cliente: d.cliente.trim(), nota: d.nota,
    items: listos.map((i) => ({
      productoId: i.productoId, nombre: i.nombre, categoriaId: i.categoriaId, unidadId: i.unidadId,
      cantidad: i.cantidad, precio: i.precio, costo: i.costo || 0,
    })),
  };
  if (moverInventario(venta.items, -1)) venta.inventario = true; // se resta de la bodega
  db.ventas.unshift(venta);
  for (const i of listos) {
    i.estado = "comprado"; // en un pedido, "comprado" quiere decir "vendido"
    i.ventaId = venta.id;
    const p = buscar("productos", i.productoId);
    if (p) p.precioVenta = i.precio; // el catálogo recuerda el último precio de venta
  }
  guardar(); refrescar();
  aviso(`Venta guardada en Cuentas: ${dinero(total)}`);
}

// Copia de un material para otra lista. Si venía de la lista de otra persona,
// su categoría y unidad se buscan (o se crean) por nombre en TU catálogo.
function copiarItem(it) {
  const { id, estado, compraId, ventaId, categoriaNombre, unidadAbrev, ...resto } = it;
  return {
    ...resto, id: nuevoId(), estado: "pendiente",
    categoriaId: buscar("categorias", it.categoriaId) ? it.categoriaId : asegurarCategoria(categoriaDeItem(it).nombre),
    unidadId: buscar("unidades", it.unidadId) ? it.unidadId : asegurarUnidad(unidadDeItem(it).abrev),
    productoId: buscar("productos", it.productoId) ? it.productoId : null,
  };
}

function bloquePresupuesto(l, t) {
  if (!(l.presupuesto > 0)) return "";
  return `
    <section class="tarjeta">
      <div class="fila entre">
        <span>Presupuesto</span><strong>${dinero(l.presupuesto)}</strong>
      </div>
      ${estadoPresupuesto(t.gastadoReal, l.presupuesto)}
      <p class="nota">Gastado real = compras ${dinero(t.compras)} + gastos ${dinero(t.otros)}</p>
    </section>`;
}

// Agrupa materiales por categoría, en el orden de tus categorías.
function grupos(items, sonComprados) {
  const ordenCat = categoriasOrdenadas(); // las de tu oficio primero
  const orden = (id) => { const i = ordenCat.findIndex((c) => c.id === id); return i < 0 ? 999 : i; };
  const porCat = new Map();
  for (const it of items) {
    const c = categoriaDeItem(it); // también entiende categorías de listas compartidas
    if (!porCat.has(c.id)) porCat.set(c.id, { c, its: [] });
    porCat.get(c.id).its.push(it);
  }
  return [...porCat.values()].sort((a, b) => orden(a.c.id) - orden(b.c.id)).map(({ c, its }) => {
    const subtotal = its.reduce((s, i) => s + i.cantidad * i.precio, 0);
    return `
      <div class="grupo">
        <h4><span>${icono(c.icono)} ${seguro(c.nombre)}</span><span>${dinero(subtotal)}</span></h4>
        ${its.map((it) => filaItem(it, sonComprados)).join("")}
      </div>`;
  }).join("");
}

function filaItem(it, comprado) {
  const u = unidadDeItem(it);
  let extra = "";
  if (!comprado && esPedido(lista)) {
    const prod = buscar("productos", it.productoId);
    if (llevaInventario(prod)) extra = ` · <span class="${it.cantidad > prod.stock ? "rojo" : ""}">hay ${prod.stock} en bodega</span>`;
  }
  if (comprado && it.ventaId) {
    const v = buscar("ventas", it.ventaId);
    if (v) extra = ` · ${fecha(v.fecha)}${v.cliente ? ` a ${seguro(v.cliente)}` : ""}`;
  }
  if (comprado && it.compraId) {
    const c = buscar("compras", it.compraId);
    const p = c && buscar("proveedores", c.proveedorId);
    if (c) extra = ` · ${fecha(c.fecha)}${p ? ` en ${seguro(p.nombre)}` : ""}`;
  }
  // Círculo para marcar (lo agarré / está listo), nombre con "cantidad × precio",
  // el total a la derecha. Tocar el nombre abre la edición (cantidad, precio…).
  const simple = esSimple(lista);
  const marcar = simple ? "Marcar" : esPedido(lista) ? "Marcar como listo" : "Marcar como agarrado";
  if (simple) {
    return `
    <div class="item ${it.estado === "comprado" ? "comprado" : ""}" data-id="${it.id}">
      <label class="circulo" title="${marcar}"><input type="checkbox" data-cambio="carrito" ${it.estado === "comprado" ? "checked" : ""} aria-label="${marcar}: ${seguro(it.nombre)}"><span>${icono("check")}</span></label>
      <button class="nombre-item" data-accion="editarItem" title="Toca para cambiarlo o quitarlo">
        <span class="nombre">${seguro(it.nombre)}</span>
        <span class="detalle">${it.cantidad} ${seguro(u.abrev)}</span>
      </button>
    </div>`;
  }
  return `
    <div class="item ${it.estado}" data-id="${it.id}">
      ${comprado ? `<span class="palomita" aria-label="Listo">${icono("check")}</span>`
                 : esPedido(lista) ? `<span class="palomita marca-venta">${icono("etiqueta")}</span>`
                 : `<label class="circulo" title="${marcar}"><input type="checkbox" data-cambio="carrito" ${it.estado === "carrito" ? "checked" : ""} aria-label="${marcar}: ${seguro(it.nombre)}"><span>${icono("check")}</span></label>`}
      <button class="nombre-item" ${comprado ? "" : 'data-accion="editarItem" title="Toca para cambiar cantidad, precio o quitarlo"'}>
        <span class="nombre">${seguro(it.nombre)}</span>
        <span class="detalle">${it.cantidad} ${seguro(u.abrev)} × ${dinero(it.precio)}${extra}</span>
      </button>
      <span class="importe">${dinero(it.cantidad * it.precio)}</span>
    </div>`;
}

function textoLista(l) {
  const lineas = [`*${l.nombre}*`];
  if (l.cliente) lineas.push(`Cliente: ${l.cliente}`);
  if (l.direccion) lineas.push(`Dirección: ${l.direccion}`);
  const pendientes = l.items.filter((i) => i.estado !== "comprado");
  const porCat = new Map();
  for (const i of pendientes) {
    const nombre = categoriaDeItem(i).nombre;
    if (!porCat.has(nombre)) porCat.set(nombre, []);
    porCat.get(nombre).push(i);
  }
  for (const [nombre, its] of porCat) {
    lineas.push("", `*${nombre}*`);
    for (const i of its) lineas.push(`• ${i.cantidad} ${unidadDeItem(i).abrev} — ${i.nombre}`);
  }
  const total = pendientes.reduce((s, i) => s + i.cantidad * i.precio, 0);
  lineas.push("", `Total estimado: ${dinero(total)}`);
  const autor = quienSoy(db.perfil.nombre, db.perfil.ocupacion);
  lineas.push("", autor ? `Enviada por ${autor} · ObraList` : "Hecha con ObraList");
  return lineas.join("\n");
}
