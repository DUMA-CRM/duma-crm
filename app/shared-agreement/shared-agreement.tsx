'use client';

import { useEffect, useState } from 'react';

import { AgreementSnapshotView } from '@/components/marketplace/AgreementSnapshotView';
import { Button } from '@/components/ui/button';
import { readSharedAgreement, type AgreementSnapshot } from '@/lib/marketplace/creator-agreement-storage';

export function SharedAgreement() {
  const [result, setResult] = useState<AgreementSnapshot | 'unavailable'>();
  useEffect(() => {
    const controller = new AbortController();
    const token = window.location.hash.slice(1);
    void Promise.resolve().then(async () => {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid link');
      return readSharedAgreement(token, controller.signal);
    }).then((agreement) => {
      if (!controller.signal.aborted) setResult(agreement);
    }).catch(() => {
      if (!controller.signal.aborted) setResult('unavailable');
    });
    return () => controller.abort();
  }, []);

  if (!result || result === 'unavailable') return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <p role="status">{result ? 'This agreement link is unavailable or has expired. Ask the sender for a new copy.' : 'Opening agreement…'}</p>
    </main>
  );
  const uk = result.language === 'uk';
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-5 py-8 print:max-w-none print:p-0" lang={uk ? 'uk' : 'en-GB'}>
      <div className="flex items-center justify-between gap-3 print:hidden">
        <h1 className="text-sm font-semibold text-muted-foreground">{uk ? 'Спільний договір' : 'Shared agreement'}</h1>
        <Button onClick={() => window.print()}>{uk ? 'Друк / Зберегти PDF' : 'Print / Save PDF'}</Button>
      </div>
      <AgreementSnapshotView {...result} />
    </main>
  );
}
