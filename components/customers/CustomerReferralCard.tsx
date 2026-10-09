'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import { copyText } from '@/components/cms/shared';
import { Gift, Hash, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { CopyButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { getCustomerReferrals, issueCustomerReferralCode } from '@/lib/modules/referrals/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';

/**
 * Refer a friend, on the customer's record: their own code (or a button to
 * give them one), and how their referrals stand. Nothing when the programme
 * isn't set up.
 */
export function CustomerReferralCard({ customerId, canIssue }: { customerId: string; canIssue: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: moduleQueryKeys.referrals.key('customer', customerId),
    queryFn: () => getCustomerReferrals(customerId),
  });
  const issue = useMutation({
    mutationFn: () => issueCustomerReferralCode(customerId),
    onSuccess: async (issued) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.referrals.all });
      toast('success', `Their code is ${issued.code}.`);
    },
    onError: (error) => toast('error', error.message),
  });

  if (query.isSuccess && query.data === null) return null;
  return (
    <SettingsSection title="Refer a friend">
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading referrals">
          <Bone className="h-20 rounded-lg" />
        </div>
      ) : query.isError ? (
        <ErrorState className="py-6" title="Referrals couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : (
        <InfoRows>
          <InfoRow icon={Hash} title="Their code">
            {query.data!.code ? (
              <>
                <span className="font-mono text-sm font-semibold text-foreground">{query.data!.code}</span>
                <CopyButton
                  iconOnly
                  size="icon-sm"
                  variant="ghost"
                  label="Copy their code"
                  copiedLabel="Copied"
                  onCopy={async () => {
                    const copied = await copyText(query.data!.code!);
                    if (!copied) toast('error', 'Copy failed — select the code instead.');
                    return copied;
                  }}
                />
              </>
            ) : canIssue ? (
              <Button size="sm" variant="outline" disabled={issue.isPending} onClick={() => issue.mutate()}>
                {issue.isPending ? 'Giving…' : 'Give them a code'}
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">None yet</span>
            )}
          </InfoRow>
          <InfoRow icon={Users} title="Friends waiting">
            <span className="text-sm tabular-nums text-muted-foreground">{query.data!.pending}</span>
          </InfoRow>
          <InfoRow icon={Gift} title="Rewards earned">
            <span className="text-sm tabular-nums text-muted-foreground">{query.data!.rewarded}</span>
          </InfoRow>
        </InfoRows>
      )}
    </SettingsSection>
  );
}
