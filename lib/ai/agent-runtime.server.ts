import 'server-only';

import { apiFetch } from '@/lib/api/client';
import type { StockItem } from '@/lib/api/inventory.service';
import type { Supplier } from '@/lib/api/purchasing.service';
import type { StaffProfile } from '@/lib/api/staff.service';
import type { Location } from '@/lib/api/workspace.service';
import type { MenuItem } from '@/types/menu';

import { toNumber } from './agent-format.ts';
import type { AgentFieldOption } from './agent-types';

/**
 * One agent turn's view of the workspace. Reference data (locations, suppliers,
 * stock items, staff, menu) is fetched at most once per turn: a single question
 * can trigger several tools plus an action draft, and each of those needs the
 * same lists to resolve names and to build the editable option sets.
 */
export class AgentRuntime {
  private readonly cache = new Map<string, Promise<unknown>>();

  /**
   * Set by the turn generator so a long-running tool can narrate itself.
   *
   * Tools run inside a `Promise.all`, which the generator cannot yield from, so
   * progress is pushed here and drained by the generator between awaits. A tool
   * that pages through hundreds of records otherwise sits behind one static
   * step label for the whole sweep.
   */
  onProgress: ((label: string) => void) | null = null;

  constructor(
    readonly cookieHeader: string,
    readonly profile: StaffProfile,
    readonly locationId: string | null,
    readonly tenantId: string | null,
  ) {}

  /** Report progress mid-tool. Silently ignored when nothing is listening. */
  progress(label: string) {
    this.onProgress?.(label);
  }

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const pending = load().catch((error: unknown) => {
      // A failed load must not poison the turn — the next caller retries.
      this.cache.delete(key);
      throw error;
    });
    this.cache.set(key, pending);
    return pending;
  }

  get<T>(path: string) {
    return apiFetch<T>(path, { cookieHeader: this.cookieHeader });
  }

  send<T>(path: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown) {
    return apiFetch<T>(path, {
      method,
      cookieHeader: this.cookieHeader,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  locations() {
    return this.once('locations', async () => (await this.get<Location[]>('/locations')).filter((row) => row.isActive));
  }

  suppliers() {
    return this.once('suppliers', async () => (await this.get<Supplier[]>('/suppliers')).filter((row) => row.isActive));
  }

  stockItems() {
    return this.once('stock-items', async () => (await this.get<StockItem[]>('/stock-items')).filter((row) => row.isActive));
  }

  /**
   * The API nests the account under `user`, so a raw read has no top-level name
   * or email — the staff service lifts them and every screen relies on that.
   * Reading the endpoint directly here means doing the same, or the agent
   * reports a workspace full of anonymous user ids.
   */
  staff() {
    return this.once('staff', async () =>
      (await this.get<StaffProfile[]>('/staff'))
        .filter((row) => row.isActive)
        .map((row) => ({ ...row, name: row.name ?? row.user?.name, email: row.email ?? row.user?.email })),
    );
  }

  /** userId → display name, for endpoints that return ids without the account. */
  async staffNames() {
    const staff = await this.staff().catch(() => [] as StaffProfile[]);
    return new Map(staff.map((row) => [row.userId, row.name || row.email || row.userId]));
  }

  menuItems() {
    return this.once('menu-items', () => this.get<MenuItem[]>('/menu-items'));
  }

  /** The location an action should default to: the explicit argument, then the active one, then the only one available. */
  async resolveLocationId(candidate?: unknown) {
    const locations = await this.locations();
    const requested = typeof candidate === 'string' && candidate ? candidate : '';
    if (requested && locations.some((row) => row.id === requested)) return requested;
    if (this.locationId && locations.some((row) => row.id === this.locationId)) return this.locationId;
    return locations.length === 1 ? locations[0].id : '';
  }

  async locationName(id: string | null | undefined) {
    if (!id) return '';
    const locations = await this.locations().catch(() => [] as Location[]);
    return locations.find((row) => row.id === id)?.name ?? '';
  }

  /** Timezone of a location, falling back to the UK the whole product assumes. */
  async timezone(id: string | null | undefined) {
    const locations = await this.locations().catch(() => [] as Location[]);
    return locations.find((row) => row.id === id)?.timezone || 'Europe/London';
  }

  async locationOptions(): Promise<AgentFieldOption[]> {
    return (await this.locations()).map((row) => ({ value: row.id, label: row.name, ...(row.address ? { hint: row.address } : {}) }));
  }

  async supplierOptions(): Promise<AgentFieldOption[]> {
    return (await this.suppliers()).map((row) => ({
      value: row.id,
      label: row.name,
      ...(row.contactName || row.email ? { hint: [row.contactName, row.email].filter(Boolean).join(' · ') } : {}),
    }));
  }

  /** Stock items as line options, carrying the unit and last cost so an added line lands complete. */
  async stockItemOptions(): Promise<AgentFieldOption[]> {
    return (await this.stockItems()).map((row) => ({
      value: row.id,
      label: row.name,
      hint: row.unit,
      prefill: {
        unit: row.unit,
        quantityOrdered: Number(row.defaultReorderQuantity ?? 0) || 1,
        quantity: Number(row.defaultReorderQuantity ?? 0) || 1,
        requestedQty: Number(row.defaultReorderQuantity ?? 0) || 1,
        unitCost: toNumber(row.costPerUnit),
      },
    }));
  }

  async staffOptions(): Promise<AgentFieldOption[]> {
    return (await this.staff()).map((row) => ({
      value: row.userId,
      label: row.name || row.email || row.userId,
      hint: ROLE_LABELS[row.role] ?? row.role,
    }));
  }
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  franchise_owner: 'Franchise owner',
  store_manager: 'Store manager',
  hr_manager: 'HR manager',
  marketing_manager: 'Marketing manager',
  auditor: 'Auditor',
  barista: 'Barista',
};
