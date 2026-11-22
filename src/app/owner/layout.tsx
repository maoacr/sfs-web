import { AppSidebar } from "@/components/app-sidebar";
import { usuarioDeSesion } from "@/lib/usuario-de-sesion";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  { label: "Dashboard", href: "/owner/dashboard", icon: "📊" },
  { label: "Complejos", href: "/owner/complejos", icon: "🏟️" },
  { label: "Reservas", href: "/owner/reservas", icon: "📅" },
  { label: "Cobros", href: "/owner/cobros", icon: "💵" },
  { label: "Reportes", href: "/owner/reportes", icon: "📈" },
  { label: "Clientes", href: "/owner/clientes", icon: "👥" },
];

const MAIN_TABS = NAV.slice(0, 3);
const OVERFLOW = NAV.slice(3);

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioDeSesion();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar usuario={usuario} role="OWNER" nav={NAV} />
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        {/* Mobile header: solo campanita */}
        <div className="md:hidden absolute top-0 right-0 z-30 p-4">
          <NotificationBell />
        </div>
        {/* Desktop: campanita en sidebar ya incluida */}
        <div className="flex-1">{children}</div>
        <BottomTabBar usuario={usuario} role="OWNER" tabs={MAIN_TABS} overflow={OVERFLOW} />
      </main>
    </div>
  );
}
