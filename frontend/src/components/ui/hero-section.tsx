"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "lucide-react";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { Glow } from "@/components/ui/glow";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface HeroAction {
  text: string;
  href: string;
  icon?: React.ReactNode;
  variant?: "default" | "glow";
}

interface HeroProps {
  badge?: {
    text: string;
    action: {
      text: string;
      href: string;
    };
  };
  title: string;
  description?: string;
  actions?: HeroAction[];
  image?: {
    light: string;
    dark: string;
    alt: string;
  };
  /** When true, section uses transparent background so parent background shows through */
  transparentBg?: boolean;
}

export function HeroSection({
  badge,
  title,
  description,
  actions = [],
  image,
  transparentBg,
}: HeroProps) {
  const { resolvedTheme } = useTheme();
  const imageSrc = image && (resolvedTheme === "dark" ? image.dark : image.light);

  return (
    <section
      className={cn(
        transparentBg ? "bg-transparent" : "bg-background",
        "text-foreground",
        "py-12 sm:py-24 md:py-32 px-4",
        "overflow-hidden",
        image ? "pb-0" : "pb-12"
      )}
    >
      <div className={cn("mx-auto flex max-w-6xl flex-col gap-12 sm:gap-24", image ? "pt-16" : "pt-8")}>
        <div className="flex flex-col items-center gap-6 text-center sm:gap-12">
          {badge && (
            <Badge variant="outline" className="animate-appear gap-2">
              <span className="text-muted-foreground">{badge.text}</span>
              <a href={badge.action.href} className="flex items-center gap-1">
                {badge.action.text}
                <ArrowRightIcon className="h-3 w-3" />
              </a>
            </Badge>
          )}

          <h1 className="relative z-10 inline-block animate-appear bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-4xl font-semibold leading-tight text-transparent drop-shadow-2xl sm:text-6xl sm:leading-tight md:text-8xl md:leading-tight">
            {title}
          </h1>

          {description && (
            <p className="text-md relative z-10 max-w-[550px] animate-appear font-medium text-muted-foreground opacity-0 [animation-delay:100ms] [animation-fill-mode:forwards] sm:text-xl">
              {description}
            </p>
          )}

          {actions.length > 0 && (
            <div className="relative z-10 flex animate-appear justify-center gap-4 opacity-0 [animation-delay:300ms] [animation-fill-mode:forwards]">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant === "glow" ? "glow" : "default"}
                  size="lg"
                  asChild
                >
                  <a href={action.href} className="flex items-center gap-2">
                    {action.icon}
                    {action.text}
                  </a>
                </Button>
              ))}
            </div>
          )}

          {image && imageSrc && (
            <div className="relative pt-12">
              <MockupFrame
                className="animate-appear opacity-0 [animation-delay:700ms] [animation-fill-mode:forwards]"
                size="small"
              >
                <Mockup type="responsive">
                  <img
                    src={imageSrc}
                    alt={image.alt}
                    className="w-full h-auto block"
                    width={1248}
                    height={765}
                  />
                </Mockup>
              </MockupFrame>
              <Glow
                variant="top"
                className="animate-appear-zoom opacity-0 [animation-delay:1000ms] [animation-fill-mode:forwards]"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
