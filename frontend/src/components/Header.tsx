import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { LogIn, LogOut, User } from 'lucide-react';
import LoginPopup from './LoginPopup';

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoginPopupOpen, setIsLoginPopupOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          top: element.offsetTop - 80, // Account for header height
          behavior: 'smooth'
        });
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'py-3 bg-platinum/95 backdrop-blur-md border-b border-grayOlive/20 shadow-sm'
          : 'py-6 bg-transparent',
        className
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <NavLink
          to="/"
          className={cn(
            "text-xl font-heading font-semibold tracking-tight transition-all duration-300",
            isScrolled ? 'text-jetBlack hover:text-grayOlive' : 'text-white hover:text-platinum'
          )}
        >
          Nivo
        </NavLink>

        <div className="hidden md:flex items-center space-x-8">
          <NavLinks scrollToSection={scrollToSection} isScrolled={isScrolled} />
          
          {/* Auth buttons */}
          <div className="flex items-center space-x-2">
            {user ? (
              <>
                <NavLink to="/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex items-center space-x-1",
                      isScrolled ? "text-grayOlive" : "text-white hover:text-platinum"
                    )}
                  >
                    <User className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Button>
                </NavLink>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className={cn(
                    "flex items-center space-x-1",
                    isScrolled ? "text-grayOlive" : "text-white hover:text-platinum"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLoginPopupOpen(true)}
                className={cn(
                  "flex items-center space-x-1",
                  isScrolled ? "text-grayOlive" : "text-white hover:text-platinum"
                )}
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In</span>
              </Button>
            )}
          </div>
        </div>
        
        <button 
          className="md:hidden flex items-center"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={cn(
            "block w-6 transition-all duration-300",
            isMobileMenuOpen ? "opacity-0" : "opacity-100"
          )}>
            <span className={cn("block w-6 h-0.5 mb-1.5", isScrolled ? "bg-jetBlack" : "bg-white")} />
            <span className={cn("block w-6 h-0.5 mb-1.5", isScrolled ? "bg-jetBlack" : "bg-white")} />
            <span className={cn("block w-4 h-0.5", isScrolled ? "bg-jetBlack" : "bg-white")} />
          </span>
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-0 bg-platinum z-40 flex flex-col pt-24 px-6 transition-transform duration-500 ease-in-out transform md:hidden",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <button
          className="absolute top-5 right-5 p-2"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <span className="block w-6 h-0.5 bg-jetBlack transform rotate-45 translate-y-0.5" />
          <span className="block w-6 h-0.5 bg-jetBlack transform -rotate-45" />
        </button>

        <nav className="flex flex-col space-y-6 text-lg text-jetBlack">
          <button
            className="text-left transition-colors hover:text-grayOlive"
            onClick={() => {
              scrollToSection('about-nivo');
              setIsMobileMenuOpen(false);
            }}
          >
            Om oss
          </button>
          <button
            className="text-left transition-colors hover:text-grayOlive"
            onClick={() => {
              scrollToSection('services');
              setIsMobileMenuOpen(false);
            }}
          >
            Tjänster
          </button>
          <button
            className="text-left transition-colors hover:text-grayOlive"
            onClick={() => {
              scrollToSection('team');
              setIsMobileMenuOpen(false);
            }}
          >
            Team
          </button>
          <button
            className="text-left transition-colors hover:text-grayOlive"
            onClick={() => {
              scrollToSection('contact');
              setIsMobileMenuOpen(false);
            }}
          >
            Kontakt
          </button>
        </nav>
      </div>
      
      {/* Login Popup */}
      <LoginPopup
        isOpen={isLoginPopupOpen}
        onClose={() => setIsLoginPopupOpen(false)}
        onSuccess={() => {
          // Optionally redirect to dashboard after successful login
          window.location.href = '/dashboard';
        }}
      />
    </header>
  );
};

interface NavLinksProps {
  scrollToSection: (id: string) => void;
  isScrolled: boolean;
}

const NavLinks: React.FC<NavLinksProps> = ({ scrollToSection, isScrolled }) => (
  <>
    <button
      className={cn(
        "text-sm font-medium transition-colors",
        isScrolled ? "text-grayOlive hover:text-jetBlack" : "text-white hover:text-platinum"
      )}
      onClick={() => scrollToSection('about-nivo')}
    >
      Om oss
    </button>
    <button
      className={cn(
        "text-sm font-medium transition-colors",
        isScrolled ? "text-grayOlive hover:text-jetBlack" : "text-white hover:text-platinum"
      )}
      onClick={() => scrollToSection('services')}
    >
      Tjänster
    </button>
    <button
      className={cn(
        "text-sm font-medium transition-colors",
        isScrolled ? "text-grayOlive hover:text-jetBlack" : "text-white hover:text-platinum"
      )}
      onClick={() => scrollToSection('team')}
    >
      Team
    </button>
    <button
      className={cn(
        "text-sm font-medium transition-colors",
        isScrolled ? "text-grayOlive hover:text-jetBlack" : "text-white hover:text-platinum"
      )}
      onClick={() => scrollToSection('contact')}
    >
      Kontakt
    </button>
  </>
);

export default Header;
