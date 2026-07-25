'use client';

import { ImagePlus, Loader2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';

import { Markdown } from '@/components/shared/Markdown';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function LessonContentEditor({
  value,
  onChange,
  tenantId,
  courseId,
}: {
  value: string;
  onChange: (value: string) => void;
  tenantId: string;
  courseId?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const insertImage = (url: string, filename: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const alt = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    const markdown = `\n\n![${alt}](${url})\n\n`;
    onChange(`${value.slice(0, start)}${markdown}${value.slice(end)}`);
    requestAnimationFrame(() => {
      const cursor = start + markdown.length;
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast('error', 'Use a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast('error', 'Images must be 4 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const query = new URLSearchParams({ filename: file.name, tenantId });
      if (courseId) query.set('courseId', courseId);
      const response = await fetch(`/api/training/images?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || 'Image upload failed.');
      insertImage(result.url, file.name);
      toast('success', 'Screenshot uploaded and inserted into the lesson.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return <div className="space-y-3">
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          className="min-h-80 w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="# Lesson objective\n\nExplain the workflow…\n\n> 📸 Screenshot needed: Dashboard with the POS navigation item visible."
        />
        <p className="text-[11px] text-muted-foreground">Markdown supports headings, lists, links, callouts, code, and full-width screenshots.</p>
      </div>
      <div className="min-h-80 max-h-[520px] overflow-y-auto rounded-xl border border-border bg-card p-5">
        <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live preview</p>
        {value.trim() ? <Markdown content={value} className="space-y-4"/> : <p className="text-sm text-muted-foreground">Your formatted lesson will appear here.</p>}
      </div>
    </div>
    <div
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadImage(event.dataTransfer.files[0]); }}
      className={cn('rounded-xl border border-dashed p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20')}
    >
      <div className="flex items-center gap-3"><span className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">{uploading ? <Loader2 size={19} className="animate-spin"/> : <UploadCloud size={19}/>}</span><div><p className="text-sm font-medium">Add a screenshot</p><p className="text-xs text-muted-foreground">Drop an image here or choose a file · PNG, JPG, WebP · max 4 MB</p></div></div>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} className="hidden" onChange={(event) => void uploadImage(event.target.files?.[0])}/>
      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}><ImagePlus/>{uploading ? 'Uploading…' : 'Choose image'}</Button>
    </div>
  </div>;
}
