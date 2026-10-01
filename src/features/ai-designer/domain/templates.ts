import type { AddOnCategory, DietaryRestriction, Occasion } from "@prisma/client";
import type { Vibe } from "../constants";

/**
 * Plantillas curadas en español de México para nombres, conceptos, actividades,
 * mesa y playlist. El motor elige entre ellas de forma determinista (hash del brief).
 */

export const OCCASION_TEXT: Record<Occasion, { noun: string; phrase: string }> = {
  BIRTHDAY: { noun: "Cumple", phrase: "un cumpleaños" },
  FRIENDS_BRUNCH: { noun: "Brunch", phrase: "un brunch entre amigas" },
  BACHELORETTE: { noun: "Despedida", phrase: "una despedida de soltera" },
  BRIDAL: { noun: "Bridal Brunch", phrase: "un bridal brunch" },
  BABY_BRUNCH: { noun: "Baby Brunch", phrase: "un baby brunch" },
  GATHERING: { noun: "Reunión", phrase: "una reunión" },
  CORPORATE: { noun: "Brunch Boutique", phrase: "un encuentro corporativo boutique" },
  OTHER: { noun: "Celebración", phrase: "una celebración" },
};

/** Patrones de nombre conceptual por vibra ({o} = sustantivo de la ocasión). */
export const NAME_PATTERNS: Record<Vibe, string[]> = {
  relajado: ["{o} Sobremesa Infinita", "{o} Domingo sin Prisa", "{o} Café y Calma"],
  glam: ["Noche de Divas y Mimosas", "{o} Dorado y Burbujas", "{o} Champaña y Perlas"],
  divertido: ["{o} Confeti y Carcajadas", "{o} Pop y Burbujas", "{o} Modo Fiesta"],
  intimo: ["{o} Entre Nosotras", "{o} Mesa de Confidencias", "{o} Círculo Cercano"],
  botanico: ["{o} Jardín Secreto", "{o} Entre Flores", "{o} Invernadero"],
  romantico: ["{o} Rosa Pastel", "{o} a la Luz de las Velas", "{o} Carta de Amor"],
  minimal: ["{o} Lino y Luz", "{o} en Blanco", "{o} Esencial"],
  fiestero: ["{o} Micrófono Abierto", "{o} Hasta el Último Brindis", "{o} Pista Encendida"],
  cultural: ["{o} Raíces y Sabores", "{o} Viaje de Sabores", "{o} Sabores con Historia"],
};

export const VIBE_CONCEPT: Record<Vibe, string> = {
  relajado: "sin prisas, con café de especialidad y una sobremesa que se alarga",
  glam: "con brillo dorado, burbujas y una mesa digna de alfombra roja",
  divertido: "lleno de color, risas y detalles que invitan a la fiesta",
  intimo: "pensado para conversar de cerca, con velas y una mesa que abraza",
  botanico: "rodeado de flores de temporada, follaje fresco y luz natural",
  romantico: "en tonos suaves, con rosas, velas y detalles hechos con cariño",
  minimal: "de líneas limpias, blancos rotos y una sola flor protagonista",
  fiestero: "con música arriba, mimosas y energía hasta el último brindis",
  cultural: "que celebra raíces, sabores con historia y artesanía hecha a mano",
};

/** Aperturas del primer párrafo (no repiten el concepto). */
export const VIBE_OPENERS: Record<Vibe, string[]> = {
  relajado: [
    "Imaginamos una mañana sin relojes: café recién hecho, pan dulce tibio y una sobremesa que nadie quiere terminar.",
    "La idea es simple: bajar el ritmo, servir algo rico y dejar que la conversación haga lo suyo.",
  ],
  glam: [
    "Imaginamos una mesa que brilla: cristal, toques dorados y copas listas para el primer brindis.",
    "Todo pensado para que se sientan de alfombra roja, de la bienvenida al último brindis.",
  ],
  divertido: [
    "Imaginamos una mañana llena de risas: colores alegres, detalles juguetones y música para cantar.",
    "La consigna es pasarla increíble: juegos, color y una mesa que invita a quedarse.",
  ],
  intimo: [
    "Imaginamos una mesa cercana, de las que invitan a contar secretos entre velas y café.",
    "Pocas personas, mucha conversación y detalles que se sienten hechos a mano.",
  ],
  botanico: [
    "Imaginamos un jardín sobre la mesa: flores de temporada, follaje fresco y luz natural.",
    "Flores, verde y luz suave: una mesa que se siente como una tarde en el jardín.",
  ],
  romantico: [
    "Imaginamos una mesa en tonos suaves, con rosas, velas encendidas y detalles hechos con cariño.",
    "Todo en clave romántica: pétalos, luz cálida y mensajes que se quedan en el corazón.",
  ],
  minimal: [
    "Imaginamos una mesa serena: blancos rotos, líneas limpias y una sola flor protagonista.",
    "Menos es más: lo esencial, muy bien hecho, para que el centro sea la conversación.",
  ],
  fiestero: [
    "Imaginamos una celebración con la música arriba, brindis constantes y muchas ganas de bailar.",
    "La energía manda: buena música, burbujas y momentos para cantar y bailar.",
  ],
  cultural: [
    "Imaginamos una mesa que cuenta historias: sabores con raíces, textiles artesanales y mucho color.",
    "Una celebración con identidad: cocina con historia, artesanía y tradiciones para compartir.",
  ],
};

export const VIBE_ADJECTIVE: Record<Vibe, string> = {
  relajado: "relajado",
  glam: "glam",
  divertido: "divertido",
  intimo: "íntimo",
  botanico: "botánico",
  romantico: "romántico",
  minimal: "minimalista",
  fiestero: "fiestero",
  cultural: "cultural",
};

/** Afinidad vibra → slugs de estilo (catálogo configurable: se complementa con palabras clave). */
export const VIBE_STYLE_SLUGS: Record<Vibe, string[]> = {
  relajado: ["natural", "minimal"],
  glam: ["elegante"],
  divertido: ["divertido", "colorido"],
  intimo: ["romantico", "natural"],
  botanico: ["natural", "romantico"],
  romantico: ["romantico", "elegante"],
  minimal: ["minimal", "elegante"],
  fiestero: ["divertido", "colorido"],
  cultural: ["colorido", "natural"],
};

/** Palabras clave (normalizadas, sin acentos) asociadas a cada vibra. */
export const VIBE_KEYWORDS: Record<Vibe, string[]> = {
  relajado: ["natural", "lino", "tarde", "calma", "sobremesa", "tranquil", "cafe"],
  glam: ["elegante", "cristal", "dorad", "laton", "fina", "espumoso", "premium", "candelabro"],
  divertido: ["divertid", "globos", "alegre", "fiesta", "karaoke", "color", "ruidos"],
  intimo: ["intim", "velas", "suave", "conversa", "reencuentro", "detalle"],
  botanico: ["flor", "follaje", "jardin", "campo", "floral", "huerto", "temporada"],
  romantico: ["romantic", "rosas", "blush", "velas", "nupcial", "novia", "suave"],
  minimal: ["minimal", "blanco", "limpi", "sobri", "menos es mas", "lineas"],
  fiestero: ["fiesta", "karaoke", "energia", "ruidos", "microfono", "despedida", "mimosa", "cantan"],
  cultural: ["mexic", "peru", "raices", "artesan", "papel picado", "fusion", "autor", "cocinas"],
};

/** Afinidad vibra → categoría de add-on (puntos). */
export const VIBE_ADDON_CATEGORY: Record<Vibe, Partial<Record<AddOnCategory, number>>> = {
  relajado: { DRINKS: 4, FOOD: 3, EXPERIENCE: 3 },
  glam: { DECOR: 6, PERSONALIZATION: 5, PHOTO: 6, DRINKS: 5 },
  divertido: { ENTERTAINMENT: 10, DRINKS: 5, DECOR: 3, PHOTO: 2 },
  intimo: { PERSONALIZATION: 6, EXPERIENCE: 5, FOOD: 2 },
  botanico: { DECOR: 4, EXPERIENCE: 4 },
  romantico: { DECOR: 5, PERSONALIZATION: 5, FOOD: 3 },
  minimal: { PERSONALIZATION: 4, PHOTO: 3 },
  fiestero: { ENTERTAINMENT: 12, DRINKS: 6, PHOTO: 3 },
  cultural: { EXPERIENCE: 6, FOOD: 3 },
};

/** Afinidad vibra → palabras clave del add-on (puntos; negativos penalizan). */
export const VIBE_ADDON_KEYWORDS: Record<Vibe, Record<string, number>> = {
  relajado: { mimosa: 2, postre: 2 },
  glam: { mimosa: 3, espumoso: 3, fotograf: 3, video: 2 },
  divertido: { globos: 4, karaoke: 4 },
  intimo: { regalo: 4, recuerdo: 3, album: 3, memory: 3 },
  botanico: { flor: 8, floral: 2 },
  romantico: { flor: 3, pastel: 3, regalo: 3 },
  minimal: { globos: -6, karaoke: -4 },
  fiestero: { karaoke: 4, mimosa: 4, video: 3 },
  cultural: { taller: 4 },
};

/** Afinidad ocasión → palabras clave del add-on (puntos). */
export const OCCASION_ADDON_KEYWORDS: Record<Occasion, Record<string, number>> = {
  BIRTHDAY: { pastel: 8, regalo: 5, globos: 3 },
  FRIENDS_BRUNCH: { mimosa: 6, taller: 3 },
  BACHELORETTE: { karaoke: 6, mimosa: 6, video: 4 },
  BRIDAL: { floral: 6, papeleria: 5, taller: 4, fotograf: 3 },
  BABY_BRUNCH: { postre: 6, papeleria: 4, globos: 4 },
  GATHERING: { mimosa: 3, postre: 3 },
  CORPORATE: { fotograf: 5, papeleria: 5, taller: 4 },
  OTHER: {},
};

/** Vibra → etiquetas de menú preferidas (normalizadas). */
export const VIBE_MENU_TAGS: Record<Vibe, Record<string, number>> = {
  relajado: { clasico: 3, ligero: 3 },
  glam: { premium: 8, celebracion: 4 },
  divertido: { clasico: 3, favorito: 3 },
  intimo: { "de temporada": 3, clasico: 2 },
  botanico: { "de temporada": 5, ligero: 4, vegetariano: 3 },
  romantico: { premium: 4, celebracion: 3 },
  minimal: { ligero: 4, clasico: 2 },
  fiestero: { clasico: 3, favorito: 3 },
  cultural: { fusion: 8, "de autor": 6, tematico: 6 },
};

export const DIETARY_PHRASES: Record<DietaryRestriction, string> = {
  VEGETARIAN: "vegetarianas",
  VEGAN: "veganas",
  GLUTEN_FREE: "sin gluten",
  LACTOSE_FREE: "sin lactosa",
  NUT_ALLERGY: "sin nueces",
  SEAFOOD_ALLERGY: "sin mariscos",
  KOSHER: "kosher",
  HALAL: "halal",
  OTHER: "para la restricción que nos compartas",
};

export const SEAFOOD_WORDS = [
  "ceviche",
  "pescado",
  "salmon",
  "camaron",
  "tiradito",
  "marisco",
  "atun",
  "pulpo",
  "ostion",
];
/** Proteínas animales (palabra completa, normalizada) para penalizar menús en grupos vegetarianos/veganos. */
export const MEAT_WORDS = [
  "pollo",
  "jamon",
  "rib eye",
  "res",
  "cerdo",
  "carne",
  "chorizo",
  "tocino",
  "bacon",
  "salmon",
  "pescado",
  "atun",
  "camaron",
  "charcuteria",
  "pavo",
  "arrachera",
  "cochinita",
  "barbacoa",
  "ceviche",
  "tiradito",
  "machaca",
];
export const NUT_WORDS = ["nuez", "almendra", "cacahuate", "pistache", "avellana", "nueces"];

export const OCCASION_ACTIVITIES: Record<Occasion, string[]> = {
  BIRTHDAY: [
    "Ronda de deseos: cada invitada comparte un deseo para su nuevo año",
    "Trivia «¿Qué tanto conoces a la cumpleañera?» con premios sorpresa",
    "Momento de velitas con su canción favorita sonando de fondo",
  ],
  FRIENDS_BRUNCH: [
    "Intercambio de recomendaciones: libros, series y lugares favoritos",
    "Juego de anécdotas: «la primera vez que nos conocimos»",
    "Brindis por los planes que vienen",
  ],
  BACHELORETTE: [
    "Trivia de la novia: ¿quién la conoce mejor?",
    "Votos de amigas: consejos y buenos deseos por escrito para la novia",
    "Reto de fotos con props para la despedida",
  ],
  BRIDAL: [
    "Libro de consejos y buenos deseos para la novia",
    "Dinámica «¿Quién lo dijo: la novia o el novio?»",
    "Brindis de bienvenida dedicado a la novia",
  ],
  BABY_BRUNCH: [
    "Adivina la fecha y el peso del bebé",
    "Cartas para el bebé que leerá cuando crezca",
    "Mural de buenos deseos para la futura mamá",
  ],
  GATHERING: [
    "Ronda de «lo mejor de mi año»",
    "Brindis de reencuentro",
    "Tarjetas de preguntas para conversar de verdad",
  ],
  CORPORATE: [
    "Rompehielo con tarjetas de conversación",
    "Brindis de reconocimiento al equipo",
    "Ronda de intenciones para el próximo trimestre",
  ],
  OTHER: ["Brindis de bienvenida dedicado a quien festejamos", "Ronda de anécdotas y buenos deseos"],
};

export const VIBE_ACTIVITIES: Record<Vibe, string[]> = {
  relajado: [
    "Sobremesa con tarjetas de preguntas para conversar sin prisa",
    "Estación de café de especialidad para servirse a su ritmo",
  ],
  glam: ["Photo moment con fondo dorado y copas en alto", "Pasarela de outfits con votación divertida"],
  divertido: ["Juego de mímica por equipos entre plato y plato", "Bingo de anécdotas con premios sorpresa"],
  intimo: ["Ronda de cartas escritas a mano para la homenajeada", "Círculo de gratitud antes del postre"],
  botanico: [
    "Cada invitada elige una flor de la mesa para llevarse a casa",
    "Brindis en el jardín (o junto a la ventana más luminosa)",
  ],
  romantico: [
    "Brindis con cartas de cariño",
    "Playlist dedicada con las canciones favoritas de la homenajeada",
  ],
  minimal: ["Conversación guiada con tarjetas de preguntas", "Momento de fotos con luz natural"],
  fiestero: ["Coreografía sorpresa para la homenajeada", "Ronda de brindis con dedicatorias"],
  cultural: [
    "Lotería mexicana con premios para las ganadoras",
    "Mini recorrido por el menú: la historia detrás de cada platillo",
  ],
};

/** Actividades ligadas a extras/experiencias (clave = raíz en el texto normalizado). */
export const FEATURE_ACTIVITIES: ReadonlyArray<{ key: string; text: string }> = [
  { key: "karaoke", text: "Batalla de karaoke por equipos con las canciones favoritas del grupo" },
  { key: "taller", text: "Taller floral guiado: cada invitada arma y se lleva su arreglo" },
  { key: "fotograf", text: "Sesión de retratos espontáneos con fotógrafa profesional" },
  { key: "mimosa", text: "Barra de mimosas para que cada quien cree su mezcla favorita" },
  { key: "video", text: "Mensajes en video de cada invitada para el recap" },
  { key: "memory", text: "Memory Capsule: cada invitada sube sus fotos favoritas del día" },
];

export const STYLE_TABLE: Record<string, string> = {
  natural:
    "Mesa larga con mantel de lino crudo, servilletas arena y centros bajos de follaje y flores de campo",
  elegante:
    "Mantel de lino blanco, cristalería fina, bajo platos de ratán y candelabros de latón con velas altas",
  romantico:
    "Mantel en tono blush, rosas de jardín en floreros ámbar y velas encendidas a lo largo de la mesa",
  divertido: "Mesa alegre con detalles en colores vivos, servilletas anudadas y mucho brillo",
  minimal: "Mantel blanco roto, vajilla de porcelana lisa y una sola variedad de flor en floreros de vidrio",
  colorido: "Textiles artesanales, papel picado y flores vibrantes en jarrones de barro",
};
export const DEFAULT_TABLE = "Mesa vestida con lino, vajilla de porcelana y flores de temporada";

export const VIBE_TABLE_DETAIL: Record<Vibe, string> = {
  relajado: "jarras de agua fresca al centro para que todas se sirvan sin prisa",
  glam: "toques dorados y copas flauta listas para el brindis",
  divertido: "detalles juguetones y tarjetas con mensajes divertidos",
  intimo: "velas bajas y una mesa compacta para conversar de cerca",
  botanico: "follaje cayendo sobre el camino de mesa y flores de temporada",
  romantico: "pétalos sueltos y velas en distintas alturas",
  minimal: "mucho espacio en blanco y un solo elemento protagonista",
  fiestero: "props para fotos y una esquina libre para cantar y bailar",
  cultural: "textiles bordados y cerámica artesanal",
};

export const VIBE_PLAYLIST: Record<Vibe, string> = {
  relajado: "Bossa nova, jazz suave y acústicos en español para una mañana sin prisa.",
  glam: "Pop diva y disco: Beyoncé, Dua Lipa, Gloria Trevi y ABBA para el brindis.",
  divertido: "Éxitos de los 2000, pop latino y canciones para cantar a todo pulmón.",
  intimo: "Indie suave, boleros modernos y voces femeninas de fondo para conversar.",
  botanico: "Folk luminoso, acústicos y bossa nova: como una tarde en el jardín.",
  romantico: "Baladas, boleros y clásicos románticos en español e inglés.",
  minimal: "Lo-fi, jazz instrumental y piano moderno, a volumen de conversación.",
  fiestero: "Reggaetón, pop latino e himnos para no soltar el micrófono.",
  cultural: "Música latinoamericana: cumbia, son, trova y fusiones contemporáneas.",
};

/** Géneros/artistas detectables en los gustos (normalizado → como se muestra). */
export const MUSIC_KEYWORDS: ReadonlyArray<[string, string]> = [
  ["reggaeton", "reggaetón"],
  ["k-pop", "K-pop"],
  ["kpop", "K-pop"],
  ["pop", "pop"],
  ["rock", "rock"],
  ["jazz", "jazz"],
  ["bossa", "bossa nova"],
  ["bolero", "boleros"],
  ["salsa", "salsa"],
  ["cumbia", "cumbia"],
  ["banda", "banda"],
  ["indie", "indie"],
  ["disco", "disco"],
  ["trova", "trova"],
  ["mariachi", "mariachi"],
  ["ranchera", "rancheras"],
  ["80s", "los 80"],
  ["ochentas", "los 80"],
  ["90s", "los 90"],
  ["noventas", "los 90"],
  ["2000", "los 2000"],
  ["taylor swift", "Taylor Swift"],
  ["bad bunny", "Bad Bunny"],
  ["karol g", "Karol G"],
  ["luis miguel", "Luis Miguel"],
  ["shakira", "Shakira"],
  ["beyonce", "Beyoncé"],
  ["harry styles", "Harry Styles"],
];

export const CLOSINGS: string[] = [
  "Tú sólo reúne a las tuyas: nosotras montamos, servimos y dejamos todo impecable.",
  "Llegamos antes que tus invitadas y nos vamos cuando la última taza está vacía; tú sólo disfruta.",
  "Nosotras nos encargamos de cada detalle para que tú sólo llegues a celebrar.",
];

export const NO_ADDONS_SENTENCES: string[] = [
  "Dejamos la propuesta ligera para cuidar tu presupuesto; siempre puedes sumar extras después.",
  "Mantuvimos la propuesta esencial para que rinda tu presupuesto: los extras pueden sumarse más adelante.",
];
