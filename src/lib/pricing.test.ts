import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @sfs/db with Drizzle query API
vi.mock("@sfs/db", () => ({
  db: {
    query: {
      tarifas: {
        findMany: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
  tarifas: {
    canchaId: "cancha_id",
  },
  promociones: {
    codigo: "codigo",
    usosActuales: "usos_actuales",
  },
  eq: vi.fn(),
  sql: vi.fn(),
}));

import { db } from "@sfs/db";
import { calcularPrecio, usarPromocion } from "@/lib/pricing";

const mockTarifas = (tarifas: any[]) => {
  (db.query.tarifas.findMany as any).mockResolvedValue(tarifas);
};

describe("Pricing Engine (Drizzle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula precio con tarifa genérica (sin día ni hora)", async () => {
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: "80000.00",
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: "1.00",
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
    mockTarifas([
      {
        id: "t1",
        canchaId: "c1",
        precioBase: "80000.00",
        diaSemana: 6,
        horaInicio: "18:00:00",
        horaFin: "23:00:00",
        factor: "1.50",
        promociones: [],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "19:00");

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
        precioBase: "50000.00",
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: "1.00",
        promociones: [],
      },
      {
        id: "t-sabado",
        canchaId: "c1",
        precioBase: "100000.00",
        diaSemana: 6,
        horaInicio: null,
        horaFin: null,
        factor: "1.20",
        promociones: [],
      },
    ]);

    const result = await calcularPrecio("c1", "2026-08-15", "10:00");

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
        precioBase: "100000.00",
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: "1.00",
        promociones: [
          {
            codigo: "VERANO20",
            tipoDescuento: "PORCENTAJE",
            valor: "20.00",
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
        precioBase: "100000.00",
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: "1.00",
        promociones: [
          {
            codigo: "OLD",
            tipoDescuento: "PORCENTAJE",
            valor: "50.00",
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
        precioBase: "100000.00",
        diaSemana: null,
        horaInicio: null,
        horaFin: null,
        factor: "1.00",
        promociones: [
          {
            codigo: "FULL",
            tipoDescuento: "PORCENTAJE",
            valor: "50.00",
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

  it("usaPromocion actualiza el contador", async () => {
    await usarPromocion("TEST");
    expect(db.update).toHaveBeenCalled();
  });
});
