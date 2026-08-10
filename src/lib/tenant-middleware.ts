import { Prisma } from "@prisma/client";

/**
 * Tenant isolation via Prisma $extends.
 *
 * Cada query a modelos multi-tenant se filtra automáticamente por tenantId.
 * El tenantId se inyecta desde el context vía AsyncLocalStorage.
 */

const MULTI_TENANT_MODELS = new Set([
  "Cancha",
  "Complejo",
  "Reserva",
  "ComplejoImagen",
  "ImagenCancha",
  "SlotConfig",
  "Tarifa",
  "Promocion",
]);

// ─── Tenant Context ──────────────────────────────────────────────────────────

import { AsyncLocalStorage } from "async_hooks";

const tenantStorage = new AsyncLocalStorage<string>();

export function setTenantContext(tenantId: string | null) {
  if (tenantId) {
    tenantStorage.enterWith(tenantId);
  }
}

export function getTenantContext(): string | undefined {
  return tenantStorage.getStore();
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const isMultiTenant = (model?: string): model is string =>
  !!model && MULTI_TENANT_MODELS.has(model);

function injectTenant(tenantId: string | undefined, model: unknown, data: Record<string, unknown>) {
  if (tenantId && isMultiTenant(model as string) && !data.tenantId) {
    data.tenantId = tenantId;
  }
}

// ─── Extension ───────────────────────────────────────────────────────────────

export const tenantExtension = Prisma.defineExtension({
  name: "tenant-isolation",
  query: {
    $allModels: {
      async create({ args, query }: { args: any; query: any }) {
        const tid = tenantStorage.getStore();
        injectTenant(tid, args.model, args.data);
        return query(args);
      },

      async createMany({ args, query }: { args: any; query: any }) {
        const tid = tenantStorage.getStore();
        if (tid && isMultiTenant(args.model)) {
          for (const d of args.data || []) {
            if (!d.tenantId) d.tenantId = tid;
          }
        }
        return query(args);
      },

      async findMany({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async findFirst({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async findUnique({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async count({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async update({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async updateMany({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async delete({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async deleteMany({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
      async upsert({ args, query }: { args: any; query: any }) {
        return query(filterArgs(args));
      },
    },
  },
});

function filterArgs(args: any): any {
  const tid = tenantStorage.getStore();
  if (!tid || !isMultiTenant(args.model)) return args;

  if (!args.where) args.where = {};
  if (!("tenantId" in args.where)) {
    args.where.tenantId = tid;
  }
  return args;
}
