/**
 * Peg's look, in one place (design system §10, Peg). Every Peg on every
 * screen renders this, so they all share proportions, face, and moods.
 *
 * It fills its parent; the parent positions it and sets `--peg-w` (the body
 * width) so the face scales. Moods come from `data-mood` on any ancestor.
 * Moves (motion.ts) animate `.peg-fig__actor` with the individual `translate`,
 * `rotate` and `scale` properties, so they compose with whatever transform
 * the parent's own motion writes.
 *
 * - shape "hang": hangs from a socket above; rounded at the bottom, face low
 * - shape "climb": holds an edge on its left; rounded all round, face right
 */
export function PegFigure({ shape }: { shape: "hang" | "climb" }) {
  return (
    <span className="peg-fig" data-shape={shape} aria-hidden="true">
      <span className="peg-fig__actor">
        <span className="peg-fig__body">
          <span className="peg-fig__ridges" />
          <span className="peg-fig__face">
            <span className="peg-fig__eyes">
              <span className="peg-fig__eye">
                <span className="peg-fig__pupil" />
              </span>
              <span className="peg-fig__eye">
                <span className="peg-fig__pupil" />
              </span>
            </span>
            <span className="peg-fig__mouth" />
          </span>
        </span>
      </span>
    </span>
  );
}

/** Points every Peg variant's pupils the same way: unit vector in, small offset out. */
export function aimPupils(pupils: HTMLElement[], look: { x: number; y: number }, width: number) {
  const px = look.x * width * 0.035;
  const py = look.y * width * 0.05;
  for (const p of pupils) p.style.transform = `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px)`;
}
