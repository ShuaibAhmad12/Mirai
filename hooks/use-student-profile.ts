import { create } from "zustand";
import { studentApiClient } from "@/lib/services/student-api.client";
import type {
  StudentOverviewResponse,
  StudentAcademicResponse,
  StudentFeesResponse,
  StudentContactResponse,
  StudentDocumentsResponse,
  StudentInternalRefsResponse,
  StudentNotesResponse,
  FeeAdjustment,
} from "@/lib/types/student-api.types";

// Store interface for each tab data
interface StudentProfileStore {
  // Data state
  overview: StudentOverviewResponse | null;
  academic: StudentAcademicResponse | null;
  fees: StudentFeesResponse | null;
  adjustments: FeeAdjustment[] | null;
  contact: StudentContactResponse | null;
  documents: StudentDocumentsResponse | null;
  internalRefs: StudentInternalRefsResponse | null;
  notes: StudentNotesResponse | null;

  // Loading states
  isLoadingOverview: boolean;
  isLoadingAcademic: boolean;
  isLoadingFees: boolean;
  isLoadingAdjustments: boolean;
  isLoadingContact: boolean;
  isLoadingDocuments: boolean;
  isLoadingInternalRefs: boolean;
  isLoadingNotes: boolean;

  // Error states
  overviewError: string | null;
  academicError: string | null;
  feesError: string | null;
  adjustmentsError: string | null;
  contactError: string | null;
  documentsError: string | null;
  internalRefsError: string | null;
  notesError: string | null;

  // Current student ID
  currentStudentId: string | null;

  // Actions
  loadOverview: (studentId: string) => Promise<void>;
  loadAcademic: (studentId: string) => Promise<void>;
  loadFees: (studentId: string) => Promise<void>;
  loadAdjustments: (studentId: string) => Promise<void>;
  loadContact: (studentId: string) => Promise<void>;
  loadDocuments: (studentId: string) => Promise<void>;
  loadInternalRefs: (studentId: string) => Promise<void>;
  loadNotes: (
    studentId: string,
    limit?: number,
    offset?: number
  ) => Promise<void>;

  updateContact: (
    studentId: string,
    data: Parameters<typeof studentApiClient.updateContact>[1]
  ) => Promise<void>;
  updateInternalRefs: (
    studentId: string,
    data: Parameters<typeof studentApiClient.updateInternalRefs>[1]
  ) => Promise<void>;
  addNote: (
    studentId: string,
    data: Parameters<typeof studentApiClient.addNote>[1]
  ) => Promise<void>;
  addPayment: (
    studentId: string,
    data: Parameters<typeof studentApiClient.addPayment>[1]
  ) => Promise<void>;

  // Clear data when switching students
  clearData: () => void;
  setCurrentStudent: (studentId: string) => void;
}

export const useStudentProfileStore = create<StudentProfileStore>(
  (set, get) => ({
    // Initial state
    overview: null,
    academic: null,
    fees: null,
    adjustments: null,
    contact: null,
    documents: null,
    internalRefs: null,
    notes: null,

    isLoadingOverview: false,
    isLoadingAcademic: false,
    isLoadingFees: false,
    isLoadingAdjustments: false,
    isLoadingContact: false,
    isLoadingDocuments: false,
    isLoadingInternalRefs: false,
    isLoadingNotes: false,

    overviewError: null,
    academicError: null,
    feesError: null,
    adjustmentsError: null,
    contactError: null,
    documentsError: null,
    internalRefsError: null,
    notesError: null,

    currentStudentId: null,

    // Actions
    loadOverview: async (studentId: string) => {
      set({ isLoadingOverview: true, overviewError: null });
      try {
        const data = await studentApiClient.getOverview(studentId);
        set({ overview: data, isLoadingOverview: false });
      } catch (error) {
        set({
          overviewError:
            error instanceof Error ? error.message : "Failed to load overview",
          isLoadingOverview: false,
        });
      }
    },

    loadAcademic: async (studentId: string) => {
      set({ isLoadingAcademic: true, academicError: null });
      try {
        const data = await studentApiClient.getAcademic(studentId);
        set({ academic: data, isLoadingAcademic: false });
      } catch (error) {
        set({
          academicError:
            error instanceof Error
              ? error.message
              : "Failed to load academic data",
          isLoadingAcademic: false,
        });
      }
    },

    loadFees: async (studentId: string) => {
      set({ isLoadingFees: true, feesError: null });
      try {
        const data = await studentApiClient.getFees(studentId);
        set({ fees: data, isLoadingFees: false });
      } catch (error) {
        set({
          feesError:
            error instanceof Error ? error.message : "Failed to load fees data",
          isLoadingFees: false,
        });
      }
    },

    loadAdjustments: async (studentId: string) => {
      set({ isLoadingAdjustments: true, adjustmentsError: null });
      try {
        const data = await studentApiClient.getFeeAdjustments(studentId);
        set({ adjustments: data, isLoadingAdjustments: false });
      } catch (error) {
        set({
          adjustmentsError:
            error instanceof Error
              ? error.message
              : "Failed to load adjustments",
          isLoadingAdjustments: false,
        });
      }
    },

    loadContact: async (studentId: string) => {
      set({ isLoadingContact: true, contactError: null });
      try {
        const data = await studentApiClient.getContact(studentId);
        set({ contact: data, isLoadingContact: false });
      } catch (error) {
        set({
          contactError:
            error instanceof Error
              ? error.message
              : "Failed to load contact data",
          isLoadingContact: false,
        });
      }
    },

    loadDocuments: async (studentId: string) => {
      set({ isLoadingDocuments: true, documentsError: null });
      try {
        const data = await studentApiClient.getDocuments(studentId);
        set({ documents: data, isLoadingDocuments: false });
      } catch (error) {
        set({
          documentsError:
            error instanceof Error ? error.message : "Failed to load documents",
          isLoadingDocuments: false,
        });
      }
    },

    loadInternalRefs: async (studentId: string) => {
      set({ isLoadingInternalRefs: true, internalRefsError: null });
      try {
        const data = await studentApiClient.getInternalRefs(studentId);
        set({ internalRefs: data, isLoadingInternalRefs: false });
      } catch (error) {
        set({
          internalRefsError:
            error instanceof Error
              ? error.message
              : "Failed to load internal refs",
          isLoadingInternalRefs: false,
        });
      }
    },

    loadNotes: async (studentId: string, limit = 10, offset = 0) => {
      set({ isLoadingNotes: true, notesError: null });
      try {
        const data = await studentApiClient.getNotes(studentId, limit, offset);
        set({ notes: data, isLoadingNotes: false });
      } catch (error) {
        set({
          notesError:
            error instanceof Error ? error.message : "Failed to load notes",
          isLoadingNotes: false,
        });
      }
    },

    updateContact: async (studentId: string, data) => {
      try {
        await studentApiClient.updateContact(studentId, data);
        // Reload contact data
        get().loadContact(studentId);
      } catch (error) {
        set({
          contactError:
            error instanceof Error ? error.message : "Failed to update contact",
        });
        throw error;
      }
    },

    updateInternalRefs: async (studentId: string, data) => {
      try {
        await studentApiClient.updateInternalRefs(studentId, data);
        // Reload internal refs data
        get().loadInternalRefs(studentId);
      } catch (error) {
        set({
          internalRefsError:
            error instanceof Error
              ? error.message
              : "Failed to update internal refs",
        });
        throw error;
      }
    },

    addNote: async (studentId: string, data) => {
      try {
        await studentApiClient.addNote(studentId, data);
        // Reload notes
        get().loadNotes(studentId);
      } catch (error) {
        set({
          notesError:
            error instanceof Error ? error.message : "Failed to add note",
        });
        throw error;
      }
    },

    addPayment: async (studentId: string, data) => {
      try {
        await studentApiClient.addPayment(studentId, data);
        // Reload fees data
        get().loadFees(studentId);
      } catch (error) {
        set({
          feesError:
            error instanceof Error ? error.message : "Failed to add payment",
        });
        throw error;
      }
    },

    clearData: () => {
      set({
        overview: null,
        academic: null,
        fees: null,
        adjustments: null,
        contact: null,
        documents: null,
        internalRefs: null,
        notes: null,

        isLoadingOverview: false,
        isLoadingAcademic: false,
        isLoadingFees: false,
        isLoadingAdjustments: false,
        isLoadingContact: false,
        isLoadingDocuments: false,
        isLoadingInternalRefs: false,
        isLoadingNotes: false,

        overviewError: null,
        academicError: null,
        feesError: null,
        adjustmentsError: null,
        contactError: null,
        documentsError: null,
        internalRefsError: null,
        notesError: null,
      });
    },

    setCurrentStudent: (studentId: string) => {
      const currentId = get().currentStudentId;
      if (currentId !== studentId) {
        get().clearData();
        set({ currentStudentId: studentId });
      }
    },
  })
);
