/**
 * Catálogo DEMO: experiencias, menús, add-ons, inventario, proveedores, staff y contenido.
 * Precios en centavos MXN (IVA incluido).
 */
import type {
  AddOnCategory,
  CostCategory,
  DietaryRestriction,
  ExperienceType,
  InventoryCategory,
  MenuCourse,
  MenuPricingType,
  Occasion,
  StaffFunction,
  StaffRateType,
  VendorCategory,
  VendorStatus,
} from "@prisma/client";
import { PLACEHOLDER } from "./base-data";
import { mx } from "./helpers";

export const DEMO_PASSWORD = "Demo2026!";

export const DEMO_USERS = {
  superadmin: { email: "superadmin@ivonne-rosa.test", name: "Admin Plataforma", role: "SUPER_ADMIN", phone: null },
  ivonne: { email: "ivonne@ivonne-rosa.test", name: "Ivonne", role: "OWNER", phone: "+52 55 4100 2201" },
  rosa: { email: "rosa@ivonne-rosa.test", name: "Rosa", role: "OWNER", phone: "+52 55 4100 2202" },
  lupita: { email: "staff@ivonne-rosa.test", name: "Lupita Hernández", role: "STAFF", phone: "+52 55 3301 1101" },
  carlos: { email: "staff2@ivonne-rosa.test", name: "Carlos Méndez", role: "STAFF", phone: "+52 55 3301 1102" },
} as const;

// -----------------------------------------------------------------------------
// Inventario
// -----------------------------------------------------------------------------
export interface InventorySeed {
  sku: string;
  name: string;
  category: InventoryCategory;
  unit?: string;
  totalQuantity: number;
  maintenanceQuantity?: number;
  lowStockThreshold: number;
  replacementCostCents: number;
  notes?: string;
}

export const INVENTORY: InventorySeed[] = [
  { sku: "PLT-DIN-01", name: "Plato trinche de porcelana blanca", category: "DINNERWARE", totalQuantity: 60, maintenanceQuantity: 2, lowStockThreshold: 14, replacementCostCents: mx(180) },
  { sku: "PLT-POS-01", name: "Plato postre de porcelana", category: "DINNERWARE", totalQuantity: 60, lowStockThreshold: 14, replacementCostCents: mx(120) },
  { sku: "BAJ-01", name: "Bajo plato de ratán natural", category: "DINNERWARE", totalQuantity: 36, lowStockThreshold: 12, replacementCostCents: mx(250) },
  { sku: "TAZ-01", name: "Taza de café de cerámica artesanal", category: "DINNERWARE", totalQuantity: 30, lowStockThreshold: 12, replacementCostCents: mx(140) },
  { sku: "COP-CHA-01", name: "Copa flauta de champaña (cristal)", category: "GLASSWARE", totalQuantity: 24, maintenanceQuantity: 2, lowStockThreshold: 12, replacementCostCents: mx(220), notes: "Inventario ajustado: revisar conflictos en fines de semana con dos eventos." },
  { sku: "COP-AGU-01", name: "Copa de agua de cristal", category: "GLASSWARE", totalQuantity: 48, lowStockThreshold: 12, replacementCostCents: mx(180) },
  { sku: "VAS-01", name: "Vaso old fashioned de vidrio grabado", category: "GLASSWARE", totalQuantity: 48, lowStockThreshold: 12, replacementCostCents: mx(95) },
  { sku: "CUB-TEN-01", name: "Tenedor dorado mate", category: "CUTLERY", totalQuantity: 72, lowStockThreshold: 14, replacementCostCents: mx(90) },
  { sku: "CUB-CUC-01", name: "Cuchillo dorado mate", category: "CUTLERY", totalQuantity: 72, lowStockThreshold: 14, replacementCostCents: mx(90) },
  { sku: "CUB-CUC-02", name: "Cucharita de postre dorada", category: "CUTLERY", totalQuantity: 60, lowStockThreshold: 14, replacementCostCents: mx(70) },
  { sku: "MAN-LIN-01", name: "Mantel de lino natural 3 m", category: "LINENS", totalQuantity: 10, maintenanceQuantity: 1, lowStockThreshold: 3, replacementCostCents: mx(950), notes: "Uno en tintorería por mancha de vino." },
  { sku: "CAM-01", name: "Camino de mesa de gasa salvia", category: "LINENS", totalQuantity: 8, lowStockThreshold: 2, replacementCostCents: mx(350) },
  { sku: "SER-01", name: "Servilleta de lino arena", category: "LINENS", totalQuantity: 72, lowStockThreshold: 14, replacementCostCents: mx(65) },
  { sku: "FLO-VAS-01", name: "Florero de vidrio ámbar", category: "DECOR", totalQuantity: 24, lowStockThreshold: 6, replacementCostCents: mx(150) },
  { sku: "CAN-01", name: "Candelabro de latón", category: "DECOR", totalQuantity: 12, lowStockThreshold: 4, replacementCostCents: mx(420) },
  { sku: "PIZ-01", name: "Pizarrón de bienvenida con caballete", category: "DECOR", totalQuantity: 3, lowStockThreshold: 1, replacementCostCents: mx(850) },
  { sku: "BOC-01", name: "Bocina Bluetooth portátil", category: "AUDIO", totalQuantity: 2, lowStockThreshold: 1, replacementCostCents: mx(4_500) },
  { sku: "KAR-01", name: "Equipo de karaoke (consola + pantalla 43\")", category: "KARAOKE", totalQuantity: 1, lowStockThreshold: 1, replacementCostCents: mx(12_500), notes: "Único equipo: no se pueden empalmar dos eventos con karaoke el mismo día." },
  { sku: "MIC-01", name: "Micrófono inalámbrico", category: "KARAOKE", totalQuantity: 4, maintenanceQuantity: 1, lowStockThreshold: 2, replacementCostCents: mx(1_800) },
  { sku: "TAB-01", name: "Tabla de madera para quesos y pan", category: "SERVING", totalQuantity: 8, lowStockThreshold: 2, replacementCostCents: mx(380) },
  { sku: "JAR-01", name: "Jarra de vidrio 1.5 L", category: "SERVING", totalQuantity: 10, lowStockThreshold: 3, replacementCostCents: mx(220) },
  { sku: "PAN-01", name: "Pastelero de cerámica con base", category: "SERVING", totalQuantity: 4, lowStockThreshold: 1, replacementCostCents: mx(650) },
  { sku: "CAF-01", name: "Cafetera de prensa francesa 1 L", category: "SERVING", totalQuantity: 4, lowStockThreshold: 1, replacementCostCents: mx(550) },
  { sku: "MES-01", name: "Mesa plegable de madera 2.4 m", category: "FURNITURE", totalQuantity: 3, lowStockThreshold: 1, replacementCostCents: mx(3_800) },
  { sku: "SIL-01", name: "Silla crossback de madera", category: "FURNITURE", totalQuantity: 24, lowStockThreshold: 8, replacementCostCents: mx(1_200) },
  { sku: "EXT-01", name: "Extensión eléctrica 10 m", category: "OTHER", totalQuantity: 4, lowStockThreshold: 1, replacementCostCents: mx(280) },
];

export const INVENTORY_LOCATION = "Bodega Granada";

/** Requerimientos estándar de mesa (por invitada) para todas las experiencias. */
const STANDARD_TABLE: { sku: string; quantity: number; perGuest: boolean }[] = [
  { sku: "PLT-DIN-01", quantity: 1, perGuest: true },
  { sku: "PLT-POS-01", quantity: 1, perGuest: true },
  { sku: "BAJ-01", quantity: 1, perGuest: true },
  { sku: "TAZ-01", quantity: 1, perGuest: true },
  { sku: "COP-AGU-01", quantity: 1, perGuest: true },
  { sku: "VAS-01", quantity: 1, perGuest: true },
  { sku: "CUB-TEN-01", quantity: 1, perGuest: true },
  { sku: "CUB-CUC-01", quantity: 1, perGuest: true },
  { sku: "CUB-CUC-02", quantity: 1, perGuest: true },
  { sku: "SER-01", quantity: 1, perGuest: true },
  { sku: "MAN-LIN-01", quantity: 2, perGuest: false },
  { sku: "FLO-VAS-01", quantity: 3, perGuest: false },
  { sku: "JAR-01", quantity: 2, perGuest: false },
  { sku: "CAF-01", quantity: 1, perGuest: false },
];

// -----------------------------------------------------------------------------
// Menús
// -----------------------------------------------------------------------------
export interface MenuSeed {
  slug: string;
  name: string;
  description: string;
  pricingType: MenuPricingType;
  priceCents: number;
  costPerGuestCents: number;
  tags: string[];
  dietaryTags: DietaryRestriction[];
  items: { name: string; description?: string; course: MenuCourse; dietaryTags?: DietaryRestriction[] }[];
}

export const MENUS: MenuSeed[] = [
  {
    slug: "brunch-clasico",
    name: "Brunch Clásico",
    description: "Lo dulce y lo salado que nunca falla: chilaquiles, benedictinos, pan dulce artesanal y fruta de temporada.",
    pricingType: "INCLUDED",
    priceCents: 0,
    costPerGuestCents: mx(190),
    tags: ["clásico", "dulce y salado", "favorito"],
    dietaryTags: [],
    items: [
      { name: "Café de especialidad y selección de tés", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Jugo verde y jugo de naranja recién exprimido", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Bowl de fruta de temporada con yogurt griego y granola de la casa", course: "STARTER", dietaryTags: ["VEGETARIAN"] },
      { name: "Canasta de pan dulce artesanal", description: "Conchas, cuernitos y rol de canela horneados esa mañana.", course: "STARTER", dietaryTags: ["VEGETARIAN"] },
      { name: "Chilaquiles verdes o rojos con pollo, crema y queso fresco", course: "MAIN" },
      { name: "Huevos benedictinos con jamón serrano y holandesa", course: "MAIN" },
      { name: "Frijoles refritos con totopos y queso de rancho", course: "SIDE", dietaryTags: ["VEGETARIAN"] },
      { name: "Mini hotcakes con frutos rojos y maple", course: "DESSERT", dietaryTags: ["VEGETARIAN"] },
    ],
  },
  {
    slug: "brunch-garden",
    name: "Brunch Garden",
    description: "Nuestra versión 100% vegetariana: fresca, colorida y con mucho sabor de huerto.",
    pricingType: "INCLUDED",
    priceCents: 0,
    costPerGuestCents: mx(180),
    tags: ["vegetariano", "ligero", "de temporada"],
    dietaryTags: ["VEGETARIAN"],
    items: [
      { name: "Agua fresca de pepino, limón y chía", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Café de especialidad con leches vegetales", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Tostada de aguacate con semillas, rábano y brotes", course: "STARTER", dietaryTags: ["VEGETARIAN", "VEGAN"] },
      { name: "Shakshuka con pan de masa madre", course: "MAIN", dietaryTags: ["VEGETARIAN"] },
      { name: "Enfrijoladas de queso de cabra y hoja santa", course: "MAIN", dietaryTags: ["VEGETARIAN"] },
      { name: "Ensalada de quinoa, betabel rostizado y cítricos", course: "SIDE", dietaryTags: ["VEGETARIAN", "VEGAN", "GLUTEN_FREE"] },
      { name: "Pan de plátano con nuez y mantequilla de miel", course: "DESSERT", dietaryTags: ["VEGETARIAN"] },
    ],
  },
  {
    slug: "brunch-sin-gluten",
    name: "Brunch Sin Gluten",
    description: "Pensado para celiacas y sensibles al gluten, preparado en una estación separada.",
    pricingType: "INCLUDED",
    priceCents: 0,
    costPerGuestCents: mx(215),
    tags: ["sin gluten", "cuidado"],
    dietaryTags: ["GLUTEN_FREE"],
    items: [
      { name: "Café de especialidad y jugos naturales", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Parfait de yogurt, frutos rojos y granola sin gluten", course: "STARTER", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
      { name: "Chilaquiles de tortilla de maíz con huevo estrellado", course: "MAIN", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
      { name: "Huevos rancheros sobre tortilla de maíz", course: "MAIN", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
      { name: "Papas cambray rostizadas con romero", course: "SIDE", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Panqué de almendra y naranja", course: "DESSERT", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
    ],
  },
  {
    slug: "sabores-peru-mexico",
    name: "Sabores Perú x México",
    description: "Upgrade de autor: ceviche, causa limeña y chilaquiles a la huancaína. Dos cocinas que se entienden de maravilla.",
    pricingType: "PER_GUEST",
    priceCents: mx(250),
    costPerGuestCents: mx(290),
    tags: ["fusión", "de autor", "temático"],
    dietaryTags: [],
    items: [
      { name: "Chicha morada y agua de jamaica con maracuyá", course: "DRINK", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Ceviche clásico de pescado con leche de tigre y camote", course: "STARTER", dietaryTags: ["GLUTEN_FREE"] },
      { name: "Causa limeña de pollo con aguacate", course: "STARTER", dietaryTags: ["GLUTEN_FREE"] },
      { name: "Chilaquiles a la huancaína con huevo pochado", course: "MAIN", dietaryTags: ["VEGETARIAN"] },
      { name: "Tiradito nikkei de salmón con ponzu de chile serrano", course: "MAIN", dietaryTags: ["GLUTEN_FREE"] },
      { name: "Cancha serrana y camote glaseado", course: "SIDE", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Suspiro limeño en vasito", course: "DESSERT", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
      { name: "Churros con cajeta de Celaya", course: "DESSERT", dietaryTags: ["VEGETARIAN"] },
    ],
  },
  {
    slug: "brunch-premium",
    name: "Brunch Premium",
    description: "Para cuando la ocasión pide un poco más: salmón ahumado, rib eye, tabla de quesos y torre de macarons.",
    pricingType: "PER_GUEST",
    priceCents: mx(380),
    costPerGuestCents: mx(320),
    tags: ["premium", "celebración"],
    dietaryTags: [],
    items: [
      { name: "Barra de café con leches vegetales y chocolate caliente", course: "DRINK", dietaryTags: ["VEGETARIAN", "GLUTEN_FREE"] },
      { name: "Tabla de quesos y charcutería con mermeladas de la casa", course: "STARTER" },
      { name: "Bagel de salmón ahumado con queso crema y alcaparras", course: "STARTER" },
      { name: "Huevos benedictinos con salmón ahumado", course: "MAIN" },
      { name: "Rib eye con huevo estrellado y chimichurri", course: "MAIN", dietaryTags: ["GLUTEN_FREE", "LACTOSE_FREE"] },
      { name: "Papas cambray rostizadas con romero", course: "SIDE", dietaryTags: ["VEGAN", "GLUTEN_FREE"] },
      { name: "Torre de macarons y mini tartas de temporada", course: "DESSERT", dietaryTags: ["VEGETARIAN"] },
    ],
  },
];


// -----------------------------------------------------------------------------
// Add-ons
// -----------------------------------------------------------------------------
export interface AddOnSeed {
  slug: string;
  name: string;
  description: string;
  category: AddOnCategory;
  pricingType: "FLAT" | "PER_GUEST";
  priceCents: number;
  costCents: number;
  costCategory: CostCategory;
  maxQuantity: number;
  leadTimeDays: number;
  imageUrl: string;
  inventory?: { sku: string; quantity: number; perGuest: boolean }[];
}

export const ADDONS: AddOnSeed[] = [
  {
    slug: "mini-karaoke",
    name: "Mini karaoke",
    description: "Consola con pantalla, 2 micrófonos inalámbricos y bocina. Más de 20,000 canciones.",
    category: "ENTERTAINMENT",
    pricingType: "FLAT",
    priceCents: mx(2_800),
    costCents: mx(650),
    costCategory: "OTHER",
    maxQuantity: 1,
    leadTimeDays: 3,
    imageUrl: PLACEHOLDER("karaoke"),
    inventory: [
      { sku: "KAR-01", quantity: 1, perGuest: false },
      { sku: "MIC-01", quantity: 2, perGuest: false },
      { sku: "BOC-01", quantity: 1, perGuest: false },
      { sku: "EXT-01", quantity: 1, perGuest: false },
    ],
  },
  {
    slug: "pastel-personalizado",
    name: "Pastel personalizado",
    description: "Pastel de autor para 10–12 porciones con decoración floral y mensaje a elegir.",
    category: "FOOD",
    pricingType: "FLAT",
    priceCents: mx(1_900),
    costCents: mx(950),
    costCategory: "VENDOR",
    maxQuantity: 2,
    leadTimeDays: 5,
    imageUrl: PLACEHOLDER("birthday-cake"),
    inventory: [{ sku: "PAN-01", quantity: 1, perGuest: false }],
  },
  {
    slug: "fotografo-2h",
    name: "Fotógrafo 2 h",
    description: "Fotógrafa profesional durante 2 horas; 80+ fotos editadas en galería privada en 5 días.",
    category: "PHOTO",
    pricingType: "FLAT",
    priceCents: mx(4_500),
    costCents: mx(2_800),
    costCategory: "VENDOR",
    maxQuantity: 2,
    leadTimeDays: 7,
    imageUrl: PLACEHOLDER("gallery-04"),
  },
  {
    slug: "mimosa-bar",
    name: "Mimosa bar",
    description: "Barra de mimosas con espumoso, jugos naturales, fruta fresca y opción sin alcohol.",
    category: "DRINKS",
    pricingType: "PER_GUEST",
    priceCents: mx(290),
    costCents: mx(130),
    costCategory: "FOOD",
    maxQuantity: 1,
    leadTimeDays: 2,
    imageUrl: PLACEHOLDER("mimosas"),
    inventory: [
      { sku: "COP-CHA-01", quantity: 1, perGuest: true },
      { sku: "JAR-01", quantity: 2, perGuest: false },
    ],
  },
  {
    slug: "upgrade-floral",
    name: "Upgrade floral",
    description: "Centro de mesa abundante con flores premium de temporada y arreglo para la entrada.",
    category: "DECOR",
    pricingType: "FLAT",
    priceCents: mx(2_500),
    costCents: mx(1_300),
    costCategory: "FLOWERS",
    maxQuantity: 2,
    leadTimeDays: 4,
    imageUrl: PLACEHOLDER("gallery-03"),
    inventory: [
      { sku: "FLO-VAS-01", quantity: 3, perGuest: false },
      { sku: "CAN-01", quantity: 4, perGuest: false },
    ],
  },
  {
    slug: "taller-floral",
    name: "Taller floral",
    description: "Cada invitada arma su propio arreglo guiada por nuestra florista y se lo lleva a casa.",
    category: "EXPERIENCE",
    pricingType: "PER_GUEST",
    priceCents: mx(650),
    costCents: mx(330),
    costCategory: "FLOWERS",
    maxQuantity: 1,
    leadTimeDays: 7,
    imageUrl: PLACEHOLDER("bridal-flowers"),
  },
  {
    slug: "papeleria-personalizada",
    name: "Papelería personalizada",
    description: "Menú impreso, tarjetas de lugar y letrero de bienvenida con el nombre de la homenajeada.",
    category: "PERSONALIZATION",
    pricingType: "FLAT",
    priceCents: mx(1_200),
    costCents: mx(450),
    costCategory: "VENDOR",
    maxQuantity: 1,
    leadTimeDays: 7,
    imageUrl: PLACEHOLDER("gallery-08"),
    inventory: [{ sku: "PIZ-01", quantity: 1, perGuest: false }],
  },
  {
    slug: "regalo-homenajeada",
    name: "Regalo para la homenajeada",
    description: "Caja de regalo curada (vela artesanal, chocolate de autor y tarjeta escrita a mano).",
    category: "PERSONALIZATION",
    pricingType: "FLAT",
    priceCents: mx(950),
    costCents: mx(520),
    costCategory: "VENDOR",
    maxQuantity: 2,
    leadTimeDays: 4,
    imageUrl: PLACEHOLDER("gallery-08"),
  },
  {
    slug: "video-recap",
    name: "Video recap",
    description: "Video vertical de 60 segundos editado y listo para redes en 72 horas.",
    category: "PHOTO",
    pricingType: "FLAT",
    priceCents: mx(3_200),
    costCents: mx(1_700),
    costCategory: "VENDOR",
    maxQuantity: 1,
    leadTimeDays: 7,
    imageUrl: PLACEHOLDER("gallery-02"),
  },
  {
    slug: "memory-capsule-premium",
    name: "Memory Capsule premium",
    description: "Álbum digital curado con fotos de las invitadas, libro de visitas y diseño editorial.",
    category: "EXPERIENCE",
    pricingType: "FLAT",
    priceCents: mx(1_500),
    costCents: mx(300),
    costCategory: "OTHER",
    maxQuantity: 1,
    leadTimeDays: 2,
    imageUrl: PLACEHOLDER("gallery-06"),
  },
  {
    slug: "arco-globos-organico",
    name: "Arco de globos orgánico",
    description: "Arco de globos en tonos de tu paleta, montado en la entrada o detrás de la mesa.",
    category: "DECOR",
    pricingType: "FLAT",
    priceCents: mx(2_900),
    costCents: mx(1_400),
    costCategory: "VENDOR",
    maxQuantity: 1,
    leadTimeDays: 5,
    imageUrl: PLACEHOLDER("gallery-05"),
  },
  {
    slug: "mesa-postres",
    name: "Mesa de postres mini",
    description: "Selección de 36 mini postres: tartaletas, macarons, brownies y conchas rellenas.",
    category: "FOOD",
    pricingType: "FLAT",
    priceCents: mx(2_400),
    costCents: mx(1_150),
    costCategory: "VENDOR",
    maxQuantity: 1,
    leadTimeDays: 5,
    imageUrl: PLACEHOLDER("gallery-06"),
    inventory: [
      { sku: "PAN-01", quantity: 2, perGuest: false },
      { sku: "TAB-01", quantity: 2, perGuest: false },
    ],
  },
];

// -----------------------------------------------------------------------------
// Experiencias
// -----------------------------------------------------------------------------
export interface ExperienceSeed {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  type: ExperienceType;
  occasions: Occasion[];
  basePriceCents: number;
  extraGuestPriceCents: number;
  extraGuestCostCents: number;
  durationMinutes: number;
  includes: string[];
  cover: string;
  images: string[];
  featured: boolean;
  styles: string[];
  menus: string[];
  addOns: string[];
  costs: { category: CostCategory; description: string; amountCents: number; perGuest: boolean }[];
  inventory: { sku: string; quantity: number; perGuest: boolean }[];
  faqs: { question: string; answer: string; category: string }[];
}

export const EXPERIENCES: ExperienceSeed[] = [
  {
    slug: "signature-brunch",
    name: "Signature Brunch",
    tagline: "El brunch que siempre quisiste organizar, sin mover un dedo.",
    description: [
      "Nuestra experiencia insignia: una mesa larga vestida con lino, flores de temporada y vajilla de porcelana, montada en tu casa, terraza o jardín. Llegamos antes que tus invitadas y nos vamos cuando la última taza de café está vacía.",
      "Cocinamos en sitio un brunch de autor —chilaquiles, benedictinos, pan dulce artesanal y fruta de temporada— mientras una anfitriona del equipo cuida cada detalle del servicio.",
      "Ideal para reencuentros, cumpleaños tranquilos o simplemente porque sí. Tú reúne a las tuyas; nosotras hacemos el resto.",
    ].join("\n\n"),
    type: "BRUNCH",
    occasions: ["FRIENDS_BRUNCH", "BIRTHDAY", "GATHERING", "BABY_BRUNCH"],
    basePriceCents: mx(14_900),
    extraGuestPriceCents: mx(1_500),
    extraGuestCostCents: mx(500),
    durationMinutes: 180,
    includes: [
      "Montaje completo de mesa para 6 invitadas (ampliable hasta 12)",
      "Mantelería de lino, vajilla de porcelana y cristalería",
      "Centro de mesa con flores de temporada",
      "Menú de brunch a elegir, preparado en sitio",
      "Café de especialidad, jugos naturales y aguas frescas",
      "Coordinadora y mesera durante 3 horas",
      "Montaje, servicio, desmontaje y limpieza",
    ],
    cover: "brunch-table",
    images: ["brunch-table", "mimosas", "gallery-01"],
    featured: true,
    styles: ["natural", "minimal", "romantico", "elegante"],
    menus: ["brunch-clasico", "brunch-garden", "brunch-sin-gluten", "brunch-premium", "sabores-peru-mexico"],
    addOns: ["pastel-personalizado", "fotografo-2h", "mimosa-bar", "upgrade-floral", "taller-floral", "papeleria-personalizada", "regalo-homenajeada", "video-recap", "memory-capsule-premium", "arco-globos-organico", "mesa-postres"],
    costs: [
      { category: "FOOD", description: "Café de especialidad, jugos naturales y aguas frescas (fuera del menú)", amountCents: mx(140), perGuest: true },
      { category: "FLOWERS", description: "Flores de temporada para centro de mesa", amountCents: mx(1_200), perGuest: false },
      { category: "STAFF", description: "Coordinadora y mesera (base)", amountCents: mx(2_600), perGuest: false },
      { category: "CONSUMABLES", description: "Hielo, velas, servilletas de papel y desechables de cocina", amountCents: mx(100), perGuest: true },
      { category: "TRANSPORT", description: "Carga y traslado de mobiliario", amountCents: mx(300), perGuest: false },
      { category: "OTHER", description: "Lavandería de mantelería", amountCents: mx(250), perGuest: false },
    ],
    inventory: STANDARD_TABLE,
    faqs: [
      { question: "¿Necesito un comedor grande?", answer: "No. Montamos en mesas de 6 a 12 personas y, si hace falta, llevamos nuestra mesa plegable de 2.4 m y sillas crossback sin costo adicional dentro de nuestras zonas.", category: "logistica" },
      { question: "¿Pueden montar en terraza o jardín?", answer: "¡Nos encanta! Sólo pedimos un espacio techado o un plan B en caso de lluvia; lo revisamos contigo antes del evento.", category: "logistica" },
    ],
  },
  {
    slug: "birthday-table",
    name: "Birthday Table",
    tagline: "Una mesa de cumpleaños tan especial como ella.",
    description: [
      "Un cumpleaños íntimo merece una mesa que se sienta hecha a mano. Diseñamos la mesa alrededor de la homenajeada: sus colores, sus flores favoritas y un letrero de bienvenida con su nombre.",
      "Servimos un brunch a elegir, brindamos con espumoso o mocktail y preparamos el momento del pastel con velitas, playlist y todas sus amigas alrededor.",
      "Tú sólo llegas a celebrar. Nosotras montamos, servimos, recogemos y dejamos todo impecable.",
    ].join("\n\n"),
    type: "CELEBRATION",
    occasions: ["BIRTHDAY", "FRIENDS_BRUNCH", "GATHERING"],
    basePriceCents: mx(16_900),
    extraGuestPriceCents: mx(1_700),
    extraGuestCostCents: mx(580),
    durationMinutes: 210,
    includes: [
      "Mesa de celebración para 6 invitadas (hasta 12)",
      "Letrero de bienvenida con el nombre de la homenajeada",
      "Flores de temporada y velas",
      "Menú de brunch a elegir",
      "Brindis con espumoso o mocktail para todas",
      "Momento de pastel con playlist y velitas",
      "Anfitriona dedicada durante 3.5 horas",
      "Montaje, desmontaje y limpieza",
    ],
    cover: "birthday-cake",
    images: ["birthday-cake", "gallery-02", "gallery-05"],
    featured: true,
    styles: ["romantico", "divertido", "colorido", "elegante", "natural"],
    menus: ["brunch-clasico", "brunch-garden", "brunch-sin-gluten", "brunch-premium", "sabores-peru-mexico"],
    addOns: ["mini-karaoke", "pastel-personalizado", "fotografo-2h", "mimosa-bar", "upgrade-floral", "taller-floral", "papeleria-personalizada", "regalo-homenajeada", "video-recap", "memory-capsule-premium", "arco-globos-organico", "mesa-postres"],
    costs: [
      { category: "FOOD", description: "Café, jugos y mocktail de bienvenida (fuera del menú)", amountCents: mx(160), perGuest: true },
      { category: "FLOWERS", description: "Flores y follaje para mesa de celebración", amountCents: mx(1_500), perGuest: false },
      { category: "STAFF", description: "Anfitriona y mesera (base)", amountCents: mx(2_800), perGuest: false },
      { category: "CONSUMABLES", description: "Espumoso para brindis, velas y desechables", amountCents: mx(120), perGuest: true },
      { category: "TRANSPORT", description: "Carga y traslado", amountCents: mx(300), perGuest: false },
      { category: "OTHER", description: "Letrero de bienvenida y lavandería", amountCents: mx(450), perGuest: false },
    ],
    inventory: [...STANDARD_TABLE, { sku: "COP-CHA-01", quantity: 1, perGuest: true }, { sku: "PIZ-01", quantity: 1, perGuest: false }],
    faqs: [
      { question: "¿Puedo llevar mi propio pastel?", answer: "Claro. Lo recibimos, lo emplatamos y preparamos el momento de las velitas. Si prefieres, podemos encargarnos con nuestro add-on de pastel personalizado.", category: "menu" },
      { question: "¿Incluye decoración con globos?", answer: "La experiencia base incluye flores, velas y letrero. Los globos orgánicos se agregan como add-on para que combinen con tu paleta.", category: "general" },
    ],
  },
  {
    slug: "karaoke-mimosas",
    name: "Karaoke & Mimosas",
    tagline: "Brunch, burbujas y el micrófono abierto para todas.",
    description: [
      "Nuestra experiencia más ruidosa (en el mejor sentido). Montamos una mesa divertida, una barra de mimosas con jugos naturales y un equipo de karaoke profesional con pantalla y dos micrófonos inalámbricos.",
      "Mientras ustedes cantan, nosotras servimos el brunch, rellenamos copas y cuidamos que la fiesta no pierda el ritmo. Ideal para despedidas de soltera y cumpleaños con mucha energía.",
      "Al final desmontamos todo y tu casa queda como si nada… salvo por las mejores historias.",
    ].join("\n\n"),
    type: "THEMED",
    occasions: ["BACHELORETTE", "BIRTHDAY", "FRIENDS_BRUNCH"],
    basePriceCents: mx(17_900),
    extraGuestPriceCents: mx(1_800),
    extraGuestCostCents: mx(640),
    durationMinutes: 240,
    includes: [
      "Equipo de karaoke profesional con 2 micrófonos inalámbricos",
      "Catálogo de más de 20,000 canciones en español e inglés",
      "Barra de mimosas con jugos naturales y espumoso",
      "Mesa decorada con flores y detalles divertidos",
      "Menú de brunch a elegir",
      "Anfitriona que arma la fiesta y cuida el ritmo",
      "4 horas de experiencia",
      "Montaje, desmontaje y limpieza",
    ],
    cover: "karaoke",
    images: ["karaoke", "mimosas", "gallery-05", "gallery-02"],
    featured: true,
    styles: ["divertido", "colorido", "minimal"],
    menus: ["brunch-clasico", "brunch-garden", "brunch-premium"],
    addOns: ["pastel-personalizado", "fotografo-2h", "upgrade-floral", "papeleria-personalizada", "regalo-homenajeada", "video-recap", "memory-capsule-premium", "arco-globos-organico", "mesa-postres"],
    costs: [
      { category: "FOOD", description: "Base de mimosas (espumoso y jugos), café y aguas (fuera del menú)", amountCents: mx(230), perGuest: true },
      { category: "FLOWERS", description: "Flores y detalles de mesa", amountCents: mx(1_100), perGuest: false },
      { category: "STAFF", description: "Anfitriona, mesera y técnico de karaoke", amountCents: mx(3_000), perGuest: false },
      { category: "CONSUMABLES", description: "Hielo, fruta para mimosas y desechables", amountCents: mx(130), perGuest: true },
      { category: "TRANSPORT", description: "Traslado de equipo de audio y mobiliario", amountCents: mx(400), perGuest: false },
      { category: "OTHER", description: "Licencia de catálogo, baterías y lavandería", amountCents: mx(650), perGuest: false },
    ],
    inventory: [
      ...STANDARD_TABLE,
      { sku: "COP-CHA-01", quantity: 1, perGuest: true },
      { sku: "KAR-01", quantity: 1, perGuest: false },
      { sku: "MIC-01", quantity: 2, perGuest: false },
      { sku: "BOC-01", quantity: 1, perGuest: false },
      { sku: "EXT-01", quantity: 1, perGuest: false },
    ],
    faqs: [
      { question: "¿Qué pasa con el ruido y los vecinos?", answer: "Ajustamos el volumen a tu espacio y recomendamos terminar el karaoke antes de las 21:00. Si vives en edificio, te ayudamos con un aviso amable para la administración.", category: "logistica" },
      { question: "¿Las mimosas pueden ser sin alcohol?", answer: "Sí. Siempre llevamos una versión sin alcohol con espumoso de manzana o agua mineral para quien la prefiera.", category: "menu" },
    ],
  },
  {
    slug: "bridal-brunch",
    name: "Bridal Brunch",
    tagline: "Para celebrar a la novia rodeada de las que más la quieren.",
    description: [
      "Una mesa nupcial con flores blancas, follaje y cristalería fina para celebrar a la novia antes del gran día. Brindamos con espumoso al llegar y servimos un brunch a elegir, con opción premium.",
      "Preparamos un detalle sorpresa para la novia y una dinámica de consejos y buenos deseos que se convierte en recuerdo. Si quieres, sumamos taller floral o fotógrafa.",
      "Todo coordinado por nuestro equipo para que la dama de honor también disfrute.",
    ].join("\n\n"),
    type: "CELEBRATION",
    occasions: ["BRIDAL", "BACHELORETTE", "BABY_BRUNCH"],
    basePriceCents: mx(19_900),
    extraGuestPriceCents: mx(1_900),
    extraGuestCostCents: mx(680),
    durationMinutes: 240,
    includes: [
      "Mesa nupcial con flores blancas y follaje",
      "Cristalería fina y candelabros",
      "Brindis de bienvenida con espumoso",
      "Menú de brunch a elegir con opción premium",
      "Detalle sorpresa para la novia",
      "Dinámica de consejos y buenos deseos",
      "Papelería de mesa con el nombre de la novia",
      "Coordinadora y mesera durante 4 horas",
      "Montaje, desmontaje y limpieza",
    ],
    cover: "bridal-flowers",
    images: ["bridal-flowers", "gallery-04", "gallery-03", "mimosas"],
    featured: true,
    styles: ["elegante", "romantico", "minimal", "natural"],
    menus: ["brunch-clasico", "brunch-garden", "brunch-sin-gluten", "brunch-premium"],
    addOns: ["pastel-personalizado", "fotografo-2h", "mimosa-bar", "upgrade-floral", "taller-floral", "papeleria-personalizada", "regalo-homenajeada", "video-recap", "memory-capsule-premium", "arco-globos-organico", "mesa-postres"],
    costs: [
      { category: "FOOD", description: "Espumoso de bienvenida, café y jugos (fuera del menú)", amountCents: mx(200), perGuest: true },
      { category: "FLOWERS", description: "Flores blancas premium y follaje", amountCents: mx(2_300), perGuest: false },
      { category: "STAFF", description: "Coordinadora y mesera (4 h)", amountCents: mx(3_000), perGuest: false },
      { category: "CONSUMABLES", description: "Velas, detalles de mesa y desechables", amountCents: mx(140), perGuest: true },
      { category: "TRANSPORT", description: "Traslado de cristalería y candelabros", amountCents: mx(400), perGuest: false },
      { category: "OTHER", description: "Detalle para la novia, papelería y lavandería", amountCents: mx(500), perGuest: false },
    ],
    inventory: [...STANDARD_TABLE, { sku: "COP-CHA-01", quantity: 1, perGuest: true }, { sku: "CAN-01", quantity: 4, perGuest: false }, { sku: "CAM-01", quantity: 1, perGuest: false }],
    faqs: [
      { question: "¿La novia tiene que saber?", answer: "¡Puede ser sorpresa! Coordinamos todo con la dama de honor o con quien organice, incluso los pagos y el acceso al portal.", category: "general" },
      { question: "¿Pueden incluir dinámicas o juegos?", answer: "Incluimos una dinámica de consejos y buenos deseos. Si quieren algo más (trivia de la pareja, por ejemplo) lo armamos con gusto.", category: "general" },
    ],
  },
  {
    slug: "peru-x-mexico",
    name: "Perú x México",
    tagline: "Dos cocinas que se entienden de maravilla, en tu mesa.",
    description: [
      "Un brunch temático que celebra nuestras raíces: textiles andinos, papel picado artesanal y una mesa llena de color. La chef prepara en sitio y la conversación hace el resto.",
      "Recomendamos el upgrade Sabores Perú x México: ceviche clásico con leche de tigre, causa limeña, chilaquiles a la huancaína y suspiro limeño para cerrar.",
      "Perfecto para reunir a las amigas de siempre, celebrar un cumpleaños distinto o recibir a alguien que viene de lejos.",
    ].join("\n\n"),
    type: "THEMED",
    occasions: ["FRIENDS_BRUNCH", "BIRTHDAY", "GATHERING", "CORPORATE"],
    basePriceCents: mx(18_500),
    extraGuestPriceCents: mx(1_800),
    extraGuestCostCents: mx(640),
    durationMinutes: 210,
    includes: [
      "Mesa temática con textiles andinos y papel picado artesanal",
      "Chef en sitio durante toda la experiencia",
      "Menú de brunch a elegir (recomendado: Sabores Perú x México)",
      "Chilcano sin alcohol y aguas frescas de la casa",
      "Playlist de música criolla y mexicana",
      "Mesera durante 3.5 horas",
      "Montaje, desmontaje y limpieza",
    ],
    cover: "peru-mexico",
    images: ["peru-mexico", "gallery-07", "brunch-table"],
    featured: false,
    styles: ["colorido", "natural", "divertido"],
    menus: ["brunch-clasico", "brunch-garden", "sabores-peru-mexico"],
    addOns: ["mini-karaoke", "pastel-personalizado", "fotografo-2h", "upgrade-floral", "papeleria-personalizada", "video-recap", "memory-capsule-premium"],
    costs: [
      { category: "FOOD", description: "Chilcano sin alcohol, aguas de la casa y café (fuera del menú)", amountCents: mx(180), perGuest: true },
      { category: "FLOWERS", description: "Flores de color y follaje", amountCents: mx(1_300), perGuest: false },
      { category: "STAFF", description: "Chef en sitio y mesera", amountCents: mx(3_200), perGuest: false },
      { category: "CONSUMABLES", description: "Hielo, desechables y especias", amountCents: mx(130), perGuest: true },
      { category: "TRANSPORT", description: "Traslado de equipo de cocina", amountCents: mx(350), perGuest: false },
      { category: "OTHER", description: "Textiles, papel picado y lavandería", amountCents: mx(500), perGuest: false },
    ],
    inventory: [...STANDARD_TABLE, { sku: "TAB-01", quantity: 2, perGuest: false }, { sku: "BOC-01", quantity: 1, perGuest: false }],
    faqs: [
      { question: "¿El ceviche es seguro si alguna invitada está embarazada?", answer: "Para invitadas embarazadas preparamos una versión con pescado cocido o una causa vegetariana. Sólo indícalo en el RSVP.", category: "menu" },
      { question: "¿Pueden hacerlo más picante?", answer: "Sí. Por defecto lo servimos medio y llevamos ají amarillo, rocoto y salsa macha aparte para quien quiera más.", category: "menu" },
    ],
  },
];

// -----------------------------------------------------------------------------
// Proveedores
// -----------------------------------------------------------------------------
export const VENDORS: {
  key: string;
  name: string;
  category: VendorCategory;
  contactName: string;
  phone: string;
  email: string;
  slaNotes: string;
  notes?: string;
  status?: VendorStatus;
  rating: number;
}[] = [
  { key: "flores", name: "Flores La Merced Rivera", category: "FLOWERS", contactName: "Javier Rivera", phone: "+52 55 1234 5601", email: "pedidos.floresrivera@example.com", slaNotes: "Pedidos con 72 h de anticipación. Entrega en Bodega Granada antes de las 9:00.", rating: 5 },
  { key: "botanica", name: "Botánica Roma Estudio Floral", category: "FLOWERS", contactName: "Elisa Domínguez", phone: "+52 55 1234 5602", email: "hola.botanicaroma@example.com", slaNotes: "Flores premium (peonías, ranúnculos). Pedido mínimo $1,500; 5 días de anticipación.", rating: 4 },
  { key: "panaderia", name: "Panadería Masa Madre Coyoacán", category: "FOOD", contactName: "Tomás Aguirre", phone: "+52 55 1234 5603", email: "ventas.masamadre@example.com", slaNotes: "Pan horneado el mismo día; recolección a partir de las 7:00.", rating: 5 },
  { key: "pescados", name: "Pescados y Mariscos Doña Tere (Mercado San Juan)", category: "FOOD", contactName: "Teresa Olvera", phone: "+52 55 1234 5604", email: "donatere.sanjuan@example.com", slaNotes: "Pescado fresco para ceviche: pedido el día anterior antes de las 14:00.", rating: 4 },
  { key: "pasteleria", name: "Pastelería Dulce Alondra", category: "PASTRY", contactName: "Alondra Medina", phone: "+52 55 1234 5605", email: "pedidos.dulcealondra@example.com", slaNotes: "Pasteles personalizados con 5 días de anticipación; entrega a domicilio en Polanco y Granada.", rating: 5 },
  { key: "fletes", name: "Fletes Hermanos Juárez", category: "TRANSPORT", contactName: "Raúl Juárez", phone: "+52 55 1234 5606", email: "fletes.juarez@example.com", slaNotes: "Camioneta de 1.5 t con chofer; reservar con 48 h.", rating: 4 },
  { key: "mobiliario", name: "Renta de Mobiliario Casa Olivo", category: "FURNITURE", contactName: "Sandra Olivo", phone: "+52 55 1234 5607", email: "rentas.casaolivo@example.com", slaNotes: "Sillas, mesas y carpas. Entrega y recolección incluidas en zona Polanco.", rating: 4 },
  { key: "foto", name: "Luz de Domingo Fotografía", category: "PHOTO", contactName: "Mariel Cruz", phone: "+52 55 1234 5608", email: "estudio.luzdedomingo@example.com", slaNotes: "Galería editada en 5 días hábiles; video recap en 72 h.", rating: 5 },
  { key: "cava", name: "La Cava del Valle — Vinos y Espumosos", category: "BEVERAGES", contactName: "Óscar Valle", phone: "+52 55 1234 5609", email: "pedidos.cavadelvalle@example.com", slaNotes: "Espumoso mexicano a consignación: se devuelven botellas cerradas.", rating: 5 },
  { key: "globos", name: "Globos Orgánicos Mía", category: "OTHER", contactName: "Mía Castañeda", phone: "+52 55 1234 5610", email: "hola.globosmia@example.com", slaNotes: "Arcos con 5 días de anticipación; montaje 2 h antes del evento.", rating: 4 },
  { key: "imprenta", name: "Imprenta Papel Algodón", category: "OTHER", contactName: "Bruno Salazar", phone: "+52 55 1234 5611", email: "taller.papelalgodon@example.com", slaNotes: "Papelería personalizada en 7 días hábiles; pruebas digitales en 48 h.", rating: 3, status: "INACTIVE", notes: "Pausado: retrasos en las últimas dos entregas." },
];

// -----------------------------------------------------------------------------
// Staff
// -----------------------------------------------------------------------------
export const STAFF: {
  key: "lupita" | "carlos" | "alma" | "diego" | "roberto" | "mariel";
  name: string;
  primaryFunction: StaffFunction;
  phone: string;
  email: string;
  rateCents: number;
  rateType: StaffRateType;
  availableWeekdays: number[];
  availabilityNotes?: string;
  userKey?: "lupita" | "carlos";
}[] = [
  { key: "lupita", name: "Lupita Hernández", primaryFunction: "COORDINATOR", phone: "+52 55 3301 1101", email: "staff@ivonne-rosa.test", rateCents: mx(1_200), rateType: "PER_EVENT", availableWeekdays: [0, 2, 3, 4, 5, 6], userKey: "lupita" },
  { key: "carlos", name: "Carlos Méndez", primaryFunction: "CHEF", phone: "+52 55 3301 1102", email: "staff2@ivonne-rosa.test", rateCents: mx(1_500), rateType: "PER_EVENT", availableWeekdays: [0, 3, 4, 5, 6], availabilityNotes: "Martes da clases en escuela de cocina.", userKey: "carlos" },
  { key: "alma", name: "Alma Juárez", primaryFunction: "SERVER", phone: "+52 55 3301 1103", email: "alma.juarez@example.com", rateCents: mx(120), rateType: "PER_HOUR", availableWeekdays: [0, 5, 6] },
  { key: "diego", name: "Diego Sánchez", primaryFunction: "SETUP", phone: "+52 55 3301 1104", email: "diego.sanchez@example.com", rateCents: mx(600), rateType: "PER_EVENT", availableWeekdays: [0, 2, 4, 5, 6] },
  { key: "roberto", name: "Roberto Flores", primaryFunction: "DRIVER", phone: "+52 55 3301 1105", email: "roberto.flores@example.com", rateCents: mx(500), rateType: "PER_EVENT", availableWeekdays: [0, 1, 2, 3, 4, 5, 6], availabilityNotes: "Tiene camioneta propia (Urvan)." },
  { key: "mariel", name: "Mariel Cruz", primaryFunction: "PHOTOGRAPHER", phone: "+52 55 3301 1106", email: "mariel.cruz@example.com", rateCents: mx(1_800), rateType: "PER_EVENT", availableWeekdays: [0, 5, 6], availabilityNotes: "Fotógrafa externa de Luz de Domingo." },
];

// -----------------------------------------------------------------------------
// Contenido
// -----------------------------------------------------------------------------
export const TESTIMONIALS: { authorName: string; occasion: string; body: string; rating: number }[] = [
  { authorName: "Valeria C.", occasion: "Perú x México · Polanco", body: "Llegué a mi propia casa y parecía otra. La mesa, el ceviche, la música… mis amigas siguen hablando de ese brunch. Ivonne y Rosa cuidaron cada detalle.", rating: 5 },
  { authorName: "Paola L.", occasion: "Bridal Brunch · Granada", body: "Organizar el bridal de mi mejor amiga desde otro país parecía imposible. Ellas se encargaron de todo y yo sólo tuve que llegar a llorar de emoción.", rating: 5 },
  { authorName: "Ana Paula R.", occasion: "Signature Brunch · Granada", body: "El montaje fue precioso y la comida deliciosa. Me encantó no tener que lavar ni un plato.", rating: 5 },
  { authorName: "Sofía N.", occasion: "Birthday Table · Polanco", body: "Desde la cotización hasta el pastel, todo fue clarísimo y muy cálido. Se sintió como un regalo para mí y para mis amigas.", rating: 5 },
  { authorName: "Daniela O.", occasion: "Karaoke & Mimosas · Irrigación", body: "Pensé que el karaoke iba a ser de relleno y terminó siendo lo mejor del día. ¡Las mimosas no paraban!", rating: 5 },
];

export const GENERAL_FAQS: { question: string; answer: string; category: string }[] = [
  { category: "general", question: "¿Qué es exactamente Ivonne & Rosa?", answer: "Diseñamos y montamos experiencias íntimas (brunches, cumpleaños, bridal showers, despedidas) para 6 a 12 personas en tu casa, terraza o jardín. Llevamos mesa, flores, comida, servicio y nos vamos dejando todo limpio." },
  { category: "general", question: "¿En qué zonas trabajan?", answer: "Por ahora en Polanco, Granada/Ampliación Granada e Irrigación (CDMX). Lomas de Chapultepec y Anzures llegan muy pronto; si estás fuera de zona, escríbenos y lo revisamos." },
  { category: "reservas", question: "¿Con cuánta anticipación debo reservar?", answer: "Recomendamos 2 a 3 semanas. El mínimo es de 5 días, sujeto a disponibilidad. Los fines de semana se llenan rápido." },
  { category: "reservas", question: "¿Cuántas invitadas pueden ser?", answer: "Nuestras experiencias están pensadas para 6 a 12 invitadas. Para grupos más grandes hacemos una propuesta especial." },
  { category: "pagos", question: "¿Cómo se aparta la fecha?", answer: "Con un anticipo del 50% al aceptar la cotización. El saldo se liquida a más tardar 3 días antes del evento, en línea o por transferencia." },
  { category: "pagos", question: "¿Los precios incluyen IVA?", answer: "Sí. Todos nuestros precios incluyen IVA y si necesitas factura la emitimos sin costo extra." },
  { category: "menu", question: "¿Pueden adaptar el menú a alergias o dietas especiales?", answer: "Siempre. Cada invitada puede indicar sus restricciones en el RSVP y la chef adapta su plato: vegetariano, vegano, sin gluten, sin lactosa o alergias específicas." },
  { category: "logistica", question: "¿Qué necesito tener en casa?", answer: "Sólo el espacio y acceso a una toma de corriente. Llevamos vajilla, cristalería, mantelería, flores y equipo de cocina. Si hace falta mesa o sillas, también." },
];
