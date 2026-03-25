"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard, Users, Settings, ClipboardList, ClipboardCheck, Building2,
  Map, Building, UsersRound, Briefcase, Filter, TrendingUp,
  Inbox, Scale, ArrowLeftRight, ChevronLeft, Menu, BarChart3, Search, History, Share2,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { ReactNode } from "react";

// WhatsApp SVG icon (brand icon - not in Lucide)
function WhatsAppIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const DRAWER_WIDTH = 256; // w-64
const DRAWER_COLLAPSED = 72; // w-[72px]

interface SidebarProps {
  rol: string;
  open: boolean;
  onToggle: () => void;
}

export default function Sidebar({ rol, open, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const isOperaciones = rol === "operaciones";
  const isSupervisor = rol === "supervisor";
  const isAsesorDigital = rol === "asesor_digital";
  const isGerente = rol === "gerente_regional" || rol === "gerente_sucursal";
  const isAnalista = rol === "analista";
  const isPromotor = !isOperaciones && !isSupervisor && !isAsesorDigital && !isGerente && !isAnalista && rol !== "admin";

  return (
    <>
      {/* Mini-rail: always visible */}
      <aside
        className="fixed left-0 top-0 h-full bg-sidebar text-white flex flex-col z-50
                   shadow-2xl shadow-black/40 border-r border-slate-800/50
                   w-[72px] transition-all duration-300"
      >
        <SidebarContent
          showLabels={false}
          pathname={pathname}
          rol={rol}
          isOperaciones={isOperaciones}
          isSupervisor={isSupervisor}
          isAsesorDigital={isAsesorDigital}
          isGerente={isGerente}
          isAnalista={isAnalista}
          isPromotor={isPromotor}
          onToggle={onToggle}
        />
      </aside>

      {/* Expanded overlay */}
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onToggle}
          />
          <aside
            className="fixed left-0 top-0 h-full bg-sidebar text-white flex flex-col z-50
                       shadow-2xl shadow-black/40 border-r border-slate-800/50
                       w-64 animate-slide-in-left"
          >
            <SidebarContent
              showLabels={true}
              pathname={pathname}
              rol={rol}
              isOperaciones={isOperaciones}
              isSupervisor={isSupervisor}
              isAsesorDigital={isAsesorDigital}
              isGerente={isGerente}
              isAnalista={isAnalista}
              isPromotor={isPromotor}
              onToggle={onToggle}
            />
          </aside>
        </>
      )}
    </>
  );
}

function SidebarContent({
  showLabels,
  pathname,
  rol,
  isOperaciones,
  isSupervisor,
  isAsesorDigital,
  isGerente,
  isAnalista,
  isPromotor,
  onToggle,
}: {
  showLabels: boolean;
  pathname: string;
  rol: string;
  isOperaciones: boolean;
  isSupervisor: boolean;
  isAsesorDigital: boolean;
  isGerente: boolean;
  isAnalista: boolean;
  isPromotor: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className={`flex items-center min-h-[64px] border-b border-slate-800/50 ${showLabels ? "justify-between px-4" : "justify-center"}`}>
        {showLabels ? (
          <>
            <div className="flex items-center gap-2">
              <Image
                src="/logo-talento-morado.png"
                alt="Talento Morado"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-sm font-bold text-slate-100 whitespace-nowrap">Asignador</span>
            </div>
            <button onClick={onToggle} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800/50">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button onClick={onToggle} className="p-0.5 hover:opacity-80 transition-opacity rounded-lg">
            <Image
              src="/logo-talento-morado.png"
              alt="Talento Morado"
              width={32}
              height={32}
              className="rounded-lg"
            />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto py-2 ${showLabels ? "px-2" : "px-1"}`}>
        {isOperaciones ? (
          <NavItem label="Portabilidad" href="/operaciones/portabilidad" icon={<ArrowLeftRight className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
        ) : isSupervisor ? (
          <>
            <NavItem label="Dashboard" href="/supervisor" icon={<LayoutDashboard className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Bandeja" href="/supervisor/bandeja" icon={<Inbox className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
            <NavItem label="Solicitar Datos" href="/supervisor/asignaciones" icon={<ClipboardList className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
            <NavItem label="Calificar" href="/supervisor/calificar" icon={<ClipboardCheck className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
            <NavItem label="Mi Plantilla" href="/supervisor/plantilla" icon={<Users className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Busqueda" href="/supervisor/busqueda" icon={<Search className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="WhatsApp" href="/supervisor/whatsapp" icon={<WhatsAppIcon />} pathname={pathname} showLabels={showLabels} exact />
          </>
        ) : isAsesorDigital ? (
          <>
            <NavItem label="Mis Registros" href="/asesor-digital" icon={<TrendingUp className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Redes Sociales" href="/asesor-digital/redes-sociales" icon={<Share2 className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
          </>
        ) : isGerente ? (
          <>
            <NavItem label="Dashboard" href="/gerente" icon={<LayoutDashboard className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Promotores" href="/gerente/promotores" icon={<Users className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Embudo" href="/gerente/embudo" icon={<Filter className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Actividad" href="/gerente/actividad" icon={<BarChart3 className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <div className="h-px bg-slate-800/50 my-2" />
            {showLabels && (
              <p className="px-3 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                Mensajería
              </p>
            )}
            <NavItem label="WhatsApp" href="/gerente/whatsapp" icon={<WhatsAppIcon />} pathname={pathname} showLabels={showLabels} exact />
            <div className="h-px bg-slate-800/50 my-2" />
            <NavItem label="Pool Calificados" href="/gerente/pool-calificados" icon={<ClipboardList className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Comparativa" href="/gerente/comparativa" icon={<TrendingUp className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
          </>
        ) : isAnalista ? (
          <>
            <NavItem label="Mi Lote" href="/analista" icon={<ClipboardList className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
          </>
        ) : isPromotor ? (
          <>
            <NavItem label="Mi Asignación" href="/promotor/oportunidades" icon={<TrendingUp className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
            <NavItem label="Busqueda" href="/promotor/busqueda" icon={<Search className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="WhatsApp" href="/promotor/whatsapp" icon={<WhatsAppIcon />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Analítica WA" href="/promotor/whatsapp/analitica" icon={<BarChart3 className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Configuración" href="/promotor/configuracion" icon={<Settings className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
          </>
        ) : (
          <>
            <NavItem label="Dashboard" href="/admin" icon={<LayoutDashboard className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Bandeja" href="/admin/bandeja" icon={<Inbox className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} />
            <NavItem label="Usuarios" href="/admin/usuarios" icon={<Users className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Embudo" href="/admin/embudo" icon={<Filter className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Convenio Reglas" href="/admin/convenio-reglas" icon={<Scale className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />

            {/* Divider + Section */}
            <div className="h-px bg-slate-800/50 my-2" />
            {showLabels && (
              <p className="px-3 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                Organización
              </p>
            )}
            <NavItem label="Regiones" href="/admin/organizacion/regiones" icon={<Map className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} indent />
            <NavItem label="Zonas" href="/admin/organizacion/zonas" icon={<Building2 className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} indent />
            <NavItem label="Sucursales" href="/admin/organizacion/sucursales" icon={<Building className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} indent />
            <NavItem label="Equipos" href="/admin/organizacion/equipos" icon={<UsersRound className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} indent />

            <div className="h-px bg-slate-800/50 my-2" />
            {showLabels && (
              <p className="px-3 py-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                Mensajería
              </p>
            )}
            <NavItem label="WhatsApp" href="/admin/whatsapp" icon={<WhatsAppIcon />} pathname={pathname} showLabels={showLabels} exact />

            <div className="h-px bg-slate-800/50 my-2" />
            <NavItem label="Planes de Trabajo" href="/admin/planes-trabajo" icon={<Briefcase className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Hist. Busquedas" href="/admin/busquedas" icon={<History className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
            <NavItem label="Configuración" href="/admin/configuracion" icon={<Settings className="w-5 h-5" />} pathname={pathname} showLabels={showLabels} exact />
          </>
        )}
      </nav>
    </>
  );
}

function NavItem({
  label,
  href,
  icon,
  pathname,
  exact = false,
  indent = false,
  showLabels,
}: {
  label: string;
  href: string;
  icon: ReactNode;
  pathname: string;
  exact?: boolean;
  indent?: boolean;
  showLabels: boolean;
}) {
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  const linkContent = (
    <Link
      href={href}
      className={`
        relative flex items-center gap-3 rounded-lg text-sm mb-0.5
        transition-all duration-150
        ${showLabels ? "px-3 py-2.5" : "justify-center px-2 py-2.5"}
        ${indent && showLabels ? "pl-6" : ""}
        ${
          isActive
            ? "bg-amber-500/10 text-amber-400"
            : "text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
        }
      `.trim()}
    >
      <span className={showLabels ? "" : ""}>{icon}</span>
      {showLabels && <span className="whitespace-nowrap">{label}</span>}
      {isActive && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-500 rounded-l" />
      )}
    </Link>
  );

  if (!showLabels) {
    return <Tooltip content={label} position="right">{linkContent}</Tooltip>;
  }

  return linkContent;
}

export { DRAWER_WIDTH, DRAWER_COLLAPSED };
