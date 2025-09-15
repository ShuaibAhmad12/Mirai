"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Download,
  Eye,
  Calendar,
  MapPin,
  GraduationCap,
  CreditCard,
} from "lucide-react";

interface StudentReferral {
  student_id: string;
  student_name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  course_name: string | null;
  college_code: string | null;
  admission_status: string;
  admission_date: string | null;
  joining_date: string | null;
  referral_date: string;
  is_paid: boolean | null;
  remarks: string | null;
  session_year: string | null;
  enrollment_code: string | null;
}

interface AgentStudentsProps {
  agentId: string;
}

export function AgentStudents({ agentId }: AgentStudentsProps) {
  const [students, setStudents] = useState<StudentReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  useEffect(() => {
    const loadStudents = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (searchTerm) params.append("search", searchTerm);
        if (statusFilter !== "all") params.append("status", statusFilter);
        if (countryFilter !== "all") params.append("country", countryFilter);

        const response = await fetch(
          `/api/agents/${agentId}/students?${params.toString()}`
        );
        if (!response.ok) throw new Error("Failed to load students");

        const data = await response.json();
        setStudents(data.students || []);
      } catch (error) {
        console.error("Error loading students:", error);
      } finally {
        setLoading(false);
      }
    };

    if (agentId) {
      loadStudents();
    }
  }, [agentId, searchTerm, statusFilter, countryFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      enrolled: { variant: "default" as const, label: "Enrolled" },
      pending: { variant: "secondary" as const, label: "Pending" },
      rejected: { variant: "destructive" as const, label: "Rejected" },
      waitlisted: { variant: "outline" as const, label: "Waitlisted" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      variant: "outline" as const,
      label: status,
    };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (isPaid: boolean | null) => {
    if (isPaid === true) {
      return <Badge variant="default">Paid</Badge>;
    } else if (isPaid === false) {
      return <Badge variant="secondary">Pending</Badge>;
    } else {
      return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
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
            <GraduationCap className="h-5 w-5 mr-2" />
            Referred Students ({students.length})
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Admission Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enrolled">Enrolled</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="India">India</SelectItem>
              <SelectItem value="Nepal">Nepal</SelectItem>
              <SelectItem value="Bangladesh">Bangladesh</SelectItem>
              <SelectItem value="Sri Lanka">Sri Lanka</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Students Table */}
        {students.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">No students found</h3>
            <p className="text-muted-foreground">
              This agent hasn&apos;t referred any students yet.
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Course & College</TableHead>
                  <TableHead>Admission</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.student_id}>
                    <TableCell>
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {student.enrollment_code || "Not set"}
                        </div>
                        <div className="font-medium">
                          {student.student_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.email}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.phone}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center text-sm">
                        <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                        <div>{student.country || "Not set"}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        {student.state || "Not set"}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {student.course_name || "Course not assigned"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {student.college_code || "College not assigned"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {student.session_year || "Not set"}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(student.admission_date)}
                        </div>
                        {getStatusBadge(student.admission_status)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center text-sm">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                        <div>{formatDate(student.joining_date)}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-2">
                        {getPaymentStatusBadge(student.is_paid)}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center text-sm">
                        <CreditCard className="h-3 w-3 mr-1 text-muted-foreground" />
                        <div>{student.remarks || "No remarks"}</div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
