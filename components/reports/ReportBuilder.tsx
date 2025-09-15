"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type Capability = {
  key: string;
  label: string;
  fields: { name: string; type: string; label?: string }[];
  relations?: Record<
    string,
    {
      label?: string;
      fields: { name: string; type: string; label?: string }[];
    }
  >;
};

type SortDir = "asc" | "desc";
type Filter = {
  field: string;
  op: "eq" | "ilike" | "in" | "gte" | "lte" | "between";
  value: string;
  value2?: string;
};
type Template = {
  id: string;
  name: string;
  description?: string;
  source_key: string;
  columns: string[];
  filters: unknown[];
  sort: { field: string; dir: SortDir }[];
  page_size: number;
  visibility: "private" | "shared" | "global";
  joins?: { relation: string; type: "inner" | "left"; columns: string[] }[];
};

export default function ReportBuilder() {
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState<Capability[]>([]);
  const [sourceKey, setSourceKey] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [page] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ field: string; dir: SortDir }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [newTemplateName, setNewTemplateName] = useState<string>("");
  const [joins, setJoins] = useState<
    { relation: string; type: "inner" | "left"; columns: string[] }[]
  >([]);
  const [filters, setFilters] = useState<Filter[]>([]);

  const selectedCap = useMemo(
    () => caps.find((c) => c.key === sourceKey),
    [caps, sourceKey]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/reports/capabilities");
        const data = await res.json();
        if (!mounted) return;
        setCaps(data.sources || []);
        if (data.sources?.[0]?.key) setSourceKey(data.sources[0].key);
        // Load templates
        const tRes = await fetch("/api/reports/templates");
        const tData = await tRes.json();
        if (!mounted) return;
        setTemplates(tData.templates || []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedCap && columns.length === 0) {
      setColumns(selectedCap.fields.slice(0, 5).map((f) => f.name));
    }
  }, [selectedCap, columns.length]);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKey,
          columns,
          filters,
          sort,
          page,
          pageSize,
          joins,
        }),
      });
      const data = await res.json();
      setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  async function saveTemplate() {
    if (!newTemplateName.trim()) return;
    const body = {
      name: newTemplateName.trim(),
      description: "",
      source_key: sourceKey,
      columns,
      filters,
      sort,
      page_size: pageSize,
      visibility: "private",
      joins,
    };
    const res = await fetch("/api/reports/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setTemplates((prev) => [data, ...prev]);
    setSelectedTemplateId(data.id);
    setNewTemplateName("");
  }

  function loadTemplateById(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSourceKey(t.source_key);
    setColumns(t.columns || []);
    setSort(t.sort || []);
    setPageSize(t.page_size || 25);
    setJoins(t.joins || []);
    setFilters((t.filters as Filter[]) || []);
    setSelectedTemplateId(id);
  }

  async function deleteTemplate() {
    if (!selectedTemplateId) return;
    await fetch(`/api/reports/templates/${selectedTemplateId}`, {
      method: "DELETE",
    });
    setTemplates((prev) => prev.filter((x) => x.id !== selectedTemplateId));
    setSelectedTemplateId("");
  }

  function toggleColumn(name: string) {
    setColumns((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  // Helpers to manage joins UI
  function addJoin() {
    if (!selectedCap?.relations) return;
    const firstRel = Object.keys(selectedCap.relations)[0];
    if (!firstRel) return;
    setJoins((prev) => [
      ...prev,
      { relation: firstRel, type: "inner", columns: [] },
    ]);
  }
  function updateJoin(
    idx: number,
    patch: Partial<{
      relation: string;
      type: "inner" | "left";
      columns: string[];
    }>
  ) {
    setJoins((prev) =>
      prev.map((j, i) => (i === idx ? { ...j, ...patch } : j))
    );
  }
  function removeJoin(idx: number) {
    setJoins((prev) => prev.filter((_, i) => i !== idx));
  }

  // Helpers to manage filters UI
  function addFilter() {
    const firstField = selectedCap?.fields[0]?.name || "";
    setFilters((prev) => [...prev, { field: firstField, op: "eq", value: "" }]);
  }
  function updateFilter(idx: number, patch: Partial<Filter>) {
    setFilters((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    );
  }
  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  }
  function getOperatorsForField(
    fieldName: string
  ): { value: Filter["op"]; label: string }[] {
    const field = selectedCap?.fields.find((f) => f.name === fieldName);
    const type = field?.type || "text";
    switch (type) {
      case "number":
      case "date":
        return [
          { value: "eq", label: "Equals" },
          { value: "gte", label: "Greater than or equal" },
          { value: "lte", label: "Less than or equal" },
          { value: "between", label: "Between" },
        ];
      case "text":
        return [
          { value: "eq", label: "Equals" },
          { value: "ilike", label: "Contains" },
          { value: "in", label: "In list" },
        ];
      default:
        return [
          { value: "eq", label: "Equals" },
          { value: "ilike", label: "Contains" },
        ];
    }
  }

  // CSV Export helper
  function exportCSV() {
    if (rows.length === 0 || columns.length === 0) return;

    const csvContent = [
      columns.join(","), // header
      ...rows.map((row) =>
        columns
          .map((col) => {
            let value = "";
            if (col.includes(".")) {
              const [rel, field] = col.split(".");
              const joined: unknown = (row as Record<string, unknown>)[rel];
              if (Array.isArray(joined)) {
                value = joined
                  .map((item) =>
                    item && typeof item === "object"
                      ? String((item as Record<string, unknown>)[field] ?? "")
                      : ""
                  )
                  .filter(Boolean)
                  .join("; ");
              } else if (joined && typeof joined === "object") {
                value = String(
                  (joined as Record<string, unknown>)[field] ?? ""
                );
              }
            } else {
              value = String((row as Record<string, unknown>)[col] ?? "");
            }
            // Escape quotes and wrap in quotes if contains comma
            return value.includes(",") || value.includes('"')
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Clear all selections
  function handleClear() {
    setRows([]);
    setSelectedTemplateId("");
    setNewTemplateName("");
    setSourceKey("");
    setColumns([]);
    setFilters([]);
    setSort([]);
    setJoins([]);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClear}>
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={exportCSV}
            disabled={rows.length === 0}
          >
            Export CSV
          </Button>
          <Button onClick={run} disabled={loading || !sourceKey}>
            Run
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Templates
            </label>
            <div className="flex gap-2">
              <select
                className="w-full border rounded px-2 py-1 bg-background"
                value={selectedTemplateId}
                onChange={(e) => loadTemplateById(e.target.value)}
              >
                <option value="">Select template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="destructive"
                onClick={deleteTemplate}
                disabled={!selectedTemplateId}
              >
                Delete
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Save as
            </label>
            <div className="flex gap-2">
              <input
                className="w-full border rounded px-2 py-1 bg-background"
                placeholder="Template name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
              <Button onClick={saveTemplate} disabled={!newTemplateName.trim()}>
                Save
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Table
            </label>
            <Select value={sourceKey} onValueChange={setSourceKey}>
              <SelectTrigger>
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {caps.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Page size
            </label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100, 250].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Sort
            </label>
            <Select
              value={sort[0]?.field || ""}
              onValueChange={(v) =>
                setSort(v ? [{ field: v, dir: sort[0]?.dir || "desc" }] : [])
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {selectedCap?.fields.map((f) => (
                  <SelectItem key={f.name} value={f.name}>
                    {f.label || f.name}
                  </SelectItem>
                ))}
                {/* allow sorting by joined fields using relation.field */}
                {selectedCap?.relations &&
                  Object.entries(selectedCap.relations).flatMap(
                    ([relKey, rel]) =>
                      rel.fields.map((f) => (
                        <SelectItem
                          key={`${relKey}.${f.name}`}
                          value={`${relKey}.${f.name}`}
                        >
                          {f.label || f.name}
                        </SelectItem>
                      ))
                  )}
              </SelectContent>
            </Select>
            <div className="mt-2">
              <Select
                value={sort[0]?.dir || "desc"}
                onValueChange={(dir) =>
                  setSort(
                    sort[0]?.field
                      ? [{ field: sort[0].field, dir: dir as SortDir }]
                      : []
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Joins builder */}
        {selectedCap?.relations && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm text-muted-foreground">
                Joins
              </label>
              <Button size="sm" variant="outline" onClick={addJoin}>
                Add join
              </Button>
            </div>
            {joins.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No joins added. Use Add join to include related data.
              </p>
            ) : (
              <div className="space-y-2">
                {joins.map((j, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Relation
                        </label>
                        <select
                          className="w-full border rounded px-2 py-1 bg-background"
                          value={j.relation}
                          onChange={(e) =>
                            updateJoin(idx, {
                              relation: e.target.value,
                              columns: [],
                            })
                          }
                        >
                          {Object.keys(selectedCap.relations || {}).map(
                            (rk) => (
                              <option key={rk} value={rk}>
                                {selectedCap.relations?.[rk]?.label || rk}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          Type
                        </label>
                        <Select
                          value={j.type}
                          onValueChange={(v) =>
                            updateJoin(idx, { type: v as "inner" | "left" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inner">Inner</SelectItem>
                            <SelectItem value="left">Left</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeJoin(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {/* join columns */}
                    <div className="mt-3">
                      <label className="block text-xs text-muted-foreground mb-1">
                        Join columns
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(
                          selectedCap.relations?.[j.relation]?.fields || []
                        ).map((f) => {
                          const full = `${j.relation}.${f.name}`;
                          const checked =
                            j.columns.includes(f.name) ||
                            j.columns.includes(full);
                          return (
                            <label
                              key={full}
                              className="flex items-center gap-2"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  updateJoin(idx, {
                                    columns: checked
                                      ? j.columns.filter(
                                          (c) => c !== f.name && c !== full
                                        )
                                      : [
                                          ...j.columns.filter(
                                            (c) => !c.includes(".")
                                          ),
                                          f.name,
                                        ],
                                  })
                                }
                              />
                              <span className="text-sm">
                                {(selectedCap.relations?.[j.relation]?.label ||
                                  j.relation) +
                                  "." +
                                  (f.label || f.name)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters builder */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm text-muted-foreground">
              Filters
            </label>
            <Button size="sm" variant="outline" onClick={addFilter}>
              Add filter
            </Button>
          </div>
          {filters.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No filters added. Use Add filter to narrow results.
            </p>
          ) : (
            <div className="space-y-2">
              {filters.map((filter, idx) => (
                <div key={idx} className="border rounded p-3">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Field
                      </label>
                      <select
                        className="w-full border rounded px-2 py-1 bg-background"
                        value={filter.field}
                        onChange={(e) =>
                          updateFilter(idx, {
                            field: e.target.value,
                            op: "eq",
                            value: "",
                          })
                        }
                      >
                        {selectedCap?.fields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.label || f.name}
                          </option>
                        ))}
                        {/* Allow filtering by joined fields */}
                        {selectedCap?.relations &&
                          Object.entries(selectedCap.relations).flatMap(
                            ([relKey, rel]) =>
                              rel.fields.map((f) => (
                                <option
                                  key={`${relKey}.${f.name}`}
                                  value={`${relKey}.${f.name}`}
                                >
                                  {f.label || f.name}
                                </option>
                              ))
                          )}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Operator
                      </label>
                      <Select
                        value={filter.op}
                        onValueChange={(v) =>
                          updateFilter(idx, { op: v as Filter["op"] })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorsForField(filter.field).map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        Value
                      </label>
                      <input
                        className="w-full border rounded px-2 py-1 bg-background"
                        value={filter.value}
                        onChange={(e) =>
                          updateFilter(idx, { value: e.target.value })
                        }
                        placeholder="Enter value"
                      />
                    </div>
                    {filter.op === "between" && (
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">
                          To
                        </label>
                        <input
                          className="w-full border rounded px-2 py-1 bg-background"
                          value={filter.value2 || ""}
                          onChange={(e) =>
                            updateFilter(idx, { value2: e.target.value })
                          }
                          placeholder="End value"
                        />
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeFilter(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted-foreground mb-2">
            Columns
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {selectedCap?.fields.map((f) => (
              <label key={f.name} className="flex items-center gap-2">
                <Checkbox
                  checked={columns.includes(f.name)}
                  onCheckedChange={() => toggleColumn(f.name)}
                />
                <span className="text-sm">{f.label || f.name}</span>
              </label>
            ))}
            {/* joined fields selection into base columns list as dotted names */}
            {selectedCap?.relations &&
              Object.entries(selectedCap.relations).flatMap(([relKey, rel]) =>
                rel.fields.map((f) => {
                  const dotted = `${relKey}.${f.name}`;
                  return (
                    <label key={dotted} className="flex items-center gap-2">
                      <Checkbox
                        checked={columns.includes(dotted)}
                        onCheckedChange={() => toggleColumn(dotted)}
                      />
                      <span className="text-sm">{f.label || f.name}</span>
                    </label>
                  );
                })
              )}
          </div>
        </div>
      </Card>

      <Card className="p-4 overflow-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No data. Click Run to preview.
          </p>
        ) : (
          <div className="w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="py-2 pr-4 font-medium text-muted-foreground"
                    >
                      {c.includes(".") ? c.split(".")[1] : c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    {columns.map((c) => (
                      <td key={c} className="py-2 pr-4">
                        {c.includes(".")
                          ? // dotted path from joined object array or object
                            (() => {
                              const [rel, field] = c.split(".");
                              const joined: unknown = (
                                r as Record<string, unknown>
                              )[rel];
                              if (Array.isArray(joined)) {
                                return joined
                                  .map((item) =>
                                    item && typeof item === "object"
                                      ? String(
                                          (item as Record<string, unknown>)[
                                            field
                                          ] ?? ""
                                        )
                                      : ""
                                  )
                                  .filter(Boolean)
                                  .join(", ");
                              }
                              if (joined && typeof joined === "object") {
                                return String(
                                  (joined as Record<string, unknown>)[field] ??
                                    ""
                                );
                              }
                              return "";
                            })()
                          : String((r as Record<string, unknown>)[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
