"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Bloqueo frontend de copiar/pegar/seleccionar/click-derecho para todos los usuarios
 * excepto admin. Es una capa de fricción, NO una protección real: quien abra DevTools
 * o la consola puede seguir extrayendo datos.
 */
export default function CopyGuard() {
  const { data: session } = useSession();
  const rol = session?.user?.rol;
  const exento = rol === "admin";

  useEffect(() => {
    if (exento || !rol) return;

    const block = (e: Event) => e.preventDefault();

    const blockKeys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.ctrlKey && ["c", "x", "a", "s", "p", "u"].includes(k)) {
        e.preventDefault();
      }
      if (e.ctrlKey && e.shiftKey && ["i", "j", "c"].includes(k)) {
        e.preventDefault();
      }
      if (k === "f12") e.preventDefault();
    };

    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("selectstart", block);
    document.addEventListener("keydown", blockKeys);

    document.body.classList.add("no-copy");

    return () => {
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("selectstart", block);
      document.removeEventListener("keydown", blockKeys);
      document.body.classList.remove("no-copy");
    };
  }, [exento, rol]);

  return null;
}
