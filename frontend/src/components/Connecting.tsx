
import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';

interface ConnectingProps {
  className?: string;
}

const Connecting: React.FC<ConnectingProps> = ({ className }) => {
  const founderTypes = [
    "Kvinnliga chefer, forskare, företagsägare",
    "Förstagångsgrundare med betydande erfarenhet utanför teknik (företag, företagsägare)"
  ];

  return (
    <section id="connecting" className={cn('py-20 bg-white', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-heading text-jetBlack mb-12 text-center">Kopplingar</h2>
          </FadeIn>

          <FadeIn delay={100}>
            <h3 className="text-xl font-heading font-semibold text-jetBlack mb-6 text-center">Typer av potentiella grundare</h3>
          </FadeIn>

          <div className="space-y-4 mb-16">
            {founderTypes.map((type, index) => (
              <FadeIn key={index} delay={150 + index * 50}>
                <div className="flex items-start">
                  <span className="text-grayOlive mr-3 mt-1">—</span>
                  <p className="text-jetBlack/80">{type}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Connecting;
