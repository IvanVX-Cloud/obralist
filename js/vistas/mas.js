// =====================================================================
// "Más": perfil, cuenta, proveedores, categorías, unidades y respaldo.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, reemplazarTodo, esRespaldoValido, semilla, OCUPACIONES } from "../datos.js";
import { seguro, formulario, aviso, refrescar, descargar, moneda, tipoCambio, dinero, aplicarApariencia } from "../ui.js";

// Tarjeta de apariencia: tema y modo obra.
function tarjetaApariencia() {
  const tema = db.perfil.tema || "auto";
  const op = (v, t) => `<option value="${v}" ${tema === v ? "selected" : ""}>${t}</option>`;
  return `
    <section class="tarjeta">
      <h3>${icono("apariencia")}Apariencia</h3>
      <form data-form="apariencia" class="formulario">
        <label class="ancho">Tema
          <select name="tema">${op("auto", "Automático (como el celular)")}${op("claro", "Claro: se lee mejor bajo el sol")}${op("oscuro", "Oscuro")}</select>
        </label>
        <label class="ancho check"><input type="checkbox" name="modoObra" ${db.perfil.modoObra ? "checked" : ""}>
          Modo obra: letra grande, más contraste y botones más grandes</label>
        <button class="principal ancho">Aplicar</button>
      </form>
    </section>`;
}
import { VERSION_APP, SOPORTE } from "../config.js";
import { icono, ICONOS_CATEGORIA } from "../iconos.js";
import { nube, entrar, crearCuenta, recuperarContrasena, salir, sincronizar } from "../nube.js";

// "hace 5 min", "hace 2 h"…
function hace(fecha) {
  const s = Math.round((Date.now() - fecha.getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return fecha.toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

let editandoPerfil = false;

// "Ivan Vargas" → "IV"
function iniciales(nombre, correo) {
  const partes = String(nombre || correo || "").trim().split(/[\s@.]+/).filter(Boolean);
  return ((partes[0]?.[0] || "") + (partes[1]?.[0] || "")).toUpperCase() || "?";
}

function formularioPerfil() {
  return `
    <form data-form="perfil" class="formulario">
      <label>Nombre
        <input name="nombre" value="${seguro(db.perfil.nombre)}" placeholder="Tu nombre o el de tu empresa">
      </label>
      <label>Ocupación
        <input name="ocupacion" list="dl-ocupaciones" value="${seguro(db.perfil.ocupacion || "")}" placeholder="Ej. Electricista" autocomplete="off">
        <datalist id="dl-ocupaciones">${OCUPACIONES.map((o) => `<option value="${seguro(o)}">`).join("")}</datalist>
      </label>
      <button class="principal ancho">Guardar perfil</button>
    </form>
    <p class="nota">Tu nombre y oficio aparecen cuando compartes una lista, y la app se ajusta a tu oficio.</p>`;
}

// Tarjeta "Mi cuenta": perfil (nombre y oficio) + cuenta en la nube, todo junto.
function tarjetaMiCuenta() {
  const { nombre, ocupacion } = db.perfil;
  const usuario = nube.usuario;
  const mostrarFormulario = editandoPerfil || !nombre;

  const cabecera = `
    <div class="perfil-cabecera">
      <span class="avatar" aria-hidden="true">${seguro(iniciales(nombre, usuario?.email))}</span>
      <div class="perfil-datos">
        <strong>${seguro(nombre || "Sin nombre todavía")}</strong>
        ${ocupacion ? `<span class="etiqueta-oficio">${seguro(ocupacion)}</span>` : ""}
        <span class="nota">${usuario ? `${icono("nube")} ${seguro(usuario.email || "")}` : "Sin cuenta: tus datos están sólo en este dispositivo"}</span>
      </div>
      ${nombre ? `<button data-accion="editarPerfil" aria-label="Editar perfil">${icono(editandoPerfil ? "cerrar" : "editar")}</button>` : ""}
    </div>`;

  let nubeHtml;
  if (!nube.configurada) {
    nubeHtml = `<p class="nota">La conexión con la nube todavía no está configurada en esta versión de la app.</p>`;
  } else if (!nube.lista) {
    nubeHtml = `<p class="nota">Conectando con la nube…</p>`;
  } else if (!usuario) {
    nubeHtml = `
      <h4 class="subtitulo-tarjeta">${icono("nube")}Respalda tus datos en la nube</h4>
      <p class="nota">Crea una cuenta gratis para no perder nada y usar tus datos en el celular y en la computadora.
      Sin cuenta, la app sigue funcionando igual, sólo en este dispositivo.</p>
      ${nube.error ? `<p class="rojo">${icono("alerta")} ${seguro(nube.error)}</p>` : ""}
      <form data-form="cuenta" class="formulario">
        <label class="ancho">Correo<input name="correo" type="email" autocomplete="email" required></label>
        <label class="ancho">Contraseña<input name="contrasena" type="password" autocomplete="current-password" minlength="6" required></label>
        <button class="principal" value="entrar">Entrar</button>
        <button value="crear">Crear cuenta</button>
      </form>
      <button class="enlace" data-accion="recuperar">Olvidé mi contraseña</button>`;
  } else {
    const estado = nube.sincronizando ? "Sincronizando…"
      : nube.error ? `${icono("alerta")} ${seguro(nube.error)}`
      : nube.ultima ? `${icono("check", "icono-acento")} Sincronizado ${hace(nube.ultima)}` : "Pendiente de sincronizar";
    nubeHtml = `
      <p class="nota ${nube.error ? "rojo" : ""}">${estado}</p>
      <p class="nota">Tus listas, catálogo, compras, gastos y bitácora se respaldan solos cuando hay internet.
      Las fotos de la bitácora todavía se quedan sólo en este dispositivo.</p>
      <div class="acciones-lista">
        <button data-accion="sincronizar" ${nube.sincronizando ? "disabled" : ""}>${icono("restaurar")}Sincronizar ahora</button>
        <button data-accion="salir">${icono("cerrar")}Cerrar sesión</button>
      </div>`;
  }

  return `
    <section class="tarjeta cuenta">
      <h3>${icono("usuario")}Mi cuenta</h3>
      ${cabecera}
      ${mostrarFormulario ? formularioPerfil() : ""}
      <hr class="separador">
      ${nubeHtml}
    </section>`;
}

// Tarjeta de moneda: colones o dólares + tipo de cambio.
function tarjetaMoneda() {
  const m = moneda();
  return `
    <section class="tarjeta">
      <h3>${icono("moneda")}Moneda</h3>
      <form data-form="moneda" class="formulario">
        <label>Mostrar precios en
          <select name="moneda">
            <option value="CRC" ${m === "CRC" ? "selected" : ""}>₡ Colones</option>
            <option value="USD" ${m === "USD" ? "selected" : ""}>$ Dólares</option>
          </select>
        </label>
        <label>Tipo de cambio (₡ por $1)
          <input name="tipoCambio" type="number" min="1" step="any" inputmode="decimal" value="${tipoCambio()}" required>
        </label>
        <button class="principal ancho">Guardar moneda</button>
      </form>
      <p class="nota">Todo se guarda en colones; al elegir dólares se convierte con este tipo de cambio.
      Consulta el del día en el Banco Central (BCCR). Ejemplo: ₡10 000 = ${dinero(10000)}.</p>
    </section>`;
}

// Tarjeta de ayuda: preguntas frecuentes + formas de contacto.
function tarjetaSoporte() {
  const info = `ObraList ${VERSION_APP} · ${navigator.userAgent}`;
  const botones = [];
  if (SOPORTE.whatsapp) {
    const texto = encodeURIComponent("Hola, necesito ayuda con ObraList.");
    botones.push(`<a class="boton" href="https://wa.me/${SOPORTE.whatsapp}?text=${texto}" target="_blank" rel="noopener">${icono("mensaje")}WhatsApp</a>`);
  }
  if (SOPORTE.correo) {
    const asunto = encodeURIComponent("Ayuda con ObraList");
    const cuerpo = encodeURIComponent(`Cuéntanos qué pasó:\n\n\n---\n${info}`);
    botones.push(`<a class="boton" href="mailto:${SOPORTE.correo}?subject=${asunto}&body=${cuerpo}">${icono("correo")}Correo</a>`);
  }
  if (SOPORTE.github) {
    botones.push(`<a class="boton" href="${SOPORTE.github}" target="_blank" rel="noopener">${icono("alerta")}Reportar un problema</a>`);
  }
  const preguntas = [
    ["¿Dónde se guardan mis datos?", "En este dispositivo, dentro del navegador. Nadie más los ve. Haz respaldos de vez en cuando (abajo, en Respaldo)."],
    ["¿Cómo paso mis datos a otro celular?", "Aquí en Más, toca Descargar respaldo; mándate el archivo y en el otro celular usa Restaurar respaldo."],
    ["¿Cómo comparto una lista con alguien?", "Abre la lista y toca Enviar archivo. La otra persona la importa en Listas, sección Recibidas."],
    ["¿Funciona sin internet?", "Sí. Ábrela una vez con internet y después funciona sin señal en la obra."],
    ["Los precios no son los de mi ferretería", "Son de ejemplo. Edítalos en Catálogo; además se actualizan solos cada vez que registras una compra."],
  ];
  return `
    <section class="tarjeta">
      <h3>${icono("ayuda")}Ayuda y soporte</h3>
      ${preguntas.map(([p, r]) => `<details class="pregunta"><summary>${p}</summary><p class="nota">${r}</p></details>`).join("")}
      ${botones.length ? `<p class="nota" style="margin-top:12px">¿No encontraste tu respuesta? Escríbenos:</p>
      <div class="acciones-lista">${botones.join("")}</div>` : ""}
    </section>`;
}
import { plataforma, enAppInstalada, sePuedeInstalar, instalar } from "../instalar.js";

// Tarjeta "Instalar en tu celular": cambia según el teléfono y si ya está instalada.
function tarjetaInstalar() {
  let contenido;
  if (enAppInstalada()) {
    contenido = `<p>${icono("check", "icono-acento")} Estás usando la app instalada. Se actualiza sola cada vez que la abres con internet.</p>`;
  } else if (sePuedeInstalar()) {
    contenido = `<button class="principal ancho-total" data-accion="instalar">${icono("descargar")}Instalar ObraList</button>`;
  } else if (plataforma === "ios") {
    contenido = `
      <ol class="pasos">
        <li>Abre esta página en <strong>Safari</strong>.</li>
        <li>Toca <strong>Compartir</strong> (abajo al centro).</li>
        <li>Elige <strong>"Agregar a inicio"</strong> y luego <strong>Agregar</strong>.</li>
      </ol>`;
  } else if (plataforma === "android") {
    contenido = `
      <ol class="pasos">
        <li>En <strong>Chrome</strong>, toca el menú <strong>⋮</strong> (arriba a la derecha).</li>
        <li>Elige <strong>"Instalar aplicación"</strong>. Si sólo ves "Agregar a pantalla principal", tócalo y en la
        ventana elige <strong>"Instalar"</strong>, <u>no</u> "Crear acceso directo".</li>
      </ol>
      <p class="nota">¿Cómo saber si quedó como app? Se abre <strong>sin barra de direcciones</strong>, el ícono
      <strong>no</strong> tiene la marquita de Chrome y aparece en Ajustes, en Aplicaciones.</p>
      <p class="nota">¿No aparece "Instalar"? Seguramente <strong>ya está instalada</strong> una versión anterior:
      búscala en tu cajón de apps y ábrela con internet (se actualiza sola), o desinstálala y recarga esta página.</p>`;
  } else {
    contenido = `<p class="nota">En la computadora, con Chrome o Edge, busca el ícono de instalar a la
      derecha de la barra de direcciones. Para el celular, abre el enlace de tu app en el teléfono.</p>`;
  }
  return `<section class="tarjeta"><h3>${icono("instalar")}Instalar en tu celular</h3>${contenido}</section>`;
}

// Configuración de cada colección que se puede editar aquí.
// Así un solo código sirve para las tres (agregar, editar, borrar).
const COLECCIONES = {
  proveedores: {
    titulo: "Proveedores", icono: "tienda", singular: "proveedor",
    campos: (x) => [
      { nombre: "nombre", etiqueta: "Nombre", valor: x?.nombre, requerido: true, ancho: true, ayuda: "Ej. Ferretería El Martillo" },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: x?.telefono },
      { nombre: "notas", etiqueta: "Notas", valor: x?.notas, ayuda: "Da crédito, entrega a domicilio…" },
    ],
    linea: (x) => `${seguro(x.nombre)}${x.telefono ? ` · <a href="tel:${seguro(x.telefono)}">${icono("telefono")} ${seguro(x.telefono)}</a>` : ""}${x.notas ? `<div class="detalle">${seguro(x.notas)}</div>` : ""}`,
    usos: (id) => db.compras.filter((c) => c.proveedorId === id).length,
  },
  categorias: {
    titulo: "Categorías", icono: "etiqueta", singular: "categoría",
    campos: (x) => [
      { nombre: "icono", etiqueta: "Ícono", tipo: "select", valor: x?.icono || "etiqueta",
        opciones: Object.entries(ICONOS_CATEGORIA).map(([valor, texto]) => ({ valor, texto })) },
      { nombre: "nombre", etiqueta: "Nombre", valor: x?.nombre, requerido: true, ayuda: "Ej. Impermeabilización" },
    ],
    linea: (x) => `${icono(x.icono, "icono-acento")} ${seguro(x.nombre)}`,
    usos: (id) => db.productos.filter((p) => p.categoriaId === id).length
      + db.listas.reduce((s, l) => s + l.items.filter((i) => i.categoriaId === id).length, 0),
  },
  unidades: {
    titulo: "Unidades de medida", icono: "regla", singular: "unidad",
    campos: (x) => [
      { nombre: "nombre", etiqueta: "Nombre", valor: x?.nombre, requerido: true, ayuda: "Ej. Metro lineal" },
      { nombre: "abrev", etiqueta: "Abreviatura", valor: x?.abrev, requerido: true, ayuda: "Ej. ml" },
    ],
    linea: (x) => `${seguro(x.nombre)} <span class="nota">(${seguro(x.abrev)})</span>`,
    usos: (id) => db.productos.filter((p) => p.unidadId === id).length
      + db.listas.reduce((s, l) => s + l.items.filter((i) => i.unidadId === id).length, 0),
  },
};

export const vistaMas = {
  tab: "mas",

  render() {
    return `
      <div class="encabezado"><h2>Más opciones</h2></div>

      ${tarjetaMiCuenta()}

      ${tarjetaInstalar()}

      ${tarjetaMoneda()}

      ${tarjetaApariencia()}

      ${Object.entries(COLECCIONES).map(([clave, cfg]) => `
        <section class="tarjeta">
          <div class="encabezado">
            <h3>${icono(cfg.icono)}${cfg.titulo} <span class="nota">(${db[clave].length})</span></h3>
            <button data-accion="crear" data-col="${clave}">+ Agregar</button>
          </div>
          ${db[clave].length ? db[clave].map((x) => `
            <div class="producto" data-id="${x.id}" data-col="${clave}">
              <div>${cfg.linea(x)}</div>
              <div class="botones">
                <button data-accion="editar" aria-label="Editar">${icono("editar")}</button>
                <button data-accion="borrar" aria-label="Borrar">${icono("borrar")}</button>
              </div>
            </div>`).join("") : `<p class="nota">Se agregan solos cuando registras una compra, o agrégalos aquí.</p>`}
        </section>`).join("")}

      <section class="tarjeta">
        <h3>${icono("respaldo")}Respaldo</h3>
        <p class="nota">Guarda una copia de TODO (listas, catálogo, compras, gastos) en un archivo. Útil para pasar tus datos a otro celular. Las fotos de la bitácora no se incluyen: se quedan en este dispositivo.</p>
        <div class="acciones-lista">
          <button data-accion="exportar">${icono("descargar")}Descargar respaldo</button>
          <label class="boton">${icono("enviar")}Restaurar respaldo<input type="file" accept=".json,application/json" data-cambio="restaurar" hidden></label>
          <button data-accion="reiniciar" class="peligro">${icono("borrar")}Borrar todo</button>
        </div>
      </section>

      ${tarjetaSoporte()}

      <p class="nota centro">ObraList · Versión beta · Hecha en Costa Rica</p>`;
  },

  formularios: {
    // Entrar o crear cuenta (según el botón que se tocó)
    async cuenta(form, d, e) {
      const crear = e?.submitter?.value === "crear";
      const botones = form.querySelectorAll("button");
      botones.forEach((b) => { b.disabled = true; });
      try {
        if (crear) {
          const { requiereConfirmar } = await crearCuenta(d.correo.trim(), d.contrasena);
          aviso(requiereConfirmar ? "Cuenta creada. Revisa tu correo y toca el enlace para confirmarla." : "Cuenta creada");
        } else {
          await entrar(d.correo.trim(), d.contrasena);
          aviso("Sesión iniciada. Sincronizando…");
        }
      } catch (error) {
        aviso(error.message);
        botones.forEach((b) => { b.disabled = false; });
      }
    },

    apariencia(form, d) {
      db.perfil.tema = ["claro", "oscuro"].includes(d.tema) ? d.tema : "auto";
      db.perfil.modoObra = Boolean(d.modoObra);
      guardar();
      aplicarApariencia();
      refrescar();
      aviso("Apariencia aplicada");
    },

    moneda(form, d) {
      db.perfil.moneda = d.moneda === "USD" ? "USD" : "CRC";
      db.perfil.tipoCambio = Number(d.tipoCambio) > 0 ? Number(d.tipoCambio) : tipoCambio();
      guardar(); refrescar();
      aviso(db.perfil.moneda === "USD" ? "Ahora ves los precios en dólares" : "Ahora ves los precios en colones");
    },

    perfil(form, d) {
      db.perfil.nombre = d.nombre.trim();
      const cambioOficio = db.perfil.ocupacion !== d.ocupacion.trim();
      db.perfil.ocupacion = d.ocupacion.trim();
      guardar();
      editandoPerfil = false;
      refrescar();
      aviso(cambioOficio && db.perfil.ocupacion ? `Perfil guardado. La app se ajustó para ${db.perfil.ocupacion}` : "Perfil guardado");
    },
  },

  acciones: {
    instalar() { instalar(); },

    editarPerfil() { editandoPerfil = !editandoPerfil; refrescar(); },

    async recuperar() {
      const correo = document.querySelector('[data-form="cuenta"] [name="correo"]')?.value.trim();
      if (!correo) return aviso("Escribe tu correo arriba y vuelve a tocar «Olvidé mi contraseña».");
      try {
        await recuperarContrasena(correo);
        aviso("Te enviamos un correo para cambiar la contraseña.");
      } catch (error) { aviso(error.message); }
    },

    sincronizar() { sincronizar({ manual: true }); },

    salir() {
      if (!confirm("¿Cerrar sesión en este dispositivo?\nTus datos se quedan aquí, pero dejan de respaldarse hasta que vuelvas a entrar.")) return;
      salir();
    },

    async crear(el) {
      const clave = el.dataset.col;
      const cfg = COLECCIONES[clave];
      const d = await formulario({ titulo: `Nuevo ${cfg.singular}`, campos: cfg.campos(null) });
      if (!d) return;
      db[clave].push({ id: nuevoId(), ...d });
      guardar(); refrescar();
    },

    async editar(el) {
      const fila = el.closest("[data-id]");
      const cfg = COLECCIONES[fila.dataset.col];
      const x = buscar(fila.dataset.col, fila.dataset.id);
      const d = await formulario({ titulo: `Editar ${cfg.singular}`, campos: cfg.campos(x) });
      if (!d) return;
      Object.assign(x, d);
      guardar(); refrescar();
    },

    borrar(el) {
      const fila = el.closest("[data-id]");
      const clave = fila.dataset.col;
      const cfg = COLECCIONES[clave];
      const x = buscar(clave, fila.dataset.id);
      const usos = cfg.usos(x.id);
      // No dejamos borrar algo que se está usando, para no dejar datos "huérfanos".
      if (usos > 0) return aviso(`No se puede borrar: se usa en ${usos} lugar(es)`);
      if (!confirm(`¿Borrar ${cfg.singular} "${x.nombre}"?`)) return;
      db[clave] = db[clave].filter((y) => y !== x);
      guardar(); refrescar();
    },

    exportar() {
      descargar(`obralist-respaldo-${hoy()}.json`, JSON.stringify(db, null, 2), "application/json");
      aviso("Respaldo descargado");
    },

    reiniciar() {
      if (!confirm("¿Borrar TODOS tus datos de este dispositivo?\nListas, compras, gastos y catálogo. No se puede deshacer (salvo que tengas un respaldo).")) return;
      reemplazarTodo(semilla());
      refrescar();
      aviso("Datos borrados. Empezamos de cero.");
    },
  },

  cambios: {
    async restaurar(el) {
      const archivo = el.files[0];
      if (!archivo) return;
      try {
        const o = JSON.parse(await archivo.text());
        if (!esRespaldoValido(o)) throw new Error("formato");
        if (!confirm("Esto reemplaza TODOS tus datos actuales por los del respaldo. ¿Continuar?")) return;
        reemplazarTodo(o);
        refrescar();
        aviso("Respaldo restaurado");
      } catch {
        aviso("Ese archivo no es un respaldo de ObraList");
      } finally {
        el.value = "";
      }
    },
  },
};
