import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface OptionBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function OptionBtn({ label, active, onClick }: OptionBtnProps) {
  return (
    <Button
      // `touch` (44px), not `lg` (40px): this is the most-tapped control in the
      // application and it sat under the floor.
      size="touch"
      // Selected is the filled ink key. The previous className override painted
      // a primary-tinted chip over the solid variant, which both fought the
      // variant and rebuilt the tinted-chip pattern that fails contrast on a
      // page-level surface.
      variant={active ? 'default' : 'outline'}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export function OptionGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Label uppercase>{label}</Label>
        {required && <Badge variant="warning">Required</Badge>}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
