import { apiFetch } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  tenantId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  videoUrl: string;
  sortOrder: number;
  createdAt: string;
}

export interface CreateCoursePayload {
  tenantId: string;
  title: string;
  description?: string;
  category?: string;
  videoUrl: string;
  sortOrder?: number;
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  category?: string;
  videoUrl?: string;
  sortOrder?: number;
}

// ── Operations ──────────────────────────────────────────────────────────────

// List courses for a tenant, ordered by sortOrder then title.
export const getCourses = (tenantId?: string) => {
  const qs = tenantId ? `?tenantId=${tenantId}` : '';
  return apiFetch<Course[]>(`/courses${qs}`);
};

export const getCourse = (id: string) => apiFetch<Course>(`/courses/${id}`);

// Create a course (store_manager+). Published immediately.
export const createCourse = (data: CreateCoursePayload) =>
  apiFetch<Course>('/courses', { method: 'POST', body: JSON.stringify(data) });

export const updateCourse = (id: string, data: UpdateCoursePayload) =>
  apiFetch<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCourse = (id: string) =>
  apiFetch<{ success: boolean; id: string }>(`/courses/${id}`, { method: 'DELETE' });
