import { NextRequest, NextResponse } from "next/server";
import { studentService } from "@/lib/services/student.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;

    const [addresses, contacts] = await Promise.all([
      studentService.getStudentAddresses(studentId),
      studentService.getStudentContacts(studentId),
    ]);

    const contactData = {
      addresses: addresses,
      contacts: contacts,
    };

    return NextResponse.json(contactData);
  } catch (error) {
    console.error("Error fetching contact data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const { addresses } = await request.json();

    const updatedAddresses = [];

    // Update addresses if provided
    if (addresses?.permanent) {
      const permanentAddress = await studentService.upsertStudentAddress(
        studentId,
        "permanent",
        addresses.permanent
      );
      updatedAddresses.push(permanentAddress);
    }

    if (addresses?.correspondence) {
      const correspondenceAddress = await studentService.upsertStudentAddress(
        studentId,
        "correspondence",
        addresses.correspondence
      );
      updatedAddresses.push(correspondenceAddress);
    }

    return NextResponse.json({
      success: true,
      updated_addresses: updatedAddresses,
    });
  } catch (error) {
    console.error("Error updating contact data:", error);
    return NextResponse.json(
      { error: "Failed to update contact data" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const studentId = id;
    const { contacts, addresses } = await request.json();

    const updates = [];

    // Update contacts if provided
    if (contacts) {
      for (const contact of contacts) {
        const updatedContact = await studentService.upsertStudentContact(
          studentId,
          contact.contact_type,
          contact.value_raw
        );
        updates.push(updatedContact);
      }
    }

    // Update addresses if provided
    if (addresses?.permanent) {
      const permanentAddress = await studentService.upsertStudentAddress(
        studentId,
        "permanent",
        addresses.permanent
      );
      updates.push(permanentAddress);
    }

    if (addresses?.correspondence) {
      const correspondenceAddress = await studentService.upsertStudentAddress(
        studentId,
        "correspondence",
        addresses.correspondence
      );
      updates.push(correspondenceAddress);
    }

    return NextResponse.json({
      success: true,
      updates: updates,
    });
  } catch (error) {
    console.error("Error updating contact data:", error);
    return NextResponse.json(
      { error: "Failed to update contact data" },
      { status: 500 }
    );
  }
}
