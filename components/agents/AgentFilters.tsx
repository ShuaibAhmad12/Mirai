"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface AgentFilters {
  search: string;
  status: "all" | "active" | "inactive";
  source_channel: string;
}

interface AgentFiltersProps {
  filters: AgentFilters;
  onFiltersChange: (filters: AgentFilters) => void;
  sourceChannels: string[];
}

export function AgentFiltersComponent({
  filters,
  onFiltersChange,
  sourceChannels,
}: AgentFiltersProps) {
  const [localSearch, setLocalSearch] = useState(filters.search);

  const updateFilters = (updates: Partial<AgentFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const clearFilters = () => {
    setLocalSearch("");
    onFiltersChange({
      search: "",
      status: "all",
      source_channel: "",
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: localSearch });
  };

  const hasActiveFilters =
    filters.search || filters.status !== "all" || filters.source_channel;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <form
        onSubmit={handleSearchSubmit}
        className="flex gap-2 flex-1 max-w-md"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents by name or email..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
      </form>

      <div className="flex gap-2 items-center">
        <Select
          value={filters.status}
          onValueChange={(value: "all" | "active" | "inactive") =>
            updateFilters({ status: value })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.source_channel}
          onValueChange={(value) => updateFilters({ source_channel: value })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {sourceChannels.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-10 px-2"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
