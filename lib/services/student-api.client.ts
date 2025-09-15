import type {
  StudentOverviewResponse,
  StudentAcademicResponse,
  StudentFeesResponse,
  StudentContactResponse,
  StudentDocumentsResponse,
  StudentInternalRefsResponse,
  StudentNotesResponse,
  UpdateContactRequest,
  UpdateInternalRefsRequest,
  AddNoteRequest,
  AddPaymentRequest,
  FeeAdjustment,
  AddAdjustmentRequest,
} from "@/lib/types/student-api.types";

// Import the complex payment types from the service
import type { PaymentRequest } from "@/lib/services/fee-payment.service";

export class StudentApiClient {
  private baseUrl = "/api/students";

  async getOverview(studentId: string): Promise<StudentOverviewResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/overview`);
    if (!response.ok) throw new Error("Failed to fetch student overview");
    return response.json();
  }

  async getAcademic(studentId: string): Promise<StudentAcademicResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/academic`);
    if (!response.ok) throw new Error("Failed to fetch academic data");
    return response.json();
  }

  async getFees(studentId: string): Promise<StudentFeesResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/fees`);
    if (!response.ok) throw new Error("Failed to fetch fees data");
    return response.json();
  }

  async getContact(studentId: string): Promise<StudentContactResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/contact`);
    if (!response.ok) throw new Error("Failed to fetch contact data");
    return response.json();
  }

  async getDocuments(studentId: string): Promise<StudentDocumentsResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/documents`);
    if (!response.ok) throw new Error("Failed to fetch documents");
    return response.json();
  }

  async getInternalRefs(
    studentId: string
  ): Promise<StudentInternalRefsResponse> {
    const response = await fetch(`${this.baseUrl}/${studentId}/internal-refs`);
    if (!response.ok) throw new Error("Failed to fetch internal refs");
    return response.json();
  }

  async getNotes(
    studentId: string,
    limit = 10,
    offset = 0
  ): Promise<StudentNotesResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });
    const response = await fetch(
      `${this.baseUrl}/${studentId}/notes?${params}`
    );
    if (!response.ok) throw new Error("Failed to fetch notes");
    return response.json();
  }

  // Update Operations
  async updateContact(
    studentId: string,
    data: UpdateContactRequest
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/${studentId}/contact`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update contact data");
    return response.json();
  }

  async updateInternalRefs(
    studentId: string,
    data: UpdateInternalRefsRequest
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/${studentId}/internal-refs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update internal refs");
    return response.json();
  }

  async addNote(studentId: string, data: AddNoteRequest) {
    const response = await fetch(`${this.baseUrl}/${studentId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to add note");
    return response.json();
  }

  async addPayment(studentId: string, data: AddPaymentRequest) {
    const response = await fetch(`${this.baseUrl}/${studentId}/fees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to add payment");
    return response.json();
  }

  async processComplexPayment(studentId: string, data: PaymentRequest) {
    const response = await fetch(`${this.baseUrl}/${studentId}/fees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to process payment");
    return response.json();
  }

  async updatePaymentReceipt(
    studentId: string,
    receiptId: string,
    data: PaymentRequest
  ) {
    const response = await fetch(
      `${this.baseUrl}/${studentId}/receipts/${receiptId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) throw new Error("Failed to update payment receipt");
    return response.json();
  }

  async getReceiptDetail(studentId: string, receiptId: string) {
    const response = await fetch(
      `${this.baseUrl}/${studentId}/receipts/${receiptId}`
    );
    if (!response.ok) throw new Error("Failed to fetch receipt detail");
    return response.json();
  }

  async getFeeAdjustments(studentId: string): Promise<FeeAdjustment[]> {
    const response = await fetch(`/api/students/${studentId}/adjustments`);
    if (!response.ok) {
      throw new Error("Failed to fetch adjustments");
    }
    const data = await response.json();
    return data.adjustments || [];
  }

  async createAdjustment(
    studentId: string,
    adjustmentData: AddAdjustmentRequest
  ): Promise<FeeAdjustment> {
    const response = await fetch(
      `/api/students/${studentId}/adjustments/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adjustmentData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.details || error.error || "Failed to create adjustment"
      );
    }

    const data = await response.json();
    return data.adjustment;
  }

  async cancelAdjustment(
    studentId: string,
    adjustmentId: string,
    cancellationReason: string
  ): Promise<FeeAdjustment> {
    const response = await fetch(`/api/students/${studentId}/adjustments`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        adjustmentId,
        action: "cancel",
        cancellationReason,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.details || error.error || "Failed to cancel adjustment"
      );
    }

    const data = await response.json();
    return data.adjustment;
  }
}

export const studentApiClient = new StudentApiClient();
