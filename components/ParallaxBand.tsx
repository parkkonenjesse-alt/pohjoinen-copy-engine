"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";

// Floating thumbnails that drift at different speeds behind a headline — the
// Locomotive "portfolio built for every step" motif. Self-hosted images.
const THUMBS = [
  { src: "/thumbs/1.jpg", x: "6%", y: "16%", w: 150, spd: -70 },
  { src: "/thumbs/2.jpg", x: "78%", y: "9%", w: 128, spd: -120 },
  { src: "/thumbs/3.jpg", x: "17%", y: "60%", w: 168, spd: 80 },
  { src: "/thumbs/4.jpg", x: "70%", y: "58%", w: 158, spd: 130 },
  { src: "/thumbs/5.jpg", x: "45%", y: "6%", w: 120, spd: -45 },
  { src: "/thumbs/6.jpg", x: "53%", y: "72%", w: 138, spd: 100 },
];

export function ParallaxBand() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // -0.5 (band entering from below) .. +0.5 (leaving at top); 0 = centered.
      const progress = (vh / 2 - (rect.top + rect.height / 2)) / vh;
      el.style.setProperty("--pp", progress.toFixed(4));
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="parallax" ref={ref} aria-label="Built for every season">
      {THUMBS.map((t, i) => (
        <img
          key={i}
          className="parallax-thumb"
          src={t.src}
          alt=""
          aria-hidden="true"
          width={t.w}
          height={Math.round(t.w * 1.25)}
          style={
            {
              left: t.x,
              top: t.y,
              width: `${t.w}px`,
              "--spd": `${t.spd}px`,
            } as React.CSSProperties
          }
        />
      ))}
      <h2 className="parallax-head h-xl">Built for every season.</h2>
    </section>
  );
}
