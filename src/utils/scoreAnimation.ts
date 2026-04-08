/**
 * Animates a score display by rapidly cycling random numbers before
 * settling on the final value. Returns a cleanup function.
 *
 * @param finalScore  - The real score to settle on
 * @param setValue    - State setter to call on each tick
 * @param duration    - Total animation duration in ms (default 600)
 * @param onComplete  - Called when animation finishes
 */
export function animateScore(
  finalScore: number,
  setValue: (n: number) => void,
  duration: number = 600,
  onComplete?: () => void,
): () => void {
  const steps    = 15;
  const interval = duration / steps;
  let step       = 0;

  const timer = setInterval(() => {
    step++;
    if (step >= steps) {
      clearInterval(timer);
      setValue(finalScore);
      onComplete?.();
    } else {
      // Flash random values in range [0, finalScore + 2] so it feels chaotic
      setValue(Math.floor(Math.random() * (Math.max(finalScore, 1) + 3)));
    }
  }, interval);

  return () => clearInterval(timer);
}
