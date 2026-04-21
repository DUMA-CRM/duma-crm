'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Pencil, Check, Package } from 'lucide-react';
import {
  getStockItems,
  getMenuItemStock,
  linkMenuItemStock,
  updateMenuItemStock,
  removeMenuItemStock,
  getModifierStock,
  linkModifierStock,
  updateModifierStock,
  removeModifierStock,
  type StockItem,
} from '@/lib/api/inventory.service';

interface LinkRow {
  id: string;
  stockItemId: string;
  quantity: string;
  stockItem?: StockItem;
}

interface Props {
  type: 'menu-item' | 'modifier';
  entityId: string;
}

const inputClass =
  'h-8 bg-background border border-border rounded-md px-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

export function StockLinker({ type, entityId }: Props) {
  const qc = useQueryClient();
  const qKey = type === 'menu-item' ? ['menu-item-stock', entityId] : ['modifier-stock', entityId];

  const fetchLinks = (): Promise<LinkRow[]> => (type === 'menu-item' ? getMenuItemStock(entityId) : getModifierStock(entityId));

  const { data: links = [], isLoading } = useQuery<LinkRow[]>({
    queryKey: qKey,
    queryFn: fetchLinks,
  });

  const { data: allStockItems = [] } = useQuery({
    queryKey: ['stock-items'],
    queryFn: getStockItems,
  });

  const linkMutation = useMutation<LinkRow, Error, { stockItemId: string; quantity: string }>({
    mutationFn: ({ stockItemId, quantity }) =>
      type === 'menu-item'
        ? linkMenuItemStock({ menuItemId: entityId, stockItemId, quantity })
        : linkModifierStock({ modifierId: entityId, stockItemId, quantity }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      setSelectedId('');
      setQty('');
    },
  });

  const updateMutation = useMutation<LinkRow, Error, { id: string; quantity: string }>({
    mutationFn: ({ id, quantity }) => (type === 'menu-item' ? updateMenuItemStock(id, quantity) : updateModifierStock(id, quantity)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      setEditingId(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => (type === 'menu-item' ? removeMenuItemStock(id) : removeModifierStock(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  const linkedIds = new Set((links as LinkRow[]).map((l) => l.stockItemId));
  const available = allStockItems.filter((s) => !linkedIds.has(s.id));

  const selectedStock = allStockItems.find((s) => s.id === selectedId);

  if (isLoading) return null;

  return (
    <div className="border-t border-border pt-4 mt-2 space-y-3">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Stock Consumption</p>

      {allStockItems.length === 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Package size={12} aria-hidden="true" />
          No stock items defined yet. Add them in Inventory first.
        </p>
      )}

      {/* Linked rows */}
      {(links as LinkRow[]).length > 0 && (
        <div className="flex flex-col gap-1">
          {(links as LinkRow[]).map((link) => {
            const stock = link.stockItem ?? allStockItems.find((s) => s.id === link.stockItemId);
            const isEditing = editingId === link.id;

            return (
              <div key={link.id} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground">{stock?.name ?? link.stockItemId}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{stock?.unit}</span>
                </div>

                {isEditing ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      pattern="^\d+(\.\d{1,2})?$"
                      className={`${inputClass} w-20`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => editQty && updateMutation.mutate({ id: link.id, quantity: editQty })}
                      disabled={!editQty || updateMutation.isPending}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-success hover:bg-success/10 transition-colors disabled:opacity-40"
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-surface-offset transition-colors"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm font-semibold text-foreground tabular-nums">{link.quantity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(link.id);
                        setEditQty(link.quantity);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-offset transition-colors"
                      aria-label="Edit quantity"
                    >
                      <Pencil size={11} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(link.id)}
                      disabled={removeMutation.isPending}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remove link"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add row */}
      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 cursor-pointer"
          >
            <option value="">Add stock item…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.unit})
              </option>
            ))}
          </select>

          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={selectedStock ? selectedStock.unit : 'qty'}
            pattern="^\d+(\.\d{1,2})?$"
            className={`${inputClass} w-20`}
            aria-label="Quantity per use"
          />

          <button
            type="button"
            disabled={!selectedId || !qty || linkMutation.isPending}
            onClick={() => selectedId && qty && linkMutation.mutate({ stockItemId: selectedId, quantity: qty })}
            className="h-9 w-9 flex items-center justify-center bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            aria-label="Add stock link"
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {available.length === 0 && allStockItems.length > 0 && (
        <p className="text-xs text-muted-foreground">All stock items are already linked.</p>
      )}
    </div>
  );
}
