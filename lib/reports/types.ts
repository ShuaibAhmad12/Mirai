import { z } from "zod";

export type FieldType = "text" | "number" | "date" | "uuid" | "boolean";

export type ReportField = {
  type: FieldType;
  label?: string;
};

export type ReportSource = {
  key: string;
  label: string;
  table: string; // direct table name (no views)
  fields: Record<string, ReportField>;
  defaultSort?: { field: string; dir: "asc" | "desc" };
  // Named relations that can be embedded via PostgREST (FK-based)
  relations?: Record<
    string,
    {
      label?: string;
      fields: Record<string, ReportField>;
    }
  >;
};

export const Operator = z.enum(["eq", "ilike", "in", "gte", "lte", "between"]);
export type Operator = z.infer<typeof Operator>;

export const FilterSchema = z.object({
  field: z.string(),
  op: Operator,
  value: z.unknown(),
  value2: z.unknown().optional(), // for between
});

export const SortSchema = z.object({
  field: z.string(),
  dir: z.enum(["asc", "desc"]).default("asc"),
});

export const QuerySpecSchema = z.object({
  sourceKey: z.string(),
  columns: z.array(z.string()).default([]),
  filters: z.array(FilterSchema).optional(),
  sort: z.array(SortSchema).optional(),
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(1000).default(25),
  joins: z
    .array(
      z.object({
        relation: z.string(),
        type: z.enum(["inner", "left"]).default("inner"),
        columns: z.array(z.string()).default([]),
      })
    )
    .optional(),
});
export type QuerySpec = z.infer<typeof QuerySpecSchema>;
