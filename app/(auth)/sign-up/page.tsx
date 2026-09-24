'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Building2, Loader2, MapPin } from '@/components/icons';
import { Input } from '@/components/ui/input';

import { createWorkspace, type WorkspaceSignupInput } from '@/lib/modules/identity/client';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function slugFrom(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

const initialForm: WorkspaceSignupInput = {
  businessName: '',
  workspaceSlug: '',
  locationName: '',
  locationAddress: '',
  timezone: '',
  ownerName: '',
  email: '',
  password: '',
};

export default function SignUpPage() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [form, setForm] = useState(initialForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const command = useRef<{ payload: string; key: string } | null>(null);

  const update = (field: keyof WorkspaceSignupInput, value: string) => {
    setError(null);
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'businessName' && !slugTouched) next.workspaceSlug = slugFrom(value);
      return next;
    });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const payload: WorkspaceSignupInput = {
      ...form,
      businessName: form.businessName.trim(),
      workspaceSlug: slugFrom(form.workspaceSlug),
      locationName: form.locationName.trim(),
      locationAddress: form.locationAddress.trim(),
      ownerName: form.ownerName.trim(),
      email: form.email.trim().toLowerCase(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
    };
    const serialized = JSON.stringify(payload);
    if (!command.current || command.current.payload !== serialized) {
      command.current = { payload: serialized, key: crypto.randomUUID() };
    }

    try {
      const result = await createWorkspace(payload, command.current.key);
      setUser(result.user);
      useWorkspaceStore.setState({
        tenantId: result.workspace.tenantId,
        locationId: result.workspace.locationId,
      });
      router.replace('/settings/workspaces');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The workspace could not be created. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-headline text-foreground">Open your first workspace</h1>
        <p className="mt-2 max-w-[58ch] text-sm leading-6 text-muted-foreground">
          Create the business, first location and owner access together. You’ll choose the tools your team needs on the next screen.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <p role="alert" className="rounded-sm border border-exception/35 bg-destructive/6 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <section aria-labelledby="business-details-heading">
          <div className="mb-3 flex items-center gap-2 border-b border-rule/55 pb-2">
            <Building2 size={17} className="text-primary" aria-hidden="true" />
            <h2 id="business-details-heading" className="text-sm font-semibold text-foreground">Business</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Business name"
              name="organization"
              autoComplete="organization"
              placeholder="North Street Coffee"
              value={form.businessName}
              onChange={(event) => update('businessName', event.target.value)}
              autoFocus
              required
            />
            <Input
              label="Workspace ID"
              name="workspaceSlug"
              autoComplete="off"
              placeholder="north-street-coffee"
              hint="Lowercase letters, numbers and hyphens."
              value={form.workspaceSlug}
              onChange={(event) => {
                setSlugTouched(true);
                update('workspaceSlug', slugFrom(event.target.value));
              }}
              minLength={3}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
          </div>
        </section>

        <section aria-labelledby="location-details-heading">
          <div className="mb-3 flex items-center gap-2 border-b border-rule/55 pb-2">
            <MapPin size={17} className="text-stock" aria-hidden="true" />
            <h2 id="location-details-heading" className="text-sm font-semibold text-foreground">First location</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Location name"
              name="locationName"
              autoComplete="organization-title"
              placeholder="North Street"
              value={form.locationName}
              onChange={(event) => update('locationName', event.target.value)}
              required
            />
            <Input
              label="Address"
              name="locationAddress"
              autoComplete="street-address"
              placeholder="12 North Street, London"
              value={form.locationAddress}
              onChange={(event) => update('locationAddress', event.target.value)}
              required
            />
          </div>
        </section>

        <section aria-labelledby="owner-details-heading">
          <div className="mb-3 border-b border-rule/55 pb-2">
            <h2 id="owner-details-heading" className="text-sm font-semibold text-foreground">Your owner account</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Your name"
              name="name"
              autoComplete="name"
              placeholder="Alex Morgan"
              value={form.ownerName}
              onChange={(event) => update('ownerName', event.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="alex@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              required
            />
            <div className="sm:col-span-2">
              <Input
                label="Password"
                type="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="At least 12 characters"
                hint="Use 12 or more characters. A password manager is best."
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                minLength={12}
                maxLength={128}
                required
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          <span aria-live="polite">{isSubmitting ? 'Creating your workspace…' : 'Create workspace'}</span>
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="font-semibold text-primary transition-colors hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}
