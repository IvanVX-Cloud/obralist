// =====================================================================
// "Más": perfil, cuenta, proveedores, categorías, unidades y respaldo.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, reemplazarTodo, esRespaldoValido, semilla } from "../datos.js";
import { seguro, formulario, aviso, refrescar, descargar, moneda, tipoCambio, dinero } from "../ui.js";
import { VERSION_APP, SOPORTE } from "../config.js";

// Tarjeta de moneda: colones o dólares + tipo de cambio.
function tarjetaMoneda() {
  const m = moneda();
  return `
    <section class="tarjeta">
      <h3>💱 Moneda</h3>
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
    botones.push(`<a class="boton" href="https://wa.me/${SOPORTE.whatsapp}?text=${texto}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
  }
  if (SOPORTE.correo) {
    const asunto = encodeURIComponent("Ayuda con ObraList");
    const cuerpo = encodeURIComponent(`Cuéntanos qué pasó:\n\n\n---\n${info}`);
    botones.push(`<a class="boton" href="mailto:${SOPORTE.correo}?subject=${asunto}&body=${cuerpo}">✉️ Correo</a>`);
  }
  if (SOPORTE.github) {
    botones.push(`<a class="boton" href="${SOPORTE.github}" target="_blank" rel="noopener">🐞 Reportar un problema</a>`);
  }
  const preguntas = [
    ["¿Dónde se guardan mis datos?", "En este dispositivo, dentro del navegador. Nadie más los ve. Haz respaldos de vez en cuando (abajo, en 💾 Respaldo)."],
    ["¿Cómo paso mis datos a otro celular?", "Aquí en Más → Descargar respaldo; mándate el archivo y en el otro celular usa Restaurar respaldo."],
    ["¿Cómo comparto una lista con alguien?", "Abre la lista → 💾 Enviar archivo. La otra persona la importa en Listas → 📥 Recibidas."],
    ["¿Funciona sin internet?", "Sí. Ábrela una vez con internet y después funciona sin señal en la obra."],
    ["Los precios no son los de mi ferretería", "Son de ejemplo. Edítalos en 📦 Catálogo; además se actualizan solos cada vez que registras una compra."],
  ];
  return `
    <section class="tarjeta">
      <h3>🛟 Ayuda y soporte</h3>
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
    contenido = `<p>✅ Estás usando la app instalada. Se actualiza sola cada vez que la abres con internet.</p>`;
  } else if (sePuedeInstalar()) {
    contenido = `<button class="principal ancho-total" data-accion="instalar">📲 Instalar ObraList</button>`;
  } else if (plataforma === "ios") {
    contenido = `
      <ol class="pasos">
        <li>Abre esta página en <strong>Safari</strong>.</li>
        <li>Toca <strong>Compartir</strong> ⬆️ (abajo al centro).</li>
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
      <strong>no</strong> tiene la marquita de Chrome y aparece en Ajustes → Aplicaciones.</p>
      <p class="nota">¿No aparece "Instalar"? Seguramente <strong>ya está instalada</strong> una versión anterior:
      búscala en tu cajón de apps y ábrela con internet (se actualiza sola), o desinstálala y recarga esta página.</p>`;
  } else {
    contenido = `<p class="nota">En la computadora, con Chrome o Edge, busca el ícono de instalar (🖥️⬇️) a la
      derecha de la barra de direcciones. Para el celular, abre el enlace de tu app en el teléfono.</p>`;
  }
  return `<section class="tarjeta"><h3>📲 Instalar en tu celular</h3>${contenido}</section>`;
}

// Configuración de cada colección que se puede editar aquí.
// Así un solo código sirve para las tres (agregar, editar, borrar).
const COLECCIONES = {
  proveedores: {
    titulo: "🏪 Proveedores", singular: "proveedor",
    campos: (x) => [
      { nombre: "nombre", etiqueta: "Nombre", valor: x?.nombre, requerido: true, ancho: true, ayuda: "Ej. Ferretería El Martillo" },
      { nombre: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: x?.telefono },
      { nombre: "notas", etiqueta: "Notas", valor: x?.notas, ayuda: "Da crédito, entrega a domicilio…" },
    ],
    linea: (x) => `${seguro(x.nombre)}${x.telefono ? ` · <a href="tel:${seguro(x.telefono)}">📞 ${seguro(x.telefono)}</a>` : ""}${x.notas ? `<div class="detalle">${seguro(x.notas)}</div>` : ""}`,
    usos: (id) => db.compras.filter((c) => c.proveedorId === id).length,
  },
  categorias: {
    titulo: "🗂️ Categorías", singular: "categoría",
    campos: (x) => [
      { nombre: "icono", etiqueta: "Ícono (emoji)", valor: x?.icono || "📦" },
      { nombre: "nombre", etiqueta: "Nombre", valor: x?.nombre, requerido: true, ayuda: "Ej. Impermeabilización" },
    ],
    linea: (x) => `${seguro(x.icono)} ${seguro(x.nombre)}`,
    usos: (id) => db.productos.filter((p) => p.categoriaId === id).length
      + db.listas.reduce((s, l) => s + l.items.filter((i) => i.categoriaId === id).length, 0),
  },
  unidades: {
    titulo: "📏 Unidades de medida", singular: "unidad",
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

      ${tarjetaInstalar()}

      ${tarjetaMoneda()}

      <section class="tarjeta">
        <h3>👷 Tu perfil</h3>
        <form data-form="perfil" class="fila">
          <input name="nombre" value="${seguro(db.perfil.nombre)}" placeholder="Tu nombre o el de tu empresa" aria-label="Tu nombre">
          <button class="principal">Guardar</button>
        </form>
        <p class="nota">Se usa cuando compartes una lista, para que sepan quién la manda.</p>
      </section>

      <section class="tarjeta cuenta">
        <h3>☁️ Cuenta en la nube <span class="etiqueta">Próximamente</span></h3>
        <p class="nota">Por ahora tus datos viven sólo en este dispositivo. En el siguiente paso conectaremos
        una base de datos en la nube (Supabase) para iniciar sesión, usar la app en el celular y en la compu
        con los mismos datos, y compartir listas con tu cuadrilla al instante.</p>
      </section>

      ${Object.entries(COLECCIONES).map(([clave, cfg]) => `
        <section class="tarjeta">
          <div class="encabezado">
            <h3>${cfg.titulo} <span class="nota">(${db[clave].length})</span></h3>
            <button data-accion="crear" data-col="${clave}">+ Agregar</button>
          </div>
          ${db[clave].length ? db[clave].map((x) => `
            <div class="producto" data-id="${x.id}" data-col="${clave}">
              <div>${cfg.linea(x)}</div>
              <div class="botones">
                <button data-accion="editar" aria-label="Editar">✏️</button>
                <button data-accion="borrar" aria-label="Borrar">🗑️</button>
              </div>
            </div>`).join("") : `<p class="nota">Se agregan solos cuando registras una compra, o agrégalos aquí.</p>`}
        </section>`).join("")}

      <section class="tarjeta">
        <h3>💾 Respaldo</h3>
        <p class="nota">Guarda una copia de TODO (listas, catálogo, compras, gastos) en un archivo. Útil para pasar tus datos a otro celular.</p>
        <div class="acciones-lista">
          <button data-accion="exportar">⬇️ Descargar respaldo</button>
          <label class="boton">⬆️ Restaurar respaldo<input type="file" accept=".json,application/json" data-cambio="restaurar" hidden></label>
          <button data-accion="reiniciar" class="peligro">🧨 Borrar todo</button>
        </div>
      </section>

      ${tarjetaSoporte()}

      <p class="nota centro">ObraList ${VERSION_APP} · Hecha en Costa Rica 🇨🇷</p>`;
  },

  formularios: {
    moneda(form, d) {
      db.perfil.moneda = d.moneda === "USD" ? "USD" : "CRC";
      db.perfil.tipoCambio = Number(d.tipoCambio) > 0 ? Number(d.tipoCambio) : tipoCambio();
      guardar(); refrescar();
      aviso(db.perfil.moneda === "USD" ? "Ahora ves los precios en dólares" : "Ahora ves los precios en colones");
    },

    perfil(form, d) {
      db.perfil.nombre = d.nombre.trim();
      guardar();
      aviso("Perfil guardado ✓");
    },
  },

  acciones: {
    instalar() { instalar(); },

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
      aviso("Respaldo descargado ✓");
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
        aviso("Respaldo restaurado ✓");
      } catch {
        aviso("Ese archivo no es un respaldo de ObraList");
      } finally {
        el.value = "";
      }
    },
  },
};
