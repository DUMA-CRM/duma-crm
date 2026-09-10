/**
 * Ask DUMA is an operational product assistant, not a general chat model.
 *
 * This deterministic boundary runs before a provider call, so the model is
 * never trusted to decide whether it should answer an unrelated request.
 *
 * It is a **deny-list**, and that is a deliberate reversal.
 *
 * The original guard was an allow-list of business nouns: a request had to
 * contain one of ~120 words, or a recognised "operational intent" phrase, to
 * reach the model at all. It read as cautious and was quietly the worst thing
 * in the agent. Measured against nine ordinary manager questions, seven were
 * refused:
 *
 *     Are we busy on Saturday?          — "busy" was not a business word
 *     Why did takings drop last week?   — "revenue" was in the list, "takings" was not
 *     How much did we make yesterday?   — no listed noun at all
 *     Is anyone off sick today?         — "leave" was listed, "sick" was not
 *     Compare Camden and Shoreditch     — location names are not vocabulary
 *     Which barista is fastest?
 *     Should I hire another part-timer?
 *
 * Every one is a question the product exists to answer, and each was declined
 * with a message about staying on topic. Nothing recorded it, so the refusals
 * were invisible.
 *
 * The trade this makes: a genuinely unrelated question that dodges the patterns
 * below — "what is the capital of France?" — now reaches the model, which
 * declines it under its own instructions. That is the right way round. A wrong
 * refusal costs a real answer and the operator's trust in asking again; a wrong
 * admission costs one cheap completion that says no.
 *
 * The rule for editing this file: patterns here must describe **a kind of task
 * DUMA does not do**, never a subject it does not know the word for.
 */

/**
 * Work that belongs to a general-purpose assistant, not to a coffee CRM.
 *
 * Grouped by the kind of request rather than by keyword, because that is the
 * test a new pattern has to pass. Anything matching is refused outright, in
 * any conversation, however it is framed.
 */
const OUT_OF_SCOPE = [
  // Writing or explaining software.
  /\b(?:html|css|javascript|typescript|python|react|sql query|source code|code snippet|regex|program(?:ming)?(?: language)?|shell script|api key)\b/i,
  /\b(?:write|build|generate|debug|refactor|compile)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+)?(?:code|script|app|website|landing page|calculator|game)\b/i,
  // Producing creative or personal content.
  /\b(?:poem|essay|story|song|lyrics|joke|riddle|screenplay|cover letter|homework|blog post)\b/i,
  // Media DUMA cannot make.
  /\b(?:generate|create|draw|design|make)\s+(?:me\s+)?(?:a\s+|an\s+)?(?:image|picture|photo|logo|video|presentation|slide deck)\b/i,
  // The world outside the business.
  /\b(?:weather|forecast for tomorrow|news headlines|sports score|football score|cryptocurrency|bitcoin|share price|stock market|horoscope|election)\b/i,
  // Language work.
  /\btranslat(?:e|ion)\b/i,
  // Encyclopaedia questions, only in their unmistakable form. "Who is on shift
  // today?" and "which supplier is cheapest?" look identical to trivia at the
  // grammar level, so nothing may key on the question word alone.
  /\b(?:capital|population|president|prime minister)\s+of\s+[A-Z]/,
  /\bmeaning of life\b/i,
] as const;

/**
 * Whether the model should be asked at all.
 *
 * Note there is no history parameter any more. The allow-list needed one to let
 * "yes, do that" through after an in-scope turn; a deny-list admits short
 * follow-ups by default, and an out-of-scope request is refused whatever came
 * before it.
 */
export function isAppRelatedRequest(request: string) {
  const normalized = request.trim();
  if (!normalized) return false;
  return !OUT_OF_SCOPE.some((pattern) => pattern.test(normalized));
}
