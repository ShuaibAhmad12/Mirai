"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  CreditCard,
  Percent,
  Building,
} from "lucide-react";

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
  total_referrals: number;
  paid_referrals: number;
  pending_referrals: number;
  total_students: number;
  total_commission: number;
  pending_commission: number;
  last_referral_date: string | null;
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

interface AgentOverviewProps {
  agent: AgentProfile;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Not provided";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function AgentOverview({ agent }: AgentOverviewProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center space-x-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">
                  {agent.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">
                  {agent.phone_e164 || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Date of Birth</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(agent.date_of_birth)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Nationality</p>
                <p className="text-sm text-muted-foreground">
                  {agent.nationality || "Not provided"}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Emergency Contact</p>
            <p className="text-sm text-muted-foreground">
              {agent.emergency_contact || "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Address Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Address Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium">Street Address</p>
              <p className="text-sm text-muted-foreground">
                {agent.address || "Not provided"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium">City</p>
                <p className="text-sm text-muted-foreground">
                  {agent.city || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">State</p>
                <p className="text-sm text-muted-foreground">
                  {agent.state || "Not provided"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium">Country</p>
                <p className="text-sm text-muted-foreground">
                  {agent.country || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Postal Code</p>
                <p className="text-sm text-muted-foreground">
                  {agent.postal_code || "Not provided"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Business Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center space-x-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Source Channel</p>
                <p className="text-sm text-muted-foreground">
                  {agent.source_channel ? (
                    <Badge variant="outline">
                      {agent.source_channel.replace("_", " ")}
                    </Badge>
                  ) : (
                    "Not specified"
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Commission Rate</p>
                <p className="text-sm text-muted-foreground">
                  {agent.commission_rate
                    ? `${agent.commission_rate}%`
                    : "Not set"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Joined Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(agent.created_at)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Referral</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(agent.last_referral_date)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-2">Bank Details</p>
            <p className="text-sm text-muted-foreground">
              {agent.bank_details || "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Notes & Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {agent.notes || "No notes available"}
            </p>
            <Button variant="outline" size="sm">
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
