import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function CustomerNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="No encontramos a esta clienta"
      description="Puede que el enlace esté incompleto o que la ficha se haya eliminado."
      action={
        <Button asChild>
          <Link href="/admin/customers">Ver todas las clientas</Link>
        </Button>
      }
      className="my-10"
    />
  );
}
