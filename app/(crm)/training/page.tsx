'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import {
  type Course,
  type CreateCoursePayload,
  type UpdateCoursePayload,
  createCourse,
  deleteCourse,
  getCourses,
  updateCourse,
} from '@/lib/api/courses.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { videoThumbnail } from '@/lib/utils/video';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// ── Shared form styles ────────────────────────────────────────────────────────

const inp =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';
const primaryBtn =
  'h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors';

// ── Course form (create + edit) ────────────────────────────────────────────────

function CourseForm({ tenantId, course, onClose }: { tenantId: string; course?: Course; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!course;

  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [category, setCategory] = useState(course?.category ?? '');
  const [videoUrl, setVideoUrl] = useState(course?.videoUrl ?? '');
  const [sortOrder, setSortOrder] = useState<number>(course?.sortOrder ?? 0);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const base = { title, description: description || undefined, category: category || undefined, videoUrl, sortOrder };
      return isEdit ? updateCourse(course.id, base as UpdateCoursePayload) : createCourse({ tenantId, ...base } as CreateCoursePayload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={lbl}>Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={2}
          placeholder="Pulling the perfect shot"
          className={inp}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={lbl}>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Barista Basics" className={inp} />
        </div>
        <div>
          <label className={lbl}>Sort order</label>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Video URL</label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          required
          placeholder="https://youtube.com/watch?v=…"
          className={inp}
        />
      </div>
      <div>
        <label className={lbl}>Description · Markdown supported</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={'## What you will learn\n- Grind size\n- Tamping\n\nSee the [guide](https://…).'}
          className={inp + ' h-auto py-2 resize-y font-mono text-xs'}
        />
      </div>

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── Delete confirmation ─────────────────────────────────────────────────────

function DeleteCourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      onClose();
    },
  });
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Delete <span className="font-semibold text-foreground">{course.title}</span>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => mutate()}
          disabled={isPending}
          className="flex-1 h-10 bg-destructive hover:bg-destructive/90 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// ── Course card (YouTube-style) ─────────────────────────────────────────────────

function CourseCard({
  course,
  isManager,
  onEdit,
  onDelete,
}: {
  course: Course;
  isManager: boolean;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
}) {
  const thumb = videoThumbnail(course.videoUrl);

  return (
    <Link href={`/training/${course.id}`} className="group block">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted border border-border">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={course.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-200]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-primary/15 to-primary/5">
            <Play size={28} className="text-primary/60" />
          </div>
        )}
        {/* Manager actions */}
        {isManager && (
          <div className="absolute top-2 right-2 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.preventDefault();
                onEdit(course);
              }}
              title="Edit"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(course);
              }}
              title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 text-white hover:bg-destructive transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <p className="text-sm font-semibold text-foreground mt-2 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
        {course.title}
      </p>
    </Link>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

type ModalState = { type: 'create' } | { type: 'edit'; course: Course } | { type: 'delete'; course: Course };

export default function TrainingPage() {
  const { tenantId } = useWorkspaceStore();
  const isManager = roleAtLeast(
    useAuthStore((s) => s.role),
    'store_manager',
  );
  const [modal, setModal] = useState<ModalState | null>(null);
  const close = () => setModal(null);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['courses', tenantId],
    queryFn: () => getCourses(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  // Group by category (sorted), courses ordered by sortOrder then title.
  const groups = useMemo(() => {
    const map = new Map<string, Course[]>();
    const sorted = [...courses].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    for (const c of sorted) {
      const key = c.category?.trim() || 'Uncategorised';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [courses]);

  return (
    <>
      <PageLayout
        eyebrow="Learning"
        title="Training"
        fullHeight
        headerBorder={false}
        headerSlot={
          tenantId && isManager ? (
            <button onClick={() => setModal({ type: 'create' })} className={primaryBtn}>
              <Plus size={15} />
              New Course
            </button>
          ) : undefined
        }
      >
        <div className="h-full overflow-auto pb-8">
          {!tenantId ? (
            <div className="py-24">
              <EmptyState icon={GraduationCap} title="No workspace selected" description="Select a workspace to view courses." />
            </div>
          ) : isLoading ? (
            <div className="grid gap-x-4 gap-y-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="aspect-video rounded-xl bg-muted animate-pulse" />
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="py-24">
              <EmptyState
                icon={GraduationCap}
                title="No courses yet"
                description={isManager ? 'Click "New Course" to add your first training video.' : 'Training videos will appear here.'}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map(([category, list]) => (
                <section key={category}>
                  <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    {category}
                    <span className="text-xs font-medium text-muted-foreground">· {list.length}</span>
                  </h2>
                  <div className="grid gap-x-4 gap-y-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {list.map((course) => (
                      <CourseCard
                        key={course.id}
                        course={course}
                        isManager={isManager}
                        onEdit={(c) => setModal({ type: 'edit', course: c })}
                        onDelete={(c) => setModal({ type: 'delete', course: c })}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </PageLayout>

      {modal?.type === 'create' && tenantId && (
        <Modal title="New Course" onClose={close}>
          <CourseForm tenantId={tenantId} onClose={close} />
        </Modal>
      )}
      {modal?.type === 'edit' && tenantId && (
        <Modal title="Edit Course" onClose={close}>
          <CourseForm tenantId={tenantId} course={modal.course} onClose={close} />
        </Modal>
      )}
      {modal?.type === 'delete' && (
        <Modal title="Delete Course" onClose={close}>
          <DeleteCourseModal course={modal.course} onClose={close} />
        </Modal>
      )}
    </>
  );
}
