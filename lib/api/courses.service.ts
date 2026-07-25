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
  isPublished: boolean;
  estimatedMinutes: number;
  isMandatory: boolean;
  validityDays?: number | null;
  version: number;
  completionRule: 'acknowledge' | 'practical_signoff';
  completed: boolean;
  completedAt?: string | null;
  assignment?: { required: boolean; dueAt?: string | null; startedAt?: string | null; status?: TrainingStatus } | null;
  signoff?: { id: string; status: 'pending' | 'approved' | 'rejected'; requestedAt: string; assessorNotes?: string | null } | null;
  createdAt: string;
}

export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
export interface TrainingAssignment {
  id: string; courseId: string; required: boolean; dueAt?: string | null; startedAt?: string | null;
  assignedAt: string; status: TrainingStatus; completedAt?: string | null; expiresAt?: string | null;
  course: Pick<Course, 'id' | 'title' | 'category' | 'videoUrl' | 'description' | 'estimatedMinutes' | 'completionRule'>;
}
export interface ComplianceRow { assignmentId: string; courseId: string; userId: string; employeeName: string; employeeEmail: string; courseTitle: string; category?: string | null; required: boolean; dueAt?: string | null; startedAt?: string | null; completedAt?: string | null; expiresAt?: string | null; status: TrainingStatus }
export interface ComplianceReport { summary: { total: number; completed: number; overdue: number; inProgress: number; notStarted: number; expired: number; completionRate: number }; rows: ComplianceRow[] }
export interface TrainingSignoff { id: string; courseId: string; userId: string; courseTitle: string; employeeName: string; employeeEmail: string; employeeNotes?: string | null; status: string; requestedAt: string }

export interface CreateCoursePayload {
  tenantId: string;
  title: string;
  description?: string;
  category?: string;
  videoUrl: string;
  sortOrder?: number;
  isPublished?: boolean;
  estimatedMinutes?: number;
  isMandatory?: boolean;
  validityDays?: number | null;
  completionRule?: 'acknowledge' | 'practical_signoff';
}

export interface UpdateCoursePayload {
  title?: string;
  description?: string;
  category?: string;
  videoUrl?: string;
  sortOrder?: number;
  isPublished?: boolean;
  estimatedMinutes?: number;
  isMandatory?: boolean;
  validityDays?: number | null;
  completionRule?: 'acknowledge' | 'practical_signoff';
}

// ── Operations ──────────────────────────────────────────────────────────────

// List courses for a tenant, ordered by sortOrder then title.
export const getCourses = (tenantId?: string) => {
  const qs = tenantId ? `?${new URLSearchParams({ tenantId })}` : '';
  return apiFetch<Course[]>(`/courses${qs}`);
};

export const getCourse = (id: string) => apiFetch<Course>(`/courses/${id}`);

// Create a course (store_manager+). Published immediately.
export const createCourse = (data: CreateCoursePayload) => apiFetch<Course>('/courses', { method: 'POST', body: JSON.stringify(data) });

export const updateCourse = (id: string, data: UpdateCoursePayload) =>
  apiFetch<Course>(`/courses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCourse = (id: string) => apiFetch<{ success: boolean; id: string }>(`/courses/${id}`, { method: 'DELETE' });

export const getMyTrainingAssignments = () => apiFetch<TrainingAssignment[]>('/courses/my-assignments');
export const getTrainingCompliance = (tenantId?: string) => apiFetch<ComplianceReport>(`/courses/compliance${tenantId ? `?tenantId=${tenantId}` : ''}`);
export const getTrainingSignoffs = () => apiFetch<TrainingSignoff[]>('/courses/signoffs');
export const assignCourse = (courseId: string, data: { userIds: string[]; dueAt?: string | null; required?: boolean }) =>
  apiFetch<{ success: boolean; assigned: number }>(`/courses/${courseId}/assign`, { method: 'POST', body: JSON.stringify(data) });
export const startCourse = (courseId: string) => apiFetch<{ started: boolean }>(`/courses/${courseId}/start`, { method: 'POST' });
export const completeCourse = (courseId: string) => apiFetch<{ completed: boolean; completedAt: string; expiresAt?: string | null }>(`/courses/${courseId}/complete`, { method: 'POST' });
export const requestCourseSignoff = (courseId: string, notes?: string) => apiFetch<{ id: string; status: string; requestedAt: string }>(`/courses/${courseId}/signoff-request`, { method: 'POST', body: JSON.stringify({ notes }) });
export const reviewCourseSignoff = (courseId: string, signoffId: string, status: 'approved' | 'rejected', notes?: string) => apiFetch<{ success: boolean; status: string }>(`/courses/${courseId}/signoffs/${signoffId}`, { method: 'PATCH', body: JSON.stringify({ status, notes }) });
