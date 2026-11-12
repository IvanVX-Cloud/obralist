// =====================================================================
// config.js — Datos de la app que puedes cambiar fácilmente.
// =====================================================================

export const VERSION_APP = "1.7.0";

// Conexión con Supabase (la nube). Ambos datos son PÚBLICOS por diseño:
// la seguridad la dan las reglas de la base de datos (Row Level Security).
// Están en Supabase → Project Settings → API (o el botón "Connect").
// ⚠ NUNCA pongas aquí la clave "service_role" / "secret": esa sí es secreta.
export const SUPABASE = {
  url: "https://yejhysusnlnetfggdqum.supabase.co",
  clave: "sb_publishable_b9oJmwRNe-mU8lkB--vd0Q_45kB_93D", // clave "publishable" (pública)
};

// Contacto de soporte. Deja un campo vacío ("") para que no aparezca.
export const SOPORTE = {
  // Correo de soporte, ej. "soporte@obralist.com"
  correo: "",
  // WhatsApp con código de país 506, sin "+" ni espacios, ej. "50688887777"
  whatsapp: "",
  // Página para reportar problemas (necesita cuenta de GitHub)
  github: "https://github.com/IvanVX-Cloud/obralist/issues/new",
};
