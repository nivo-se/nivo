import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import TextReveal from './animations/TextReveal';

interface EntrepreneursProps {
  className?: string;
  id?: string;
}

const Entrepreneurs: React.FC<EntrepreneursProps> = ({ className, id }) => {
  return (
    <section id={id} className={cn('py-16 md:py-28 bg-platinum/60', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn delay={100}>
            <div className="text-center mb-16">
              <TextReveal delay={200} duration={1000}>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-heading font-semibold tracking-tight text-jetBlack mb-8">
                  Vi utvecklar företag till sin fulla potential
                </h2>
              </TextReveal>
            </div>
          </FadeIn>

          <div className="space-y-8">
            <FadeIn delay={400} duration={900} direction="up">
              <p className="text-base leading-relaxed text-jetBlack/80 sm:text-lg md:text-xl">
                Entreprenöriella verksamheter är ryggraden i nordiska lokalsamhällen och skapar arbetstillfällen och ekonomisk tillväxt. Många framgångsrika små och medelstora företag når dock en punkt där de behöver nya resurser och expertis för att ta nästa steg i sin utveckling. Med vårt långsiktiga ägarperspektiv, djup operationell kunskap och avancerad AI-kompetens, strävar Nivo efter att vara den partner som möjliggör denna utveckling.
              </p>
            </FadeIn>

            <FadeIn delay={600} duration={900} direction="up">
              <p className="text-base leading-relaxed text-jetBlack/80 sm:text-lg md:text-xl">
                Genom fokuserade förvärv av marknadsledande företag som genererar stabila kassaflöden och bidrar till positiv samhällsutveckling, hjälper vi etablerade nordiska verksamheter att modernisera sina processer och nå sin fulla tillväxtpotential. Vi söker specifikt efter välskötta företag inom sina respektive segment som redan skapar värde och har potential för ytterligare utveckling genom operationell optimering och teknologisk innovation.
              </p>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Entrepreneurs;