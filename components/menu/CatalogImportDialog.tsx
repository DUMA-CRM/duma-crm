'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { TEXTAREA_CLASS } from '@/components/cms/shared';
import { AlertTriangle, CheckCircle2, Download, FileText, UploadCloud } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { importCatalog } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { rowsFromCsv } from '@/lib/utils/catalog-import';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { CatalogImportReport } from '@/types/catalog';

const TEMPLATE = [
  'Product,Category,Description,Colour,Size,Price,Was price,SKU,Stock,Image URL',
  'Oversized Hoodie,Hoodies,Heavyweight cotton,Black,M,45.00,,,12,',
  'Oversized Hoodie,Hoodies,,Black,L,45.00,,,8,',
  'Logo Tee,T-shirts,Soft organic cotton,White,S,20.00,25.00,,15,',
].join('\n');

/**
 * Products, sizes and stock from a sheet — ours, or a Shopify export. Checked
 * first (nothing kept), then imported. Existing products and sizes are updated
 * by name and SKU, never duplicated.
 */
export function CatalogImportDialog({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [report, setReport] = useState<CatalogImportReport | null>(null);
  const locationsQuery = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId),
  });
  const locations = locationsQuery.data ?? [];
  const parsed = useMemo(() => (text.trim() ? rowsFromCsv(text) : null), [text]);
  const hasStock = parsed?.map.fields.stock !== undefined;
  const stockAt = hasStock ? locationId || locations[0]?.id || '' : '';

  const run = useMutation({
    mutationFn: (dryRun: boolean) => importCatalog({ rows: parsed!.rows, ...(stockAt ? { locationId: stockAt } : {}), dryRun }, tenantId),
    onSuccess: (result) => {
      if (result.dryRun) {
        setReport(result);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('item-catalog') });
      toast(
        'success',
        `Imported — ${result.totals.productsCreated} new, ${result.totals.productsUpdated} updated, ${result.totals.variantsCreated} sizes added.`,
      );
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const load = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    setText(await file.text());
  };

  const mapped = parsed
    ? [
        ...Object.keys(parsed.map.fields).map(
          (field) =>
            ({
              product: 'Product',
              category: 'Category',
              description: 'Description',
              price: 'Price',
              compareAtPrice: 'Was price',
              sku: 'SKU',
              barcode: 'Barcode',
              stock: 'Stock',
              imageUrl: 'Image',
            })[field] ?? field,
        ),
        ...parsed.map.options.map((option) => ('name' in option ? option.name : 'Options')),
      ]
    : [];

  return (
    <Modal
      title="Import products"
      description="From a spreadsheet saved as CSV — your own, or a Shopify export. You’ll see what changes before anything is saved."
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}
            download="duma-products-template.csv"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Download size={13} aria-hidden="true" /> Template
          </a>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {report ? (
              <Button className="min-w-32" disabled={run.isPending} onClick={() => run.mutate(false)}>
                {run.isPending ? 'Importing…' : `Import ${report.products.length} ${report.products.length === 1 ? 'product' : 'products'}`}
              </Button>
            ) : (
              <Button className="min-w-32" disabled={!parsed || Boolean(parsed.error) || run.isPending} onClick={() => run.mutate(true)}>
                {run.isPending ? 'Checking…' : 'Check'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {!text ? (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void load(event.dataTransfer.files[0]);
              }}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-rule/70 bg-control px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-rule hover:text-foreground"
            >
              <UploadCloud size={22} aria-hidden="true" />
              <span className="font-medium text-foreground">Choose a CSV file</span>
              <span className="text-xs">or drop it here</span>
            </button>
            <textarea
              aria-label="Or paste the sheet"
              rows={3}
              className={cn(TEXTAREA_CLASS, 'font-mono text-xs')}
              placeholder="…or paste it: Product,Size,Price,Stock"
              onChange={(event) => {
                setFileName(null);
                setReport(null);
                setText(event.target.value);
              }}
            />
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-control px-3.5 py-2.5">
            <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{fileName ?? 'Pasted sheet'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {parsed?.error ??
                  `${parsed?.rows.length} rows · reads ${mapped.join(', ')}${parsed?.map.unused.length ? ` · ignores ${parsed.map.unused.join(', ')}` : ''}`}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText('');
                setReport(null);
              }}
            >
              Change
            </Button>
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => void load(event.target.files?.[0])}
        />

        {parsed?.error && (
          <p className="flex items-center gap-2 text-sm text-exception">
            <AlertTriangle size={14} aria-hidden="true" /> {parsed.error}
          </p>
        )}

        {hasStock && locations.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-label uppercase text-muted-foreground">Stock is at</p>
            <Select
              ariaLabel="Stock is at"
              className="w-full"
              value={stockAt}
              onValueChange={(value) => {
                setLocationId(value);
                setReport(null);
              }}
              options={locations.map((location) => ({ value: location.id, label: location.name }))}
            />
          </div>
        )}

        {report && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CheckCircle2 size={15} className="text-momentum" aria-hidden="true" />
              {report.totals.productsCreated} new, {report.totals.productsUpdated} updated · {report.totals.variantsCreated} sizes added,{' '}
              {report.totals.variantsUpdated} updated{report.totals.stockSet > 0 ? ` · stock set for ${report.totals.stockSet}` : ''}
            </p>
            <ul className="max-h-64 divide-y divide-rule/40 overflow-auto rounded-lg border border-rule/60 bg-control">
              {report.products.map((product) => (
                <li key={product.name} className="px-3.5 py-2">
                  <p className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-foreground">{product.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {product.action === 'create' ? 'New' : 'Update'} · {product.variantsCreated + product.variantsUpdated} sizes
                    </span>
                  </p>
                  {product.problems.map((problem) => (
                    <p key={problem} className="mt-0.5 flex items-start gap-1.5 text-xs text-measured">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" /> {problem}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Nothing has been saved yet.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
