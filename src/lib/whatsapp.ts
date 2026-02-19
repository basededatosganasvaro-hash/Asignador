// Mensajes predefinidos por etapa para WhatsApp
// Variables disponibles: {nombre} = nombre completo del cliente, {promotor} = nombre del promotor
export const WA_MENSAJES_DEFAULT: Record<string, string> = {
  Asignado: "Hola {nombre}, buenas tardes. Mi nombre es {promotor}, le contacto para brindarle información sobre un beneficio disponible para usted. ¿Tiene un momento para platicar?",
  Contactado: "Hola {nombre}, le saludo nuevamente. Dando seguimiento a nuestra conversación anterior, me gustaría resolver cualquier duda que tenga sobre el beneficio que le comenté.",
  Interesado: "Hola {nombre}, como le comenté, tengo la información lista para avanzar con su trámite. ¿Le parece bien si revisamos los detalles?",
  "Negociación": "Hola {nombre}, le comparto los detalles de su propuesta. Quedo atento a cualquier duda para que podamos concretar.",
  Capturados: "Hola {nombre}, mi nombre es {promotor}. Le contacto porque tenemos una excelente oportunidad para usted. ¿Podemos platicar unos minutos?",
};

export const WA_ETAPAS_ORDEN = ["Asignado", "Contactado", "Interesado", "Negociación", "Capturados"];

export function buildWhatsAppUrl(
  telefono: string,
  nombre: string,
  etapa: string,
  promotorNombre: string,
  plantillas: Record<string, string>,
): string | null {
  if (!telefono) return null;

  // Limpiar teléfono: solo dígitos
  let tel = telefono.replace(/\D/g, "");
  // Si es número mexicano de 10 dígitos, agregar código de país
  if (tel.length === 10) tel = "52" + tel;
  // Si empieza con 0, quitar
  if (tel.startsWith("0")) tel = tel.slice(1);

  const template = plantillas[etapa] || plantillas["Asignado"] || WA_MENSAJES_DEFAULT["Asignado"];
  const mensaje = template
    .replace(/\{nombre\}/g, nombre)
    .replace(/\{promotor\}/g, promotorNombre);

  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
}
