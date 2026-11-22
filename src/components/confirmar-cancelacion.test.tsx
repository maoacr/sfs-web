import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmarCancelacion, type ReservaACancelar } from "@/components/confirmar-cancelacion";

const RESERVA: ReservaACancelar = {
  titular: "Juan Pérez",
  cancha: "Cancha 1",
  horario: "19:00",
  montoPagado: 0,
};

function montar(over: Partial<ReservaACancelar> = {}) {
  const onConfirmar = vi.fn();
  const onCerrar = vi.fn();
  render(
    <ConfirmarCancelacion
      reserva={{ ...RESERVA, ...over }}
      onCerrar={onCerrar}
      onConfirmar={onConfirmar}
    />
  );
  return { onConfirmar, onCerrar };
}

describe("ConfirmarCancelacion", () => {
  it("dice sobre qué reserva está preguntando", () => {
    montar();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/cancha 1/i)).toBeInTheDocument();
    expect(screen.getByText(/juan pérez/i)).toBeInTheDocument();
    expect(screen.getByText(/19:00/)).toBeInTheDocument();
  });

  it("avisa que hay plata de por medio, porque dispara el reembolso", () => {
    montar({ montoPagado: 80000 });

    expect(screen.getByText(/80\.000/)).toBeInTheDocument();
    expect(screen.getByText(/política de reembolso/i)).toBeInTheDocument();
  });

  it("sin plata pagada no menciona reembolsos que no van a pasar", () => {
    montar();

    expect(screen.queryByText(/política de reembolso/i)).not.toBeInTheDocument();
  });

  it("confirmar es una decisión explícita, no el botón cómodo", () => {
    const { onConfirmar } = montar();

    fireEvent.click(screen.getByRole("button", { name: /sí, cancelar/i }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it("se puede salir sin cancelar nada", () => {
    const { onCerrar, onConfirmar } = montar();

    fireEvent.click(screen.getByRole("button", { name: /no, dejarla/i }));

    expect(onCerrar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });
});
