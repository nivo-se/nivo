import React, { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useDimensions } from "@/components/hooks/use-debounced-dimensions";

interface AnimatedGradientProps {
  colors: string[];
  speed?: number;
  blur?: "light" | "medium" | "heavy";
  className?: string;
}

// Deterministic "random" from seed for stable positions across renders
function seeded(seed: number) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

const AnimatedGradient: React.FC<AnimatedGradientProps> = ({
  colors,
  speed = 5,
  blur = "light",
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useDimensions(containerRef);

  const circleSize = useMemo(
    () => Math.max(dimensions.width, dimensions.height),
    [dimensions.width, dimensions.height]
  );

  const blurClass =
    blur === "light"
      ? "blur-2xl"
      : blur === "medium"
        ? "blur-3xl"
        : "blur-[100px]";

  const styleProps = useMemo(
    () =>
      colors.map((_, i) => ({
        top: `${seeded(i * 7) * 50}%`,
        left: `${seeded(i * 11) * 50}%`,
        tx1: seeded(i * 13) - 0.5,
        ty1: seeded(i * 17) - 0.5,
        tx2: seeded(i * 19) - 0.5,
        ty2: seeded(i * 23) - 0.5,
        tx3: seeded(i * 29) - 0.5,
        ty3: seeded(i * 31) - 0.5,
        tx4: seeded(i * 37) - 0.5,
        ty4: seeded(i * 41) - 0.5,
        size: 0.5 + seeded(i * 43),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- memoized layout should only change when palette size changes
    [colors.length]
  );

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden", className)}>
      <div className={cn("absolute inset-0", blurClass)}>
        {colors.map((color, index) => (
          <svg
            key={`${color}-${index}`}
            className="absolute animate-background-gradient"
            style={
              {
                top: styleProps[index]?.top,
                left: styleProps[index]?.left,
                "--background-gradient-speed": `${1 / speed}s`,
                "--tx-1": styleProps[index]?.tx1,
                "--ty-1": styleProps[index]?.ty1,
                "--tx-2": styleProps[index]?.tx2,
                "--ty-2": styleProps[index]?.ty2,
                "--tx-3": styleProps[index]?.tx3,
                "--ty-3": styleProps[index]?.ty3,
                "--tx-4": styleProps[index]?.tx4,
                "--ty-4": styleProps[index]?.ty4,
              } as React.CSSProperties
            }
            width={circleSize * (styleProps[index]?.size ?? 1)}
            height={circleSize * (styleProps[index]?.size ?? 1)}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="50"
              fill={color}
              className="opacity-30 dark:opacity-[0.15]"
            />
          </svg>
        ))}
      </div>
    </div>
  );
};

export { AnimatedGradient };
