
import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import { Button } from '@/components/ui/button';

interface CommunityProps {
  className?: string;
}

const Community: React.FC<CommunityProps> = ({ className }) => {
  return (
    <section id="contact" className={cn('py-16 md:py-20 bg-platinum', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-2 grid-gap-nivo items-start max-w-6xl mx-auto">
          <FadeIn>
            <div className="space-y-6">
              <h2 className="text-3xl font-heading text-jetBlack sm:text-4xl">
                Är ditt företag redo för nästa steg?
              </h2>
              <p className="text-base leading-relaxed text-jetBlack/80 sm:text-lg">
                Nivo är ständigt på jakt efter kvalitetsföretag och intressanta förvärvsmöjligheter. Om du är företagare som funderar på nästa steg för ditt bolag, eller om du är branschexpert med insikter om potentiella förvärv, tveka inte att höra av dig! Vi ser fram emot att höra från dig och utforska hur vi tillsammans kan utveckla framgångsrika verksamheter.
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="card-elevated max-w-xl md:ml-auto">
              <form className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-jetBlack mb-1">
                    Namn
                  </label>
                  <input
                    type="text"
                    id="name"
                    className="w-full rounded-lg border border-grayOlive/30 bg-white px-3 py-2 text-jetBlack shadow-sm outline-none transition focus:border-grayOlive/60 focus:ring-2 focus:ring-grayOlive/30"
                    placeholder="Ditt namn"
                  />
                </div>
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-jetBlack mb-1">
                    Företag
                  </label>
                  <input
                    type="text"
                    id="company"
                    className="w-full rounded-lg border border-grayOlive/30 bg-white px-3 py-2 text-jetBlack shadow-sm outline-none transition focus:border-grayOlive/60 focus:ring-2 focus:ring-grayOlive/30"
                    placeholder="Ditt företag"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-jetBlack mb-1">
                    E-post
                  </label>
                  <input
                    type="email"
                    id="email"
                    className="w-full rounded-lg border border-grayOlive/30 bg-white px-3 py-2 text-jetBlack shadow-sm outline-none transition focus:border-grayOlive/60 focus:ring-2 focus:ring-grayOlive/30"
                    placeholder="din@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-jetBlack mb-1">
                    Meddelande
                  </label>
                  <textarea
                    id="message"
                    rows={3}
                    className="w-full rounded-lg border border-grayOlive/30 bg-white px-3 py-2 text-jetBlack shadow-sm outline-none transition focus:border-grayOlive/60 focus:ring-2 focus:ring-grayOlive/30"
                    placeholder="Berätta om ditt företag..."
                  />
                </div>
                <Button type="submit" className="w-full justify-center">
                  Skicka meddelande
                </Button>
              </form>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

export default Community;
