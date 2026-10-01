import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function ExperienceNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Esta experiencia no existe"
      description="Puede que el enlace esté incompleto o que se haya eliminado del catálogo."
      action={
        <Button asChild>
          <Link href="/admin/catalog">Ver experiencias</Link>
        </Button>
      }
      className="my-10"
    />
  );
}
