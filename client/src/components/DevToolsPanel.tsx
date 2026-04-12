import { useState } from "react";
import { Bug, X, ChevronUp } from "lucide-react";
import { trpc } from "@/lib/trpc";

const ROLES = [
  { key: "admin", label: "Admin", color: "bg-red-500" },
  { key: "comercial", label: "Comercial", color: "bg-blue-500" },
  { key: "operacoes", label: "Operações", color: "bg-orange-500" },
  { key: "financeiro", label: "Financeiro", color: "bg-purple-500" },
  { key: "anunciante", label: "Anunciante", color: "bg-emerald-500" },
  { key: "restaurante", label: "Local", color: "bg-teal-500" },
] as const;

interface DevToolsPanelProps {
  currentRole: string;
  overrideRole: string | null;
  overrideClientId: number | null;
  onSetOverride: (role: string | null) => void;
  onSetClientId: (clientId: number | null) => void;
}

export default function DevToolsPanel({ currentRole, overrideRole, overrideClientId, onSetOverride, onSetClientId }: DevToolsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: clientsList = [] } = trpc.advertiser.list.useQuery(undefined, {
    enabled: isOpen && overrideRole === "anunciante",
  });

  if (import.meta.env.PROD) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9998] w-10 h-10 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-lg hover:bg-amber-400 transition-colors"
        title="Dev Tools"
      >
        <Bug className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9998] w-[220px] bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333] bg-[#222]">
        <div className="flex items-center gap-1.5">
          <Bug className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Dev Tools</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsOpen(false)} className="text-[#666] hover:text-white transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div>
          <p className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Visualizar como</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ROLES.map((role) => {
              const isActive = overrideRole === role.key;
              const isReal = !overrideRole && currentRole === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => {
                    if (isActive) {
                      onSetOverride(null);
                      onSetClientId(null);
                    } else {
                      onSetOverride(role.key);
                      if (role.key !== "anunciante") {
                        onSetClientId(null);
                      }
                    }
                  }}
                  className={`text-[10px] px-2 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50"
                      : isReal
                      ? "bg-[#2a2a2a] text-white ring-1 ring-[#444]"
                      : "bg-[#222] text-[#888] hover:bg-[#2a2a2a] hover:text-white"
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${role.color}`} />
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>

        {overrideRole === "anunciante" && (
          <div>
            <p className="text-[9px] text-[#666] uppercase tracking-wider mb-1.5">Anunciante simulado</p>
            <select
              value={overrideClientId ?? ""}
              onChange={(e) => onSetClientId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full text-[10px] px-2 py-1.5 rounded-md bg-[#222] border border-[#444] text-[#ccc] focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            >
              <option value="">Nenhum (sem vínculo)</option>
              {clientsList.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {overrideRole && (
          <button
            onClick={() => { onSetOverride(null); onSetClientId(null); }}
            className="w-full text-[10px] px-2 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
          >
            <X className="w-3 h-3" />
            Resetar para {currentRole}
          </button>
        )}

        <div className="pt-1 border-t border-[#333]">
          <p className="text-[9px] text-[#555]">
            Role real: <span className="text-[#888] font-mono">{currentRole}</span>
            {overrideRole && (
              <> → <span className="text-amber-400 font-mono">{overrideRole}</span></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
