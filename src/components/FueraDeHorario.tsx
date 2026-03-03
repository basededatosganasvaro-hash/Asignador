"use client";

import { Clock } from "lucide-react";

interface Props {
  mensaje?: string;
  horaActual?: string;
  horarioInicio?: string;
  horarioFin?: string;
}

export default function FueraDeHorario({
  mensaje,
  horaActual,
  horarioInicio = "08:55",
  horarioFin = "19:15",
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center">
      <div className="bg-surface rounded-xl border border-slate-800/60 p-10 max-w-[440px] text-center shadow-2xl shadow-black/50">
        <Clock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-100 mb-2">
          Fuera de horario
        </h2>
        <p className="text-base text-slate-400 mb-2">
          {mensaje || `El sistema opera de ${horarioInicio} a ${horarioFin}.`}
        </p>
        <p className="text-base text-slate-400 mb-2">
          Lunes a Viernes
        </p>
        {horaActual && (
          <p className="text-sm text-slate-500">
            Hora actual: {horaActual} (Hora Centro de Mexico)
          </p>
        )}
        <p className="text-sm text-slate-500 mt-2">
          Puedes consultar tus registros pero no realizar operaciones.
        </p>
      </div>
    </div>
  );
}
