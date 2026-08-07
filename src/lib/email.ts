import { Resend } from "resend";

interface ReservaEvent {
  tipo: string;
  reservaId: string;
  canchaNombre: string;
  complejoNombre: string;
  slotInicio: Date;
  slotFin: Date;
  playerId: string;
  playerNombre: string;
  playerEmail: string;
  tenantId: string;
  tenantEmail: string;
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "SFS <notificaciones@maoacr.com>";

function fH(iso: Date) {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function fD(iso: Date) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long" });
}

// ─── Templates ──────────────────────────────────────────────────────────────

const templates: Record<
  string,
  (e: ReservaEvent) => { subject: string; html: string } | null
> = {
  RESERVA_CREADA: (e) => ({
    subject: `⚽ Reserva pendiente — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>¡Reserva creada!</h2>
      <p>Tu reserva en <strong>${e.complejoNombre}</strong> está pendiente de pago.</p>
      <table style="margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Cancha</td><td>${e.canchaNombre}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Fecha</td><td>${fD(e.slotInicio)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Horario</td><td>${fH(e.slotInicio)} – ${fH(e.slotFin)}</td></tr>
      </table>
      <p style="color:#71717a;font-size:14px">Tenés 15 minutos para completar el pago.</p>
    `,
  }),

  RESERVA_CONFIRMADA: (e) => ({
    subject: `✅ Reserva confirmada — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>¡Reserva confirmada!</h2>
      <p>Tu reserva en <strong>${e.complejoNombre}</strong> fue confirmada.</p>
      <table style="margin:16px 0;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Cancha</td><td>${e.canchaNombre}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Fecha</td><td>${fD(e.slotInicio)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#71717a">Horario</td><td>${fH(e.slotInicio)} – ${fH(e.slotFin)}</td></tr>
      </table>
      <p style="color:#71717a;font-size:14px">Presentate en el complejo 10 minutos antes. ¡Buen partido!</p>
    `,
  }),

  RESERVA_CANCELADA: (e) => ({
    subject: `❌ Reserva cancelada — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>Reserva cancelada</h2>
      <p>Tu reserva en <strong>${e.complejoNombre}</strong> fue cancelada.</p>
      <p style="color:#71717a;font-size:14px">El slot fue liberado. Podés reservar otro horario cuando quieras.</p>
    `,
  }),

  RESERVA_COMPLETADA: (e) => ({
    subject: `🏆 ¿Cómo estuvo? — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>¡Partido completado!</h2>
      <p>Esperamos que hayas disfrutado tu partido en <strong>${e.complejoNombre}</strong>.</p>
      <p style="color:#71717a;font-size:14px">¿Querés reservar de nuevo? Entrá a SFS y buscá tu próximo horario.</p>
    `,
  }),

  RESERVA_EXPIRADA: (e) => ({
    subject: `⏰ Reserva expirada — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>Tu reserva expiró</h2>
      <p>No se completó el pago a tiempo para tu reserva en <strong>${e.complejoNombre}</strong>.</p>
      <p style="color:#71717a;font-size:14px">El slot fue liberado. Podés buscar otro horario en SFS.</p>
    `,
  }),
};

// ─── Owner templates ────────────────────────────────────────────────────────

const ownerTemplates: Record<
  string,
  (e: ReservaEvent) => { subject: string; html: string } | null
> = {
  RESERVA_CREADA: () => null, // Owner solo recibe email cuando el pago se confirma

  RESERVA_CONFIRMADA: (e) => ({
    subject: `✅ Pago recibido — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>Pago confirmado</h2>
      <p><strong>${e.playerNombre}</strong> pagó su reserva en ${e.canchaNombre}.</p>
      <p style="color:#71717a;font-size:14px">La reserva está confirmada para el ${fD(e.slotInicio)} de ${fH(e.slotInicio)} a ${fH(e.slotFin)}.</p>
    `,
  }),

  RESERVA_CANCELADA: (e) => ({
    subject: `❌ Cancelación — ${e.canchaNombre} ${fD(e.slotInicio)}`,
    html: `
      <h2>Reserva cancelada</h2>
      <p><strong>${e.playerNombre}</strong> canceló su reserva en ${e.canchaNombre}.</p>
      <p style="color:#71717a;font-size:14px">El slot del ${fD(e.slotInicio)} de ${fH(e.slotInicio)} a ${fH(e.slotFin)} quedó liberado.</p>
    `,
  }),
};

// ─── Send ───────────────────────────────────────────────────────────────────

export async function enviarEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log("[EMAIL] Resend no configurado — skip:", subject);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[EMAIL] Error enviando:", subject, err);
  }
}

// ─── React to events ────────────────────────────────────────────────────────

export async function notificarPorEmail(event: ReservaEvent) {
  // Email al jugador
  const tpl = templates[event.tipo];
  if (tpl) {
    const email = tpl(event);
    if (email && event.playerEmail) {
      await enviarEmail(event.playerEmail, email.subject, email.html);
    }
  }

  // Email al dueño
  const ownerTpl = ownerTemplates[event.tipo];
  if (ownerTpl) {
    const email = ownerTpl(event);
    if (email && event.tenantEmail) {
      await enviarEmail(event.tenantEmail, email.subject, email.html);
    }
  }
}
