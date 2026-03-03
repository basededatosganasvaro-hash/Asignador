"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export default function CambiarPasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const esObligatorio = session?.user?.debe_cambiar_password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (passwordNueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (passwordNueva !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password_actual: esObligatorio ? undefined : passwordActual,
          password_nueva: passwordNueva,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al cambiar la contraseña");
        return;
      }

      setSuccess(true);
      await update();
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1500);
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="bg-surface rounded-xl border border-slate-800/60 max-w-[420px] w-full mx-4 p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-amber-500/20">
            <KeyRound className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-100">
            Cambiar Contraseña
          </h1>
          {esObligatorio && (
            <Alert variant="warning" className="mt-3">
              Debes cambiar tu contraseña antes de continuar.
            </Alert>
          )}
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" className="mb-4">
            Contraseña actualizada. Redirigiendo...
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!esObligatorio && (
            <Input
              label="Contraseña actual"
              type="password"
              value={passwordActual}
              onChange={(e) => setPasswordActual(e.target.value)}
              required
              autoComplete="current-password"
            />
          )}
          <Input
            label="Nueva contraseña"
            type="password"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
            helperText="Mínimo 6 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={loading}
            disabled={success}
            className="mt-6"
          >
            Cambiar Contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
