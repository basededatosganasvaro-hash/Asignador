"use client";

import { useState, useEffect, useCallback } from "react";

interface HorarioState {
  activo: boolean;
  mensaje?: string;
  horaActual?: string;
  horarioInicio?: string;
  horarioFin?: string;
  loading: boolean;
}

/**
 * Hook para verificar el horario operativo del sistema.
 * Consulta cada 60 segundos para mantener el estado actualizado.
 */
export function useHorario() {
  const [estado, setEstado] = useState<HorarioState>({
    activo: true, // optimistic default
    loading: true,
  });

  const verificar = useCallback(async () => {
    try {
      const res = await fetch("/api/sistema/horario");
      if (res.ok) {
        const data = await res.json();
        setEstado({ ...data, loading: false });
      }
    } catch {
      // Si falla la consulta, asumir activo para no bloquear
      setEstado((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    verificar();
    const interval = setInterval(verificar, 60_000); // cada 60s
    return () => clearInterval(interval);
  }, [verificar]);

  return estado;
}
