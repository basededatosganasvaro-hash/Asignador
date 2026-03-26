// Mensajes predefinidos por etapa para WhatsApp
// Variables disponibles: {nombre} = nombre completo del cliente, {promotor} = nombre del promotor
export const WA_MENSAJES_DEFAULT: Record<string, string> = {
  Asignado: "Hola {nombre}, buenas tardes. Mi nombre es {promotor}, le contacto para brindarle información sobre un beneficio disponible para usted. ¿Tiene un momento para platicar?",
  Contactado: "Hola {nombre}, le saludo nuevamente. Dando seguimiento a nuestra conversación anterior, me gustaría resolver cualquier duda que tenga sobre el beneficio que le comenté.",
  Interesado: "Hola {nombre}, como le comenté, tengo la información lista para avanzar con su trámite. ¿Le parece bien si revisamos los detalles?",
  "Negociación": "Hola {nombre}, le comparto los detalles de su propuesta. Quedo atento a cualquier duda para que podamos concretar.",
  Capturados: "Hola {nombre}, mi nombre es {promotor}. Le contacto porque tenemos una excelente oportunidad para usted. ¿Podemos platicar unos minutos?",
  Capacidades: "Hola {nombre}, mi nombre es {promotor}. Revisamos su información y tiene un beneficio disponible. ¿Le gustaría conocer los detalles?",
};

export const WA_ETAPAS_ORDEN = ["Asignado", "Contactado", "Interesado", "Negociación", "Capturados", "Capacidades"];

/** Formatear teléfono mexicano para WhatsApp: 10 dígitos → 521XXXXXXXXXX */
export function formatPhoneForWA(telefono: string): string {
  let tel = telefono.replace(/\D/g, "");
  if (tel.startsWith("0")) tel = tel.slice(1);
  // 10 dígitos mexicanos → agregar 521 (país + indicador móvil)
  if (tel.length === 10) tel = "521" + tel;
  // Si ya tiene 52 pero sin el 1 (12 dígitos) → insertar el 1
  if (tel.length === 12 && tel.startsWith("52")) tel = "521" + tel.slice(2);
  // Validar longitud final: debe ser 12-13 dígitos (ej. 521XXXXXXXXXX)
  if (tel.length < 12 || tel.length > 13) {
    console.warn(`[formatPhoneForWA] Longitud inesperada (${tel.length} dígitos): ${tel}`);
  }
  return tel;
}

export function buildWhatsAppUrl(
  telefono: string,
  nombre: string,
  etapa: string,
  promotorNombre: string,
  plantillas: Record<string, string>,
): string | null {
  if (!telefono) return null;

  const tel = formatPhoneForWA(telefono);

  const template = plantillas[etapa] || plantillas["Asignado"] || WA_MENSAJES_DEFAULT["Asignado"];
  const mensaje = template
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{promotor\}/g, promotorNombre);

  return `https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(mensaje)}`;
}
