"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { QrCode, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export default function WhatsAppQRDialog({ open, onClose, onConnected }: Props) {
  const [status, setStatus] = useState<"connecting" | "qr" | "connected" | "error">("connecting");
  const [qrData, setQrData] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const [error, setError] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Generar QR localmente en vez de enviar token a servidor externo (C6)
  useEffect(() => {
    if (qrData) {
      QRCode.toDataURL(qrData, { width: 256, margin: 2 }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
    } else {
      setQrDataUrl("");
    }
  }, [qrData]);

  useEffect(() => {
    if (!open) {
      stopPolling();
      return;
    }

    setStatus("connecting");
    setQrData("");
    setError("");

    // 1. Trigger connection
    fetch("/api/whatsapp/sesion/connect", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Error al iniciar conexion");
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });

    // 2. Poll status every 2 seconds
    const poll = async () => {
      try {
        const res = await fetch("/api/whatsapp/sesion/estado");
        if (!res.ok) return;
        const data = await res.json();

        if (data.estado === "CONECTADO") {
          setStatus("connected");
          stopPolling();
          setTimeout(() => onConnectedRef.current(), 1500);
        } else if (data.estado === "QR_PENDIENTE" && data.qr_code) {
          setStatus("qr");
          setQrData(data.qr_code);
        } else if (data.estado === "DESCONECTADO") {
          setStatus("error");
          setError("WhatsApp se desconecto. Intenta de nuevo.");
          stopPolling();
        }
      } catch {
        // Ignore polling errors
      }
    };

    // Poll immediately, then every 2s
    poll();
    pollingRef.current = setInterval(poll, 2000);

    return () => stopPolling();
  }, [open, stopPolling]);

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm">
      <DialogHeader onClose={handleClose}>
        <div className="flex flex-col items-center w-full text-center">
          <QrCode className="w-10 h-10 text-[#25D366] mb-2" />
          <span className="text-lg font-bold text-slate-100">Conectar WhatsApp</span>
          <span className="text-sm text-slate-400 font-normal mt-0.5">
            Escanea el codigo QR con tu WhatsApp
          </span>
        </div>
      </DialogHeader>

      <DialogBody className="text-center">
        {status === "connecting" && (
          <div className="py-8 flex flex-col items-center">
            <Spinner size="lg" className="text-[#25D366]" />
            <p className="text-sm text-slate-400 mt-4">
              Generando codigo QR...
            </p>
          </div>
        )}

        {status === "qr" && qrDataUrl && (
          <div className="py-4 flex flex-col items-center">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="w-64 h-64 mx-auto rounded-lg border-4 border-[#25D366]"
            />
            <p className="text-xs text-slate-400 mt-4 block">
              Abre WhatsApp {">"} Dispositivos vinculados {">"} Vincular dispositivo
            </p>
          </div>
        )}

        {status === "connected" && (
          <div className="py-8 flex flex-col items-center">
            <CheckCircle className="w-16 h-16 text-[#25D366]" />
            <p className="text-lg font-semibold text-[#25D366] mt-2">
              Conectado
            </p>
          </div>
        )}

        {status === "error" && (
          <Alert variant="error" className="mt-4">{error || "Error de conexion"}</Alert>
        )}
      </DialogBody>

      <DialogFooter className="justify-center">
        <Button variant="danger" onClick={handleClose}>
          Cancelar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
