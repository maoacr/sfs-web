import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/owner/dashboard",
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetch: vi.fn() }));

import { BottomTabBar } from "@/components/bottom-tab-bar";

const TABS = [{ label: "Dashboard", href: "/owner/dashboard", icon: "📊" }];
const OVERFLOW = [{ label: "Reportes", href: "/owner/reportes", icon: "📈" }];

const MARIO = { nombre: "Mario Alejandro Crespo", iniciales: "MC", avatarUrl: null };

function abrirMenu() {
  fireEvent.click(screen.getByRole("button", { name: /más/i }));
}

describe("BottomTabBar — avatar en el menú de perfil", () => {
  it("muestra la foto del usuario en 'Mi perfil' cuando tiene una", () => {
    render(
      <BottomTabBar
        role="OWNER"
        tabs={TABS}
        overflow={OVERFLOW}
        usuario={{ ...MARIO, avatarUrl: "https://cdn.sfs.test/firmada?token=abc" }}
      />
    );
    abrirMenu();

    const foto = screen.getByRole("img", { name: /mario alejandro crespo/i });
    expect(foto).toHaveAttribute("src", "https://cdn.sfs.test/firmada?token=abc");
  });

  it("cae en las iniciales reales cuando no hay foto", () => {
    render(<BottomTabBar role="OWNER" tabs={TABS} overflow={OVERFLOW} usuario={MARIO} />);
    abrirMenu();

    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("sigue navegando al perfil al tocarlo", () => {
    render(<BottomTabBar role="OWNER" tabs={TABS} overflow={OVERFLOW} usuario={MARIO} />);
    abrirMenu();

    fireEvent.click(screen.getByRole("button", { name: /mi perfil/i }));

    expect(mocks.push).toHaveBeenCalledWith("/owner/perfil");
  });

  it("no se rompe si no se pudo resolver la sesión", () => {
    render(<BottomTabBar role="OWNER" tabs={TABS} overflow={OVERFLOW} usuario={null} />);
    abrirMenu();

    expect(screen.getByRole("button", { name: /mi perfil/i })).toBeInTheDocument();
  });
});
