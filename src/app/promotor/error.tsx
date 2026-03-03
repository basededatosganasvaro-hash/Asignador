"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

export default function PromotorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center mt-20 gap-4">
      <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 max-w-md">
        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Ocurrio un error al cargar la pagina</p>
          <p className="text-sm text-red-400 mt-1">
            {error.message || "Error inesperado. Intenta recargar la pagina."}
          </p>
        </div>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-950 text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20"
      >
        <RefreshCw className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}
