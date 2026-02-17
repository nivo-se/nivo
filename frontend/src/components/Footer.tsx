
import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface FooterProps {
  className?: string;
}

const Footer: React.FC<FooterProps> = ({ className }) => {
  const scrollToSection = (id: string) => {
    if (id === 'home') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      const element = document.getElementById(id);
      if (element) {
        window.scrollTo({
          top: element.offsetTop - 80,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <footer
      id="contact"
      className={cn(
        'py-16 md:py-24 bg-background text-foreground border-t border-border',
        className
      )}
    >
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/nivo-wordmark-white.svg"
              alt="Nivo Group"
              className="h-7 w-auto sm:h-8"
            />
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm md:gap-6">
            <button
              onClick={() => scrollToSection('about-nivo')}
              className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Om oss
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Tjänster
            </button>
            <button
              onClick={() => scrollToSection('team')}
              className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Team
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              Kontakt
            </button>
          </div>

          <div className="text-center text-xs text-primary-foreground/60 md:text-right">
            &copy; {new Date().getFullYear()} Nivo. Alla rättigheter förbehållna.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
