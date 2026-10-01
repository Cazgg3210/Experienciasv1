import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export default function AddOnNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Este add-on no existe"
      description="Puede que el enlace esté incompleto o que se haya eliminado del catálogo."
      action={
        <Button asChild>
          <Link href="/admin/catalog/addons">Ver add-ons</Link>
        </Button>
      }
      className="my-10"
    />
  );
}
