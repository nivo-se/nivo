import React from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import { Card, CardContent } from '@/components/ui/card';

interface FoundersInSearchProps {
  className?: string;
}

const FoundersInSearch: React.FC<FoundersInSearchProps> = ({ className }) => {
  const founderTypes = [
    {
      title: "Svårdefinierade Grundare",
      description: "De som avvisar enkel kategorisering, oavsett om det beror på okonventionella bakgrunder, marknader eller affärsmodeller. Vi specialiserar oss på att finansiera det andra förbiser."
    },
    {
      title: "Förstagångsgrundare med Betydande Icke-Teknisk Erfarenhet",
      description: "Företagsledare, operatörer och företagsägare som gör språnget in i startups, och bidrar med unik domänexpertis och genomförandeförmåga."
    },
    {
      title: "Akademiska Innovatörer & Forskare",
      description: "Vetenskapsmän och akademiker med djup teknisk kunskap och IP-drivna innovationer som vill kommersialisera sin forskning genom entreprenörskap."
    },
    {
      title: "Könsmångfaldiga Team",
      description: "Stödjer kvinnliga ledare och blandat könssammansatta grundarteam som bidrar med nya perspektiv och samarbetsinriktade tillvägagångssätt för att bygga transformativa företag."
    }
  ];

  return (
    <section id="founders" className={cn('py-20 bg-platinum/70', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-heading text-jetBlack mb-8 text-center">Grundare vi stödjer</h2>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-2 grid-gap-nivo max-w-5xl mx-auto">
          {founderTypes.map((type, index) => (
            <FadeIn key={index} delay={150 + index * 50}>
              <Card className="h-full">
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-xl font-heading font-semibold text-jetBlack">{type.title}</h3>
                  <p className="text-jetBlack/75">{type.description}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FoundersInSearch;
