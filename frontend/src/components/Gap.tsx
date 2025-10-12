
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import FadeIn from './animations/FadeIn';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface GapProps {
  className?: string;
}

const Gap: React.FC<GapProps> = ({ className }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [email, setEmail] = useState('');
  
  const messages = [
    "Vill du diskutera framtida projekt eller möjligheter?",
    "Är du redo att ta nästa steg på din tillväxtresa?",
    "Låt oss utforska hur vi kan skapa värde tillsammans"
  ];
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Start fading out
      setOpacity(0);
      
      // Change message after fade out
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % messages.length);
        // Start fading in
        setOpacity(1);
      }, 1000);
    }, 4000); // Total time for each message
    
    return () => clearInterval(interval);
  }, [messages.length]);
  
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      console.log('Subscribing email:', email);
      // Here you would typically send this to a backend
      alert(`Tack för ditt meddelande! Vi hör av oss till ${email} snart.`);
      setEmail('');
    }
  };

  const statistics = [
    {
      title: "Tillväxtfokus",
      description: "Vi fokuserar på konkreta resultat och hållbart värdeskapande för svenska tillväxtföretag"
    },
    {
      title: "Operativt engagemang",
      description: "Genom operationellt stöd skapar vi värde bortom traditionell kapitalinvestering"
    },
    {
      title: "Långsiktiga partnerskap",
      description: "Vår filosofi bygger på att skapa partnerskap som varar och framgångar som står sig över tid"
    }
  ];

  return (
    <section id="gap" className={cn('py-20 bg-platinum/80', className)}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto mb-16">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-heading text-jetBlack mb-8 text-center">Låt oss diskutera</h2>
          </FadeIn>

          <FadeIn delay={100}>
            <p className="text-xl text-center text-jetBlack/80 mb-8">
              Vi på Project Nico är ständigt på jakt efter spännande samarbeten och nya möjligheter
            </p>
          </FadeIn>
        </div>

        <div className="grid md:grid-cols-3 grid-gap-nivo max-w-5xl mx-auto mb-20">
          {statistics.map((stat, index) => (
            <FadeIn key={index} delay={150 + index * 50}>
              <Card className="h-full">
                <CardContent className="p-6 space-y-3">
                  <h3 className="text-xl font-heading font-semibold text-jetBlack">{stat.title}</h3>
                  <p className="text-jetBlack/75">{stat.description}</p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        
        <div className="relative max-w-full mx-auto">
          <FadeIn delay={200}>
            <div className="relative">
              <div className="w-full h-[500px] overflow-hidden">
                <img
                  src="/lovable-uploads/dabbf929-5dd0-4794-a011-fe43bf4b3418.png"
                  alt="Beautiful orangery with palm trees and plants"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-jetBlack/40"></div>
              </div>

              {/* Centered newsletter box overlaid on the image */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="mx-4 w-full max-w-md rounded-2xl bg-platinum/95 p-8 text-jetBlack shadow-2xl shadow-jetBlack/20 backdrop-blur">
                  <h3 className="text-2xl font-heading mb-6 text-center">Kontakta oss</h3>

                  <div className="flex justify-center mb-6">
                    <Button
                      variant="outline"
                      className="min-h-[3.5rem] min-w-[220px] justify-center bg-white/60 text-grayOlive hover:bg-white md:min-w-[280px]"
                    >
                      <span
                        className="transition-opacity duration-1000 ease-in-out"
                        style={{ opacity: opacity }}
                      >
                        {messages[messageIndex]}
                      </span>
                    </Button>
                  </div>
                  
                  <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                    <Input
                      type="email"
                      placeholder="Ange din e-post för kontakt"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full justify-center sm:w-auto">
                      Skicka
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
};

export default Gap;
