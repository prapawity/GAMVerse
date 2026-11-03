import type { HTMLAttributes } from "react";

type BrandWordmarkProps = HTMLAttributes<HTMLSpanElement>;

/** GAMVerse logotype with a small color shift that echoes its portal icon. */
export function BrandWordmark({ className = "brand-wordmark", ...props }: BrandWordmarkProps) {
  return <span {...props} className={className} aria-label="GAMVerse">
    <span className="brand-wordmark-gam">GAM</span><span className="brand-wordmark-verse">Verse</span>
  </span>;
}
