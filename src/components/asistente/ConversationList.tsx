"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@/components/ui/Dialog";

interface Conversacion {
  id: number;
  titulo: string | null;
  updated_at: string;
  _count: { mensajes: number };
}

interface ConversationListProps {
  conversaciones: Conversacion[];
  activeId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
}

export default function ConversationList({
  conversaciones, activeId, loading, onSelect, onNew, onDelete,
}: ConversationListProps) {
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const handleConfirmDelete = () => {
    if (deleteTarget !== null) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">
          Conversaciones
        </span>
        <button
          onClick={onNew}
          title="Nueva conversacion"
          className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-slate-800/50 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="h-px bg-slate-800/60" />
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : conversaciones.length === 0 ? (
          <p className="text-sm text-slate-500 p-4 text-center">
            Sin conversaciones aun
          </p>
        ) : (
          <ul className="py-1">
            {conversaciones.map((conv) => (
              <li key={conv.id}>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2.5 text-left
                    transition-colors group
                    ${conv.id === activeId
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-slate-400 hover:bg-surface-hover hover:text-slate-200"
                    }
                  `.trim()}
                >
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm truncate">
                      {conv.titulo || "Sin titulo"}
                    </span>
                    <span className="block text-[11px] text-slate-600">
                      {conv._count.mensajes} msgs
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv.id); }}
                    className="p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-slate-400 hover:text-red-400 rounded transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Dialog de confirmacion para eliminar */}
      <Dialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        maxWidth="sm"
      >
        <DialogHeader onClose={() => setDeleteTarget(null)}>
          Eliminar conversacion
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-slate-400">
            Esta accion eliminara la conversacion y todo su historial de mensajes. Esta accion no se puede deshacer.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            Eliminar
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
