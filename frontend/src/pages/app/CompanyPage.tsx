import { useParams, useNavigate } from "react-router-dom";
import CompanyDetail from "@/pages/CompanyDetail";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export function CompanyPage() {
  const { orgnr } = useParams<{ orgnr: string }>();
  const navigate = useNavigate();

  if (!orgnr) {
    return (
      <div>
        <p className="text-muted-foreground">No company selected.</p>
        <Button variant="outline" onClick={() => navigate("/app/universe")}>
          Back to Universe
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back
      </Button>
      <CompanyDetail />
    </div>
  );
}
