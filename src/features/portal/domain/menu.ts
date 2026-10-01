import type { DietaryRestriction, MenuCourse } from "@prisma/client";
import { MENU_COURSE_LABELS } from "@/lib/labels";
import { sortDietary } from "@/features/guests/domain/rsvp";

export const COURSE_ORDER: MenuCourse[] = ["DRINK", "STARTER", "MAIN", "SIDE", "DESSERT", "OTHER"];

export type MenuItemView = {
  id: string;
  name: string;
  description: string | null;
  dietaryTags: DietaryRestriction[];
};

export type MenuView = {
  name: string;
  description: string | null;
  dietaryTags: DietaryRestriction[];
  courses: Array<{ course: MenuCourse; label: string; items: MenuItemView[] }>;
};

type MenuInput = {
  name: string;
  description: string | null;
  dietaryTags: DietaryRestriction[];
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    course: MenuCourse;
    dietaryTags: DietaryRestriction[];
    sortOrder: number;
  }>;
};

/** Agrupa los platillos por tiempo (bebidas, entradas, plato fuerte…) en orden estable. */
export function buildMenuView(menu: MenuInput | null | undefined): MenuView | null {
  if (!menu) return null;
  const courses = COURSE_ORDER.map((course) => ({
    course,
    label: MENU_COURSE_LABELS[course],
    items: menu.items
      .filter((i) => i.course === course)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es"))
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        dietaryTags: sortDietary(i.dietaryTags),
      })),
  })).filter((c) => c.items.length > 0);
  return {
    name: menu.name,
    description: menu.description,
    dietaryTags: sortDietary(menu.dietaryTags),
    courses,
  };
}
