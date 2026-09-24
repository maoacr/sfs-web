import { describe, it, expect } from "vitest";
import {
  usuarios,
  complejos,
  canchas,
  slotConfigs,
  tarifas,
  reservas,
  pagos,
  promociones,
  notificaciones,
  partidos,
  equipos,
  rolUsuarioEnum,
  tipoCanchaEnum,
  estadoReservaEnum,
} from "@sfs/db";

describe("Capa de Persistencia — Drizzle Schema Integrity", () => {
  it("exporta correctamente los enums de dominio", () => {
    expect(rolUsuarioEnum.enumValues).toEqual(["OWNER", "PLAYER", "ADMIN"]);
    expect(tipoCanchaEnum.enumValues).toContain("FUTBOL_5");
    expect(tipoCanchaEnum.enumValues).toContain("FUTBOL_11");
    expect(estadoReservaEnum.enumValues).toContain("PENDIENTE_PAGO");
    expect(estadoReservaEnum.enumValues).toContain("CONFIRMADA");
  });

  it("exporta todas las tablas principales con sus nombres mapeados", () => {
    expect(usuarios).toBeDefined();
    expect(complejos).toBeDefined();
    expect(canchas).toBeDefined();
    expect(slotConfigs).toBeDefined();
    expect(tarifas).toBeDefined();
    expect(reservas).toBeDefined();
    expect(pagos).toBeDefined();
    expect(promociones).toBeDefined();
    expect(notificaciones).toBeDefined();
    expect(partidos).toBeDefined();
    expect(equipos).toBeDefined();
  });
});
