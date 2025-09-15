import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Mock activity data for now
    const activities = [
      {
        id: "1",
        type: "referral",
        title: "New student referral",
        description: "Referred John Doe for Computer Science program",
        metadata: {
          student_name: "John Doe",
          course: "Computer Science",
          status: "enrolled",
        },
        created_at: "2024-01-20T10:30:00Z",
        created_by: "System",
      },
      {
        id: "2",
        type: "payment",
        title: "Commission payment received",
        description: "Received commission payment for student enrollment",
        metadata: {
          amount: 25000,
          student_name: "Alice Johnson",
          status: "paid",
        },
        created_at: "2024-01-18T14:15:00Z",
        created_by: "Finance Team",
      },
      {
        id: "3",
        type: "contact",
        title: "Phone call made",
        description: "Followed up with prospective student",
        metadata: {
          duration: "15 minutes",
          outcome: "Interested in application",
        },
        created_at: "2024-01-17T16:45:00Z",
        created_by: "Agent",
      },
      {
        id: "4",
        type: "note",
        title: "Note added",
        description: "Updated contact information and preferences",
        metadata: {},
        created_at: "2024-01-15T09:20:00Z",
        created_by: "Admin",
      },
      {
        id: "5",
        type: "status_change",
        title: "Agent status updated",
        description: "Agent status changed to active",
        metadata: {
          previous_status: "inactive",
          new_status: "active",
        },
        created_at: "2024-01-10T11:00:00Z",
        created_by: "Manager",
      },
    ];

    return NextResponse.json({
      activities,
      total: activities.length,
    });
  } catch (error) {
    console.error("Error fetching agent activity:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
