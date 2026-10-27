'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';

import { CalendarCheck, type IconComponent, Loader2, Mail, Plus, Send, Star, UserPlus } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';

import { createForm } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { FORM_TEMPLATES, type FormTemplate, isInputField } from '@/lib/utils/forms';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const ICONS: Record<string, IconComponent> = {
  blank: Plus,
  contact: Mail,
  private_event: CalendarCheck,
  feedback: Star,
  job: UserPlus,
  newsletter: Send,
};

/**
 * The ways to start a form, as cards: blank, or a template with its questions
 * already written. Picking one creates the draft and opens it — the name and
 * every question can be changed in the builder.
 */
export function TemplateGallery({ onCreated, compact = false }: { onCreated: (id: string) => void; compact?: boolean }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const create = useMutation({
    mutationFn: (template: FormTemplate) =>
      createForm({ name: template.id === 'blank' ? 'Untitled form' : template.name, definition: template.definition() }, tenantId),
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      onCreated(form.id);
    },
    onError: (error) => toast('error', error.message),
  });

  return (
    <ul className={cn('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')}>
      {FORM_TEMPLATES.map((template, index) => {
        const Icon = ICONS[template.id] ?? Plus;
        const questions = template.definition().fields.filter(isInputField).length;
        const pending = create.isPending && create.variables?.id === template.id;
        return (
          <motion.li
            key={template.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : index * 0.04 } }}
          >
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate(template)}
              className="group flex h-full w-full flex-col rounded-lg border border-rule/60 bg-field p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-rule hover:shadow-md disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-md border',
                    template.id === 'blank'
                      ? 'border-dashed border-rule bg-background text-muted-foreground'
                      : 'border-rule/55 bg-background text-foreground',
                  )}
                >
                  {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
                </span>
                {questions > 0 && <span className="text-xs tabular-nums text-muted-foreground">{questions} questions</span>}
              </span>
              <span className="mt-3 text-sm font-semibold text-foreground">{template.name}</span>
              <span className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{template.description}</span>
              {template.id !== 'blank' && <Sketch template={template} />}
            </button>
          </motion.li>
        );
      })}
    </ul>
  );
}

/** A glimpse of the form's shape: a bar per question, wider for the long ones. */
function Sketch({ template }: { template: FormTemplate }) {
  const fields = template
    .definition()
    .fields.filter((field) => field.type !== 'hidden' && field.type !== 'page_break')
    .slice(0, 4);
  return (
    <span aria-hidden="true" className="mt-4 flex flex-col gap-1.5 rounded-md bg-band/45 p-2.5 transition-colors group-hover:bg-band/70">
      {fields.map((field) => (
        <span key={field.id} className="flex items-center gap-1.5">
          <span className="h-1.5 w-10 shrink-0 rounded-full bg-rule/70" />
          <span
            className={cn(
              'h-3 rounded-sm border border-rule/50 bg-background',
              field.type === 'long_text'
                ? 'w-full'
                : field.width === 'half'
                  ? 'w-1/2'
                  : field.type === 'rating' || field.type === 'yes_no'
                    ? 'w-1/3'
                    : 'w-3/4',
            )}
          />
        </span>
      ))}
    </span>
  );
}

/** "New form": the gallery in a dialog. */
export function NewFormDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Modal
      title="New form"
      description="Start blank, or from a form that’s already written — change anything afterwards."
      size="2xl"
      onClose={onClose}
    >
      <TemplateGallery onCreated={onCreated} compact={false} />
    </Modal>
  );
}
