import { useNavigate, Link } from "react-router-dom";
import { useLists, usePromptTemplates, useCreateAIRun } from "@/lib/hooks/figmaQueries";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewCreateRun() {
  const navigate = useNavigate();
  const { data: lists = [] } = useLists();
  const { data: templates = [] } = usePromptTemplates();
  const createRunMutation = useCreateAIRun();

  const handleCreate = async () => {
    const listId = lists[0]?.id;
    const templateId = templates[0]?.id ?? "default";
    if (!listId) return;
    try {
      const run = await createRunMutation.mutateAsync({
        name: `Run ${new Date().toLocaleTimeString()}`,
        list_id: listId,
        template_id: templateId,
        config: { auto_approve: false, overwrite_existing: false },
      });
      navigate(`/new/ai/runs/${run.id}`);
    } catch {
      // Error handled
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <Link to="/new/ai">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to AI Lab
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create AI Run</h1>
        <p className="text-sm text-gray-600 mb-8">Configure and start an AI analysis run</p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <p className="text-sm text-gray-600">
            List: {lists[0]?.name ?? "No lists — create a list first"}
          </p>
          <p className="text-sm text-gray-600">
            Template: {templates[0]?.name ?? "Default (templates not implemented)"}
          </p>
          <Button
            onClick={handleCreate}
            disabled={lists.length === 0}
          >
            Start Run
          </Button>
        </div>
      </div>
    </div>
  );
}
