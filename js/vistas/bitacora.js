// =====================================================================
// Bitácora de obra: un registro por día con nota, clima, avance y fotos.
// Sirve para llevar el control de la obra y para mandarle avances al cliente.
// =====================================================================
import { db, guardar, nuevoId, hoy, buscar, quienSoy } from "../datos.js";
import { seguro, fecha, aviso, refrescar, mostrar, $ } from "../ui.js";
import { icono } from "../iconos.js";
import { comprimir, guardarFoto, leerFoto, borrarFoto, urlFoto } from "../fotos.js";

export const CLIMAS = { sol: "Soleado", nublado: "Nublado", lluvia: "Lluvia" };

let lista = null;
let guardando = false;

// Registros de una obra, del más nuevo al más viejo.
export const registrosDe = (listaId) =>
  db.bitacora.filter((r) => r.listaId === listaId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado - a.creado);

// El último avance (%) anotado en la bitácora, o null.
export function ultimoAvance(listaId) {
  const r = registrosDe(listaId).find((x) => x.avance !== null && x.avance !== undefined);
  return r ? r.avance : null;
}

const registroDe = (el) => db.bitacora.find((r) => r.id === el.closest("[data-id]").dataset.id);

export const vistaBitacora = {
  tab: "listas",

  render(listaId) {
    lista = buscar("listas", listaId);
    if (!lista) return `<p class="vacio">No encontré esa obra. <a href="#/listas">Volver</a></p>`;
    const registros = registrosDe(lista.id);
    const avance = ultimoAvance(lista.id);
    return `
      <a href="#/lista/${lista.id}" class="volver">${icono("volver")} ${seguro(lista.nombre)}</a>
      <div class="encabezado"><h2>${icono("bitacora")}Bitácora de obra</h2></div>

      ${avance !== null ? `
        <section class="tarjeta">
          <div class="fila entre"><span>Avance de la obra</span><strong>${avance} %</strong></div>
          <div class="barra-progreso"><div style="width:${avance}%"></div></div>
        </section>` : ""}

      <section class="tarjeta">
        <h3>${icono("mas_")}Nuevo registro</h3>
        <form data-form="registro" class="formulario">
          <label>Fecha<input name="fecha" type="date" value="${hoy()}" required></label>
          <label>Clima
            <select name="clima">
              <option value="">—</option>
              ${Object.entries(CLIMAS).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}
            </select>
          </label>
          <label>Avance (%)<input name="avance" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="${avance ?? 0}"></label>
          <label>Personas en obra<input name="personas" type="number" min="0" step="1" inputmode="numeric"></label>
          <label class="ancho">¿Qué se hizo hoy?
            <textarea name="nota" rows="3" required placeholder="Ej. Se terminó el cableado de la planta baja. Falta colocar tomacorrientes."></textarea>
          </label>
          <label class="ancho subir-fotos">
            <span>${icono("camara")} Fotos (opcional)</span>
            <input name="fotos" type="file" accept="image/*" multiple>
          </label>
          <button class="principal ancho">Guardar registro</button>
        </form>
      </section>

      ${registros.length
        ? registros.map(tarjetaRegistro).join("")
        : `<p class="vacio">Todavía no hay registros. Anota cada día lo que se avanzó; te sirve para controlar la obra y para mandarle avances al cliente.</p>`}`;
  },

  // Después de dibujar, cargamos las fotos (vienen de IndexedDB, que es asíncrono).
  despues() {
    document.querySelectorAll("img[data-foto]").forEach(async (img) => {
      const url = await urlFoto(img.dataset.foto);
      if (url) img.src = url;
      else img.closest(".miniatura")?.remove();
    });
  },

  formularios: {
    async registro(form, d) {
      if (guardando) return;
      const archivos = [...form.fotos.files];
      guardando = true;
      const boton = form.querySelector("button");
      boton.disabled = true;
      boton.textContent = archivos.length ? "Guardando fotos…" : "Guardando…";
      try {
        const fotos = [];
        for (const archivo of archivos) fotos.push(await guardarFoto(await comprimir(archivo)));
        const avance = d.avance === "" ? null : Math.min(100, Math.max(0, Math.round(Number(d.avance))));
        db.bitacora.push({
          id: nuevoId(), listaId: lista.id, fecha: d.fecha, creado: Date.now(),
          clima: d.clima || "", avance, personas: d.personas === "" ? null : Number(d.personas),
          nota: d.nota.trim(), fotos,
        });
        guardar();
        aviso(fotos.length ? `Registro guardado con ${fotos.length} foto(s)` : "Registro guardado");
      } catch (e) {
        console.warn(e);
        aviso("No se pudieron guardar las fotos. Intenta con menos fotos a la vez.");
      } finally {
        guardando = false;
        refrescar();
      }
    },
  },

  acciones: {
    async verFoto(el) {
      const url = await urlFoto(el.dataset.foto);
      if (url) mostrar("Foto", `<img src="${url}" alt="Foto de la obra" class="foto-completa">`);
    },

    async borrar(el) {
      const r = registroDe(el);
      if (!confirm(`¿Borrar el registro del ${fecha(r.fecha)}${r.fotos.length ? ` y sus ${r.fotos.length} foto(s)` : ""}?`)) return;
      for (const id of r.fotos) await borrarFoto(id).catch(() => {});
      db.bitacora = db.bitacora.filter((x) => x !== r);
      guardar(); refrescar();
      aviso("Registro borrado");
    },

    // Mandar el registro del día (texto + fotos) por WhatsApp u otra app.
    async compartir(el) {
      const r = registroDe(el);
      const autor = quienSoy(db.perfil.nombre, db.perfil.ocupacion);
      // null = esa línea no aplica y se omite
      const texto = [
        `*${lista.nombre}* — avance de obra`,
        `${fecha(r.fecha)}${r.clima ? ` · ${CLIMAS[r.clima]}` : ""}`,
        r.avance !== null ? `Avance: ${r.avance} %` : null,
        r.personas ? `Personas en obra: ${r.personas}` : null,
        "",
        r.nota,
        "",
        autor ? `Enviado por ${autor} · ObraList` : "Enviado con ObraList",
      ].filter((linea) => linea !== null).join("\n");

      const archivos = (await Promise.all(r.fotos.map(async (id, i) => {
        const blob = await leerFoto(id).catch(() => null);
        return blob ? new File([blob], `obra-${r.fecha}-${i + 1}.jpg`, { type: "image/jpeg" }) : null;
      }))).filter(Boolean);

      try {
        if (archivos.length && navigator.canShare?.({ files: archivos })) {
          await navigator.share({ text: texto, files: archivos });
        } else if (navigator.share) {
          await navigator.share({ text: texto });
        } else {
          await navigator.clipboard.writeText(texto);
          aviso("Texto copiado. Las fotos se comparten desde el celular.");
        }
      } catch (e) {
        if (e.name !== "AbortError") aviso("No se pudo compartir");
      }
    },
  },
};

function tarjetaRegistro(r) {
  const detalles = [
    r.clima ? `${icono(r.clima)} ${CLIMAS[r.clima]}` : "",
    r.avance !== null ? `Avance ${r.avance} %` : "",
    r.personas ? `${icono("usuario")} ${r.personas}` : "",
  ].filter(Boolean);
  return `
    <article class="tarjeta registro" data-id="${r.id}">
      <div class="fila entre">
        <strong>${fecha(r.fecha)}</strong>
        <span class="nota detalles-registro">${detalles.join(" · ")}</span>
      </div>
      <p class="texto-registro">${seguro(r.nota)}</p>
      ${r.fotos.length ? `
        <div class="galeria">
          ${r.fotos.map((id) => `
            <button class="miniatura" data-accion="verFoto" data-foto="${id}" aria-label="Ver foto">
              <img data-foto="${id}" alt="Foto de la obra" loading="lazy">
            </button>`).join("")}
        </div>` : ""}
      <div class="fila fin">
        <button data-accion="compartir">${icono("compartir")}Compartir</button>
        <button data-accion="borrar" class="peligro" aria-label="Borrar registro">${icono("borrar")}</button>
      </div>
    </article>`;
}
