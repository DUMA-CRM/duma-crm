import { QrCode, Phone } from 'lucide-react';

export function CustomerLoyalty() {
  return (
    <div className="p-5 border-b border-border shrink-0">
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-muted-foreground uppercase tracking-widest">Customer Loyalty</p>
        <QrCode size={18} className="text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center gap-1.5 font-semibold border border-border rounded-lg h-10 text-foreground hover:bg-muted transition-colors">
          <Phone size={18} /> Find by Phone
        </button>
        <button className="flex items-center justify-center gap-1.5 font-semibold rounded-lg h-10 bg-amber-400 hover:bg-amber-500 text-amber-950 transition-colors">
          <QrCode size={18} /> Scan Code
        </button>
      </div>
    </div>
  );
}
