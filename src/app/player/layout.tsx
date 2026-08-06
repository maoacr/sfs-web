import { AppSidebar } from "@/components/app-sidebar";
import { BottomTabBar } from "@/components/bottom-tab-bar";

const NAV = [
  { label: "Buscar", href: "/player/buscar", icon: "🔍" },
  { label: "Mis reservas", href: "/player/reservas", icon: "📅" },
];

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar role="PLAYER" nav={[...NAV, { label: "Perfil", href: "/player/perfil", icon: "👤" }]} />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1">{children}</div>
        <BottomTabBar role="PLAYER" tabs={NAV} />
      </main>
    </div>
  );
}
