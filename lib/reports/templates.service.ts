"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { QuerySpecSchema } from "./types";

const TemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  source_key: z.string().min(1),
  columns: z.array(z.string()),
  filters: z.array(
    z.object({
      field: z.string(),
      op: z.string(),
      value: z.any(),
      value2: z.any().optional(),
    })
  ),
  sort: z
    .array(z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) }))
    .default([]),
  page_size: z.number().min(1).max(1000).default(25),
  visibility: z.enum(["private", "shared", "global"]).default("private"),
  joins: z
    .array(
      z.object({
        relation: z.string(),
        type: z.enum(["inner", "left"]).default("inner"),
        columns: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export type TemplateInput = z.infer<typeof TemplateSchema>;

export async function listTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_templates")
    .select(
      "id, name, description, source_key, columns, filters, sort, page_size, visibility, joins, created_at, updated_at"
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTemplate(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createTemplate(input: unknown) {
  // Validate spec payload overlaps with QuerySpec to ensure runtime safety later
  const parsed = TemplateSchema.parse(input);
  // Soft-validate query-able parts
  QuerySpecSchema.parse({
    sourceKey: parsed.source_key,
    columns: parsed.columns,
    filters: parsed.filters,
    sort: parsed.sort,
    page: 1,
    pageSize: parsed.page_size,
    joins: parsed.joins,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_templates")
    .insert({
      ...parsed,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateTemplate(id: string, input: unknown) {
  const parsed = TemplateSchema.partial().parse(input);

  if (
    parsed.source_key ||
    parsed.columns ||
    parsed.filters ||
    parsed.sort ||
    parsed.page_size ||
    parsed.joins
  ) {
    // Re-validate query parts when present
    QuerySpecSchema.parse({
      sourceKey: parsed.source_key || "", // schema will fail if empty
      columns: parsed.columns || [],
      filters: parsed.filters,
      sort: parsed.sort,
      page: 1,
      pageSize: parsed.page_size || 25,
      joins: parsed.joins,
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_templates")
    .update({
      ...parsed,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("report_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
  return { success: true } as const;
}
