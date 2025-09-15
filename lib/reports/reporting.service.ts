"use server";
import { createClient } from "@/lib/supabase/server";
import { getReportSource } from "./registry";
import { QuerySpec, QuerySpecSchema, type FieldType } from "./types";

type RunResult = {
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  total?: number; // optional, can be estimated later
};

export async function getReportingCapabilities() {
  const { REPORT_SOURCES } = await import("./registry");
  return REPORT_SOURCES.map((s) => ({
    key: s.key,
    label: s.label,
    fields: Object.entries(s.fields).map(([name, meta]) => ({ name, ...meta })),
    relations: s.relations
      ? Object.fromEntries(
          Object.entries(s.relations).map(([relName, rel]) => [
            relName,
            {
              label: rel.label,
              fields: Object.entries(rel.fields).map(([name, meta]) => ({
                name,
                ...meta,
              })),
            },
          ])
        )
      : undefined,
    defaultSort: s.defaultSort,
  }));
}

export async function runReport(specInput: unknown): Promise<RunResult> {
  const spec = QuerySpecSchema.parse(specInput) as QuerySpec;

  const source = getReportSource(spec.sourceKey);
  if (!source) throw new Error("Invalid report source");

  // Validate columns - handle both base fields and dotted relation fields
  const allFieldNames = new Set(Object.keys(source.fields));
  const selectedColumns: string[] = [];
  const selectedRelationColumns: string[] = [];

  if (spec.columns.length) {
    for (const col of spec.columns) {
      if (col.includes(".")) {
        // Dotted relation field - validate against relations
        const [relName, fieldName] = col.split(".");
        if (source.relations?.[relName]?.fields[fieldName]) {
          selectedRelationColumns.push(col);
        }
      } else {
        // Base field - validate against base fields
        if (allFieldNames.has(col)) {
          selectedColumns.push(col);
        }
      }
    }
  } else {
    selectedColumns.push(...Object.keys(source.fields));
  }

  // Handle joins by using embedded resources in select
  const supabase = await createClient();
  const selectParts: string[] = [];

  // base columns
  if (selectedColumns.length) {
    selectParts.push(selectedColumns.join(", "));
  }

  // Create a map of relations and their required fields
  const relationFieldsMap = new Map<string, Set<string>>();

  // Add fields from explicit joins
  if (spec.joins && spec.joins.length && source.relations) {
    for (const j of spec.joins) {
      const rel = source.relations[j.relation];
      if (!rel) continue;

      if (!relationFieldsMap.has(j.relation)) {
        relationFieldsMap.set(j.relation, new Set());
      }

      const fieldsToAdd = j.columns.length
        ? j.columns
        : Object.keys(rel.fields);
      fieldsToAdd.forEach((field) =>
        relationFieldsMap.get(j.relation)?.add(field)
      );
    }
  }

  // Add fields from selected dotted columns
  for (const dottedCol of selectedRelationColumns) {
    const [relName, fieldName] = dottedCol.split(".");
    if (source.relations?.[relName]) {
      if (!relationFieldsMap.has(relName)) {
        relationFieldsMap.set(relName, new Set());
      }
      relationFieldsMap.get(relName)?.add(fieldName);
    }
  }

  // Build embedded selects for relations
  for (const [relName, fields] of relationFieldsMap) {
    const rel = source.relations?.[relName];
    if (!rel) continue;

    const joinCols = Array.from(fields).join(", ");
    // Default to left join to avoid filtering out records without related data
    const joinDef = spec.joins?.find((j) => j.relation === relName);
    const mod = joinDef?.type === "inner" ? "!inner" : "!left";
    selectParts.push(`${relName}${mod}(${joinCols})`);
  }

  const selectQuery = selectParts.length ? selectParts.join(", ") : "*";

  let query = supabase.from(source.table).select(selectQuery);
  const coerce = (type: FieldType, v: unknown): string | number | boolean => {
    switch (type) {
      case "number":
        return typeof v === "number" ? v : Number(v);
      case "boolean":
        return typeof v === "boolean" ? v : String(v).toLowerCase() === "true";
      case "date": {
        // Accept ISO string or Date; send ISO string to PG
        if (v instanceof Date) return v.toISOString();
        const d = new Date(String(v));
        return isNaN(d.getTime()) ? String(v) : d.toISOString();
      }
      case "uuid":
      case "text":
      default:
        return String(v);
    }
  };

  // Filters - handle both base fields and relation fields
  for (const f of spec.filters || []) {
    let fieldMeta: { type: FieldType } | undefined;
    let isRelationField = false;

    if (f.field.includes(".")) {
      // Dotted relation field
      const [relName, fieldName] = f.field.split(".");
      fieldMeta = source.relations?.[relName]?.fields[fieldName];
      isRelationField = true;
    } else {
      // Base field
      if (!allFieldNames.has(f.field)) continue;
      fieldMeta = source.fields[f.field];
    }

    if (!fieldMeta) continue;

    const ftype: FieldType = fieldMeta.type || "text";

    if (isRelationField) {
      // For relation fields, we need to use the relation table name in the filter
      const [relName, fieldName] = f.field.split(".");
      switch (f.op) {
        case "eq":
          query = query.eq(`${relName}.${fieldName}`, coerce(ftype, f.value));
          break;
        case "ilike":
          query = query.ilike(`${relName}.${fieldName}`, String(f.value));
          break;
        case "gte":
          query = query.gte(`${relName}.${fieldName}`, coerce(ftype, f.value));
          break;
        case "lte":
          query = query.lte(`${relName}.${fieldName}`, coerce(ftype, f.value));
          break;
        case "between":
          if (typeof f.value2 === "undefined") break;
          query = query
            .gte(`${relName}.${fieldName}`, coerce(ftype, f.value))
            .lte(`${relName}.${fieldName}`, coerce(ftype, f.value2));
          break;
        // Note: 'in' filter on relation fields might need special handling
        default:
          break;
      }
    } else {
      // Base field filtering (existing logic)
      switch (f.op) {
        case "eq":
          query = query.eq(f.field, coerce(ftype, f.value));
          break;
        case "ilike":
          query = query.ilike(f.field, String(f.value));
          break;
        case "in": {
          const arr = (
            Array.isArray(f.value)
              ? (f.value as unknown[])
              : String(f.value)
                  .split(",")
                  .map((s) => s.trim())
          ) as unknown[];

          let coercedArr: string[] | number[] | boolean[];
          if (ftype === "number") {
            coercedArr = arr.map((x) => Number(x));
          } else if (ftype === "boolean") {
            coercedArr = arr.map((x) => String(x).toLowerCase() === "true");
          } else {
            coercedArr = arr.map((x) => String(x));
          }

          query = query.in(
            f.field,
            coercedArr as string[] | number[] | boolean[]
          );
          break;
        }
        case "gte":
          query = query.gte(f.field, coerce(ftype, f.value));
          break;
        case "lte":
          query = query.lte(f.field, coerce(ftype, f.value));
          break;
        case "between":
          if (typeof f.value2 === "undefined") break;
          query = query
            .gte(f.field, coerce(ftype, f.value))
            .lte(f.field, coerce(ftype, f.value2));
          break;
        default:
          break;
      }
    }
  }

  // Sorting
  if (spec.sort && spec.sort.length) {
    for (const s of spec.sort) {
      if (s.field.includes(".")) {
        // dotted relation.field sort: use foreignTable option
        const [rel, childField] = s.field.split(".");
        if (rel && childField && source.relations && source.relations[rel]) {
          query = query.order(childField, {
            ascending: s.dir === "asc",
            foreignTable: rel,
          });
        }
        continue;
      }
      if (!allFieldNames.has(s.field)) continue;
      query = query.order(s.field, { ascending: s.dir === "asc" });
    }
  } else if (source.defaultSort) {
    query = query.order(source.defaultSort.field, {
      ascending: source.defaultSort.dir === "asc",
    });
  }

  // Pagination (server-side)
  const page = spec.page || 1;
  const pageSize = spec.pageSize || 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error } = await query;
  if (error) throw error;

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? (data as unknown[]).map((r) => (r ?? {}) as Record<string, unknown>)
    : [];
  return { rows, page, pageSize };
}

// Note: Do not export types as values from server modules to avoid Turbopack runtime issues.
