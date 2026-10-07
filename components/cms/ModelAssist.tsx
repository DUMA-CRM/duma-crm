'use client';

import { useEffect, useState } from 'react';

import { ArrowLeftRight, Loader2, Plus, Sparkles } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { CmsFieldDefinition } from '@/lib/modules/cms/client';
import type { ModelDraft } from '@/lib/utils/cms-model-draft';

import { assist } from './AssistSection';
import { DumaSays } from './DumaSays';
import { TEXTAREA_CLASS } from './shared';

/** Starting points for a new model — one tap fills the box. */
const MODEL_IDEAS = ['Blog post', 'Menu special', 'Event', 'Team member', 'FAQ page'];

/**
 * Ask DUMA on a model: describe what the content should hold and the model is
 * built — name, kind, fields from the CMS's own types, references to models
 * that exist, the SEO block when it is a page. On an existing model it only
 * adds fields. Everything lands in the form; nothing is saved until Save.
 */
export function ModelAssist({
  isNew,
  blank,
  name,
  fields,
  models,
  onApply,
}: {
  isNew: boolean;
  /** Nothing in the form worth keeping yet — a draft simply fills it. */
  blank: boolean;
  name: string;
  fields: CmsFieldDefinition[];
  /** Models a reference can point to. */
  models: Array<{ key: string; name: string }>;
  /** Put the draft into the form; returns how many fields were added. */
  onApply: (draft: ModelDraft, mode: 'add' | 'replace') => number;
}) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [saying, setSaying] = useState<null | { tone: 'done' | 'error'; text: string }>(null);
  const [cheer, setCheer] = useState(0);
  // A draft for different content than this model holds, waiting on "replace or add?".
  const [asking, setAsking] = useState<ModelDraft | null>(null);

  // A "done" line has said its piece after a few seconds.
  useEffect(() => {
    if (saying?.tone !== 'done') return;
    const timer = setTimeout(() => setSaying(null), saying.text.includes('Skipped') ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [saying]);

  async function build(text = prompt.trim()) {
    setBusy(true);
    setSaying(null);
    try {
      const { draft } = await assist<{ draft: ModelDraft }>({
        task: 'model',
        prompt: text,
        name,
        existingFields: blank ? [] : fields.map((field) => ({ key: field.key, label: field.label, type: field.type })),
        models,
      });
      setPrompt('');
      // Different content than the model holds: the person decides what happens to the old fields.
      if (!blank && !draft.related && draft.fields.length > 0) {
        setAsking(draft);
        return;
      }
      apply(draft, 'add');
    } catch (error) {
      setSaying({ tone: 'error', text: error instanceof Error ? error.message : 'That didn’t work — try again.' });
    } finally {
      setBusy(false);
    }
  }

  function apply(draft: ModelDraft, mode: 'add' | 'replace') {
    setAsking(null);
    const added = onApply(draft, mode);
    // Name what was left out, briefly — the first one is usually the one they'd ask about.
    const first = draft.skipped.find((entry) => entry.reason !== 'it’s already there') ?? draft.skipped[0];
    const leftOut = first
      ? ` Skipped ${first.label} — ${first.reason}${draft.skipped.length > 1 ? `, +${draft.skipped.length - 1} more` : ''}.`
      : '';
    const verb = isNew || mode === 'replace' ? 'Built' : 'Added';
    setSaying({
      tone: 'done',
      text:
        added === 0
          ? `It already has everything I’d add.${leftOut}`
          : `${verb} ${added} ${added === 1 ? 'field' : 'fields'} — check them, then ${isNew ? 'create' : 'save'}.${leftOut}`,
    });
    setCheer((count) => count + 1);
  }

  const subject = asking?.name ? `${/^[aeiou]/i.test(asking.name) ? 'an' : 'a'} ${asking.name.toLowerCase()}` : 'something different';
  const line = busy
    ? 'Building…'
    : asking
      ? `That’s ${subject}, not ${name.trim() ? `a ${name.trim().toLowerCase()}` : 'what this model holds'}. Replace the ${fields.length} ${fields.length === 1 ? 'field' : 'fields'} here, or add alongside?`
      : saying
        ? saying.text
        : isNew
          ? 'Tell me what this content is, and I’ll build the model.'
          : 'Need more fields? Tell me what’s missing.';

  return (
    <div className="space-y-3">
      <DumaSays line={line} busy={busy} tone={asking ? 'idle' : (saying?.tone ?? 'idle')} cheer={cheer} />
      {asking && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => apply(asking, 'replace')}>
              <ArrowLeftRight size={14} aria-hidden="true" />
              Replace
            </Button>
            <Button className="gap-1.5" onClick={() => apply(asking, 'add')}>
              <Plus size={14} aria-hidden="true" />
              Add alongside
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setAsking(null)}
            className="w-full rounded-md py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Never mind
          </button>
        </div>
      )}
      <textarea
        aria-label={isNew ? 'Describe the model' : 'Describe the fields to add'}
        rows={3}
        className={TEXTAREA_CLASS}
        value={prompt}
        disabled={busy}
        placeholder={isNew ? 'A menu special: name, price, photo, allergens, available from and to' : 'Add a gallery and the opening hours'}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && prompt.trim().length >= 3 && !busy) void build();
        }}
      />
      {isNew && !prompt && (
        <div className="flex flex-wrap gap-1.5">
          {MODEL_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setPrompt(idea)}
              className="rounded-md border border-rule/60 bg-control px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-rule hover:text-foreground"
            >
              {idea}
            </button>
          ))}
        </div>
      )}
      <Button className="w-full gap-1.5" disabled={busy || prompt.trim().length < 3} onClick={() => void build()}>
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
        {isNew ? 'Build model' : 'Add fields'}
      </Button>
    </div>
  );
}
