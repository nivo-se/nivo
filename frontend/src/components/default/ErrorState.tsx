import { ReactNode } from "react";

interface ErrorStateProps {
  message: string;
  retry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ message, retry, action, className = "" }: ErrorStateProps) {
  return (
    <div className={`app-card p-8 text-center border-destructive/40 bg-destructive/10 ${className}`}>
      <p className="text-destructive font-medium">Error</p>
      <p className="text-sm text-destructive mt-1">{message}</p>
      {(retry || action) && (
        <div className="mt-4 flex justify-center gap-2">
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="text-sm px-3 py-1.5 rounded border border-destructive/50 text-destructive hover:bg-destructive/15"
            >
              Retry
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
