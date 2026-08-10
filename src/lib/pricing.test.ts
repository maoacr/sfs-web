import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@sfs/db", () => ({
  prisma: {
    tarifa: {
      findMany: vi.fn(),
    },
    promocion: {
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@sfs/db";
import { calcularPrecio, usarPromocion } from "@/lib/pricing";

const mockTarifas = (tarifas: any[]) => {
  (prisma.tarifa.findMany as any).mockResolvedValue(tarifas);
};

const mockPromociones = (promos: any[]) => {
  // promociones are included in the tarifas response
};

describe("Pricing Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula precio con tarifa genérica (sin día ni hora)", async () => {
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: 80000,
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: 1.0,
        promociones: [],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.precioBase).toBe(80000);
      expect(result.data.factorAplicado).toBe(1.0);
      expect(result.data.precioFinal).toBe(80000);
      expect(result.data.descuento).toBe(0);
    }
  });

  it("aplica factor por día y horario", async () => {
    // Saturday = 6
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: 80000,
        diaSemana: 6,
        horaInicio: new Date("1970-01-01T18:00:00Z"),
        horaFin: new Date("1970-01-01T23:00:00Z"),
        factor: 1.5,
        promociones: [],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "19:00");
    // 2026-08-15 is a Saturday (day 6)

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.factorAplicado).toBe(1.5);
      expect(result.data.precioFinal).toBe(120000);
    }
  });

  it("elige la tarifa más específica (día + hora sobre genérica)", async () => {
    mockTarifas([
      {
        id: "t-gen",
        canchaId: "c1",
        precioBase: 50000,
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: 1.0,
        promociones: [],
      },
      {
        id: "t-sabado",
        canchaId: "c1",
        precioBase: 100000,
        diaSemana: 6,
        horaInicio: null,
        horaFin: null,
        factor: 1.2,
        promociones: [],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00");
    // Saturday, should pick t-sabado over t-gen

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.precioBase).toBe(100000);
      expect(result.data.factorAplicado).toBe(1.2);
      expect(result.data.precioFinal).toBe(120000);
      expect(result.data.tarifaId).toBe("t-sabado");
    }
  });

  it("aplica promoción con descuento porcentual", async () => {
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: 100000,
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: 1.0,
        promociones: [
          {
            codigo: "VERANO20",
            tipoDescuento: "PORCENTAJE",
            valor: 20,
            validoDesde: new Date("2026-01-01"),
            validoHasta: new Date("2026-12-31"),
            usosMaximos: 100,
            usosActuales: 5,
          },
        ],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00", "VERANO20");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.precioFinal).toBe(80000);
      expect(result.data.descuento).toBe(20000);
      expect(result.data.descuentoTipo).toBe("porcentaje");
      expect(result.data.promocionAplicada).toBe("VERANO20");
    }
  });

  it("rechaza promoción vencida", async () => {
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: 100000,
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: 1.0,
        promociones: [
          {
            codigo: "OLD",
            tipoDescuento: "PORCENTAJE",
            valor: 50,
            validoDesde: new Date("2020-01-01"),
            validoHasta: new Date("2020-12-31"),
            usosMaximos: null,
            usosActuales: 0,
          },
        ],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00", "OLD");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("vigente");
    }
  });

  it("rechaza promoción agotada", async () => {
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: 100000,
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: 1.0,
        promociones: [
          {
            codigo: "FULL",
            tipoDescuento: "PORCENTAJE",
            valor: 50,
            validoDesde: new Date("2026-01-01"),
            validoHasta: new Date("2026-12-31"),
            usosMaximos: 10,
            usosActuales: 10,
          },
        ],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00", "FULL");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("límite");
    }
  });

  it("rechaza sin tarifas disponibles", async () => {
    mockTarifas([]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("tarifas");
    }
  });

  it("usaPromocion incrementa el contador", async () => {
    await usarPromocion("TEST");

    expect(prisma.promocion.updateMany).toHaveBeenCalledWith({
      where: { codigo: "TEST" },
      data: { usosActuales: { increment: 1 } },
    });
  });
});
