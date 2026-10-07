'use client';

import { useState } from 'react';

import { AlertTriangle, Loader2, ScanLine, Search } from '@/components/icons';
import { QrScanner } from '@/components/pos/QrScanner';
import { Button } from '@/components/ui/button';

import { getCustomer } from '@/lib/modules/customers/client';
import { cn } from '@/lib/utils/cn';
import { parseCustomerQr } from '@/lib/utils/customer-qr';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { Customer } from '@/types/customers';

interface ScanCustomerProps {
  onSelect: (c: Customer) => void;
  /** Leave scanning for the name/phone search. */
  onSearchInstead: () => void;
}

/**
 * Scan a customer's loyalty QR and attach them to the ticket. Reads via the
 * device camera or a keyboard-wedge scanner, per Settings → Configuration →
 * Till. Either way the value flows through the same parse → lookup path, and
 * a miss keeps the scanner running so the next attempt is just holding the
 * code up again.
 */
export function ScanCustomer({ onSelect, onSearchInstead }: ScanCustomerProps) {
  const scannerMode = usePosSettingsStore((s) => s.scannerMode);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [manual, setManual] = useState('');

  async function handleScanned(raw: string) {
    setError(null);
    const id = parseCustomerQr(raw.trim());
    if (!id) {
      setError('That isn’t a DUMA loyalty code. Ask for the code in their app, or search by name instead.');
      return;
    }
    setLooking(true);
    try {
      onSelect(await getCustomer(id));
    } catch {
      setError('No customer was found for this code. It may belong to another business.');
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      {scannerMode === 'camera' ? (
        <div className="relative">
          <QrScanner onScan={handleScanned} paused={looking} />
          {looking && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/55 text-white" role="status">
              <Loader2 size={26} className="animate-spin" aria-hidden="true" />
              <p className="text-sm font-medium">Finding the customer…</p>
            </div>
          )}
        </div>
      ) : (
        // Wedge scanners type the code and press Enter — an auto-focused input
        // catches it without any device integration.
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!manual.trim()) return;
            void handleScanned(manual);
            setManual('');
          }}
          className="rounded-2xl border border-rule/60 bg-card p-5 text-center"
        >
          <span className={cn('mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/8 text-primary', !looking && 'animate-pulse')} aria-hidden="true">
            {looking ? <Loader2 size={28} className="animate-spin" /> : <ScanLine size={28} />}
          </span>
          <p className="mt-4 text-lg font-semibold text-foreground" role="status">{looking ? 'Finding the customer…' : 'Ready — scan the code'}</p>
          <p className="mt-1 text-sm text-muted-foreground">Point the scanner at their loyalty code. You can also type it and press Enter.</p>
          <input
            autoFocus
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            disabled={looking}
            aria-label="Loyalty code"
            placeholder="Waiting for the scanner…"
            autoComplete="off"
            className="mt-4 h-12 w-full rounded-lg border border-input bg-control px-3.5 text-center text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
          />
        </form>
      )}

      {error && !looking && (
        <p role="alert" className="flex gap-2.5 rounded-xl border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-foreground">
          <AlertTriangle size={17} aria-hidden="true" className="mt-0.5 shrink-0 text-destructive" />
          {error}
        </p>
      )}
      {scannerMode === 'camera' && !error && !looking && (
        <p className="text-center text-sm text-muted-foreground">Hold the code inside the frame. It scans on its own.</p>
      )}

      <Button variant="outline" onClick={onSearchInstead} className="h-14 w-full gap-2 text-base">
        <Search size={18} aria-hidden="true" /> Search by name or phone instead
      </Button>
    </div>
  );
}
