"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentStats } from "@/components/agents/AgentStats";
import {
  AgentFiltersComponent,
  AgentFilters,
} from "@/components/agents/AgentFilters";
import { CreateAgentDialog } from "@/components/agents/CreateAgentDialog";
import { AgentTable, AgentWithStats } from "@/components/agents/AgentTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Download, Upload } from "lucide-react";

interface AgentStatsData {
  totalAgents: number;
  activeAgents: number;
  inactiveAgents: number;
  totalReferrals: number;
  paidReferrals: number;
  pendingReferrals: number;
  uniqueStudents: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithStats[]>([]);
  const [stats, setStats] = useState<AgentStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [filters, setFilters] = useState<AgentFilters>({
    search: "",
    status: "all",
    source_channel: "all",
  });

  // Simple toast replacement - you can replace with proper toast implementation
  const showToast = (title: string, description: string) => {
    console.log(`${title}: ${description}`);
    // You can replace this with proper toast implementation
  };

  // Load agents with applied filters
  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.search) params.append("search", filters.search);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.source_channel !== "all")
        params.append("source", filters.source_channel);

      const response = await fetch(`/api/agents?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load agents");

      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error("Error loading agents:", error);
      showToast("Error", "Failed to load agents. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load agent statistics
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch("/api/agents/stats");
      if (!response.ok) throw new Error("Failed to load stats");

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
      showToast("Error", "Failed to load agent statistics.");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Handle filter changes
  const handleFiltersChange = (newFilters: AgentFilters) => {
    setFilters(newFilters);
  };

  // Handle agent creation
  const handleAgentCreated = () => {
    setCreateDialogOpen(false);
    loadAgents();
    loadStats();
    showToast("Success", "Agent created successfully.");
  };

  // Default stats for when data is loading
  const defaultStats: AgentStatsData = {
    totalAgents: 0,
    activeAgents: 0,
    inactiveAgents: 0,
    totalReferrals: 0,
    paidReferrals: 0,
    pendingReferrals: 0,
    uniqueStudents: 0,
  };

  // Source channels for filters (you can fetch this from API)
  const sourceChannels = [
    "online",
    "referral",
    "walk_in",
    "social_media",
    "advertisement",
  ];

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agents</h1>
          <p className="text-muted-foreground">
            Manage recruitment agents and track their performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Agent
          </Button>

          <CreateAgentDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            onAgentCreated={handleAgentCreated}
          />

        </div>
      </div>

      {/* Statistics */}
      {!statsLoading && <AgentStats stats={stats || defaultStats} />}
      {statsLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-8 bg-muted rounded w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <AgentFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            sourceChannels={sourceChannels}
          />
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Agents ({agents.length})
              </h2>
              {loading && (
                <div className="text-sm text-muted-foreground">Loading...</div>
              )}
            </div>
            <AgentTable agents={agents} loading={loading} />
          </div>
        </CardContent>
      </Card>

      {/* Create Agent Dialog */}
      {createDialogOpen && (
        <CreateAgentDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onAgentCreated={handleAgentCreated}
        />
      )}
    </div>
  );
}
