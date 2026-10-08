import assert from 'node:assert/strict';
import test from 'node:test';

const { addressErrors, cleanAddress, countryOptions, defaultCountry, emptyAddress } = await import('../lib/utils/delivery-address.ts');

test('countries are ISO codes with names, sorted by name', () => {
  const options = countryOptions('en-GB');
  assert.ok(options.length > 240);
  assert.deepEqual(options.find((option) => option.value === 'UA'), { value: 'UA', label: 'Ukraine' });
  assert.deepEqual(options.find((option) => option.value === 'GB'), { value: 'GB', label: 'United Kingdom' });
  const labels = options.map((option) => option.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, 'en-GB')));
});

test('the default country follows the browser, else the UK', () => {
  assert.equal(defaultCountry('uk-UA'), 'UA');
  assert.equal(defaultCountry('pl'), 'PL');
  assert.equal(defaultCountry(undefined), 'GB');
  assert.equal(defaultCountry('not a locale!'), 'GB');
});

test('an address needs who, street, town, postcode and a country', () => {
  const blank = emptyAddress({ name: 'Olena Koval', phone: '+380', country: 'UA' });
  assert.deepEqual(Object.keys(addressErrors(blank)).sort(), ['city', 'line1', 'postcode']);
  const full = { ...blank, line1: 'Khreshchatyk 1', city: 'Kyiv', postcode: '01001' };
  assert.deepEqual(addressErrors(full), {});
  assert.deepEqual(cleanAddress({ ...full, line2: '  ', region: '' }), {
    recipientName: 'Olena Koval',
    phone: '+380',
    line1: 'Khreshchatyk 1',
    line2: null,
    city: 'Kyiv',
    region: null,
    postcode: '01001',
    country: 'UA',
  });
});

test('the reader\u2019s own country is pinned first, set apart, and not listed twice', () => {
  const options = countryOptions('en-GB', 'UA');
  assert.deepEqual(options[0], { value: 'UA', label: 'Ukraine', dividerAfter: true });
  assert.equal(options.filter((option) => option.value === 'UA').length, 1);
  assert.equal(countryOptions('en-GB', 'XX')[0]!.dividerAfter, undefined, 'an unknown code pins nothing');
});

test('an order’s address matches the saved one it came from', async () => {
  const { sameAddress } = await import('../lib/utils/delivery-address.ts');
  const saved = { line1: 'Khreshchatyk 1', line2: null, postcode: '01001', country: 'UA' };
  assert.equal(sameAddress(saved, { line1: ' khreshchatyk 1', line2: '', postcode: '010 01', country: 'ua' }), true);
  assert.equal(sameAddress(saved, { ...saved, line2: 'Flat 4' }), false);
  assert.equal(sameAddress(saved, { ...saved, postcode: '01002' }), false);
});

test('home countries: the currency’s country, then every country the languages name; bare "en" guesses nothing', async () => {
  const { homeCountries, countryOptions: options } = await import('../lib/utils/delivery-address.ts');
  assert.deepEqual(homeCountries({ languages: ['en', 'uk'], currency: 'UAH' }), ['UA']);
  assert.deepEqual(homeCountries({ languages: ['en-GB', 'uk-UA'] }), ['GB', 'UA']);
  assert.deepEqual(homeCountries({ languages: ['en-GB', 'uk'], currency: 'EUR' }), ['GB', 'UA']);
  assert.deepEqual(homeCountries({ languages: ['en'] }), [], 'not the United States');
  assert.deepEqual(homeCountries({ languages: ['ua'] }), ['UA'], 'the country-code slip for Ukrainian');
  const pinned = options('en-GB', ['GB', 'UA']);
  assert.deepEqual(pinned.slice(0, 2), [
    { value: 'GB', label: 'United Kingdom' },
    { value: 'UA', label: 'Ukraine', dividerAfter: true },
  ]);
});
