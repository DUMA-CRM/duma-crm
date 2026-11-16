'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  CalendarCheck,
  ChefHat,
  ClipboardPaste,
  type IconComponent,
  Loader2,
  Mail,
  Plus,
  Send,
  Star,
  Thermometer,
  UserPlus,
} from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Button } from '@/components/ui/button';

import { createForm } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { definitionFromQuestions, questionsFromText } from '@/lib/utils/form-questions';
import { FORM_TEMPLATES, type FormDefinition, fieldTypeLabel, isInputField } from '@/lib/utils/forms';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FIELD_ICONS } from './field-icons';

/** The tile's glyph while that way in is being created. */
const Spinner: IconComponent = ({ className, ...props }) => <Loader2 {...props} className={cn('animate-spin', className)} />;

const ICONS: Record<string, IconComponent> = {
  booking: CalendarCheck,
  feedback: Star,
  private_event: ChefHat,
  job: UserPlus,
  fridge: Thermometer,
  contact: Mail,
  newsletter: Send,
};

// Forms just made from Blank or a pasted list open with their name ready to type over.
const fresh = new Set<string>();
/** Whether this form was just created here and its name should take the focus — asked once. */
export const takeFreshForm = (id: string) => fresh.delete(id);

const textarea =
  'w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30';

const PASTE_EXAMPLE = 'Your name *\nEmail *\nHow many guests?\nWhich day?\nOccasion: Birthday, Anniversary, Other\nAnything else?';

type Start = { id: string; name: string; definition: FormDefinition; focusName: boolean };

/**
 * The three ways to start a form: blank, paste the questions you already have,
 * or a café template. Every one creates the draft and opens the builder with
 * the questions on it — nothing to set up first.
 */
export function TemplateGallery({ onCreated }: { onCreated: (id: string) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState('');
  const parsed = useMemo(() => questionsFromText(text), [text]);

  const create = useMutation({
    mutationFn: (start: Start) => createForm({ name: start.name, definition: start.definition }, tenantId),
    onSuccess: async (form, start) => {
      if (start.focusName) fresh.add(form.id);
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      onCreated(form.id);
    },
    onError: (error) => toast('error', error.message),
  });
  const start = (next: Start) => {
    if (!create.isPending) create.mutate(next);
  };
  const busy = (id: string) => create.isPending && create.variables?.id === id;
  const rowState = (id: string) => cn(create.isPending && 'pointer-events-none', create.isPending && !busy(id) && 'opacity-60');

  if (pasting) {
    const choices = parsed.filter((question) => question.options).length;
    return (
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="paste-questions" className="text-sm font-semibold text-foreground">
            Your questions, one per line
          </label>
          <textarea
            id="paste-questions"
            autoFocus
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={PASTE_EXAMPLE}
            className={cn(textarea, 'mt-2 min-h-44 field-sizing-content resize-none text-base sm:text-sm')}
          />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            End with * for required. Options go after a colon, with commas — or on indented lines underneath.
          </p>
        </div>

        {parsed.length > 0 && (
          <RecordGroup
            id="paste-preview"
            title={`${parsed.length} ${parsed.length === 1 ? 'question' : 'questions'}${choices ? ` · ${choices} with options` : ''}`}
            footnote="You can change any of it in the builder."
          >
            <ol className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm">
              {parsed.map((question, index) => {
                const Icon = FIELD_ICONS[question.type];
                return (
                  <li key={index} className="flex min-w-0 items-center gap-2.5 px-1.5 py-1.5 text-sm">
                    <Icon size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-foreground">
                      {question.label}
                      {question.required && <span className="text-exception"> *</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {question.options ? `${question.options.length} options` : fieldTypeLabel(question.type)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </RecordGroup>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="pointer-coarse:h-11" onClick={() => setPasting(false)} disabled={create.isPending}>
            Back
          </Button>
          <Button
            className="pointer-coarse:h-11"
            disabled={parsed.length === 0 || create.isPending}
            onClick={() => start({ id: 'paste', name: 'Untitled form', definition: definitionFromQuestions(parsed), focusName: true })}
          >
            {busy('paste') && <Loader2 className="animate-spin" aria-hidden="true" />}
            Make the form
          </Button>
        </div>
      </div>
    );
  }

  const blank = FORM_TEMPLATES.find((template) => template.id === 'blank')!;
  return (
    <div className="flex flex-col gap-5" aria-busy={create.isPending || undefined}>
      <ListRowGroup aria-label="Start from">
        <ListRow
          icon={busy('blank') ? Spinner : Plus}
          title="Blank form"
          meta="Start typing your first question"
          onClick={() => start({ id: 'blank', name: 'Untitled form', definition: blank.definition(), focusName: true })}
          className={rowState('blank')}
        />
        <ListRow
          icon={ClipboardPaste}
          title="Paste your questions"
          meta="From a document or a note — one per line"
          onClick={() => setPasting(true)}
          className={rowState('paste')}
        />
      </ListRowGroup>

      <RecordGroup id="form-templates" title="Templates">
        <ListRowGroup aria-label="Templates">
          {FORM_TEMPLATES.filter((template) => template.id !== 'blank').map((template) => {
            const questions = template.definition().fields.filter(isInputField).length;
            return (
              <ListRow
                key={template.id}
                icon={busy(template.id) ? Spinner : (ICONS[template.id] ?? Plus)}
                tone="muted"
                title={template.name}
                meta={template.description}
                trailing={<span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{questions} questions</span>}
                onClick={() => start({ id: template.id, name: template.name, definition: template.definition(), focusName: false })}
                className={rowState(template.id)}
              />
            );
          })}
        </ListRowGroup>
      </RecordGroup>
    </div>
  );
}

/** "New form": the three ways in, as one sheet — full screen on a phone. */
export function NewFormDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Drawer title="New form" onClose={onClose}>
      <TemplateGallery onCreated={onCreated} />
    </Drawer>
  );
}
