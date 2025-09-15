"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  User,
  FileText,
  DollarSign,
  UserPlus,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

interface ActivityRecord {
  id: string;
  type: "referral" | "payment" | "contact" | "note" | "status_change";
  title: string;
  description: string;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
  created_by: string | null;
}

interface AgentActivityProps {
  agentId: string;
}

export function AgentActivity({ agentId }: AgentActivityProps) {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/agents/${agentId}/activity`);
        if (!response.ok) throw new Error("Failed to load activity");

        const data = await response.json();
        setActivities(data.activities || []);
      } catch (error) {
        console.error("Error loading activity:", error);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      loadActivity();
    }
  }, [agentId]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const getActivityIcon = (type: string) => {
    const iconMap = {
      referral: UserPlus,
      payment: DollarSign,
      contact: Phone,
      note: MessageSquare,
      status_change: TrendingUp,
      email: Mail,
      call: Phone,
      meeting: Calendar,
    };

    return iconMap[type as keyof typeof iconMap] || FileText;
  };

  const getActivityColor = (type: string) => {
    const colorMap = {
      referral: "text-green-600",
      payment: "text-blue-600",
      contact: "text-purple-600",
      note: "text-orange-600",
      status_change: "text-red-600",
    };

    return colorMap[type as keyof typeof colorMap] || "text-muted-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex space-x-4">
                <div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                </div>
                <div className="h-3 bg-muted animate-pulse rounded w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Activity ({activities.length})
          </div>
          <Button variant="outline" size="sm">
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No recent activity</h3>
            <p className="text-muted-foreground">
              Activity and interactions will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type);
              const colorClass = getActivityColor(activity.type);

              return (
                <div key={activity.id} className="relative">
                  {/* Timeline line */}
                  {index < activities.length - 1 && (
                    <div className="absolute left-5 top-10 w-px h-6 bg-border" />
                  )}

                  <div className="flex space-x-4">
                    {/* Activity icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center ${colorClass}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Activity content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(activity.created_at)}
                        </p>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">
                        {activity.description}
                      </p>

                      {/* Activity metadata */}
                      {activity.metadata &&
                        Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {activity.metadata.student_name && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <User className="h-3 w-3 mr-1" />
                                Student: {activity.metadata.student_name}
                              </div>
                            )}
                            {activity.metadata.amount && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <DollarSign className="h-3 w-3 mr-1" />
                                Amount: ₹
                                {activity.metadata.amount.toLocaleString()}
                              </div>
                            )}
                            {activity.metadata.course && (
                              <div className="flex items-center text-xs text-muted-foreground">
                                <FileText className="h-3 w-3 mr-1" />
                                Course: {activity.metadata.course}
                              </div>
                            )}
                            {activity.metadata.status && (
                              <Badge variant="outline" className="text-xs">
                                {activity.metadata.status}
                              </Badge>
                            )}
                          </div>
                        )}

                      {activity.created_by && (
                        <p className="text-xs text-muted-foreground mt-2">
                          by {activity.created_by}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
