'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Award,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  GraduationCap,
  Layers3,
  LayoutGrid,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { ROLES, ROLE_CONFIG } from '@/components/people/shared';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { LessonContentEditor } from '@/components/training/LessonContentEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type ComplianceRow,
  type Course,
  type CreateCoursePayload,
  type TrainingAssignment,
  type TrainingSignoff,
  type TrainingStatus,
  assignCourse,
  createCourse,
  deleteCourse,
  getCourses,
  getMyTrainingAssignments,
  getTrainingCompliance,
  getTrainingSignoffs,
  reviewCourseSignoff,
  updateCourse,
} from '@/lib/api/courses.service';
import { type StaffProfile, type StaffRole, getStaff } from '@/lib/api/staff.service';
import { cn } from '@/lib/utils/cn';
import { videoThumbnail } from '@/lib/utils/video';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'learning' | 'courses' | 'compliance';
const inp =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';
const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date';
const statusLabel: Record<TrainingStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  overdue: 'Overdue',
  expired: 'Expired',
};
const statusVariant = (status: TrainingStatus): 'muted' | 'warning' | 'success' | 'destructive' | 'primary' =>
  status === 'completed'
    ? 'success'
    : status === 'overdue' || status === 'expired'
      ? 'destructive'
      : status === 'in_progress'
        ? 'primary'
        : 'muted';

export function TrainingWorkspace() {
  const role = useAuthStore((state) => state.role);
  const { tenantId } = useWorkspaceStore();
  const manager = !!role && ['super_admin', 'franchise_owner', 'store_manager', 'hr_manager'].includes(role);
  const [tab, setTab] = useState<Tab>('learning');
  return (
    <PageLayout
      eyebrow="Learning & compliance"
      title="Training"
      fullHeight
      headerBorder={false}
      headerSlot={
        <div className="flex gap-1 overflow-x-auto">
          <TabButton active={tab === 'learning'} onClick={() => setTab('learning')} icon={BookOpen}>
            My learning
          </TabButton>
          {manager && (
            <>
              <TabButton active={tab === 'courses'} onClick={() => setTab('courses')} icon={LayoutGrid}>
                Manage courses
              </TabButton>
              <TabButton active={tab === 'compliance'} onClick={() => setTab('compliance')} icon={ShieldCheck}>
                Compliance
              </TabButton>
            </>
          )}
        </div>
      }
    >
      <div className="max-w-[1500px] mx-auto pb-8">
        {!tenantId ? (
          <div className="py-24">
            <EmptyState icon={GraduationCap} title="No workspace selected" description="Select a workspace to view training." />
          </div>
        ) : tab === 'learning' ? (
          <LearningView tenantId={tenantId} />
        ) : tab === 'courses' ? (
          <CourseManagement tenantId={tenantId} />
        ) : (
          <ComplianceView tenantId={tenantId} />
        )}
      </div>
    </PageLayout>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof BookOpen;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-9 px-3 rounded-lg inline-flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon size={15} />
      {children}
    </button>
  );
}

function LearningView({ tenantId }: { tenantId: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expandedPaths, setExpandedPaths] = useState<string[]>([]);
  const { data: courses = [], isLoading, isError } = useQuery({ queryKey: ['courses', tenantId], queryFn: () => getCourses(tenantId) });
  const { data: assignments = [] } = useQuery({ queryKey: ['training-assignments-me'], queryFn: getMyTrainingAssignments });
  const assignedByCourse = useMemo(() => new Map(assignments.map((item) => [item.courseId, item])), [assignments]);
  const visible = useMemo(
    () =>
      courses.filter((course) => {
        const assignment = assignedByCourse.get(course.id);
        const status = assignment?.status ?? (course.completed ? 'completed' : 'not_started');
        if (filter === 'required' && !assignment?.required) return false;
        if (filter === 'incomplete' && status === 'completed') return false;
        if (filter === 'completed' && status !== 'completed') return false;
        const q = search.trim().toLowerCase();
        return !q || `${course.title} ${course.category ?? ''} ${course.description ?? ''}`.toLowerCase().includes(q);
      }),
    [courses, assignments, assignedByCourse, filter, search],
  );
  const learningPaths = useMemo(() => {
    const includedCategories = new Set(visible.map((course) => course.category?.trim() || 'Other training'));
    const groups = new Map<string, Course[]>();
    courses.forEach((course) => {
      const category = course.category?.trim() || 'Other training';
      if (!includedCategories.has(category)) return;
      groups.set(category, [...(groups.get(category) ?? []), course]);
    });
    return Array.from(groups, ([category, lessons]) => ({
      category,
      lessons: lessons.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    })).sort((a, b) => a.category.localeCompare(b.category));
  }, [courses, visible]);
  const visibleLessonCount = learningPaths.reduce((total, path) => total + path.lessons.length, 0);
  const incomplete = assignments.filter((item) => item.status !== 'completed');
  const completed = assignments.filter((item) => item.status === 'completed').length;
  const overdue = assignments.filter((item) => item.status === 'overdue').length;
  const progress = assignments.length
    ? Math.round((completed / assignments.length) * 100)
    : courses.filter((course) => course.completed).length
      ? 100
      : 0;
  const next = incomplete[0];
  if (isLoading) return <CourseSkeleton />;
  if (isError)
    return (
      <div className="py-24">
        <EmptyState icon={CircleAlert} title="Training couldn’t be loaded" description="Refresh the page or try again shortly." />
      </div>
    );
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 md:p-7 overflow-hidden relative">
        <div className="relative z-10 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your development</p>
          <h2 className="text-2xl md:text-3xl font-semibold mt-2">
            {next
              ? `Continue: ${next.course.title}`
              : assignments.length
                ? 'You’re fully up to date'
                : 'Build skills that make every shift better'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {next
              ? `${next.course.estimatedMinutes} min · ${next.required ? 'Required training' : 'Optional learning'}${next.dueAt ? ` · Due ${fmtDate(next.dueAt)}` : ''}`
              : 'Complete assigned training and explore your team’s operating guides.'}
          </p>
          {next && (
            <Button asChild className="mt-5">
              <Link href={`/training/${next.courseId}`}>
                <Play />
                Continue learning
              </Link>
            </Button>
          )}
        </div>
        <GraduationCap className="absolute -right-8 -bottom-12 size-56 text-primary/5" />
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric icon={BookOpen} label="Assigned" value={String(assignments.length)} />
        <Metric icon={CheckCircle2} label="Completed" value={String(completed)} tone="success" />
        <Metric icon={CalendarClock} label="Overdue" value={String(overdue)} tone={overdue ? 'danger' : undefined} />
        <Metric icon={Award} label="Progress" value={`${progress}%`} tone="primary" />
      </div>
      {incomplete.length > 0 && (
        <section>
          <SectionTitle title="Required and upcoming" description="Your priority learning, ordered by due date." />
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {incomplete.slice(0, 6).map((assignment) => (
              <AssignedCourseCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </section>
      )}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <SectionTitle
            title="Learning paths"
            description={`${learningPaths.length} ${learningPaths.length === 1 ? 'category' : 'categories'} · ${visibleLessonCount} ${visibleLessonCount === 1 ? 'lesson' : 'lessons'}.`}
          />
          <div className="flex gap-2">
            <div className="w-full md:w-64">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                leftIcon={<Search />}
                placeholder="Search paths or lessons…"
              />
            </div>
            <Select
              value={filter}
              onValueChange={setFilter}
              options={[
                { value: 'all', label: 'All lessons' },
                { value: 'required', label: 'Required' },
                { value: 'incomplete', label: 'Not completed' },
                { value: 'completed', label: 'Completed' },
              ]}
              ariaLabel="Lesson filter"
              className="w-40"
            />
          </div>
        </div>
        {learningPaths.length ? (
          <div className="grid xl:grid-cols-2 gap-5">
            {learningPaths.map((path) => (
              <LearningPathCard
                key={path.category}
                category={path.category}
                lessons={path.lessons}
                assignments={assignedByCourse}
                expanded={expandedPaths.includes(path.category)}
                onToggle={() =>
                  setExpandedPaths((current) =>
                    current.includes(path.category) ? current.filter((item) => item !== path.category) : [...current, path.category],
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            No lessons match these filters.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  tone?: 'success' | 'danger' | 'primary';
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon
          size={15}
          className={cn(
            tone === 'success' && 'text-success',
            tone === 'danger' && 'text-destructive',
            tone === 'primary' && 'text-primary',
          )}
        />
        {label}
      </div>
      <p className="text-2xl font-semibold mt-2 tabular-nums">{value}</p>
    </div>
  );
}
function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function AssignedCourseCard({ assignment }: { assignment: TrainingAssignment }) {
  return (
    <Link
      href={`/training/${assignment.courseId}`}
      className={cn(
        'rounded-2xl border bg-card p-4 flex gap-4 hover:border-primary/40 hover:shadow-sm transition-all',
        assignment.status === 'overdue' ? 'border-destructive/30' : 'border-border',
      )}
    >
      <div
        className={cn(
          'size-11 rounded-xl flex items-center justify-center shrink-0',
          assignment.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
        )}
      >
        <BookOpen size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-snug line-clamp-2">{assignment.course.title}</p>
          <Badge variant={statusVariant(assignment.status)}>{statusLabel[assignment.status]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {assignment.course.estimatedMinutes} min{assignment.dueAt ? ` · Due ${fmtDate(assignment.dueAt)}` : ''}
        </p>
      </div>
    </Link>
  );
}

function LearningPathCard({
  category,
  lessons,
  assignments,
  expanded,
  onToggle,
}: {
  category: string;
  lessons: Course[];
  assignments: Map<string, TrainingAssignment>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const lessonStatus = (lesson: Course) => assignments.get(lesson.id)?.status ?? (lesson.completed ? 'completed' : 'not_started');
  const completed = lessons.filter((lesson) => lessonStatus(lesson) === 'completed').length;
  const minutes = lessons.reduce((total, lesson) => total + lesson.estimatedMinutes, 0);
  const overdue = lessons.filter((lesson) => ['overdue', 'expired'].includes(lessonStatus(lesson))).length;
  const nextLesson = lessons.find((lesson) => lessonStatus(lesson) !== 'completed') ?? lessons[0];
  const progress = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const shownLessons = expanded ? lessons : lessons.slice(0, 4);

  return (
    <article className="rounded-3xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="p-5 md:p-6 bg-gradient-to-br from-primary/10 via-card to-card border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <span className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Layers3 size={23} />
          </span>
          <div className="flex gap-2">
            {overdue > 0 && <Badge variant="destructive">{overdue} overdue</Badge>}
            {completed === lessons.length && <Badge variant="success">Completed</Badge>}
          </div>
        </div>
        <h3 className="text-xl font-semibold mt-4">{category}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {lessons.length} {lessons.length === 1 ? 'lesson' : 'lessons'} · {minutes} min total
        </p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums">
            {completed}/{lessons.length}
          </span>
        </div>
        <Button asChild className="w-full mt-4">
          <Link href={`/training/${nextLesson.id}`}>
            {progress > 0 && progress < 100 ? 'Continue path' : progress === 100 ? 'Review path' : 'Start path'}
            <ChevronRight />
          </Link>
        </Button>
      </div>
      <div className="p-3">
        <div className="space-y-1">
          {shownLessons.map((lesson, index) => {
            const status = lessonStatus(lesson);
            const lessonNumber = lessons.indexOf(lesson) + 1;
            return (
              <Link
                key={lesson.id}
                href={`/training/${lesson.id}`}
                className="group flex items-center gap-3 rounded-xl p-3 hover:bg-muted/70 transition-colors"
              >
                <span
                  className={cn(
                    'size-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold',
                    status === 'completed'
                      ? 'bg-success/10 border-success/30 text-success'
                      : status === 'overdue' || status === 'expired'
                        ? 'bg-destructive/10 border-destructive/30 text-destructive'
                        : status === 'in_progress'
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'border-border text-muted-foreground',
                  )}
                >
                  {status === 'completed' ? <Check size={15} /> : lessonNumber}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate group-hover:text-primary">{lesson.title}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Lesson {lessonNumber} · {lesson.estimatedMinutes} min{assignments.get(lesson.id)?.required ? ' · Required' : ''}
                  </span>
                </span>
                <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary" />
              </Link>
            );
          })}
        </div>
        {lessons.length > 4 && (
          <button
            type="button"
            onClick={onToggle}
            className="w-full mt-1 h-10 rounded-xl text-xs font-semibold text-primary hover:bg-primary/5 inline-flex items-center justify-center gap-1.5"
          >
            {expanded ? 'Show fewer lessons' : `Show all ${lessons.length} lessons`}
            <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
    </article>
  );
}

function CourseManagement({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ type: 'create' } | { type: 'edit' | 'assign' | 'archive'; course: Course } | null>(null);
  const { data: courses = [], isLoading } = useQuery({ queryKey: ['courses', tenantId], queryFn: () => getCourses(tenantId) });
  const { data: signoffs = [] } = useQuery({ queryKey: ['training-signoffs'], queryFn: getTrainingSignoffs });
  const review = useMutation({
    mutationFn: ({ signoff, status }: { signoff: TrainingSignoff; status: 'approved' | 'rejected' }) =>
      reviewCourseSignoff(signoff.courseId, signoff.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-signoffs'] });
      qc.invalidateQueries({ queryKey: ['training-compliance'] });
      toast('success', 'Practical sign-off reviewed.');
    },
    onError: (error) => toast('error', (error as Error).message),
  });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <SectionTitle title="Lesson management" description="Create lessons, organize them into learning paths, and assign training." />
        <Button onClick={() => setModal({ type: 'create' })}>
          <Plus />
          New lesson
        </Button>
      </div>
      {signoffs.length > 0 && (
        <section className="rounded-2xl border border-warning/30 bg-warning/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-warning/20">
            <h3 className="font-semibold flex items-center gap-2">
              <Award size={17} className="text-warning" />
              Practical sign-offs awaiting review <Badge variant="warning">{signoffs.length}</Badge>
            </h3>
          </div>
          <div className="divide-y divide-warning/15">
            {signoffs.map((item) => (
              <div key={item.id} className="p-4 md:px-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.employeeName} · {item.courseTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requested {fmtDate(item.requestedAt)}
                    {item.employeeNotes ? ` · ${item.employeeNotes}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => review.mutate({ signoff: item, status: 'rejected' })}>
                    <X />
                    Needs more practice
                  </Button>
                  <Button size="sm" onClick={() => review.mutate({ signoff: item, status: 'approved' })}>
                    <Check />
                    Sign off
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex justify-center">
            <Loader2 className="animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="py-20">
            <EmptyState icon={GraduationCap} title="No courses yet" description="Create your first operational training course." />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {courses.map((course) => (
              <div key={course.id} className="p-4 md:px-5 flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="size-16 rounded-xl overflow-hidden bg-muted shrink-0">
                  {videoThumbnail(course.videoUrl) ? (
                    <img src={videoThumbnail(course.videoUrl)!} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center">
                      <Play />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{course.title}</p>
                    <Badge variant={course.isPublished ? 'success' : 'muted'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>
                    {course.isMandatory && <Badge variant="warning">Mandatory</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {course.category || 'Uncategorised'} · {course.estimatedMinutes} min · Version {course.version}
                    {course.validityDays ? ` · renew every ${course.validityDays} days` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setModal({ type: 'assign', course })}>
                    <UsersRound />
                    Assign
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal({ type: 'edit', course })}>
                    <Pencil />
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setModal({ type: 'archive', course })}>
                    <Archive />
                    Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {modal?.type === 'create' && (
        <Modal title="Create lesson" onClose={() => setModal(null)} className="max-w-5xl">
          <CourseForm
            tenantId={tenantId}
            onDone={() => {
              setModal(null);
              qc.invalidateQueries({ queryKey: ['courses'] });
            }}
          />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit lesson" onClose={() => setModal(null)} className="max-w-5xl">
          <CourseForm
            tenantId={tenantId}
            course={modal.course}
            onDone={() => {
              setModal(null);
              qc.invalidateQueries({ queryKey: ['courses'] });
            }}
          />
        </Modal>
      )}
      {modal?.type === 'assign' && (
        <Modal title={`Assign training · ${modal.course.title}`} onClose={() => setModal(null)} className="max-w-2xl">
          <AssignmentForm
            tenantId={tenantId}
            course={modal.course}
            courses={courses}
            onDone={() => {
              setModal(null);
              qc.invalidateQueries({ queryKey: ['training-compliance'] });
            }}
          />
        </Modal>
      )}
      {modal?.type === 'archive' && (
        <Modal title="Archive course" onClose={() => setModal(null)}>
          <ArchiveCourse
            course={modal.course}
            onDone={() => {
              setModal(null);
              qc.invalidateQueries({ queryKey: ['courses'] });
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function CourseForm({ tenantId, course, onDone }: { tenantId: string; course?: Course; onDone: () => void }) {
  const [form, setForm] = useState<CreateCoursePayload>({
    tenantId,
    title: course?.title ?? '',
    description: course?.description ?? '',
    category: course?.category ?? '',
    videoUrl: course?.videoUrl?.startsWith('lesson://') ? '' : (course?.videoUrl ?? ''),
    sortOrder: course?.sortOrder ?? 0,
    isPublished: course?.isPublished ?? false,
    estimatedMinutes: course?.estimatedMinutes ?? 10,
    isMandatory: course?.isMandatory ?? false,
    validityDays: course?.validityDays ?? null,
    completionRule: course?.completionRule ?? 'acknowledge',
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, videoUrl: form.videoUrl.trim() || 'lesson://text' };
      return course ? updateCourse(course.id, payload) : createCourse(payload);
    },
    onSuccess: () => {
      toast('success', course ? 'Course updated.' : 'Course created.');
      onDone();
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="space-y-5"
    >
      <div>
        <label className={lbl}>Lesson title</label>
        <input
          className={inp}
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Taking an order in POS"
          required
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Learning path / category</label>
          <input
            className={inp}
            value={form.category ?? ''}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            placeholder="Duma App · Barista Essentials"
          />
        </div>
        <div>
          <label className={lbl}>Estimated duration</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="1440"
              className={cn(inp, 'pr-14')}
              value={form.estimatedMinutes}
              onChange={(event) => setForm({ ...form, estimatedMinutes: Number(event.target.value) })}
            />
            <span className="absolute right-3 top-3 text-xs text-muted-foreground">min</span>
          </div>
        </div>
      </div>
      <div>
        <label className={lbl}>Video URL · optional</label>
        <input
          className={inp}
          value={form.videoUrl}
          onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
          placeholder="Leave blank for a document lesson"
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Without a video, employees will read the rich lesson document in the main content area.
        </p>
      </div>
      <div>
        <label className={lbl}>Lesson content</label>
        <LessonContentEditor
          value={form.description ?? ''}
          onChange={(description) => setForm({ ...form, description })}
          tenantId={tenantId}
          courseId={course?.id}
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Completion rule</label>
          <Select
            value={form.completionRule ?? 'acknowledge'}
            onValueChange={(value) => setForm({ ...form, completionRule: value as CreateCoursePayload['completionRule'] })}
            options={[
              { value: 'acknowledge', label: 'Employee acknowledgement' },
              { value: 'practical_signoff', label: 'Manager practical sign-off' },
            ]}
            ariaLabel="Completion rule"
          />
        </div>
        <div>
          <label className={lbl}>Renewal</label>
          <Select
            value={form.validityDays ? String(form.validityDays) : 'never'}
            onValueChange={(value) => setForm({ ...form, validityDays: value === 'never' ? null : Number(value) })}
            options={[
              { value: 'never', label: 'Does not expire' },
              { value: '90', label: 'Every 3 months' },
              { value: '180', label: 'Every 6 months' },
              { value: '365', label: 'Every year' },
              { value: '730', label: 'Every 2 years' },
            ]}
            ariaLabel="Renewal period"
          />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle
          checked={!!form.isMandatory}
          onChange={(checked) => setForm({ ...form, isMandatory: checked })}
          title="Mandatory lesson"
          description="Highlighted as required when assigned."
        />
        <Toggle
          checked={!!form.isPublished}
          onChange={(checked) => setForm({ ...form, isPublished: checked })}
          title="Publish now"
          description="Visible to employees immediately."
        />
      </div>
      <Button type="submit" className="w-full" disabled={form.title.length < 2 || save.isPending}>
        {save.isPending && <Loader2 className="animate-spin" />}
        {course ? 'Save changes' : 'Create lesson'}
      </Button>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn('rounded-xl border p-3 text-left flex gap-3', checked ? 'border-primary/40 bg-primary/5' : 'border-border')}
    >
      <span
        className={cn(
          'mt-0.5 size-5 rounded-md border flex items-center justify-center shrink-0',
          checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
        )}
      >
        {checked && <Check size={13} />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
    </button>
  );
}

function AssignmentForm({
  tenantId,
  course,
  courses,
  onDone,
}: {
  tenantId: string;
  course: Course;
  courses: Course[];
  onDone: () => void;
}) {
  const { data: staff = [], isLoading } = useQuery({ queryKey: ['staff', tenantId], queryFn: () => getStaff(tenantId) });
  const [audienceMode, setAudienceMode] = useState<'roles' | 'employees'>('roles');
  const [scope, setScope] = useState<'lesson' | 'category'>('lesson');
  const [selectedRoles, setSelectedRoles] = useState<StaffRole[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
  const activeStaff = staff.filter((member) => member.isActive);
  const visibleStaff = activeStaff.filter((member) =>
    `${member.name} ${member.email} ${ROLE_CONFIG[member.role].label}`.toLowerCase().includes(search.toLowerCase()),
  );
  const categoryLessons = courses.filter((item) => item.category === course.category && item.isPublished);
  const targetLessons = scope === 'category' ? categoryLessons : [course];
  const targetUserIds =
    audienceMode === 'roles'
      ? activeStaff.filter((member) => selectedRoles.includes(member.role)).map((member) => member.userId)
      : selectedEmployees;
  const roleCounts = new Map<StaffRole, number>(ROLES.map((role) => [role, activeStaff.filter((member) => member.role === role).length]));
  const save = useMutation({
    mutationFn: () =>
      Promise.all(
        targetLessons.map((lesson) =>
          assignCourse(lesson.id, { userIds: targetUserIds, dueAt: dueAt ? new Date(`${dueAt}T23:59:59`).toISOString() : null, required }),
        ),
      ),
    onSuccess: () => {
      toast(
        'success',
        `${targetLessons.length} ${targetLessons.length === 1 ? 'lesson' : 'lessons'} assigned to ${targetUserIds.length} ${targetUserIds.length === 1 ? 'employee' : 'employees'}.`,
      );
      onDone();
    },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <div className="space-y-5">
      <div>
        <label className={lbl}>What to assign</label>
        <div className="grid sm:grid-cols-2 gap-2">
          <ChoiceCard selected={scope === 'lesson'} onClick={() => setScope('lesson')} title="This lesson" description={course.title} />
          <ChoiceCard
            selected={scope === 'category'}
            onClick={() => setScope('category')}
            disabled={!course.category || categoryLessons.length < 2}
            title="Entire learning path"
            description={
              course.category ? `${course.category} · ${categoryLessons.length} published lessons` : 'This lesson has no category'
            }
          />
        </div>
      </div>
      <div>
        <label className={lbl}>Assign to</label>
        <div className="inline-flex rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setAudienceMode('roles')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold',
              audienceMode === 'roles' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Roles
          </button>
          <button
            type="button"
            onClick={() => setAudienceMode('employees')}
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold',
              audienceMode === 'employees' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
            )}
          >
            Specific employees
          </button>
        </div>
      </div>
      {audienceMode === 'roles' ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {ROLES.filter((role) => (roleCounts.get(role) ?? 0) > 0).map((role) => {
            const selected = selectedRoles.includes(role);
            const count = roleCounts.get(role) ?? 0;
            return (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRoles((current) => (selected ? current.filter((item) => item !== role) : [...current, role]))}
                className={cn(
                  'rounded-xl border p-3 flex items-center gap-3 text-left transition-colors',
                  selected ? `${ROLE_CONFIG[role].border} ${ROLE_CONFIG[role].bg}` : 'border-border hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'size-5 rounded-md border flex items-center justify-center shrink-0',
                    selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {selected && <Check size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-semibold', selected && ROLE_CONFIG[role].text)}>{ROLE_CONFIG[role].label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {count} active {count === 1 ? 'employee' : 'employees'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            leftIcon={<Search />}
            placeholder="Search employees or roles…"
          />
          <div className="border border-border rounded-xl max-h-64 overflow-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="animate-spin" />
              </div>
            ) : (
              visibleStaff.map((member) => (
                <EmployeeChoice
                  key={member.userId}
                  member={member}
                  selected={selectedEmployees.includes(member.userId)}
                  onToggle={() =>
                    setSelectedEmployees((current) =>
                      current.includes(member.userId) ? current.filter((id) => id !== member.userId) : [...current, member.userId],
                    )
                  }
                />
              ))
            )}
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-semibold text-primary"
              onClick={() =>
                setSelectedEmployees(
                  visibleStaff.every((member) => selectedEmployees.includes(member.userId))
                    ? selectedEmployees.filter((id) => !visibleStaff.some((member) => member.userId === id))
                    : Array.from(new Set([...selectedEmployees, ...visibleStaff.map((member) => member.userId)])),
                )
              }
            >
              {visibleStaff.every((member) => selectedEmployees.includes(member.userId))
                ? 'Clear visible employees'
                : 'Select visible employees'}
            </button>
            <span className="text-xs text-muted-foreground">{selectedEmployees.length} selected</span>
          </div>
        </>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Due date</label>
          <input type="date" className={inp} value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-primary">Assignment summary</p>
          <p className="text-sm font-semibold mt-1">
            {targetLessons.length} {targetLessons.length === 1 ? 'lesson' : 'lessons'} × {targetUserIds.length}{' '}
            {targetUserIds.length === 1 ? 'employee' : 'employees'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{targetLessons.length * targetUserIds.length} assignment records</p>
        </div>
      </div>
      <Toggle
        checked={required}
        onChange={setRequired}
        title="Required assignment"
        description="Included in compliance and overdue reporting."
      />
      <Button className="w-full" onClick={() => save.mutate()} disabled={!targetUserIds.length || !targetLessons.length || save.isPending}>
        {save.isPending && <Loader2 className="animate-spin" />}Assign training
      </Button>
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed',
        selected ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/50',
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn('size-4 rounded-full border flex items-center justify-center', selected ? 'border-primary' : 'border-border')}>
          {selected && <span className="size-2 rounded-full bg-primary" />}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </span>
      <span className="block text-xs text-muted-foreground mt-1 ml-6 line-clamp-2">{description}</span>
    </button>
  );
}
function EmployeeChoice({ member, selected, onToggle }: { member: StaffProfile; selected: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 text-left">
      <span
        className={cn(
          'size-5 rounded-md border flex items-center justify-center',
          selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border',
        )}
      >
        {selected && <Check size={13} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate">{member.name ?? member.email}</span>
        <span className="block text-xs text-muted-foreground truncate">{member.email}</span>
      </span>
    </button>
  );
}
function ArchiveCourse({ course, onDone }: { course: Course; onDone: () => void }) {
  const archive = useMutation({
    mutationFn: () => deleteCourse(course.id),
    onSuccess: () => {
      toast('success', 'Course archived. Completion history was retained.');
      onDone();
    },
    onError: (e) => toast('error', (e as Error).message),
  });
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Archive <strong className="text-foreground">{course.title}</strong>? Employees will no longer see it, but assignments and completion
        history remain available for compliance records.
      </p>
      <Button variant="destructive" className="w-full" onClick={() => archive.mutate()} disabled={archive.isPending}>
        {archive.isPending && <Loader2 className="animate-spin" />}Archive course
      </Button>
    </div>
  );
}

function ComplianceView({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['training-compliance', tenantId],
    queryFn: () => getTrainingCompliance(tenantId),
  });
  const rows = (data?.rows ?? []).filter(
    (row) =>
      (status === 'all' || row.status === status) &&
      (!search || `${row.employeeName} ${row.employeeEmail} ${row.courseTitle}`.toLowerCase().includes(search.toLowerCase())),
  );
  if (isLoading) return <CourseSkeleton />;
  if (isError)
    return (
      <div className="py-24">
        <EmptyState icon={CircleAlert} title="Compliance data couldn’t be loaded" description="Try again shortly." />
      </div>
    );
  const s = data?.summary;
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title="Training compliance" description="Monitor required learning, due dates, renewals, and employee progress." />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Metric icon={Award} label="Completion rate" value={`${s?.completionRate ?? 0}%`} tone="primary" />
        <Metric icon={CheckCircle2} label="Completed" value={String(s?.completed ?? 0)} tone="success" />
        <Metric icon={CircleAlert} label="Overdue" value={String(s?.overdue ?? 0)} tone={(s?.overdue ?? 0) > 0 ? 'danger' : undefined} />
        <Metric icon={Clock3} label="In progress" value={String(s?.inProgress ?? 0)} />
        <Metric icon={CalendarClock} label="Expired" value={String(s?.expired ?? 0)} tone={(s?.expired ?? 0) > 0 ? 'danger' : undefined} />
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="sm:w-72">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
            placeholder="Search employee or course…"
          />
        </div>
        <Select
          value={status}
          onValueChange={setStatus}
          options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]}
          ariaLabel="Compliance status"
          className="w-44"
        />
      </div>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto">
          <DataTable className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">Employee</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">Course</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">Due</th>
                <th className="text-left px-5 py-3 text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => <ComplianceTableRow key={row.assignmentId} row={row} />)
              ) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-muted-foreground">
                    No assignments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </div>
      </div>
    </div>
  );
}
function ComplianceTableRow({ row }: { row: ComplianceRow }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-5 py-4">
        <p className="font-medium">{row.employeeName}</p>
        <p className="text-xs text-muted-foreground">{row.employeeEmail}</p>
      </td>
      <td className="px-5 py-4">
        <p className="font-medium">{row.courseTitle}</p>
        <p className="text-xs text-muted-foreground">{row.category ?? 'Uncategorised'}</p>
      </td>
      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{fmtDate(row.dueAt)}</td>
      <td className="px-5 py-4">
        <Badge variant={statusVariant(row.status)}>{statusLabel[row.status]}</Badge>
      </td>
    </tr>
  );
}
function CourseSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-44 bg-muted rounded-3xl animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-video bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
