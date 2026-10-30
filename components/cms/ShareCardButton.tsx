'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Loader2, Sparkles } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';

import { uploadCmsAsset } from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import { slugify } from '@/lib/utils/cms';

import { useCmsTenantId } from './ContentScope';
import { createRenditions } from './renditions';
import { invalidateCms } from './shared';

/**
 * Draws the entry's share card — logo, "DUMA · {type}", the title, the
 * mascot — uploads it to Media and sets it as the Social image. The picture
 * comes from /api/share-card (lib/marketing/og-image.tsx), the same design
 * DUMA's own blog uses. A snapshot: after the title changes, Regenerate.
 */
export function ShareCardButton({
  label,
  title,
  hasImage,
  onGenerated,
}: {
  /** The content type's name, shown grey after the brand. */
  label: string;
  title: string;
  hasImage: boolean;
  onGenerated: (assetId: string) => void;
}) {
  const tenantId = useCmsTenantId() ?? undefined;
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/share-card?${new URLSearchParams({ label, title })}`);
      if (!response.ok) throw new Error('The share card couldn’t be drawn. Try again in a moment.');
      const file = new File([await response.blob()], `share-card-${slugify(title).slice(0, 60) || 'entry'}.png`, { type: 'image/png' });
      const asset = await uploadCmsAsset(file, { title: `Share card — ${title}`, altText: title }, tenantId);
      return { asset, file };
    },
    onSuccess: async ({ asset, file }) => {
      onGenerated(asset.id);
      invalidateCms(queryClient);
      toast('success', 'Share card added to Media and set as the social image. Save to keep it.');
      // The smaller copies websites load, as an upload gets them; a failure only costs a larger download.
      await createRenditions(asset, tenantId, file).catch(() => 0);
    },
    onError: (error) => toast('error', error.message),
  });

  const Icon = generate.isPending ? Loader2 : Sparkles;
  return (
    <Tooltip side="top" align="end" wrap label={title ? 'Draw a 1200 × 630 card from the title, with the DUMA logo and mascot.' : 'Add a title first — the card is drawn from it.'}>
      <Button type="button" variant="outline" className="h-9 shrink-0" disabled={!title || generate.isPending} onClick={() => generate.mutate()}>
        <Icon className={generate.isPending ? 'motion-safe:animate-spin' : undefined} aria-hidden="true" />
        {generate.isPending ? 'Drawing…' : hasImage ? 'Regenerate' : 'Generate'}
      </Button>
    </Tooltip>
  );
}
