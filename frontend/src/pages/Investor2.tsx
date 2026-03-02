import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Lock, Building2 } from "lucide-react";
import { Investor2LongForm } from "@/pages/investor-deck/Investor2LongForm";

const INVESTOR_STORAGE_KEY = "nivo_investor_unlocked";
const INVESTOR_PASSWORD = "nivo2020";

const Investor2: React.FC = () => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(INVESTOR_STORAGE_KEY);
    if (stored === "1") setUnlocked(true);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password === INVESTOR_PASSWORD) {
      sessionStorage.setItem(INVESTOR_STORAGE_KEY, "1");
      setUnlocked(true);
    } else {
      setError("Fel lösenord. Försök igen.");
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem(INVESTOR_STORAGE_KEY);
    setUnlocked(false);
    setPassword("");
    setError(null);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-inv2-bg-subtle flex items-center justify-center p-4 sm:p-6 overflow-x-hidden">
        <div className="w-full max-w-md bg-white rounded-xl p-6 sm:p-8 shadow-[var(--inv2-shadow-soft)] border border-inv2-divider">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-5 sm:mb-6">
              <img
                src="/nivo-logo-green.svg"
                alt="Nivo Logo"
                className="h-14 sm:h-16 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
                }}
              />
              <div className="w-16 h-16 bg-inv2-olive-muted border border-inv2-divider rounded-xl flex items-center justify-center hidden">
                <Building2 className="h-8 w-8 text-inv2-olive" />
              </div>
            </div>
            <div className="inline-block px-3 py-1.5 bg-inv2-olive-muted border border-inv2-divider rounded-full text-inv2-olive text-sm font-medium uppercase tracking-wider mb-4">
              Investor
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-inv2-fg tracking-tight mb-2">Investor Access</h1>
            <p className="text-inv2-fg-muted text-base">Ange lösenord för att komma åt materialet.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="investor2-password" className="text-inv2-fg text-base font-medium">
                Lösenord
              </label>
              <Input
                id="investor2-password"
                type="password"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-inv2-divider text-inv2-fg text-base rounded-lg min-h-[48px] h-12 px-4 focus-visible:ring-inv2-olive/40 focus-visible:border-inv2-olive/50"
                autoComplete="off"
              />
            </div>
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-destructive text-base">{error}</p>
              </div>
            )}
            <button
              type="submit"
              className="w-full min-h-[48px] h-12 rounded-lg bg-inv2-olive hover:opacity-90 text-white text-base font-semibold flex items-center justify-center gap-2 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inv2-olive/50 focus-visible:ring-offset-2 touch-manipulation"
            >
              <Lock className="h-4 w-4" />
              Öppna
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
      <header className="border-b border-inv2-divider bg-inv2-olive text-white sticky top-0 z-20 shadow-[var(--inv2-shadow-soft)] [padding-top:env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/nivo-wordmark-white.svg"
              alt="Nivo"
              className="h-5 sm:h-6 w-auto"
              onError={(e) => {
                const el = e.currentTarget;
                el.src = "/nivo-wordmark-green.svg";
                el.classList.add("brightness-0", "invert");
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-inv2-olive touch-manipulation flex-shrink-0"
            >
              <Lock className="h-4 w-4" />
              Lås sidan
            </button>
          </div>
        </div>
      </header>
      <Investor2LongForm />
    </div>
  );
};

export default Investor2;
