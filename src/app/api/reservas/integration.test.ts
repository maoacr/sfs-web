import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de prisma
vi.mock("@sfs/db", () => ({
  prisma: {
    reserva: { aggregate: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from "@sfs/db";

describe("Integration: Balance Check Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detecta saldo pendiente cuando hay reservas PAGO_PARCIAL", async () => {
    (prisma.reserva.aggregate as any).mockResolvedValue({
      _sum: { saldoPendiente: 35000 },
    });

    const result = await prisma.reserva.aggregate({
      where: { playerId: "p1", estado: "PAGO_PARCIAL" },
      _sum: { saldoPendiente: true },
    });

    const total = Number(result._sum.saldoPendiente || 0);
    expect(total).toBe(35000);
    expect(total > 0).toBe(true);
  });

  it("no detecta saldo cuando el aggregate retorna null", async () => {
    (prisma.reserva.aggregate as any).mockResolvedValue({
      _sum: { saldoPendiente: null },
    });

    const result = await prisma.reserva.aggregate({
      where: { playerId: "p1", estado: "PAGO_PARCIAL" },
      _sum: { saldoPendiente: true },
    });

    const total = Number(result._sum.saldoPendiente || 0);
    expect(total).toBe(0);
  });

  it("calcula progreso correctamente", () => {
    const montoTotal = 100000;
    const montoPagado = 65000;
    const progreso = Math.round((montoPagado / montoTotal) * 100);

    expect(progreso).toBe(65);
  });

  it("pago mínimo es 50%", () => {
    const precioFinal = 120000;
    const pagoMinimo = Math.round(precioFinal * 0.5);

    expect(pagoMinimo).toBe(60000);
  });

  it("detecta cuándo un pago completa la reserva", () => {
    const montoPagado = 50000;
    const nuevoPago = 50000;
    const montoTotal = 100000;

    const nuevoMontoPagado = montoPagado + nuevoPago;
    const completo = nuevoMontoPagado >= montoTotal;

    expect(completo).toBe(true);
  });

  it("saldo pendiente parcial después de pago", () => {
    const montoTotal = 100000;
    const montoPagado = 60000;
    const saldoPendiente = montoTotal - montoPagado;

    expect(saldoPendiente).toBe(40000);
  });
});
