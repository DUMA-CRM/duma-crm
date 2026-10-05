// ---------------------------------------------------------------------------
// The supplier list's filtering: search across the fields a manager would
// type, the active/inactive view, and which suppliers can't be reached.
// ---------------------------------------------------------------------------

export interface SupplierLike {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

/** A supplier you couldn't contact to chase a delivery: no email and no phone. */
export const unreachable = (supplier: SupplierLike) => !supplier.email?.trim() && !supplier.phone?.trim();

/** What's missing from a supplier's details, in reading order — empty when complete. */
export function missingDetails(supplier: SupplierLike): string[] {
  const missing: string[] = [];
  if (!supplier.contactName?.trim()) missing.push('contact');
  if (!supplier.email?.trim()) missing.push('email');
  if (!supplier.phone?.trim()) missing.push('phone');
  return missing;
}

export type SupplierView = 'active' | 'inactive' | 'all';

/** Suppliers in the view, matching the search on name, contact, email or phone, A to Z. */
export function filterSuppliers<T extends SupplierLike>(suppliers: T[], view: SupplierView, search: string): T[] {
  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return suppliers
    .filter((supplier) => (view === 'all' ? true : view === 'active' ? supplier.isActive : !supplier.isActive))
    .filter((supplier) => {
      if (!q) return true;
      const text = [supplier.name, supplier.contactName, supplier.email].filter(Boolean).join(' ').toLowerCase();
      if (text.includes(q)) return true;
      return digits.length >= 3 && (supplier.phone ?? '').replace(/\D/g, '').includes(digits);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface SupplierForm {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

export type SupplierFormErrors = Partial<Record<keyof SupplierForm, string>>;

// The API's limits (duma-api src/routes/suppliers.ts), checked here so a save
// fails in the field rather than as a toast.
const LIMITS: Record<keyof SupplierForm, number> = { name: 255, contactName: 255, email: 255, phone: 30, address: 500, notes: 2000 };

/**
 * What stops the form saving, per field. `hadEmail` matters because the API
 * validates a blank email as an email and has no way to clear one.
 */
export function supplierFormErrors(form: SupplierForm, hadEmail = false): SupplierFormErrors {
  const errors: SupplierFormErrors = {};
  const name = form.name.trim();
  if (name.length < 2) errors.name = 'A name of at least two characters is needed.';
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That doesn’t look like an email address.';
  else if (!email && hadEmail) errors.email = 'An email can be replaced but not removed yet.';
  if (form.phone.trim() && !/^[\d\s()+\-.]+$/.test(form.phone.trim())) errors.phone = 'Digits, spaces and + ( ) - only.';
  for (const key of Object.keys(LIMITS) as (keyof SupplierForm)[]) {
    if (!errors[key] && form[key].trim().length > LIMITS[key]) errors[key] = `Keep it under ${LIMITS[key]} characters.`;
  }
  return errors;
}

/**
 * The body to send. A new supplier omits blank fields. An edit sends a blank
 * text field as '' — the API's PATCH skips omitted fields, so leaving one out
 * would silently keep the old value. Email is omitted when blank (see above).
 */
export function supplierPayload(form: SupplierForm, editing: boolean) {
  const text = (value: string) => {
    const trimmed = value.trim();
    return trimmed || (editing ? '' : undefined);
  };
  return {
    name: form.name.trim(),
    contactName: text(form.contactName),
    email: form.email.trim() || undefined,
    phone: text(form.phone),
    address: text(form.address),
    notes: text(form.notes),
  };
}

/** Up to two initials for a supplier's monogram, skipping "&" and the like. */
export const supplierInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter((word) => /[a-z0-9]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
