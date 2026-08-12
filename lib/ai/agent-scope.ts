const OUT_OF_SCOPE =
  /\b(html|css|javascript|typescript|python|react|sql|source code|code snippet|program(?:ming)?|script|calculator|website|landing page|essay|poem|story|song|joke|riddle|cover letter|homework|translate|translation|image|picture|video|presentation|logo|weather|news|sports score|cryptocurrency|bitcoin)\b/i;

const APP_LANGUAGE =
  /\b(duma|dashboard|operations|operational|performance|metrics|kpi|priorities|target|targets|forecast|exceptions|warnings|my hr|personal details|my name|my address|emergency contact|national insurance|ni number|payslip|expense claim|order|orders|customer|customers|guest|guests|loyalty|points|segment|segments|menu|recipe|recipes|modifier|modifiers|inventory|stock|supplier|suppliers|purchase|purchasing|restock|reorder|delivery|deliveries|stocktake|transfer|waste|loss|report|reports|sales|sold|selling|revenue|refund|refunds|staff|team|rota|shift|shifts|clocked|clock-in|leave|payroll|attendance|helpdesk|email|automation|communications|cash-up|cashup|variance|compliance|privacy|audit|settings|location|locations|workspace|pos|kds|kitchen|payment|payments|trading|vat|opening hours|close|closing|low stock|menu item|service|till)\b/i;

const APP_UI_LANGUAGE =
  /\b(this page|current page|screen|drawer|button|field|form|filter|tab|dropdown|select|highlight|guide me|walk me through|where can i find|how do i|not working|won't open|cannot open|can't open)\b/i;

// Natural management language often omits the noun naming the underlying
// screen. These phrases are still unambiguously asking DUMA to assess the
// operator's workspace, and several are offered by the Dashboard itself.
const APP_OPERATIONAL_INTENT =
  /\b(review (?:today[’']?s|current) operations|what needs (?:my )?attention|what needs doing|things? (?:that )?need attention|today[’']?s priorities|set (?:my |the )?priorities|how (?:are|did) we (?:doing|do)|my business|business performance|operational (?:summary|status|risk|risks|priorities))\b/i;

const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|thanks|thank you)[!. ]*$/i;

function directlyRelated(request: string) {
  return (
    GREETING.test(request.trim()) || APP_LANGUAGE.test(request) || APP_UI_LANGUAGE.test(request) || APP_OPERATIONAL_INTENT.test(request)
  );
}

/**
 * Ask DUMA is an operational product assistant, not a general chat model.
 * This deterministic boundary runs before a provider call; the model is never
 * trusted to decide whether it should answer an unrelated request itself.
 */
export function isAppRelatedRequest(request: string, previousUserRequests: readonly string[] = []) {
  const normalized = request.trim();
  if (!normalized || OUT_OF_SCOPE.test(normalized)) return false;
  if (directlyRelated(normalized)) return true;

  // Preserve natural follow-ups such as "yes", "tomorrow" or "the first one",
  // but only when the preceding user request was itself clearly about DUMA.
  const previousWasRelated = [...previousUserRequests].reverse().some((entry) => directlyRelated(entry) && !OUT_OF_SCOPE.test(entry));
  return normalized.length <= 160 && previousWasRelated;
}
