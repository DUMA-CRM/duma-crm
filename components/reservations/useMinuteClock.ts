'use client';

import { useEffect, useState } from 'react';

/** The wall clock, ticking twice a minute — waits and "booked soon" move with it. */
export function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
