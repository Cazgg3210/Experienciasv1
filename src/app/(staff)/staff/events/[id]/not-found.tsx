import Link from "next/link";
import { CalendarX } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";

export default function StaffEventNotFound() {
  return (
    <EmptyState
      icon={CalendarX}
      title="No encontramos este evento"
      description="Puede que ya no estés asignada o que el enlace no sea correcto."
      action={
        <Link href="/staff" className="text-olive text-sm font-medium underline-offset-4 hover:underline">
          Volver a mis eventos
        </Link>
      }
    />
  );
}
