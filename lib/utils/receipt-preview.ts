/**
 * Totals for the sample receipt on the Trading & tax screen. Worked in pence
 * so the preview never shows a float artefact. This is a picture of the VAT
 * setting, not the till's arithmetic — real totals come from the API.
 */

export interface ReceiptLine {
  quantity: number;
  name: string;
  /** Unit price in pence, as the menu shows it. */
  unitPence: number;
  extras?: { name: string; pence: number }[];
}

export interface ReceiptTotals {
  /** Sum of the lines as priced on the menu. */
  itemsPence: number;
  vatPence: number;
  totalPence: number;
}

export const linePence = (line: ReceiptLine) =>
  line.quantity * (line.unitPence + (line.extras ?? []).reduce((sum, extra) => sum + extra.pence, 0));

export function receiptTotals(
  lines: ReceiptLine[],
  vat: { registered: boolean; ratePercent: number; pricesIncludeTax: boolean },
): ReceiptTotals {
  const itemsPence = lines.reduce((sum, line) => sum + linePence(line), 0);
  if (!vat.registered || vat.ratePercent <= 0) return { itemsPence, vatPence: 0, totalPence: itemsPence };
  const rate = vat.ratePercent / 100;
  if (vat.pricesIncludeTax) {
    const vatPence = Math.round(itemsPence - itemsPence / (1 + rate));
    return { itemsPence, vatPence, totalPence: itemsPence };
  }
  const vatPence = Math.round(itemsPence * rate);
  return { itemsPence, vatPence, totalPence: itemsPence + vatPence };
}
