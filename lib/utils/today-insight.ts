/**
 * The one thing worth saying about today so far, and the question to put to
 * Ask DUMA about it — for the tile that fills the dashboard's figures row.
 * First match wins, most pressing first; a reading that can't be compared
 * honestly falls back to an open question rather than a confident claim.
 */
export interface TodayFacts {
  weekday: string;
  /** Enough history, and the day under way. */
  comparable: boolean;
  open: boolean;
  orders: number;
  typicalOrders: number;
  averageOrder: number;
  typicalAverageOrder: number;
  refunds: number;
  /** Labour as a % of takings; null when there isn't enough taken to say. */
  labourPercent: number | null;
}

export function todayInsight(facts: TodayFacts, money: (value: number) => string): { line: string; prompt: string } {
  const day = facts.weekday;
  const change = (value: number, typical: number) => (typical > 0 ? Math.round(((value - typical) / typical) * 100) : 0);

  if (!facts.open || facts.orders === 0) {
    return {
      line: `Nothing in yet. Ask what a typical ${day} brings.`,
      prompt: `What does a typical ${day} look like for us — the busy hours, the best sellers, and how many orders?`,
    };
  }
  if (facts.labourPercent !== null && facts.labourPercent > 35) {
    const pct = Math.round(facts.labourPercent);
    return {
      line: `Labour is ${pct}% of takings so far — on the high side.`,
      prompt: `Labour is ${pct}% of today's takings so far. Is that unusual for a ${day}, and what could I change?`,
    };
  }
  if (facts.comparable) {
    const orders = change(facts.orders, facts.typicalOrders);
    if (orders <= -15) {
      return {
        line: `${Math.abs(orders)}% fewer orders than a typical ${day} by now.`,
        prompt: `We're ${Math.abs(orders)}% behind a typical ${day} on orders. What might explain it, and what could we do for the rest of the day?`,
      };
    }
    if (orders >= 15) {
      return {
        line: `${orders}% busier than a typical ${day} — worth checking stock.`,
        prompt: `We're ${orders}% ahead of a typical ${day}. What's driving it, and are we short of anything we'll need later?`,
      };
    }
    const basket = change(facts.averageOrder, facts.typicalAverageOrder);
    if (Math.abs(basket) >= 10) {
      return {
        line: `Average order is ${Math.abs(basket)}% ${basket > 0 ? 'up' : 'down'} on a typical ${day}.`,
        prompt: `Our average order is ${money(facts.averageOrder)} today against ${money(facts.typicalAverageOrder)} on a typical ${day}. Why, and which items are behind it?`,
      };
    }
  }
  if (facts.refunds > 0) {
    return {
      line: `${money(facts.refunds)} refunded today. See why in a sentence.`,
      prompt: `What were today's refunds for, who gave them, and is anything repeating?`,
    };
  }
  return {
    line: facts.comparable ? `Tracking a typical ${day}. Ask what to watch next.` : 'Ask for a quick read of the day so far.',
    prompt: 'Give me a quick read of today so far, and one thing I should act on.',
  };
}
