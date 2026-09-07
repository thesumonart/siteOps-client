'use client';

import { useSyncExternalStore } from 'react';

/**
 * The current time, as an external store React can subscribe to.
 *
 * The wall clock is exactly what `useSyncExternalStore` is for: a value that
 * lives outside React, changes without React's involvement, and differs between
 * the server render and the browser. Reading `Date.now()` during render instead
 * is impure — two renders of the same props give different output — and
 * produces a hydration mismatch the moment anything branches on it.
 *
 * The server snapshot is deliberately `null`. A component that needs the clock
 * cannot honestly render on the server, and returning a server timestamp would
 * make it render one thing there and another a millisecond later in the
 * browser. `null` means "not known yet", which the caller renders as nothing.
 */

/**
 * How often subscribers are woken.
 *
 * Matches `RelativeTime`, so a component showing "4 minutes ago" and a
 * component deciding whether four minutes is too long cannot disagree.
 */
const TICK_MS = 30_000;

/*
 * One timer for every subscriber rather than one per component.
 *
 * The snapshot has to be a cached value: `useSyncExternalStore` compares
 * successive snapshots with `Object.is`, so a `getSnapshot` that returned a
 * fresh `Date.now()` on every call would never compare equal and would spin.
 */
let cached = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (timer === null) {
    cached = Date.now();
    timer = setInterval(() => {
      cached = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  // Zero only before the first subscription, which React establishes
  // immediately after the first client render.
  return cached === 0 ? (cached = Date.now()) : cached;
}

function getServerSnapshot(): null {
  return null;
}

export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
