"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

export interface AgentWithStats {
  id: string;
  name: string;
  email: string | null;
  phone_e164: string | null;
  source_channel: string | null;
  status: number;
  notes: string | null;
  total_referrals: number;
  paid_referrals: number;
  pending_referrals: number;
  total_students: number;
  last_referral_date: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentTableProps {
  agents: AgentWithStats[];
  loading?: boolean;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function AgentTable({ agents, loading = false }: AgentTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">No agents found</div>
        <div className="text-sm text-muted-foreground mt-1">
          Try adjusting your search filters or add a new agent
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Performance</TableHead>
            <TableHead>Last Activity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.map((agent) => (
            <TableRow key={agent.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{agent.name}</div>
                  {agent.notes && (
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {agent.notes}
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <div className="space-y-1">
                  {agent.email && (
                    <div className="flex items-center text-sm">
                      <Mail className="h-3 w-3 mr-1 text-muted-foreground" />
                      <span className="truncate max-w-xs">{agent.email}</span>
                    </div>
                  )}
                  {agent.phone_e164 && (
                    <div className="flex items-center text-sm">
                      <Phone className="h-3 w-3 mr-1 text-muted-foreground" />
                      <span>{agent.phone_e164}</span>
                    </div>
                  )}
                  {!agent.email && !agent.phone_e164 && (
                    <span className="text-sm text-muted-foreground">
                      No contact info
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell>
                {agent.source_channel ? (
                  <Badge variant="outline">
                    {agent.source_channel.replace("_", " ")}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </TableCell>

              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center text-sm">
                    <TrendingUp className="h-3 w-3 mr-1 text-muted-foreground" />
                    <span className="font-medium">{agent.total_students}</span>
                    <span className="text-muted-foreground ml-1">students</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="default" className="text-xs px-1">
                      {agent.paid_referrals} paid
                    </Badge>
                    {agent.pending_referrals > 0 && (
                      <Badge variant="secondary" className="text-xs px-1">
                        {agent.pending_referrals} pending
                      </Badge>
                    )}
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3 mr-1" />
                  {agent.last_referral_date
                    ? formatTimeAgo(agent.last_referral_date)
                    : "No activity"}
                </div>
              </TableCell>

              <TableCell>
                <Badge variant={agent.status === 1 ? "default" : "secondary"}>
                  {agent.status === 1 ? "Active" : "Inactive"}
                </Badge>
              </TableCell>

              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/agents/${agent.id}`}>View details</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Edit agent</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>View referrals</DropdownMenuItem>
                    <DropdownMenuItem>Mark payment</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      {agent.status === 1 ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
