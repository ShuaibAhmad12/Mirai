"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, DollarSign, Clock } from "lucide-react";

interface AgentStatsProps {
  stats: {
    totalAgents: number;
    activeAgents: number;
    inactiveAgents: number;
    totalReferrals: number;
    paidReferrals: number;
    pendingReferrals: number;
    uniqueStudents: number;
  };
}

export function AgentStats({ stats }: AgentStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalAgents}</div>
          <p className="text-xs text-muted-foreground">
            {stats.activeAgents} active, {stats.inactiveAgents} inactive
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Students Referred
          </CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.uniqueStudents}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalReferrals} total referrals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Paid Commissions
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.paidReferrals}</div>
          <p className="text-xs text-muted-foreground">
            {(
              (stats.paidReferrals / Math.max(stats.totalReferrals, 1)) *
              100
            ).toFixed(1)}
            % of referrals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Payments
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingReferrals}</div>
          <p className="text-xs text-muted-foreground">
            {(
              (stats.pendingReferrals / Math.max(stats.totalReferrals, 1)) *
              100
            ).toFixed(1)}
            % pending
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
