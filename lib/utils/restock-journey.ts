export type RestockJourneyStage = { label: string; state: 'done' | 'current' | 'next' };

export function restockJourney(
  request: {
    status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
    receivedAt?: string | null;
    purchaseOrderId?: string | null;
  },
  directReceive: boolean,
): RestockJourneyStage[] {
  if (request.status === 'rejected') {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Rejected', state: 'current' },
    ];
  }
  if (request.receivedAt) {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Approved', state: 'done' },
      { label: 'Received', state: 'done' },
    ];
  }
  if (request.status === 'pending') {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Review now', state: 'current' },
      { label: directReceive ? 'Receive' : 'Order', state: 'next' },
    ];
  }
  if (request.status === 'approved') {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Approved', state: 'done' },
      { label: directReceive ? 'Receive next' : 'Create order', state: 'current' },
    ];
  }
  if (directReceive) {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Approved', state: 'done' },
      { label: 'Ordered', state: 'done' },
      { label: 'Receive next', state: 'current' },
    ];
  }
  if (!request.purchaseOrderId) {
    return [
      { label: 'Requested', state: 'done' },
      { label: 'Approved', state: 'done' },
      { label: 'Add to purchase orders', state: 'current' },
    ];
  }
  return [
    { label: 'Requested', state: 'done' },
    { label: 'Approved', state: 'done' },
    { label: 'Ordered', state: 'done' },
  ];
}
