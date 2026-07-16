// Customer loyalty QR payload.
//
// The QR shown on a customer's profile encodes their unique customer id with a
// stable prefix, so a POS scanner can both validate that a scanned code is one
// of ours and extract the id. Keep encode/parse together — they are a contract.

const PREFIX = 'duma:customer:';

export const customerQrValue = (customerId: string) => `${PREFIX}${customerId}`;

/** Returns the customer id from a scanned QR value, or null if it isn't a customer code. */
export function parseCustomerQr(value: string): string | null {
  if (!value.startsWith(PREFIX)) return null;
  const id = value.slice(PREFIX.length).trim();
  return id.length > 0 ? id : null;
}
