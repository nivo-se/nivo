import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

export interface ChatgptDeepResearchPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full plain-text prompt for ChatGPT Deep Research */
  prompt: string;
  /** Shown in subtitle (e.g. company name + org.nr) */
  companyLabel: string;
}

export function ChatgptDeepResearchPromptDialog({
  open,
  onOpenChange,
  prompt,
  companyLabel,
}: ChatgptDeepResearchPromptDialogProps) {
  const handleCopy = () => {
    navigator.clipboard
      .writeText(prompt)
      .then(() => toast.success("Prompt copied — paste into ChatGPT Deep Research"))
      .catch(() => toast.error("Could not copy to clipboard"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(100vw-2rem,42rem)] max-w-[min(100vw-2rem,42rem)] gap-0 overflow-hidden p-0 sm:max-w-[42rem]">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>ChatGPT Deep Research prompt</DialogTitle>
            <DialogDescription className="line-clamp-2" title={companyLabel}>
              {companyLabel}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-6 py-3">
          <pre className="max-h-[min(60vh,480px)] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground">
            {prompt}
          </pre>
        </div>
        <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" className="gap-2" onClick={handleCopy}>
            <ClipboardCopy className="h-4 w-4" />
            Copy prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
