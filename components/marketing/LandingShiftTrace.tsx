'use client';

import { TraceChart } from '@/components/shared/TraceChart';

const sampleShift = [
  { label: '06:30', value: 0 },
  { label: '07:00', value: 3 },
  { label: '07:30', value: 9 },
  { label: '08:00', value: 17 },
  { label: '08:30', value: 22 },
  { label: '09:00', value: 27 },
  { label: '09:30', value: 31 },
  { label: '10:00', value: 35 },
  { label: '10:30', value: 39 },
];

const sampleReference = [
  { label: '06:30', value: 0 },
  { label: '07:00', value: 2 },
  { label: '07:30', value: 7 },
  { label: '08:00', value: 14 },
  { label: '08:30', value: 20 },
  { label: '09:00', value: 24 },
  { label: '09:30', value: 29 },
  { label: '10:00', value: 32 },
  { label: '10:30', value: 36 },
];

export function LandingShiftTrace() {
  return (
    <TraceChart
      className="border-0"
      title="Illustrative shift continuity trace"
      readoutLabel="Sample orders recorded"
      series={sampleShift}
      reference={sampleReference}
      referenceLabel="sample baseline"
      format={(value) => String(value)}
      events={[
        { at: 0, label: 'Open', time: '06:30' },
        { at: 4, label: 'Offline', time: '08:30', tone: 'exception' },
        { at: 8, label: 'Online', time: '10:30' },
      ]}
      phases={[
        { label: 'Opening', weight: 2 },
        { label: 'Morning rush', weight: 4 },
        { label: 'Steady trade', weight: 3 },
      ]}
      action={<span className="annot text-reference">Illustrative data</span>}
    />
  );
}
