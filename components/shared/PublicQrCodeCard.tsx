'use client';

import { useRef, useState } from 'react';
import QRCode from 'react-qr-code';

import { Download, ExternalLink } from '@/components/icons';
import { CopyGlyph } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { copyText } from '@/components/cms/shared';
import { toast } from '@/stores/toastStore';

export function PublicQrCodeCard({
  url,
  locationName,
  purpose = 'menu',
  downloadPrefix = 'qr',
}: {
  url: string;
  locationName: string;
  purpose?: string;
  downloadPrefix?: string;
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
    const size = 1024;
    const margin = 64;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size + margin * 2;
      canvas.height = size + margin * 2;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, margin, margin, size, size);
      const link = document.createElement('a');
      const safeLocationName = locationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'location';
      link.download = `${downloadPrefix}-${safeLocationName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }

  return (
    <section aria-label={`Your ${purpose} QR code`} className="flex w-fit max-w-full items-stretch gap-2">
      <div ref={codeRef} className="shrink-0 rounded-lg border border-rule/50 bg-white p-3">
        <QRCode value={url} size={208} aria-label={`${purpose} QR code for ${locationName}`} />
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
