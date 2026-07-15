import { useEffect, useRef } from "react";

// Wraps an existing fetch function (e.g. PaymentsPage's fetchAll,
// AssessmentPage's fetchData) with simple interval-based polling, so
// data entered on one PC becomes visible on another without staff
// having to manually refresh. Deliberately NOT a React Query migration —
// this is the lighter "keep the existing useState+useEffect pattern,
// just add setInterval" approach.
//
// Usage:
//   const isModalOpenRef = useRef(false);
//   useEffect(() => { isModalOpenRef.current = showModal; }, [showModal]);
//   usePolling(fetchAll, { intervalMs: 15000, isPausedRef: isModalOpenRef });
//
// Why a ref instead of just passing `showModal` as a boolean prop: the
// interval callback is created once and must always read the LATEST
// open/closed state when it fires, not whatever value was captured at
// setup time. A plain boolean dependency would require tearing down and
// recreating the interval every time the modal opens/closes, which is
// more moving parts for no benefit — a ref sidesteps that entirely.
export default function usePolling(fetchFn, { intervalMs = 15000, isPausedRef, enabled = true } = {}) {
  // Keeps the latest fetchFn without retriggering the effect below every
  // time the parent component re-renders and passes a new function
  // reference (e.g. a useCallback whose own deps changed) — only
  // intervalMs/enabled changing should tear down and restart the timer.
  const fetchFnRef = useRef(fetchFn);
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      // Skip this tick entirely if the page says it's paused — e.g. a
      // modal is open and a background refetch right now would either
      // flash an unwanted loading state behind it or refresh list data
      // out from under a form that's mid-edit. The NEXT tick will just
      // try again; nothing is queued or lost, since the page's own data
      // wasn't stale in a way that matters while a human is actively
      // working with a snapshot of it.
      if (isPausedRef?.current) return;

      // Also skip while the window/tab isn't visible — no reason to hit
      // the server on a schedule for a screen nobody is looking at,
      // and it avoids every backgrounded PC in the office polling
      // simultaneously for no visible benefit.
      if (document.visibilityState !== "visible") return;

      fetchFnRef.current();
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled, isPausedRef]);
}