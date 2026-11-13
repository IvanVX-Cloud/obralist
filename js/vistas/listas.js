// =====================================================================
// Pantallas de listas: "Mis listas" y el detalle de una lista de obra.
// =====================================================================
import {
  db, guardar, nuevoId, hoy, buscar, categoria, unidad, totalesLista,
  asegurarCategoria, asegurarUnidad, proveedorPorNombre, quienSoy, OCUPACIONES, agregarALista,
  categoriasOrdenadas, OFICIOS_RAPIDOS,
} from "../datos.js";
import { CALCULADORAS, prepararCalculadora } from "./calculadoras.js";
import { PLANTILLAS, plantillasPara, materialesDe } from "../plantillas.js";
import { vozDisponible, escuchar, interpretar } from "../voz.js";
import { icono } from "../iconos.js";
import { registrosDe, ultimoAvance } from "./bitacora.js";
import { borrarFoto } from "../fotos.js";
import { exportarLista, leerMateriales } from "../excel-datos.js";
import { compartir, esCompartidaConmigo, categoriaDeItem, unidadDeItem } from "../compartir.js";
import { nube, invitarALista, quitarDeLista, salirDeListaCompartida } from "../nube.js";
import {
  $, dinero, seguro, fecha, formulario, aviso, refrescar, descargar, opcionesDe, ir, mostrar, estadoPresupuesto,
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
    const { nombre, ocupacion } = db.perfil;
    const saludo = nombre
      ? `<p class="saludo">Hola, <strong>${seguro(nombre.split(" ")[0])}</strong>${ocupacion ? ` <span class="etiqueta-oficio">${seguro(ocupacion)}</span>` : ""}</p>`
      : `<p class="nota"><a href="#/mas">Completa tu perfil</a> con tu nombre y ocupación.</p>`;
    return `
      ${saludo}
      ${bloqueBienvenida()}
      <div class="encabezado">
        <h2>Mis listas de obra</h2>
        <button class="principal" data-accion="nueva">+ Nueva lista</button>
      </div>
      ${propias.length
        ? `<div class="tarjetas">${propias.map(tarjetaLista).join("")}</div>`
        : `<p class="vacio">Crea tu primera lista, por ejemplo "Instalación eléctrica Casa López".</p>`}

      ${conmigo.length ? `
        <div class="encabezado"><h2>${icono("usuario")}Compartidas conmigo</h2></div>
        <div class="tarjetas">${conmigo.map(tarjetaLista).join("")}</div>` : ""}

      ${bloqueHerramientas()}

      <div class="encabezado">
        <h2>${icono("recibida")}Recibidas</h2>
        <label class="boton">Importar lista<input type="file" accept=".json,application/json" data-cambio="importar" hidden></label>
      </div>
      ${recibidas.length
        ? `<div class="tarjetas">${recibidas.map(tarjetaLista).join("")}</div>`
        : `<p class="nota">Cuando alguien te mande una lista de ObraList (archivo .json), impórtala aquí.</p>`}

      ${archivadas.length ? `
        <details class="tarjeta">
          <summary>${icono("archivar")} Archivadas (${archivadas.length})</summary>
          <div class="tarjetas">${archivadas.map(tarjetaLista).join("")}</div>
        </details>` : ""}`;
  },

  acciones: {
    // Primera vez: elegir el oficio con un toque.
    elegirOficio(el) {
      db.perfil.ocupacion = el.dataset.oficio;
      guardar(); refrescar();
      aviso(`Listo: ObraList se ajustó para ${el.dataset.oficio}`);
    },

    abrirCalc(el) {
      prepararCalculadora(el.dataset.calc);
      ir("#/calculadoras");
    },

    async nueva(el) {
      const plantillaElegida = el?.dataset?.plantilla ? `plantilla:${el.dataset.plantilla}` : "";
      const d = await formulario({
        titulo: "Nueva lista de obra",
        boton: "Crear lista",
        campos: [
          { nombre: "nombre", etiqueta: "Nombre de la obra", requerido: true, ancho: true, ayuda: "Ej. Instalación eléctrica Casa López" },
          { nombre: "cliente", etiqueta: "Cliente" },
          { nombre: "presupuesto", etiqueta: `Presupuesto máximo (${simbolo()})`, tipo: "number", valor: "" },
          { nombre: "direccion", etiqueta: "Dirección", ancho: true },
          {
            nombre: "plantilla", etiqueta: "Empezar con", tipo: "select", ancho: true, valor: plantillaElegida,
            opciones: [
              { valor: "", texto: "— Lista en blanco —" },
              // plantillas de trabajos típicos (las de tu oficio primero)
              ...plantillasPara(db.perfil.ocupacion).map((p) => ({ valor: `plantilla:${p.id}`, texto: `Plantilla: ${p.titulo}` })),
              // o copiar los materiales de una lista tuya
              ...db.listas.map((l) => ({ valor: l.id, texto: `Copiar de: ${l.nombre}` })),
            ],
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
      const plantilla = PLANTILLAS.find((p) => `plantilla:${p.id}` === d.plantilla);
      if (plantilla) agregarALista(lista, materialesDe(plantilla));
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
  const sub = [enVivo, l.recibida ? `De ${quienSoy(l.recibida.de, l.recibida.ocupacion)}` : "", l.cliente, `${l.items.length} ${l.items.length === 1 ? "material" : "materiales"}`].filter(Boolean);
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
    const info = [l.cliente, l.direccion, l.recibida ? `Recibida de ${quienSoy(l.recibida.de, l.recibida.ocupacion)}` : ""].filter(Boolean);
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
        <button class="atajo-herramientas" data-accion="irHerramientas" aria-label="Ir a las herramientas de la lista" title="Herramientas">${icono("mas")}</button>
      </div>

      <section class="resumen">
        <div class="dato"><span>Total materiales</span><strong>${dinero(t.total)}</strong></div>
        <div class="dato"><span>Comprado</span><strong>${dinero(t.comprado)}</strong></div>
        <div class="dato"><span>Por comprar</span><strong>${dinero(t.pendiente)}</strong></div>
      </section>

      ${bloquePresupuesto(l, t)}

      ${bloqueBitacora(l)}

      <section class="tarjeta">
        <h3>Agregar material</h3>
        <form data-form="agregar" class="formulario">
          <label class="ancho">Material
            <span class="con-boton">
              <input name="nombre" list="dl-productos" required autocomplete="off" data-entrada="material"
                     placeholder="${vozDisponible ? "Escribe, busca o dicta con el micrófono" : "Busca en tu catálogo o escribe uno nuevo"}">
              ${vozDisponible ? `<button type="button" class="microfono" data-accion="voz" aria-label="Dictar material" title="Dictar: “10 sacos de cemento”">${icono("microfono")}</button>` : ""}
            </span>
            <datalist id="dl-productos">${db.productos.map((p) => `<option value="${seguro(p.nombre)}">`).join("")}</datalist>
          </label>
          <label>Categoría<select name="categoriaId">${opcionesDe(categoriasOrdenadas(), null, (c) => c.nombre)}</select></label>
          <label>Unidad<select name="unidadId">${opcionesDe(db.unidades, null, (u) => u.abrev)}</select></label>
          <label>Cantidad<input name="cantidad" type="number" min="0" step="any" inputmode="decimal" value="1" required></label>
          <label>Precio unitario (${simbolo()})<input name="precio" type="number" min="0" step="any" inputmode="decimal" value="0" required></label>
          <label class="ancho check"><input type="checkbox" name="guardarCatalogo" checked> Guardar en mi catálogo si es nuevo</label>
          <button class="ancho principal">Agregar a la lista</button>
        </form>
      </section>

      <section class="tarjeta">
        <h3>Por comprar (${porComprar.length})</h3>
        <p class="nota">Marca la casilla de lo que vas metiendo al carrito y al final toca "Finalizar compra".</p>
        ${porComprar.length ? grupos(porComprar, false) : `<p class="vacio">${l.items.length ? "Todo comprado." : "Aún no agregas materiales."}</p>`}
      </section>

      ${comprados.length ? `
        <details class="tarjeta">
          <summary>${icono("check")} Comprados (${comprados.length}) · ${dinero(t.comprado)}</summary>
          ${grupos(comprados, true)}
        </details>` : ""}

      ${herramientasLista(l, deOtro)}

      ${enCarrito.length ? `
        <div class="barra-carrito">
          <span>${icono("carrito")} ${enCarrito.length} en carrito · <strong>${dinero(t.carrito)}</strong></span>
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

    carrito(el) { itemDe(el).estado = el.checked ? "carrito" : "pendiente"; guardar(); refrescar(); },
    cantidad(el) { itemDe(el).cantidad = Math.max(0, Number(el.value) || 0); guardar(); refrescar(); },
  },

  acciones: {
    // Dictar un material por voz y llenar el formulario (el usuario confirma con "Agregar").
    async voz(el) {
      el.classList.add("escuchando");
      aviso("Te escucho… por ejemplo: «10 sacos de cemento»");
      try {
        const texto = await escuchar();
        llenarConVoz(texto);
      } catch (e) {
        aviso(e.message);
      } finally {
        el.classList.remove("escuchando");
      }
    },

    async editarItem(el) {
      const it = itemDe(el);
      const d = await formulario({
        titulo: "Editar material",
        campos: [
          { nombre: "nombre", etiqueta: "Material", valor: it.nombre, requerido: true, ancho: true },
          { nombre: "categoriaId", etiqueta: "Categoría", tipo: "select", valor: it.categoriaId, opciones: categoriasOrdenadas().map((c) => ({ valor: c.id, texto: c.nombre })) },
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
      aviso("Compra guardada en Compras y gastos");
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

    irHerramientas() {
      document.querySelector("#herramientas")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },

    // Un solo botón "Compartir" con las tres formas juntas
    compartirMenu() {
      const opcion = (accion, ico, titulo, detalle) => `
        <button type="button" class="opcion-menu" data-opcion="${accion}">
          ${icono(ico, "icono-grande icono-acento")}
          <span><strong>${titulo}</strong><span class="nota">${detalle}</span></span>
        </button>`;
      mostrar("Compartir lista", `
        <div class="menu-opciones">
          ${esCompartidaConmigo(lista) ? "" : opcion("enVivo", "usuario", "Compartir en vivo", "La otra persona la edita contigo y los cambios se ven al instante")}
          ${opcion("compartirTexto", "mensaje", "Mandar por WhatsApp", "Como texto, para que la lean o la lleven a la ferretería")}
          ${opcion("compartirArchivo", "enviar", "Enviar archivo de ObraList", "La otra persona la importa en su app (Recibidas)")}
        </div>`);
      // la ventana está fuera de la pantalla principal: sus botones se conectan aquí
      const dlg = document.querySelector("#dialogo");
      dlg.querySelectorAll("[data-opcion]").forEach((b) => {
        b.addEventListener("click", () => { dlg.close(); vistaLista.acciones[b.dataset.opcion](); });
      });
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
      if (!confirm(`¿Borrar la lista "${lista.nombre}"?\nLas compras y gastos ya registrados se quedan en Compras y gastos.`)) return;
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

// Pone lo que se dictó en el formulario de "Agregar material".
export function llenarConVoz(texto) {
  const f = $('[data-form="agregar"]');
  if (!f) return;
  const r = interpretar(texto, db.productos);
  f.nombre.value = r.producto ? r.producto.nombre : r.resto;
  if (r.producto) vistaLista.entradas.material(f.nombre); // llena categoría, unidad y precio
  if (r.cantidad) f.cantidad.value = r.cantidad;
  aviso(r.producto ? `Escuché «${texto}». Revisa y toca Agregar` : `Escuché «${texto}». No está en tu catálogo: revisa y toca Agregar`);
  f.nombre.focus();
}

// Arriba en el inicio, sólo si todavía no eligió oficio.
function bloqueBienvenida() {
  if (db.perfil.ocupacion) return "";
  return `
    <section class="tarjeta bienvenida">
      <h3>${icono("casco")}¿A qué te dedicas?</h3>
      <p class="nota">Así ObraList te muestra primero tus materiales, calculadoras y plantillas.</p>
      <div class="oficios">
        ${OFICIOS_RAPIDOS.map((o) => `<button data-accion="elegirOficio" data-oficio="${seguro(o)}">${seguro(o)}</button>`).join("")}
        <a class="boton" href="#/mas">Otro…</a>
      </div>
    </section>`;
}

// Debajo de las listas: calculadoras y accesos rápidos según el oficio.
function bloqueHerramientas() {
  const oficio = db.perfil.ocupacion;
  const todasLasCalc = `
    <a class="atajo" href="#/calculadoras">
      <span class="calc-icono">${icono("calculadora", "icono-grande icono-acento")}</span>
      <span><strong>Calculadoras de obra</strong><span class="nota">Concreto, block, repello, pintura, piso y cable</span></span>
      ${icono("adelante")}
    </a>`;

  if (!oficio) return todasLasCalc;

  const calcs = Object.entries(CALCULADORAS).filter(([, c]) => c.oficios.includes(oficio)).slice(0, 3);
  const plantillas = PLANTILLAS.filter((p) => p.oficios.includes(oficio)).slice(0, 2);
  if (!calcs.length && !plantillas.length) return todasLasCalc;
  return `
    <section class="tarjeta">
      <div class="encabezado">
        <h3>${icono("casco")}Para tu trabajo</h3>
        <a href="#/calculadoras" class="nota">Todas las calculadoras</a>
      </div>
      <div class="accesos">
        ${calcs.map(([clave, c]) => `
          <button class="acceso" data-accion="abrirCalc" data-calc="${clave}">
            ${icono(c.icono, "icono-grande icono-acento")}<span>${c.titulo}</span>
          </button>`).join("")}
        ${plantillas.map((p) => `
          <button class="acceso" data-accion="nueva" data-plantilla="${p.id}">
            ${icono("agregarLista", "icono-grande icono-acento")}<span>Nueva: ${seguro(p.titulo)}</span>
          </button>`).join("")}
      </div>
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

// Herramientas al final de la lista: primero lo más usado; borrar, en rojo, al último.
function herramientasLista(l, deOtro) {
  const grande = (accion, ico, texto, href) => href
    ? `<a class="herramienta" href="${href}">${icono(ico, "icono-grande")}<span>${texto}</span></a>`
    : `<button class="herramienta" data-accion="${accion}">${icono(ico, "icono-grande")}<span>${texto}</span></button>`;
  return `
    <section class="tarjeta herramientas" id="herramientas">
      <h3>${icono("mas")}Herramientas de la lista</h3>
      <div class="herramientas-grandes">
        ${grande("", "bitacora", "Bitácora", `#/bitacora/${l.id}`)}
        ${grande("", "calculadora", "Calcular", `#/calculadoras/${l.id}`)}
        ${grande("compartirMenu", "compartir", "Compartir")}
        ${grande("gasto", "billetera", "Otro gasto")}
      </div>

      <h4 class="subtitulo-tarjeta">${icono("tabla")}Excel</h4>
      <div class="acciones-lista">
        <button data-accion="excel">${icono("descargar")}Exportar a Excel</button>
        <label class="boton">${icono("enviar")}Importar de Excel<input type="file" accept=".xlsx,.xls,.csv" data-cambio="importarExcel" hidden></label>
      </div>

      <h4 class="subtitulo-tarjeta">${icono("listas")}Lista</h4>
      <div class="acciones-lista">
        <button data-accion="editar">${icono("editar")}Editar datos</button>
        ${deOtro ? "" : `<button data-accion="archivar">${l.archivada ? `${icono("restaurar")}Desarchivar` : `${icono("archivar")}Archivar`}</button>`}
      </div>
    </section>

    <div class="zona-peligro">
      ${deOtro
        ? `<button data-accion="salirCompartida" class="boton-peligro">${icono("cerrar")}Salir de la lista</button>`
        : `<button data-accion="borrar" class="boton-peligro">${icono("borrar")}Borrar lista</button>`}
    </div>`;
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
  if (comprado && it.compraId) {
    const c = buscar("compras", it.compraId);
    const p = c && buscar("proveedores", c.proveedorId);
    if (c) extra = ` · ${fecha(c.fecha)}${p ? ` en ${seguro(p.nombre)}` : ""}`;
  }
  return `
    <div class="item ${it.estado}" data-id="${it.id}">
      ${comprado ? `<span class="palomita">${icono("check")}</span>`
                 : `<input type="checkbox" data-cambio="carrito" ${it.estado === "carrito" ? "checked" : ""} aria-label="En el carrito">`}
      <button class="nombre-item" data-accion="editarItem" title="Editar">
        <span class="nombre">${seguro(it.nombre)}</span>
        <span class="detalle">${dinero(it.precio)} / ${seguro(u.abrev)}${extra}</span>
      </button>
      ${comprado ? `<span class="cant">${it.cantidad} ${seguro(u.abrev)}</span>`
                 : `<input type="number" min="0" step="any" inputmode="decimal" value="${it.cantidad}" data-cambio="cantidad" aria-label="Cantidad">`}
      <span class="importe">${dinero(it.cantidad * it.precio)}</span>
      <button data-accion="quitarItem" aria-label="Quitar" class="quitar">${icono("cerrar")}</button>
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
