import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function LeadNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Este lead no existe"
      description="Puede que el enlace esté incompleto o que el registro se haya eliminado."
      action={
        <Button asChild>
          <Link href="/admin/leads">Ver todos los leads</Link>
        </Button>
      }
      className="my-10"
    />
  );
}
