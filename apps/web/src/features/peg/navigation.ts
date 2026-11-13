/**
 * Whether a click on a link should play a Peg transition instead of letting
 * the browser handle it. New tabs, downloads, modified clicks, and external
 * links always behave natively.
 */
export function shouldIntercept(
  e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean },
  href: string,
  target?: string,
): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (target && target !== "_self") return false;
  return href.startsWith("/") && !href.startsWith("//");
}
