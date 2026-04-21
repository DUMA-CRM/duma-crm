'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QrCode, Phone, UserPlus, X, Check, Loader2, UserCircle2 } from 'lucide-react';
import { getCustomers, createCustomer, type Customer } from '@/lib/api/customers.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils/cn';

const inp =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

// ── Phone search ──────────────────────────────────────────────────────────────

function PhoneSearch({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = phone.trim();

  const { data, isFetching, isError } = useQuery({
    queryKey: ['customer-phone-search', trimmed],
    queryFn: () => getCustomers({ phoneNumber: trimmed, limit: 1 }),
    enabled: trimmed.length >= 7,
    staleTime: 10_000,
  });

  const found = data?.data[0] ?? null;
  const notFound = !isFetching && trimmed.length >= 7 && data?.data.length === 0;

  return (
    <div className="mt-2 space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          autoFocus
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+447911123456"
          className={inp}
        />
        {isFetching && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
      </div>

      {found && (
        <button
          onClick={() => onSelect(found)}
          className="w-full flex items-center gap-2.5 px-3 py-2 bg-primary/5 border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white text-xs font-bold shrink-0">
            {found.firstName[0]?.toUpperCase()}
            {found.lastName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {found.firstName} {found.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{found.phone}</p>
          </div>
          <Check size={14} className="text-primary shrink-0" />
        </button>
      )}

      {notFound && <p className="text-xs text-muted-foreground text-center py-1">No customer found for that number.</p>}

      {isError && <p className="text-xs text-destructive text-center py-1">Search failed. Please try again.</p>}

      <button onClick={onClose} className="w-full h-8 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ── New customer form ─────────────────────────────────────────────────────────

function NewCustomerForm({ onCreated, onClose }: { onCreated: (c: Customer) => void; onClose: () => void }) {
  const { tenantId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createCustomer({ tenantId: tenantId!, firstName, lastName, phone }),
    onSuccess: (customer) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onCreated(customer);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (tenantId) mutate();
      }}
      className="mt-2 space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus className={inp} placeholder="Jane" />
        </div>
        <div>
          <label className={lbl}>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inp} placeholder="Smith" />
        </div>
      </div>
      <div>
        <label className={lbl}>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required className={inp} placeholder="+447911123456" type="tel" />
      </div>
      {error && <p className="text-xs text-destructive">Failed to create customer. Please try again.</p>}
      <div className="grid grid-cols-2 gap-2 pt-0.5">
        <button
          type="button"
          onClick={onClose}
          className="h-9 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !tenantId}
          className="h-9 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CustomerLoyaltyProps {
  selectedCustomer: Customer | null;
  onCustomerSelect: (c: Customer | null) => void;
}

export function CustomerLoyalty({ selectedCustomer, onCustomerSelect }: CustomerLoyaltyProps) {
  const [mode, setMode] = useState<'idle' | 'search' | 'new'>('idle');

  function handleSelect(c: Customer) {
    onCustomerSelect(c);
    setMode('idle');
  }

  function handleClear() {
    onCustomerSelect(null);
    setMode('idle');
  }

  return (
    <div className="p-5 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer Loyalty</p>
        <QrCode size={18} className="text-primary" />
      </div>

      {/* Selected customer pill */}
      {selectedCustomer && mode === 'idle' && (
        <div className="flex items-center gap-2.5 mb-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white text-xs font-bold shrink-0">
            {selectedCustomer.firstName[0]?.toUpperCase()}
            {selectedCustomer.lastName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {selectedCustomer.firstName} {selectedCustomer.lastName}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">{selectedCustomer.pointsBalance.toLocaleString()} pts</p>
          </div>
          <button
            onClick={handleClear}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Remove customer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'idle' && !selectedCustomer && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={() => setMode('search')}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold border border-border rounded-lg h-10 text-foreground hover:bg-muted transition-colors"
          >
            <Phone size={15} /> Find by Phone
          </button>
          <button className="flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg h-10 bg-primary hover:bg-primary-hover text-white transition-colors">
            <QrCode size={15} /> Scan Code
          </button>
        </div>
      )}

      {mode === 'idle' && !selectedCustomer && (
        <button
          onClick={() => setMode('new')}
          className="w-full flex items-center justify-center gap-2 h-10 border border-dashed border-border rounded-lg text-sm font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <UserPlus size={15} />
          New Customer
        </button>
      )}

      {mode === 'idle' && selectedCustomer && (
        <button
          onClick={() => setMode('search')}
          className="w-full flex items-center justify-center gap-2 h-9 border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        >
          <UserCircle2 size={13} />
          Change Customer
        </button>
      )}

      {/* Search panel */}
      {mode === 'search' && <PhoneSearch onSelect={handleSelect} onClose={() => setMode('idle')} />}

      {/* New customer form */}
      {mode === 'new' && <NewCustomerForm onCreated={handleSelect} onClose={() => setMode('idle')} />}
    </div>
  );
}
