"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,

} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated: () => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  source_channel: string;
  notes: string;
}

const SOURCE_CHANNELS = [
  "referral",
  "aggregator",
  "internal",
  "website",
  "social_media",
  "partner",
  "other",
];

export function CreateAgentDialog({
  open,
  onOpenChange,
  onAgentCreated,
}: CreateAgentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    source_channel: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      source_channel: "",
      notes: "",
    });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        source_channel: formData.source_channel || undefined,
        notes: formData.notes.trim() || undefined,
      };

      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create agent");
      }

      resetForm();
      onOpenChange(false);
      onAgentCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  };
  // function setOpen(arg0: boolean): void {
  //   throw new Error("Function not implemented.");
  // }

  return (
     <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Agent</DialogTitle>
            <DialogDescription>
              Create a new agent profile for tracking referrals and commissions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Agent full name"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="agent@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+91 9999999999"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="source_channel">Source Channel</Label>
              <Select
                value={formData.source_channel}
                onValueChange={(value) =>
                  setFormData({ ...formData, source_channel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source channel" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel.charAt(0).toUpperCase() +
                        channel.slice(1).replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes or comments..."
                rows={3}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
             <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
