'use client';

import { Phone, QrCode, UserCircle2, X } from 'lucide-react';
import { useState } from 'react';

import { NewCustomerForm } from '@/components/pos/NewCustomerForm';
import { PhoneSearch } from '@/components/pos/PhoneSearch';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { Customer } from '@/types/customers';

// ── Phone search ──────────────────────────────────────────────────────────────

// ── Main component ────────────────────────────────────────────────────────────

interface CustomerLoyaltyProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (c: Customer | null) => void;
  /** Opens the QR scan view (a full-panel takeover owned by OrderPanel). */
  onScan: () => void;
}

export function CustomerLoyalty({ selectedCustomer, onCustomerSelect, onScan }: CustomerLoyaltyProps) {
  const [mode, setMode] = useState<'idle' | 'search' | 'new'>('idle');
  const [newPhone, setNewPhone] = useState('');

  function handleSelect(c: Customer) {
    onCustomerSelect(c);
    setMode('idle');
    setNewPhone('');
  }

  function handleClear() {
    onCustomerSelect(null);
    setMode('idle');
    setNewPhone('');
  }

  return (
    <div className="p-5 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-3">
        {/* <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer Loyalty</p> */}
        <Label uppercase>Customer Loyalty</Label>
        <QrCode size={18} className="text-primary" />
      </div>

      {/* Selected customer pill */}
      {selectedCustomer && mode === 'idle' && (
        <div className="flex items-center gap-2.5 mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
          <InitialsAvatar firstName={selectedCustomer.firstName} lastName={selectedCustomer.lastName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{selectedCustomer.pointsBalance.toLocaleString()} pts</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
            <X size={13} />
          </Button>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'idle' && !selectedCustomer && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button onClick={() => setMode('search')} variant="outline" className="gap-2">
            <Phone size={15} /> Find by Phone
          </Button>
          <Button onClick={onScan}>
            <QrCode size={15} /> Scan Code
          </Button>
        </div>
      )}

      {mode === 'idle' && selectedCustomer && (
        <Button onClick={() => setMode('search')} variant="outline" size="sm" className="w-full gap-2">
          <UserCircle2 size={13} />
          Change Customer
        </Button>
      )}

      {/* Search panel */}
      {mode === 'search' && (
        <PhoneSearch
          onSelect={handleSelect}
          onCreate={(phone) => { setNewPhone(phone); setMode('new'); }}
          onClose={() => setMode('idle')}
        />
      )}

      {/* New customer form (phone pre-filled from the search) */}
      {mode === 'new' && <NewCustomerForm defaultPhone={newPhone} onCreated={handleSelect} onClose={() => setMode('idle')} />}
    </div>
  );
}
