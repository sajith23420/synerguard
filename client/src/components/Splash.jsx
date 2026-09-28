import { useEffect, useRef, useState } from 'react';

/** How long the mark stays up on a first visit, even on a warm server. */
const MIN_VISIBLE_MS = 1200;
/** After this, say something: a blank wait reads as a broken app. */
const SLOW_AFTER_MS = 4000;
/** Length of the fade-out. Kept in step with the CSS transition. */
const FADE_MS = 400;
/**
 * On a repeat load the splash only exists to cover a sleeping server, so it
 * waits this long before drawing anything. A warm server answers well inside
 * it and the splash never appears at all.
 */
const REPEAT_GRACE_MS = 500;

const SEEN_KEY = 'synerguard:splash-seen';

/**
 * Whether the full entrance has already played this session.
 *
 * sessionStorage throws outright in some privacy modes, so every access is
 * guarded. Failing to read means "not seen": showing the animation once too
 * often is harmless, skipping the loading cover is not.
 */
function readSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* Private mode, or storage disabled — the splash just plays again. */
  }
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Splash component — the branded entrance, and the loading state for the
 * initial getStats() call.
 *
 * Deliberately says nothing about severity tiers, estimates or how to read a
 * result. It names the product and the disclaimer; the interface explains
 * itself.
 *
 * @param {Object} props
 * @param {boolean} props.ready - getStats() has succeeded
 * @param {boolean} props.failed - getStats() has kept failing past the budget
 * @param {() => void} props.onRetry - Start the stats fetch over
 * @param {() => void} props.onDone - The splash has finished; show the app
 */
export default function Splash({ ready = false, failed = false, onRetry, onDone }) {
  // Read once: the flag is written on mount, so a later read would say "seen"
  // and turn the first visit into a repeat one mid-render.
  const [firstVisit] = useState(() => !readSeen());
  const [reduced] = useState(prefersReducedMotion);

  // Whether anything is drawn yet. A repeat visit stays blank through the
  // grace period so a warm server produces no flash.
  const [armed, setArmed] = useState(firstVisit);
  const [minElapsed, setMinElapsed] = useState(!firstVisit);
  const [slow, setSlow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // onDone identity would otherwise re-run the exit timer mid-fade.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (firstVisit) markSeen();
  }, [firstVisit]);

  useEffect(() => {
    if (!firstVisit) return undefined;
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [firstVisit]);

  useEffect(() => {
    if (armed) return undefined;
    const t = setTimeout(() => setArmed(true), REPEAT_GRACE_MS);
    return () => clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  // A failed boot has to stay on screen: the retry lives here.
  const done = ready && minElapsed && !failed;

  useEffect(() => {
    if (!done && !leaving) return undefined;
    // Never drawn, so there is nothing to fade out of.
    if (!armed || reduced) {
      onDoneRef.current?.();
      return undefined;
    }
    setLeaving(true);
    const t = setTimeout(() => onDoneRef.current?.(), FADE_MS);
    return () => clearTimeout(t);
  }, [done, leaving, armed, reduced]);

  if (!armed) return null;

  const showStatus = !failed && slow && !ready;

  return (
    <div
      className={`splash${leaving ? ' splash-leaving' : ''}${
        firstVisit && !reduced ? ' splash-animated' : ''
      }`}
      role="status"
      aria-live="polite"
      aria-busy={!ready}
    >
      <div className="splash-inner">
        <div className="splash-mark" aria-hidden="true">
          SG
        </div>
        {/* Not a heading: the app's own h1 is in the header below,
            and a second one would put two page titles in the outline. */}
        <div className="splash-name">SynerGuard</div>
        <p className="splash-tagline">Drug interaction screening</p>
        <p className="splash-disclaimer">
          Educational decision support — not a substitute for clinical judgement.
        </p>

        {/* Reserved whether or not it is filled, so the mark does not jump
            when the connecting line appears four seconds in. */}
        <div className="splash-foot">
          {failed ? (
            <div className="splash-error">
              <p className="splash-error-text">
                Could not reach the server. Check your connection and try again.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {showStatus && (
                <p className="splash-status">
                  <span className="spinner" aria-hidden="true" />
                  Connecting to the server — this can take up to a minute on first load.
                </p>
              )}
              {/* Only once the data is there: skipping into an app whose
                  searches would fail is not a shortcut, it is a dead end. */}
              {ready && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm splash-skip"
                  onClick={() => setLeaving(true)}
                >
                  Skip
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
