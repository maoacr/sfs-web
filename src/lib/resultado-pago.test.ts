import { describe, it, expect } from "vitest";
import { explicarPago, explicarVueltaDeMp } from "@/lib/resultado-pago";

describe("explicarPago — rechazos de tarjeta", () => {
  it("dice qué dato revisar cuando el rechazo es por datos mal cargados", () => {
    expect(explicarPago("rejected", "cc_rejected_bad_filled_security_code").mensaje)
      .toMatch(/código de seguridad/i);
    expect(explicarPago("rejected", "cc_rejected_bad_filled_date").mensaje)
      .toMatch(/vencimiento/i);
    expect(explicarPago("rejected", "cc_rejected_bad_filled_card_number").mensaje)
      .toMatch(/número/i);
  });

  it("por fondos insuficientes sugiere otra tarjeta, no reintentar la misma", () => {
    const r = explicarPago("rejected", "cc_rejected_insufficient_amount");
    expect(r.mensaje).toMatch(/fondos/i);
    expect(r.mensaje).toMatch(/otra/i);
    expect(r.reintentable).toBe(true);
  });

  it("manda a llamar al banco cuando el banco pide autorización", () => {
    expect(explicarPago("rejected", "cc_rejected_call_for_authorize").mensaje)
      .toMatch(/banco/i);
  });

  it("ante un pago duplicado NO invita a reintentar: cobrarían dos veces", () => {
    const r = explicarPago("rejected", "cc_rejected_duplicated_payment");
    expect(r.reintentable).toBe(false);
    expect(r.mensaje).toMatch(/ya/i);
  });

  it("no le cuenta al jugador que quedó en una lista negra", () => {
    const r = explicarPago("rejected", "cc_rejected_blacklist");
    expect(r.mensaje).not.toMatch(/negra|blacklist|fraude/i);
    expect(r.reintentable).toBe(true);
  });
});

describe("explicarPago — pendientes", () => {
  it("un pago en revisión manual avisa que puede demorar y no invita a reintentar", () => {
    const r = explicarPago("in_process", "pending_review_manual");
    expect(r.reintentable).toBe(false);
    expect(r.mensaje).toMatch(/revis|demor/i);
  });

  it("si falta que la persona complete la transferencia, se lo dice", () => {
    expect(explicarPago("pending", "pending_waiting_transfer").mensaje)
      .toMatch(/transferencia/i);
  });

  it("nunca sugiere reintentar algo que ya está en curso", () => {
    for (const detalle of ["pending_contingency", "offline_process", "pending_capture"]) {
      expect(explicarPago("in_process", detalle).reintentable).toBe(false);
    }
  });
});

describe("explicarPago — aprobados", () => {
  it("confirma el pago acreditado", () => {
    const r = explicarPago("approved", "accredited");
    expect(r.mensaje).toMatch(/acredit|aprob/i);
    expect(r.reintentable).toBe(false);
  });
});

describe("explicarPago — lo que no conocemos", () => {
  it("un status_detail nuevo de MP cae en el mensaje genérico de su status", () => {
    const r = explicarPago("rejected", "cc_rejected_algo_que_mp_invente_manana");
    expect(r.mensaje).toBeTruthy();
    expect(r.mensaje).toMatch(/rechaz/i);
    expect(r.reintentable).toBe(true);
  });

  it("un status desconocido no rompe ni miente", () => {
    const r = explicarPago("un_status_nuevo", "un_detalle_nuevo");
    expect(r.mensaje).toBeTruthy();
    expect(r.mensaje).not.toMatch(/aprobad|acreditad/i);
  });

  it("sin datos devuelve algo mostrable", () => {
    const r = explicarPago(undefined, undefined);
    expect(r.mensaje).toBeTruthy();
  });

  it("nunca devuelve un mensaje vacío, venga lo que venga", () => {
    const casos = ["", "rejected", "approved", "pending", "cancelled", "refunded", "charged_back"];
    for (const status of casos) {
      expect(explicarPago(status, "").mensaje.length).toBeGreaterThan(0);
    }
  });
});

describe("explicarVueltaDeMp — el `status` de la redirección", () => {
  it("entiende el vocabulario de la API", () => {
    expect(explicarVueltaDeMp("approved")?.mensaje).toMatch(/acredit/i);
    expect(explicarVueltaDeMp("rejected")?.mensaje).toMatch(/rechaz/i);
    expect(explicarVueltaDeMp("pending")?.mensaje).toBeTruthy();
  });

  it("entiende también el de las back_urls, que no es el mismo", () => {
    // La doc de MP usa `failure`/`success` para las back_urls y
    // `rejected`/`approved` para la API. Son el mismo hecho con dos nombres.
    expect(explicarVueltaDeMp("failure")?.mensaje).toMatch(/rechaz/i);
    expect(explicarVueltaDeMp("success")?.mensaje).toMatch(/acredit/i);
  });

  it("no inventa un aviso cuando no hay status", () => {
    expect(explicarVueltaDeMp(null)).toBeNull();
    expect(explicarVueltaDeMp("")).toBeNull();
  });

  it("calla ante un status que no entiende, en vez de alarmar", () => {
    // Volver del checkout sin pagar manda `status=null`. Avisar
    // "no pudimos confirmar el pago" por un no-evento asusta sin motivo:
    // la tarjeta ya muestra la verdad que vino de la base.
    expect(explicarVueltaDeMp("null")).toBeNull();
    expect(explicarVueltaDeMp("algo_que_mp_invente")).toBeNull();
  });
});
