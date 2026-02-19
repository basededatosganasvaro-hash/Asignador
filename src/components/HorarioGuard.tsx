"use client";

import { useHorario } from "@/hooks/useHorario";
import FueraDeHorario from "@/components/FueraDeHorario";

/**
 * Wrapper que muestra overlay de fuera de horario.
 * No bloquea la lectura — solo muestra el overlay encima.
 * Los botones de acción se deshabilitan via el hook useHorario en cada página.
 */
export default function HorarioGuard({ children }: { children: React.ReactNode }) {
  const { activo, loading, mensaje, horaActual, horarioInicio, horarioFin } = useHorario();

  return (
    <>
      {children}
      {!loading && !activo && (
        <FueraDeHorario
          mensaje={mensaje}
          horaActual={horaActual}
          horarioInicio={horarioInicio}
          horarioFin={horarioFin}
        />
      )}
    </>
  );
}
