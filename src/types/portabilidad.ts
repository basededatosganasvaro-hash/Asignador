export interface RegistroPortabilidad {
  id: string;
  promotor_id: number;
  rfc_cliente: string;
  nombre_cliente: string;
  folio_portabilidad: string;
  evidencia_url: string; // string o JSON array
  created_at: string;
}
