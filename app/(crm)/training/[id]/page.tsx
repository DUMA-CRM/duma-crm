'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, BookOpen, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GraduationCap, ListChecks, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { Markdown } from '@/components/shared/Markdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { completeCourse, getCourse, getCourses, requestCourseSignoff, startCourse } from '@/lib/api/courses.service';
import { cn } from '@/lib/utils/cn';
import { videoEmbedUrl } from '@/lib/utils/video';
import { toast } from '@/stores/toastStore';

export default function CourseWatchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const qc = useQueryClient();
  const [signoffNotes, setSignoffNotes] = useState('');

  const {
    data: course,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
    enabled: !!id,
  });
  const { data: library = [] } = useQuery({
    queryKey: ['courses', 'curriculum'],
    queryFn: () => getCourses(),
  });

  const curriculum = useMemo(() => {
    if (!course) return [];
    const category = course.category?.trim() || 'Other training';
    return library
      .filter((lesson) => lesson.tenantId === course.tenantId && (lesson.category?.trim() || 'Other training') === category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }, [course, library]);
  const currentIndex = curriculum.findIndex((lesson) => lesson.id === id);
  const previousLesson = currentIndex > 0 ? curriculum[currentIndex - 1] : undefined;
  const nextLesson = currentIndex >= 0 ? curriculum[currentIndex + 1] : undefined;
  const curriculumCompleted = curriculum.filter((lesson) => lesson.completed).length;
  const curriculumProgress = curriculum.length ? Math.round((curriculumCompleted / curriculum.length) * 100) : 0;

  useEffect(() => {
    if (id) startCourse(id).catch(() => undefined);
  }, [id]);

  const complete = useMutation({
    mutationFn: () => completeCourse(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course', id] }); qc.invalidateQueries({ queryKey: ['courses'] }); qc.invalidateQueries({ queryKey: ['training-assignments-me'] }); toast('success', 'Course completed.'); },
    onError: (error) => toast('error', (error as Error).message),
  });
  const requestSignoff = useMutation({
    mutationFn: () => requestCourseSignoff(id, signoffNotes),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['course', id] }); toast('success', 'Practical sign-off requested.'); },
    onError: (error) => toast('error', (error as Error).message),
  });

  return (
    <PageLayout
      eyebrow="Training"
      title={course?.title ?? 'Course'}
      fullHeight
      headerBorder={false}
      headerSlot={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/training"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Training
          </Link>
          {course?.category && <Badge variant="primary">{course.category}</Badge>}
          {course?.isMandatory && <Badge variant="warning">Mandatory</Badge>}
          {course?.completed && <Badge variant="success">Completed</Badge>}
          {course && (
            <span className="text-xs text-muted-foreground">
              <Clock3 size={13} className="inline mr-1" />{course.estimatedMinutes} min · Lesson {currentIndex >= 0 ? currentIndex + 1 : 1} of {curriculum.length || 1}
            </span>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 h-full">
          <div className="aspect-video rounded-2xl bg-muted animate-pulse" />
          <div className="rounded-2xl bg-muted animate-pulse" />
        </div>
      ) : isError || !course ? (
        <div className="py-24">
          <EmptyState icon={GraduationCap} title="Course not found" description="It may have been removed." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 h-full min-h-0">
          {/* Video (left) */}
          <div className="min-w-0">
            <div className={cn('w-full rounded-2xl overflow-hidden border border-border', course.videoUrl.startsWith('lesson://') ? 'min-h-[70vh] bg-card' : 'aspect-video bg-black')}>
              {course.videoUrl.startsWith('lesson://') ? (
                <div className="p-6 md:p-10 lg:p-12">
                  <div className="pb-6 mb-7 border-b border-border"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary"><BookOpen size={15}/>Lesson {currentIndex >= 0 ? currentIndex + 1 : 1}</div><h2 className="text-2xl md:text-3xl font-semibold mt-3">{course.title}</h2><p className="text-sm text-muted-foreground mt-2">{course.estimatedMinutes} min read</p></div>
                  {course.description ? <Markdown content={course.description} className="space-y-5 max-w-4xl"/> : <EmptyState icon={BookOpen} title="Lesson content is being prepared" description="Please check back shortly."/>}
                </div>
              ) : videoEmbedUrl(course.videoUrl) ? (
                <iframe
                  src={videoEmbedUrl(course.videoUrl)!}
                  title={course.title}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center px-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    This video is hosted on an unsupported provider.
                    {/^https?:/i.test(course.videoUrl) && (
                      <>
                        {' '}
                        <a href={course.videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          Open it in a new tab.
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {previousLesson ? <Button asChild variant="outline" className="h-auto min-h-12 justify-start"><Link href={`/training/${previousLesson.id}`}><ChevronLeft/><span className="min-w-0 text-left"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Previous</span><span className="block truncate max-w-40">{previousLesson.title}</span></span></Link></Button> : <div/>}
              {nextLesson ? <Button asChild className="h-auto min-h-12 justify-end"><Link href={`/training/${nextLesson.id}`}><span className="min-w-0 text-right"><span className="block text-[10px] uppercase tracking-widest opacity-75">Next lesson</span><span className="block truncate max-w-40">{nextLesson.title}</span></span><ChevronRight/></Link></Button> : <Button asChild variant="outline" className="h-auto min-h-12 justify-end"><Link href="/training"><span className="text-right"><span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Path complete</span><span className="block">Back to learning paths</span></span><CheckCircle2/></Link></Button>}
            </div>
          </div>

          {/* Description (right) */}
          <aside className="space-y-4 overflow-auto h-fit">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest"><ListChecks size={15}/>Course curriculum</div>
                <h2 className="font-semibold mt-2">{course.category?.trim() || 'Other training'}</h2>
                <div className="flex items-center gap-3 mt-3"><div className="h-2 flex-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${curriculumProgress}%` }}/></div><span className="text-xs font-semibold tabular-nums">{curriculumCompleted}/{curriculum.length}</span></div>
              </div>
              <div className="max-h-[360px] overflow-y-auto p-2">
                {curriculum.map((lesson, index) => {
                  const current = lesson.id === id;
                  return <Link key={lesson.id} href={`/training/${lesson.id}`} aria-current={current ? 'step' : undefined} className={cn('flex items-center gap-3 rounded-xl p-3 transition-colors', current ? 'bg-primary/10 ring-1 ring-primary/25' : 'hover:bg-muted/70')}><span className={cn('size-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold', lesson.completed ? 'bg-success/10 border-success/30 text-success' : current ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground')}>{lesson.completed ? <Check size={14}/> : index + 1}</span><span className="min-w-0 flex-1"><span className={cn('block text-sm font-medium leading-snug', current && 'text-primary')}>{lesson.title}</span><span className="block text-[11px] text-muted-foreground mt-1">{current ? 'Current lesson' : `Lesson ${index + 1}`} · {lesson.estimatedMinutes} min</span></span>{current && <span className="size-2 rounded-full bg-primary shrink-0"/>}</Link>;
                })}
              </div>
            </div>
            {!course.videoUrl.startsWith('lesson://') && <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">What you’ll learn</p>
            {course.description ? (
              <Markdown content={course.description} className="space-y-3" />
            ) : (
              <p className="text-sm text-muted-foreground">No description for this course.</p>
            )}
            </div>}
            <div className="bg-card border border-border rounded-2xl p-5">
              {course.completed ? <div className="text-center py-2"><span className="size-12 mx-auto rounded-full bg-success/10 text-success flex items-center justify-center"><CheckCircle2 size={24}/></span><h3 className="font-semibold mt-3">Training completed</h3><p className="text-xs text-muted-foreground mt-1">Completed {course.completedAt ? new Date(course.completedAt).toLocaleDateString('en-GB') : ''}{course.validityDays ? ` · Valid for ${course.validityDays} days` : ''}</p><Button variant="outline" className="w-full mt-4" onClick={() => complete.mutate()} disabled={complete.isPending}>Review and acknowledge again</Button></div> : course.completionRule === 'practical_signoff' ? <div><div className="flex gap-3"><span className="size-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0"><Award size={20}/></span><div><h3 className="font-semibold">Practical assessment</h3><p className="text-xs text-muted-foreground mt-1">A manager must observe this skill and sign it off.</p></div></div>{course.signoff?.status === 'pending' ? <div className="mt-4 rounded-xl bg-warning/10 border border-warning/20 p-3"><p className="text-sm font-medium">Sign-off requested</p><p className="text-xs text-muted-foreground mt-1">Ask your shift manager to assess you when ready.</p></div> : <><textarea className="w-full min-h-20 rounded-lg border border-border bg-background p-3 text-sm mt-4" value={signoffNotes} onChange={(event) => setSignoffNotes(event.target.value)} placeholder="Optional note for your assessor…"/><Button className="w-full mt-3" onClick={() => requestSignoff.mutate()} disabled={requestSignoff.isPending}>{requestSignoff.isPending && <Loader2 className="animate-spin"/>}<ShieldCheck/>Request sign-off</Button></>}</div> : <div><div className="flex gap-3"><span className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck size={20}/></span><div><h3 className="font-semibold">Completion acknowledgement</h3><p className="text-xs text-muted-foreground mt-1">Confirm that you watched the training and understand this procedure.</p></div></div><Button className="w-full mt-4" onClick={() => complete.mutate()} disabled={complete.isPending}>{complete.isPending && <Loader2 className="animate-spin"/>}<CheckCircle2/>I understand · Complete</Button></div>}
            </div>
          </aside>
        </div>
      )}
    </PageLayout>
  );
}
