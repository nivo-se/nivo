
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
    <footer id="contact" className={cn('py-20 md:py-32 bg-jetBlack text-platinum border-t border-grayOlive/40', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="border-t border-platinum/10 pt-8 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <Link to="/" className="text-xl font-heading font-semibold tracking-tight">
              Nivo
            </Link>
          </div>

          <div className="flex space-x-6 mb-4 md:mb-0">
            <button
              onClick={() => scrollToSection('about-nivo')}
              className="text-sm text-platinum/80 transition-colors hover:text-platinum"
            >
              Om oss
            </button>
            <button
              onClick={() => scrollToSection('services')}
              className="text-sm text-platinum/80 transition-colors hover:text-platinum"
            >
              Tjänster
            </button>
            <button
              onClick={() => scrollToSection('team')}
              className="text-sm text-platinum/80 transition-colors hover:text-platinum"
            >
              Team
            </button>
            <button
              onClick={() => scrollToSection('contact')}
              className="text-sm text-platinum/80 transition-colors hover:text-platinum"
            >
              Kontakt
            </button>
          </div>

          <div className="text-sm text-platinum/70">
            &copy; {new Date().getFullYear()} Nivo. Alla rättigheter förbehållna.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
