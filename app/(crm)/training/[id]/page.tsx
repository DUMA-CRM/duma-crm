'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { Markdown } from '@/components/shared/Markdown';
import { Badge } from '@/components/ui/badge';

import { getCourse } from '@/lib/api/courses.service';
import { videoEmbedUrl } from '@/lib/utils/video';

export default function CourseWatchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourse(id),
    enabled: !!id,
  });

  return (
    <PageLayout
      eyebrow="Training"
      title={course?.title ?? 'Course'}
      fullHeight
      headerBorder={false}
      headerSlot={
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/training" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} />
            Back to Training
          </Link>
          {course?.category && <Badge variant="primary">{course.category}</Badge>}
          {course && (
            <span className="text-xs text-muted-foreground">
              Added {new Date(course.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 h-full">
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
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border">
              <iframe
                src={videoEmbedUrl(course.videoUrl)}
                title={course.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>

          {/* Description (right) */}
          <aside className="bg-card border border-border rounded-2xl p-5 overflow-auto h-fit">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">About this course</p>
            {course.description ? (
              <Markdown content={course.description} className="space-y-3" />
            ) : (
              <p className="text-sm text-muted-foreground">No description for this course.</p>
            )}
          </aside>
        </div>
      )}
    </PageLayout>
  );
}
