import { AppSidebar } from "@/components/app-sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { NotificationBell } from "@/components/notification-bell";

const NAV = [
  { label: "Buscar", href: "/player/buscar", icon: "🔍" },
  { label: "Mis reservas", href: "/player/reservas", icon: "📅" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar role="PLAYER" nav={[...NAV, { label: "Perfil", href: "/player/perfil", icon: "👤" }]} />
      <main className="flex-1 overflow-y-auto flex flex-col relative">
        <div className="md:hidden absolute top-0 right-0 z-30 p-4">
          <NotificationBell />
        </div>
        <div className="flex-1">{children}</div>
        <BottomTabBar role="PLAYER" tabs={NAV} />
      </main>
    </div>
  );
}
