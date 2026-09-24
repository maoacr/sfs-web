export * from "./src/client";
export * from "./src/schema";

// Re-export common Drizzle operators for consumers of @sfs/db
export {
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  and,
  or,
  not,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  asc,
  desc,
  sql,
  relations,
} from "drizzle-orm";
