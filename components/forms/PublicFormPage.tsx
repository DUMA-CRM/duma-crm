'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { GuestHeader, GuestUnavailable } from '@/components/shared/GuestChrome';
import { Logo } from '@/components/shared/Logo';
import { PublicFooter } from '@/components/shared/PublicFooter';
import { Bone } from '@/components/shared/Skeleton';

import { getPublicForm, submitPublicForm } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { prefillAnswers, responseMetadata } from '@/lib/utils/forms';

import { FormRenderer } from './FormRenderer';

/**
 * A published form on DUMA's own page: the business's name in the same dark
 * band as the booking page and the QR menu, the form on a card beneath.
 * Framed into a website (`?embed=1`) it drops the band and the footer, sits on
 * a transparent ground, and tells the page around it how tall it is.
 *
 * Answers can be filled in from the link (`?email=…`, by API key), which is
 * also how hidden fields get their values; utm_* parameters and the referrer
 * are kept with the response.
 */
export function PublicFormPage({ publicId, embedded }: { publicId: string; embedded: boolean }) {
  const form = useQuery({
    queryKey: moduleQueryKeys.forms.key('public', publicId),
    queryFn: () => getPublicForm(publicId),
    retry: false,
    // A form's questions don't change under someone filling it in.
    refetchOnWindowFocus: false,
  });

  // Read once, on the client: the link's own parameters.
  const params = useMemo(() => (typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)), []);
  const initialAnswers = useMemo(() => (form.data ? prefillAnswers(form.data.fields, params) : {}), [form.data, params]);

  useEmbedHeight(embedded, publicId);

  if (form.isPending) {
    return (
      <Frame embedded={embedded}>
        <div className="space-y-4" aria-busy="true">
          <Bone className="h-8 w-2/3 rounded-md" />
          <Bone className="h-16 rounded-md" />
          <Bone className="h-16 rounded-md" />
          <Bone className="h-11 w-32 rounded-md" />
        </div>
      </Frame>
    );
  }
  if (form.isError || !form.data) {
    return embedded ? (
      <p className="p-6 text-center text-sm text-muted-foreground">This form isn’t available.</p>
    ) : (
      <GuestUnavailable title="This form isn’t available">The link may have changed, or the form has been taken down.</GuestUnavailable>
    );
  }

  const data = form.data;
  return (
    <Frame embedded={embedded} brandName={data.brandName}>
      {data.accepting ? (
        <FormRenderer
          form={data}
          initialAnswers={initialAnswers}
          onSubmit={(answers, website) =>
            submitPublicForm(publicId, {
              answers,
              source: embedded ? 'embed' : 'hosted',
              metadata: responseMetadata(params, embedded ? '' : document.referrer),
              ...(website ? { website } : {}),
            })
          }
        />
      ) : (
        <div className="py-6 text-center">
          <Logo size={44} className="mx-auto" />
          <h1 className="mt-4 text-xl font-semibold tracking-title">{data.name}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{data.closedMessage}</p>
        </div>
      )}
    </Frame>
  );
}

function Frame({ embedded, brandName, children }: { embedded: boolean; brandName?: string; children: React.ReactNode }) {
  if (embedded) return <main className="mx-auto max-w-2xl bg-transparent p-4 sm:p-6">{children}</main>;
  return (
    <main className="min-h-dvh bg-background">
      {brandName ? <GuestHeader brandName={brandName} /> : <div className="h-20 bg-sidebar" />}
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="rounded-xl border border-rule/60 bg-field p-6 shadow-sm sm:p-8">{children}</div>
      </div>
      <PublicFooter />
    </main>
  );
}

/** Framed, post the page's height to the parent so the iframe can fit it (see `embedSnippet`). */
function useEmbedHeight(embedded: boolean, publicId: string) {
  useEffect(() => {
    if (!embedded || window.parent === window) return;
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    let last = 0;
    const post = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      if (height === last) return;
      last = height;
      window.parent.postMessage({ type: 'duma-form:height', form: publicId, height }, '*');
    };
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    post();
    return () => observer.disconnect();
  }, [embedded, publicId]);
}
