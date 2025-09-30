"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Edit,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { AgentOverview } from "@/components/agents/profile/AgentOverview";
import { AgentStudents } from "@/components/agents/profile/AgentStudents";
import { AgentPayments } from "@/components/agents/profile/AgentPayments";
import { AgentActivity } from "@/components/agents/profile/AgentActivity";

interface AgentProfile {
  id: string;
  name: string;
  email: string | null;
  phone_e164: string | null;
  source_channel: string | null;
  status: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Statistics
  total_referrals: number;
  paid_referrals: number;
  pending_referrals: number;
  total_students: number;
  total_commission: number;
  pending_commission: number;
  last_referral_date: string | null;
  // Additional profile data
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  emergency_contact: string | null;
  bank_details: string | null;
  commission_rate: number | null;
}

export default function AgentProfilePage() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const loadAgentProfile = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/agents/${agentId}`);
        if (!response.ok) throw new Error("Failed to load agent profile");

        const data = await response.json();
        setAgent(data);
      } catch (error) {
        console.error("Error loading agent profile:", error);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      loadAgentProfile();
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex-1 space-y-6 p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold">Agent not found</h2>
          <p className="text-muted-foreground mt-2">
            The agent you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
          <Button asChild className="mt-4">
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agents
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/agents">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Agents
            </Link>
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{agent.name}</h1>
            <p className="text-muted-foreground">
              Agent Profile #{agent.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={agent.status === 1 ? "default" : "secondary"}>
            {agent.status === 1 ? "Active" : "Inactive"}
          </Badge>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="ml-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Students
                </p>
                <p className="text-2xl font-bold">{agent.total_students}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div className="ml-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Referrals
                </p>
                <p className="text-2xl font-bold">{agent.total_referrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div className="ml-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Total Commission
                </p>
                <p className="text-2xl font-bold">
                  ₹{agent.total_commission?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="ml-3">
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Commission
                </p>
                <p className="text-2xl font-bold">
                  ₹{agent.pending_commission?.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <AgentOverview agent={agent} />
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <AgentStudents agentId={agent.id} />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <AgentPayments agentId={agent.id} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <AgentActivity agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
