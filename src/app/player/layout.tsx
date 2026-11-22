import { AppSidebar } from "@/components/app-sidebar";
import { usuarioDeSesion } from "@/lib/usuario-de-sesion";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  { label: "Buscar", href: "/player/buscar", icon: "🔍" },
  { label: "Mis reservas", href: "/player/reservas", icon: "📅" },
];

const OVERFLOW = [
  { label: "Perfil", href: "/player/perfil", icon: "👤" },
];

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioDeSesion();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar usuario={usuario} role="PLAYER" nav={[...NAV, { label: "Perfil", href: "/player/perfil", icon: "👤" }]} />
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        <div className="md:hidden absolute top-0 right-0 z-30 p-4">
          <NotificationBell />
        </div>
        <div className="flex-1">{children}</div>
        <BottomTabBar usuario={usuario} role="PLAYER" tabs={NAV} overflow={OVERFLOW} />
      </main>
    </div>
  );
}
