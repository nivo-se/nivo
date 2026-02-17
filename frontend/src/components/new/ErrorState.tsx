import { ReactNode } from "react";

interface ErrorStateProps {
  message: string;
  retry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ message, retry, action, className = "" }: ErrorStateProps) {
  return (
    <div className={`new-card p-8 text-center border-red-200 bg-red-50/50 ${className}`}>
      <p className="text-red-800 font-medium">Error</p>
      <p className="text-sm text-red-700 mt-1">{message}</p>
      {(retry || action) && (
        <div className="mt-4 flex justify-center gap-2">
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="text-sm px-3 py-1.5 rounded border border-red-300 text-red-800 hover:bg-red-100"
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
