/** Comparable values for the customer edit form, independent of server refreshes. */
export interface CustomerFormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dob: string;
  allergies: readonly string[];
  dietary: readonly string[];
  seating: string;
  alerts: readonly { severity: string; label: string; note?: string | null }[];
}

export function customerFormSnapshot(values: CustomerFormValues): string {
  return JSON.stringify({
    ...values,
    allergies: [...values.allergies].sort(),
    dietary: [...values.dietary].sort(),
    alerts: values.alerts.map(({ severity, label, note }) => ({ severity, label, note: note ?? '' })),
  });
}
