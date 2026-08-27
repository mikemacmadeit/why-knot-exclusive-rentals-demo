"use client";

import React, { useMemo, useState, type ElementType, type CSSProperties } from "react";

export interface TextRevealProps {
  text: string;
  as?: ElementType;
  href?: string;
  target?: string;
  className?: string;
  style?: CSSProperties;
  fontSize?: string;
  staggerDelay?: number;
  duration?: number;
  easing?: string;
  color?: string;
  hoverColor?: string;
  direction?: "up" | "down";
  onClick?: (e: React.MouseEvent) => void;
}

function splitGraphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (s) => s.segment);
  }
  return Array.from(value);
}

const TextReveal = React.memo(function TextReveal({
  text,
  as: Component = "a",
  href,
  target,
  className = "",
  style,
  fontSize = "3rem",
  staggerDelay = 25,
  duration = 250,
  easing = "ease-in-out",
  color = "inherit",
  hoverColor = "#b2c73a",
  direction = "up",
  onClick,
}: TextRevealProps) {
  const [hovered, setHovered] = useState(false);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const sign = direction === "up" ? 1 : -1;

  const rootProps: Record<string, unknown> = {
    className: `relative inline-block max-w-full no-underline font-extrabold uppercase tracking-tight cursor-pointer select-none ${className}`.trim(),
    style: {
      fontSize,
      color: hovered ? hoverColor : color,
      transition: "color 0.35s ease",
      padding: "0.15em 0.4em",
      lineHeight: 0.95,
      ...style,
    },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
    onClick,
    "aria-label": text,
  };

  if (Component === "a") {
    rootProps.href = href ?? "#";
    if (target) rootProps.target = target;
    if (target === "_blank") rootProps.rel = "noopener noreferrer";
  }

  return (
    <Component {...rootProps}>
      <span className="relative block max-w-full text-center" aria-hidden="true">
        {words.map((word, wi) => {
          const chars = splitGraphemes(word);
          const charOffset = words.slice(0, wi).reduce((n, w) => n + w.length + 1, 0);
          return (
            <span key={`${word}-${wi}`}>
              <span className="inline-block whitespace-nowrap">
                <span className="inline-flex overflow-hidden align-bottom" style={{ height: "1.05em" }}>
                  {chars.map((char, i) => (
                    <span
                      key={`${wi}-${i}`}
                      className="relative inline-block will-change-transform"
                      style={{
                        textShadow: `0 ${sign}em currentColor`,
                        transition: `transform ${duration}ms ${easing}`,
                        transitionDelay: `${(charOffset + i) * staggerDelay}ms`,
                        transform: hovered ? `translateY(${-sign}em)` : "translateY(0)",
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
              </span>
              {wi < words.length - 1 ? " " : null}
            </span>
          );
        })}
      </span>
    </Component>
  );
});

TextReveal.displayName = "TextReveal";
export { TextReveal };
