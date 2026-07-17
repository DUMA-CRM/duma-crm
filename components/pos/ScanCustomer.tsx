'use client';

import { Loader2, ScanLine } from 'lucide-react';
import { useState } from 'react';

import { QrScanner } from '@/components/pos/QrScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getCustomer } from '@/lib/api/customers.service';
import { parseCustomerQr } from '@/lib/utils/customer-qr';
import { usePosSettingsStore } from '@/stores/posSettingsStore';
import { Customer } from '@/types/customers';

interface ScanCustomerProps {
  onSelect: (c: Customer) => void;
  onClose: () => void;
}

/**
 * Scan a customer's loyalty QR and attach them to the order. Reads via the
 * tablet camera or a keyboard-wedge scanner, per the POS setting (Settings →
 * POS). Either way the value flows through the same parse → lookup path.
 */
export function ScanCustomer({ onSelect, onClose }: ScanCustomerProps) {
  const scannerMode = usePosSettingsStore((s) => s.scannerMode);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [manual, setManual] = useState('');

  async function handleScanned(raw: string) {
    setError(null);
    const id = parseCustomerQr(raw.trim());
    if (!id) {
      setError("That isn't a DUMA customer code.");
      return;
    }
    setLooking(true);
    try {
      onSelect(await getCustomer(id));
    } catch {
      setError('No customer found for this code.');
    } finally {
      setLooking(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {scannerMode === 'camera' ? (
        <>
          <QrScanner onScan={handleScanned} paused={looking} />
          <p className="text-xs text-muted-foreground text-center">Point the camera at the customer&apos;s loyalty code.</p>
        </>
      ) : (
        // Wedge scanners type the code and press Enter — an auto-focused input
        // catches it without any device integration.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!manual.trim()) return;
            void handleScanned(manual);
            setManual('');
          }}
        >
          <Input
            autoFocus
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            leftIcon={<ScanLine size={13} />}
            placeholder="Waiting for scanner…"
          />
          <p className="text-xs text-muted-foreground mt-1.5">Scan with the connected scanner, or type the code and press Enter.</p>
        </form>
      )}

      {looking && (
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5 py-1">
          <Loader2 size={12} className="animate-spin" />
          Looking up customer…
        </p>
      )}
      {error && !looking && <p className="text-xs text-destructive text-center py-1">{error}</p>}

      <Button variant="outline" size="sm" onClick={onClose} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
