import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/owner/dashboard" }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));

import { AppSidebar } from "@/components/app-sidebar";

const NAV = [{ label: "Dashboard", href: "/owner/dashboard", icon: "📊" }];

const MARIO = { nombre: "Mario Alejandro Crespo", iniciales: "MC", avatarUrl: null };

describe("AppSidebar — identidad del usuario", () => {
  it("muestra el nombre del usuario, no un texto genérico", () => {
    render(<AppSidebar role="OWNER" nav={NAV} usuario={MARIO} />);

    expect(screen.getByText("Mario Alejandro Crespo")).toBeInTheDocument();
    expect(screen.queryByText("Mi cuenta")).not.toBeInTheDocument();
  });

  it("muestra las iniciales reales y no la letra del rol", () => {
    render(<AppSidebar role="OWNER" nav={NAV} usuario={MARIO} />);

    expect(screen.getByText("MC")).toBeInTheDocument();
    expect(screen.queryByText("D")).not.toBeInTheDocument();
  });

  it("muestra la foto de perfil cuando el usuario tiene una", () => {
    render(
      <AppSidebar
        role="OWNER"
        nav={NAV}
        usuario={{ ...MARIO, avatarUrl: "https://cdn.sfs.test/firmada?token=abc" }}
      />
    );

    const foto = screen.getByRole("img", { name: /mario alejandro crespo/i });
    expect(foto).toHaveAttribute("src", "https://cdn.sfs.test/firmada?token=abc");
    expect(screen.queryByText("MC")).not.toBeInTheDocument();
  });

  it("sigue mostrando el rol debajo del nombre", () => {
    render(<AppSidebar role="PLAYER" nav={NAV} usuario={MARIO} />);

    expect(screen.getByText("Jugador")).toBeInTheDocument();
  });

  it("no se rompe si no se pudo resolver la sesión", () => {
    render(<AppSidebar role="OWNER" nav={NAV} usuario={null} />);

    // Degrada a lo genérico en vez de tumbar el layout entero.
    expect(screen.getByText("Mi cuenta")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
