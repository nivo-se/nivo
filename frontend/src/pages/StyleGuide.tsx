import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

const StyleGuide = () => {
  return (
    <main className="min-h-screen bg-platinum px-6 py-16 text-jetBlack">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <section>
          <p className="text-sm uppercase tracking-widest text-grayOlive">Typografi</p>
          <div className="mt-6 space-y-4">
            <h1 className="text-4xl font-heading">Rubrik 1 – Zapf Humanist</h1>
            <h2 className="text-3xl font-heading">Rubrik 2 – Zapf Humanist</h2>
            <h3 className="text-2xl font-heading">Rubrik 3 – Zapf Humanist</h3>
            <p className="text-base text-jetBlack/80">
              Brödtext använder Poppins i vikterna 300–700. Den nya paletten ger hög kontrast mot Platinum-bakgrunden och säkerställer läsbarhet i alla storlekar.
            </p>
          </div>
        </section>

        <Separator className="bg-grayOlive/20" />

        <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-widest text-grayOlive">Knappar</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button>Primär</Button>
              <Button variant="outline">Sekundär</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Länksstil</Button>
            </div>
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-grayOlive">Formfält</p>
            <div className="mt-6 space-y-4">
              <Input placeholder="E-post" />
              <Textarea placeholder="Meddelande" />
            </div>
          </div>
        </section>

        <Separator className="bg-grayOlive/20" />

        <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card-komponent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-jetBlack/80">
              <p>
                Kortytor använder vit bakgrund och mjuka skuggor för att skapa visuell hierarki mot Platinum-bakgrunden.
              </p>
              <Button size="sm">Visa mer</Button>
            </CardContent>
          </Card>
          <div className="card-elevated space-y-4">
            <h3 className="font-heading text-xl">Tillgänglighetskontroller</h3>
            <div className="flex items-center justify-between">
              <span className="text-jetBlack/80">E-postutskick</span>
              <Switch defaultChecked aria-label="Aktivera e-postutskick" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-jetBlack/80">Avtal accepterat</span>
              <Checkbox defaultChecked aria-label="Bekräfta avtal" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default StyleGuide;
