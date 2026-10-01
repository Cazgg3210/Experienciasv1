import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function MenuNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Este menú no existe"
      description="Puede que el enlace esté incompleto o que se haya eliminado del catálogo."
      action={
        <Button asChild>
          <Link href="/admin/catalog/menus">Ver menús</Link>
        </Button>
      }
      className="my-10"
    />
  );
}
