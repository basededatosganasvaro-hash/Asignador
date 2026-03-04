"use client";

import { useState, useEffect, useCallback } from "react";

interface WhatsAppBetaState {
  permitido: boolean;
  beta_activo: boolean;
  loading: boolean;
}

/**
 * Hook para verificar si el usuario tiene acceso a WhatsApp Masivo.
 * Poll cada 5 min (coincide con TTL del cache de config).
 * Default optimista: permitido=true para no flashear pantalla de bloqueo.
 */
export function useWhatsAppBeta() {
  const [estado, setEstado] = useState<WhatsAppBetaState>({
    permitido: true,
    beta_activo: false,
    loading: true,
  });

  const verificar = useCallback(async () => {
    try {
      const res = await fetch("/api/sistema/whatsapp-beta");
      if (res.ok) {
        const data = await res.json();
        setEstado({ ...data, loading: false });
      }
    } catch {
      // Si falla, asumir permitido para no bloquear
      setEstado((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    verificar();
    const interval = setInterval(verificar, 5 * 60 * 1000); // cada 5 min
    return () => clearInterval(interval);
  }, [verificar]);

  return estado;
}
