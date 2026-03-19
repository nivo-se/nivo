import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ScoreExplanation = {
  label: string;
  value: number | string | null;
  description?: string;
  parts?: string[];
};

interface ScoreExplanationTooltipProps {
  score: number | string | null | undefined;
  label: string;
  explanation?: ScoreExplanation["parts"] | string;
  children: React.ReactNode;
  asChild?: boolean;
}

export function ScoreExplanationTooltip({
  score,
  label,
  explanation,
  children,
  asChild = true,
}: ScoreExplanationTooltipProps) {
  const content =
    explanation == null
      ? `${label}: ${score ?? "—"}`
      : Array.isArray(explanation)
        ? [label, ...explanation].join(" · ")
        : `${label}: ${explanation}`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
