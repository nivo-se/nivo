import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Lock, Building2 } from 'lucide-react';
import { FullPresentation } from '@/pages/investor-deck/FullPresentation';

const INVESTOR_STORAGE_KEY = 'nivo_investor_unlocked';
const INVESTOR_PASSWORD = 'nivo2020';

const Investor: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(INVESTOR_STORAGE_KEY);
    if (stored === '1') {
      setUnlocked(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password === INVESTOR_PASSWORD) {
      sessionStorage.setItem(INVESTOR_STORAGE_KEY, '1');
      setUnlocked(true);
    } else {
      setError('Fel lösenord. Försök igen.');
    }
  };

  const handleSignOut = () => {
    sessionStorage.removeItem(INVESTOR_STORAGE_KEY);
    setUnlocked(false);
    setPassword('');
    setError(null);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-deck-bg flex items-center justify-center p-4 sm:p-6 overflow-x-hidden">
        <div className="w-full max-w-md bg-deck-surface rounded-xl p-6 sm:p-8 shadow-lg border border-deck-border">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex justify-center mb-5 sm:mb-6">
              <img
                src="/nivo-logo-green.svg"
                alt="Nivo Logo"
                className="h-14 sm:h-16 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="w-16 h-16 bg-deck-accent/10 border border-deck-accent-border rounded-xl flex items-center justify-center hidden">
                <Building2 className="h-8 w-8 text-deck-accent" />
              </div>
            </div>
            <div className="inline-block px-3 py-1.5 bg-deck-accent/10 border border-deck-accent-border rounded-full text-deck-accent text-sm font-medium uppercase tracking-wider mb-4">
              Investor
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-deck-fg tracking-tight mb-2">Investor Access</h1>
            <p className="text-deck-accent text-base">Ange lösenord för att komma åt materialet.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="investor-password" className="text-deck-fg text-base font-medium">
                Lösenord
              </label>
              <Input
                id="investor-password"
                type="password"
                placeholder="Lösenord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-deck-surface border-deck-fg/20 text-deck-fg text-base rounded-lg min-h-[48px] h-12 px-4 focus-visible:ring-deck-accent focus-visible:border-deck-accent/50"
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
              className="w-full min-h-[48px] h-12 rounded-lg bg-deck-accent hover:bg-deck-accent-hover text-deck-accent-foreground text-base font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deck-accent focus-visible:ring-offset-2 touch-manipulation"
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
    <div className="min-h-screen bg-deck-bg overflow-x-hidden">
      <header className="border-b border-deck-fg/15 bg-deck-accent text-deck-accent-foreground sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/nivo-wordmark-white.svg"
              alt="Nivo"
              className="h-5 sm:h-6 w-auto"
              onError={(e) => {
                const el = e.currentTarget;
                el.src = '/nivo-wordmark-green.svg';
                el.classList.add('brightness-0', 'invert');
              }}
            />
            <span className="text-deck-accent-foreground/90 text-base font-medium tracking-tight truncate">Investor</span>
            <a href="/investor2" className="text-deck-accent-foreground/80 hover:text-deck-accent-foreground text-sm font-medium ml-2 hidden sm:inline transition-colors">
              Long-form version
            </a>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-deck-accent-foreground/90 hover:text-deck-accent-foreground hover:bg-deck-surface/10 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deck-accent-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-deck-accent touch-manipulation flex-shrink-0"
          >
            <Lock className="h-4 w-4" />
            Lås sidan
          </button>
        </div>
      </header>
      <FullPresentation />
    </div>
  );
};

export default Investor;
