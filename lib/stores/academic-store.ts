// lib/stores/academic-store.ts
import React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { College, Course, AcademicSession } from "@/lib/types/academic";
import { listColleges, listCourses, listSessions } from "@/lib/api/academic";

interface AcademicStore {
  // State
  colleges: College[];
  courses: Course[];
  sessions: AcademicSession[];

  // Cache timestamps
  collegesLastFetch: number;
  coursesLastFetch: number;
  sessionsLastFetch: number;

  // Loading states
  collegesLoading: boolean;
  coursesLoading: boolean;
  sessionsLoading: boolean;

  // Hydration state
  isHydrated: boolean;
  setHydrated: () => void;

  // Actions
  loadColleges: (force?: boolean) => Promise<void>;
  loadCourses: (force?: boolean) => Promise<void>;
  loadSessions: (force?: boolean) => Promise<void>;
  loadAll: (force?: boolean) => Promise<void>;

  // Helper getters
  getCollegeById: (id: string) => College | undefined;
  getCourseById: (id: string) => Course | undefined;
  getSessionById: (id: string) => AcademicSession | undefined;
  getCollegeByCode: (code: string) => College | undefined;

  // Cache invalidation
  invalidateColleges: () => void;
  invalidateCourses: () => void;
  invalidateSessions: () => void;
}

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

export const useAcademicStore = create<AcademicStore>()(
  persist(
    (set, get) => ({
      // Initial state
      colleges: [],
      courses: [],
      sessions: [],
      collegesLastFetch: 0,
      coursesLastFetch: 0,
      sessionsLastFetch: 0,
      collegesLoading: false,
      coursesLoading: false,
      sessionsLoading: false,
      isHydrated: false,

      setHydrated: () => set({ isHydrated: true }),

      // Load colleges with cache check
      loadColleges: async (force = false) => {
        const { collegesLastFetch, collegesLoading } = get();
        const now = Date.now();

        // Skip if already loading
        if (collegesLoading) return;

        // Skip if cache is fresh and not forced
        if (
          !force &&
          now - collegesLastFetch < CACHE_DURATION &&
          get().colleges.length > 0
        ) {
          return;
        }

        set({ collegesLoading: true });
        try {
          const colleges = await listColleges();
          set({ colleges, collegesLastFetch: now });
        } catch (error) {
          console.error("Failed to load colleges:", error);
        } finally {
          set({ collegesLoading: false });
        }
      },

      // Load courses with cache check
      loadCourses: async (force = false) => {
        const { coursesLastFetch, coursesLoading } = get();
        const now = Date.now();

        if (coursesLoading) return;

        if (
          !force &&
          now - coursesLastFetch < CACHE_DURATION &&
          get().courses.length > 0
        ) {
          return;
        }

        set({ coursesLoading: true });
        try {
          const courses = await listCourses();

          set({ courses, coursesLastFetch: now });
        } catch (error) {
          console.error("Failed to load courses:", error);
        } finally {
          set({ coursesLoading: false });
        }
      },

      // Load sessions with cache check
      loadSessions: async (force = false) => {
        const { sessionsLastFetch, sessionsLoading } = get();
        const now = Date.now();

        if (sessionsLoading) return;

        if (
          !force &&
          now - sessionsLastFetch < CACHE_DURATION &&
          get().sessions.length > 0
        ) {
          return;
        }

        set({ sessionsLoading: true });
        try {
          const sessions = await listSessions();
          set({ sessions, sessionsLastFetch: now });
        } catch (error) {
          console.error("Failed to load sessions:", error);
        } finally {
          set({ sessionsLoading: false });
        }
      },

      // Load all data
      loadAll: async (force = false) => {
        const { loadColleges, loadCourses, loadSessions } = get();
        await Promise.all([
          loadColleges(force),
          loadCourses(force),
          loadSessions(force),
        ]);
      },

      // Helper getters
      getCollegeById: (id: string) => {
        return get().colleges.find((c) => c.id === id);
      },

      getCourseById: (id: string) => {
        return get().courses.find((c) => c.id === id);
      },

      getSessionById: (id: string) => {
        return get().sessions.find((s) => s.id === id);
      },

      getCollegeByCode: (code: string) => {
        return get().colleges.find((c) => c.code === code);
      },

      // Cache invalidation (call after mutations)
      invalidateColleges: () => {
        get().loadColleges(true);
      },

      invalidateCourses: () => {
        get().loadCourses(true);
      },

      invalidateSessions: () => {
        get().loadSessions(true);
      },
    }),
    {
      name: "academic-store",
      partialize: (state) => ({
        colleges: state.colleges,
        courses: state.courses,
        sessions: state.sessions,
        collegesLastFetch: state.collegesLastFetch,
        coursesLastFetch: state.coursesLastFetch,
        sessionsLastFetch: state.sessionsLastFetch,
      }),
    }
  )
);

// Hook for easy access to common data with hydration support
export const useAcademicData = () => {
  const store = useAcademicStore();

  // Handle hydration
  React.useEffect(() => {
    if (!store.isHydrated) {
      store.setHydrated();
    }
  }, [store]);

  // Auto-load if empty and hydrated
  React.useEffect(() => {
    if (!store.isHydrated) return;

    if (store.colleges.length === 0 && !store.collegesLoading) {
      store.loadColleges();
    }
    if (store.courses.length === 0 && !store.coursesLoading) {
      store.loadCourses();
    }
    if (store.sessions.length === 0 && !store.sessionsLoading) {
      store.loadSessions();
    }
  }, [store.isHydrated, store]);

  return {
    colleges: store.colleges,
    courses: store.courses,
    sessions: store.sessions,
    loading:
      store.collegesLoading || store.coursesLoading || store.sessionsLoading,
    isHydrated: store.isHydrated,
    getCollegeById: store.getCollegeById,
    getCourseById: store.getCourseById,
    getSessionById: store.getSessionById,
    getCollegeByCode: store.getCollegeByCode,
    invalidateColleges: store.invalidateColleges,
    invalidateCourses: store.invalidateCourses,
    invalidateSessions: store.invalidateSessions,
  };
};
