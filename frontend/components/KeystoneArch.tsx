"use client";

import { motion } from "framer-motion";
import type { MilestoneView } from "@/lib/soroban";

/**
 * The hero: a segmented stone arch. Each voussoir (stone) is a milestone.
 * Released stones fill with the oxide accent; refunded stones hollow out.
 */
export default function KeystoneArch({
  milestones,
}: {
  milestones: MilestoneView[];
}) {
  const n = milestones.length;
  const cx = 200;
  const cy = 190;
  const rOuter = 170;
  const rInner = 118;
  const gapDeg = 2.5;
  const span = 180 / n;

  const seg = (i: number) => {
    const a0 = 180 - i * span - gapDeg / 2;
    const a1 = 180 - (i + 1) * span + gapDeg / 2;
    const rad = (d: number) => (d * Math.PI) / 180;
    const p = (r: number, d: number) => [
      cx + r * Math.cos(rad(d)),
      cy - r * Math.sin(rad(d)),
    ];
    const [x0, y0] = p(rOuter, a0);
    const [x1, y1] = p(rOuter, a1);
    const [x2, y2] = p(rInner, a1);
    const [x3, y3] = p(rInner, a0);
    return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`;
  };

  return (
    <svg
      viewBox="0 0 400 210"
      role="img"
      aria-label="Escrow progress arch"
      className="mx-auto w-full max-w-md"
    >
      {milestones.map((m, i) => {
        const released = m.status === "Released";
        const refunded = m.status === "Refunded";
        return (
          <g key={i}>
            <motion.path
              d={seg(i)}
              initial={false}
              animate={{
                fill: released
                  ? "var(--oxide)"
                  : refunded
                    ? "transparent"
                    : "var(--paper-deep)",
                opacity: 1,
              }}
              transition={{ duration: 0.6 }}
              stroke={refunded ? "var(--ink-soft)" : "var(--ink)"}
              strokeWidth="1.2"
              strokeDasharray={refunded ? "4 3" : undefined}
            />
          </g>
        );
      })}
      {/* baseline */}
      <line
        x1="12"
        y1="192"
        x2="388"
        y2="192"
        stroke="var(--ink)"
        strokeWidth="1"
      />
      <line
        x1="12"
        y1="196"
        x2="388"
        y2="196"
        stroke="var(--line)"
        strokeWidth="1"
      />
    </svg>
  );
}
