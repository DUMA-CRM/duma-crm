'use client';

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';

import { ActionRow, ActionRows } from '@/components/cms/rows';
import { Check, Copy, Download, ExternalLink } from '@/components/icons';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/cms/shared';
import { toast } from '@/stores/toastStore';

export function PublicQrCodeCard({
  url,
  locationName,
  purpose = 'menu',
  downloadPrefix = 'qr',
  size = 208,
  actions = 'buttons',
}: {
  url: string;
  locationName: string;
  purpose?: string;
  downloadPrefix?: string;
  /** The code's on-screen size in px — smaller where it sits inside a section. The download is always full size. */
  size?: number;
  /**
   * `buttons`: a column of icon buttons beside the code. `rows`: the code centred
   * with labelled action rows beneath — for a settings section's row rhythm.
   */
  actions?: 'buttons' | 'rows';
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  async function copy() {
    const didCopy = await copyText(url);
    if (!didCopy) {
      toast('error', 'Copy failed — open the page and copy its address instead.');
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function download() {
    const svg = codeRef.current?.querySelector('svg');
    if (!svg) return;
    const exportSize = 1024;
    const margin = 64;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = exportSize + margin * 2;
      canvas.height = exportSize + margin * 2;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, margin, margin, exportSize, exportSize);
      const link = document.createElement('a');
      const safeLocationName = locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location';
      link.download = `${downloadPrefix}-${safeLocationName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }

  if (actions === 'rows') {
    return (
      <section aria-label={`Your ${purpose} QR code`} className="space-y-3">
        <div ref={codeRef} className="mx-auto w-fit rounded-lg border border-rule/50 bg-white p-3">
          <QRCode value={url} size={size} aria-label={`${purpose} QR code for ${locationName}`} />
        </div>
        <ActionRows>
          <ActionRow icon={copied ? Check : Copy} label={copied ? 'Link copied' : 'Copy link'} onClick={() => void copy()} />
          <ActionRow icon={Download} label="Download to print" onClick={download} />
          <ActionRow icon={ExternalLink} label={`Open the ${purpose}`} onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} />
        </ActionRows>
      </section>
    );
  }

  return (
    <section aria-label={`Your ${purpose} QR code`} className="flex w-fit max-w-full items-stretch gap-2">
      <div ref={codeRef} className="shrink-0 rounded-lg border border-rule/50 bg-white p-3">
        <QRCode value={url} size={size} aria-label={`${purpose} QR code for ${locationName}`} />
      </div>
      <div className="flex w-[4.5rem] flex-col gap-2 [&>*]:h-auto [&>*]:flex-1 [&_svg]:size-5">
        <Button type="button" variant="outline" onClick={() => void copy()} aria-label={copied ? 'Link copied' : 'Copy link'} title="Copy link">
          <CopyGlyph copied={copied} size={16} className="text-primary" />
        </Button>
        <Button type="button" variant="outline" onClick={download} aria-label="Download QR code" title="Download to print">
          <Download aria-hidden="true" />
        </Button>
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open the ${purpose}`} title={`Open the ${purpose}`}>
            <ExternalLink aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>
  );
}
