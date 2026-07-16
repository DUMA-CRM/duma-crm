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
      variant={active ? 'default' : 'ghost'}
      onClick={onClick}
      className={
        active
          ? 'border-primary text-primary bg-primary/10'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
      }
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
