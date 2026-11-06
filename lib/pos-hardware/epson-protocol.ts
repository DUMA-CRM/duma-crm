import { type TillHardwareSettings, validateHardware } from './model.ts';

export function epsonRequest(settings: TillHardwareSettings, action: 'check' | 'print' | 'drawer'): string {
  const error = validateHardware(settings);
  if (error) throw new Error(error);
  if (settings.connector !== 'epson-epos') throw new Error('Choose the Epson network connector.');
  if (action === 'drawer' && settings.drawer !== 'printer') throw new Error('No automatic drawer configured.');
  const command =
    action === 'drawer'
      ? `<pulse drawer="${settings.pin === 2 ? 'drawer_1' : 'drawer_2'}" time="pulse_${settings.pulseOnMs}"/>`
      : action === 'print'
        ? '<text>DUMA printer test&#10;</text><feed line="3"/>'
        : '';
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
    '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">' +
    command +
    '</epos-print></s:Body></s:Envelope>'
  );
}
