// ---------------------------------------------------------------------------
// A delivery address for an order taken by hand: starting one, checking it,
// and the countries to pick from. Orders store the country as ISO 3166-1
// alpha-2 ("GB", "UA"); the browser names them in the reader's language.
// ---------------------------------------------------------------------------

import type { OrderShippingAddress } from '../api/orders.service.ts';

/** Every assigned ISO 3166-1 alpha-2 code. */
const ISO_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ ' +
  'OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

/**
 * Countries as `{ value: 'GB', label: 'United Kingdom' }`, sorted by name in
 * `locale` — with `pinned` (the reader's own countries, in order) first, the
 * last of them set apart by a rule.
 */
export function countryOptions(locale = 'en-GB', pinned?: string | readonly string[]): Array<{ value: string; label: string; dividerAfter?: boolean }> {
  const names = new Intl.DisplayNames([locale], { type: 'region' });
  const all = ISO_CODES.map((code) => ({ value: code, label: names.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const wanted = (typeof pinned === 'string' ? [pinned] : (pinned ?? [])).filter((code) => ISO_CODES.includes(code));
  const top = [...new Set(wanted)].map((code) => all.find((option) => option.value === code)!);
  if (top.length === 0) return all;
  return [...top.map((option, index) => (index === top.length - 1 ? { ...option, dividerAfter: true } : option)), ...all.filter((option) => !top.includes(option))];
}

/** Currencies used by one country only — a workspace in UAH is in Ukraine. The euro and friends say nothing. */
const CURRENCY_COUNTRY: Record<string, string> = {
  GBP: 'GB', UAH: 'UA', PLN: 'PL', USD: 'US', CAD: 'CA', AUD: 'AU', NZD: 'NZ', CHF: 'CH', SEK: 'SE', NOK: 'NO', DKK: 'DK',
  ISK: 'IS', CZK: 'CZ', HUF: 'HU', RON: 'RO', BGN: 'BG', MDL: 'MD', GEL: 'GE', KZT: 'KZ', TRY: 'TR', ILS: 'IL', AED: 'AE',
  JPY: 'JP', CNY: 'CN', KRW: 'KR', INR: 'IN', SGD: 'SG', HKD: 'HK', ZAR: 'ZA', BRL: 'BR', MXN: 'MX',
};

/**
 * The countries this person and workspace most likely deliver to, best first:
 * the workspace currency's country, then every country the browser's languages
 * name ("en-GB" → GB, "uk-UA" → UA), then a bare language's likely country
 * ("uk" → UA). A bare "en" names no country — it would guess the United States
 * for every British and Irish reader.
 */
export function homeCountries(input: { languages?: readonly string[]; currency?: string | null }): string[] {
  const found: string[] = [];
  const add = (code: string | undefined) => {
    if (code && ISO_CODES.includes(code) && !found.includes(code)) found.push(code);
  };
  add(input.currency ? CURRENCY_COUNTRY[input.currency.toUpperCase()] : undefined);
  const tags = (input.languages ?? []).flatMap((tag) => {
    try {
      return [new Intl.Locale(tag)];
    } catch {
      return [];
    }
  });
  for (const tag of tags) add(tag.region);
  for (const tag of tags) {
    if (tag.region || tag.language === 'en') continue;
    // "ua" is a common slip for Ukrainian ("uk"); a tag that is itself a country code reads as that country.
    add(tag.maximize().region ?? tag.language.toUpperCase());
  }
  return found;
}

/** The first home country, else the United Kingdom. Kept for single-language callers. */
export function defaultCountry(language?: string, currency?: string | null): string {
  return homeCountries({ languages: language ? [language] : [], currency })[0] ?? 'GB';
}

/** A blank address, addressed to the customer when there is one. */
export function emptyAddress(input: { name?: string | null; phone?: string | null; country: string }): OrderShippingAddress {
  return { recipientName: input.name?.trim() ?? '', phone: input.phone ?? '', line1: '', line2: '', city: '', region: '', postcode: '', country: input.country };
}

export type AddressErrors = Partial<Record<'recipientName' | 'line1' | 'city' | 'postcode' | 'country', string>>;

/** What a courier can't do without. Empty when the address will do. */
export function addressErrors(address: OrderShippingAddress): AddressErrors {
  const errors: AddressErrors = {};
  if (!address.recipientName.trim()) errors.recipientName = 'Who is it for?';
  if (!address.line1.trim()) errors.line1 = 'The street and number.';
  if (!address.city.trim()) errors.city = 'Town or city.';
  if (!address.postcode.trim()) errors.postcode = 'Postcode.';
  if (!/^[A-Z]{2}$/.test(address.country)) errors.country = 'Choose a country.';
  return errors;
}

/** The address as the API takes it: trimmed, blanks as null. */
export function cleanAddress(address: OrderShippingAddress): OrderShippingAddress {
  const optional = (value: string | null | undefined) => value?.trim() || null;
  return {
    recipientName: address.recipientName.trim(),
    phone: optional(address.phone),
    line1: address.line1.trim(),
    line2: optional(address.line2),
    city: address.city.trim(),
    region: optional(address.region),
    postcode: address.postcode.trim(),
    country: address.country,
  };
}

/**
 * The same place: street, second line, postcode and country, ignoring case and
 * the spaces in a postcode. The recipient and phone may differ — it's still the
 * address the customer saved.
 */
export function sameAddress(
  a: Pick<OrderShippingAddress, 'line1' | 'line2' | 'postcode' | 'country'>,
  b: Pick<OrderShippingAddress, 'line1' | 'line2' | 'postcode' | 'country'>,
): boolean {
  const text = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
  const code = (value: string) => value.replace(/\s+/g, '').toLowerCase();
  return text(a.line1) === text(b.line1) && text(a.line2) === text(b.line2) && code(a.postcode) === code(b.postcode) && text(a.country) === text(b.country);
}
