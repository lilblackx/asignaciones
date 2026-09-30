export const INITIAL_TECHNICIANS = [
  { name: 'GERARDO MOLERO', color: 'bg-fuchsia-500 text-white' },
  { name: 'REINEL BRAVO', color: 'bg-green-500 text-white' },
  { name: 'ABRAHAM JM', color: 'bg-cyan-400 text-black' },
  { name: 'EDGAR MONTERO', color: 'bg-yellow-400 text-black' },
  { name: 'JOSE SUAREZ', color: 'bg-purple-400 text-white' },
];

// Paleta de etiquetas de técnico en estilo "tenue": en oscuro, fondo con un
// tinte del color, texto claro del mismo matiz y borde fino (igual que los
// badges de tipo de trabajo); en claro, fondo pastel con texto oscuro. Los
// matices salen del ángulo áureo (i * 137.508° mod 360) para que cada color
// nuevo quede lejos de los anteriores. Van como literales porque Tailwind solo
// detecta clases escritas completas en el código fuente.
export const COLOR_PALETTE = [
  { label: 'Color 1', hue: 0, value: 'bg-[hsl(0_70%_92%)] text-[hsl(0_65%_28%)] border border-[hsl(0_45%_70%)] dark:bg-[hsl(0_45%_50%/0.18)] dark:text-[hsl(0_85%_78%)] dark:border-[hsl(0_50%_50%/0.45)]' },
  { label: 'Color 2', hue: 138, value: 'bg-[hsl(138_70%_92%)] text-[hsl(138_65%_28%)] border border-[hsl(138_45%_70%)] dark:bg-[hsl(138_45%_50%/0.18)] dark:text-[hsl(138_85%_78%)] dark:border-[hsl(138_50%_50%/0.45)]' },
  { label: 'Color 3', hue: 275, value: 'bg-[hsl(275_70%_92%)] text-[hsl(275_65%_28%)] border border-[hsl(275_45%_70%)] dark:bg-[hsl(275_45%_50%/0.18)] dark:text-[hsl(275_85%_78%)] dark:border-[hsl(275_50%_50%/0.45)]' },
  { label: 'Color 4', hue: 53, value: 'bg-[hsl(53_70%_92%)] text-[hsl(53_65%_28%)] border border-[hsl(53_45%_70%)] dark:bg-[hsl(53_45%_50%/0.18)] dark:text-[hsl(53_85%_78%)] dark:border-[hsl(53_50%_50%/0.45)]' },
  { label: 'Color 5', hue: 190, value: 'bg-[hsl(190_70%_92%)] text-[hsl(190_65%_28%)] border border-[hsl(190_45%_70%)] dark:bg-[hsl(190_45%_50%/0.18)] dark:text-[hsl(190_85%_78%)] dark:border-[hsl(190_50%_50%/0.45)]' },
  { label: 'Color 6', hue: 328, value: 'bg-[hsl(328_70%_92%)] text-[hsl(328_65%_28%)] border border-[hsl(328_45%_70%)] dark:bg-[hsl(328_45%_50%/0.18)] dark:text-[hsl(328_85%_78%)] dark:border-[hsl(328_50%_50%/0.45)]' },
  { label: 'Color 7', hue: 105, value: 'bg-[hsl(105_70%_92%)] text-[hsl(105_65%_28%)] border border-[hsl(105_45%_70%)] dark:bg-[hsl(105_45%_50%/0.18)] dark:text-[hsl(105_85%_78%)] dark:border-[hsl(105_50%_50%/0.45)]' },
  { label: 'Color 8', hue: 243, value: 'bg-[hsl(243_70%_92%)] text-[hsl(243_65%_28%)] border border-[hsl(243_45%_70%)] dark:bg-[hsl(243_45%_50%/0.18)] dark:text-[hsl(243_85%_78%)] dark:border-[hsl(243_50%_50%/0.45)]' },
  { label: 'Color 9', hue: 20, value: 'bg-[hsl(20_70%_92%)] text-[hsl(20_65%_28%)] border border-[hsl(20_45%_70%)] dark:bg-[hsl(20_45%_50%/0.18)] dark:text-[hsl(20_85%_78%)] dark:border-[hsl(20_50%_50%/0.45)]' },
  { label: 'Color 10', hue: 158, value: 'bg-[hsl(158_70%_92%)] text-[hsl(158_65%_28%)] border border-[hsl(158_45%_70%)] dark:bg-[hsl(158_45%_50%/0.18)] dark:text-[hsl(158_85%_78%)] dark:border-[hsl(158_50%_50%/0.45)]' },
  { label: 'Color 11', hue: 295, value: 'bg-[hsl(295_70%_92%)] text-[hsl(295_65%_28%)] border border-[hsl(295_45%_70%)] dark:bg-[hsl(295_45%_50%/0.18)] dark:text-[hsl(295_85%_78%)] dark:border-[hsl(295_50%_50%/0.45)]' },
  { label: 'Color 12', hue: 73, value: 'bg-[hsl(73_70%_92%)] text-[hsl(73_65%_28%)] border border-[hsl(73_45%_70%)] dark:bg-[hsl(73_45%_50%/0.18)] dark:text-[hsl(73_85%_78%)] dark:border-[hsl(73_50%_50%/0.45)]' },
  { label: 'Color 13', hue: 210, value: 'bg-[hsl(210_70%_92%)] text-[hsl(210_65%_28%)] border border-[hsl(210_45%_70%)] dark:bg-[hsl(210_45%_50%/0.18)] dark:text-[hsl(210_85%_78%)] dark:border-[hsl(210_50%_50%/0.45)]' },
  { label: 'Color 14', hue: 348, value: 'bg-[hsl(348_70%_92%)] text-[hsl(348_65%_28%)] border border-[hsl(348_45%_70%)] dark:bg-[hsl(348_45%_50%/0.18)] dark:text-[hsl(348_85%_78%)] dark:border-[hsl(348_50%_50%/0.45)]' },
  { label: 'Color 15', hue: 125, value: 'bg-[hsl(125_70%_92%)] text-[hsl(125_65%_28%)] border border-[hsl(125_45%_70%)] dark:bg-[hsl(125_45%_50%/0.18)] dark:text-[hsl(125_85%_78%)] dark:border-[hsl(125_50%_50%/0.45)]' },
  { label: 'Color 16', hue: 263, value: 'bg-[hsl(263_70%_92%)] text-[hsl(263_65%_28%)] border border-[hsl(263_45%_70%)] dark:bg-[hsl(263_45%_50%/0.18)] dark:text-[hsl(263_85%_78%)] dark:border-[hsl(263_50%_50%/0.45)]' },
  { label: 'Color 17', hue: 40, value: 'bg-[hsl(40_70%_92%)] text-[hsl(40_65%_28%)] border border-[hsl(40_45%_70%)] dark:bg-[hsl(40_45%_50%/0.18)] dark:text-[hsl(40_85%_78%)] dark:border-[hsl(40_50%_50%/0.45)]' },
  { label: 'Color 18', hue: 178, value: 'bg-[hsl(178_70%_92%)] text-[hsl(178_65%_28%)] border border-[hsl(178_45%_70%)] dark:bg-[hsl(178_45%_50%/0.18)] dark:text-[hsl(178_85%_78%)] dark:border-[hsl(178_50%_50%/0.45)]' },
  { label: 'Color 19', hue: 315, value: 'bg-[hsl(315_70%_92%)] text-[hsl(315_65%_28%)] border border-[hsl(315_45%_70%)] dark:bg-[hsl(315_45%_50%/0.18)] dark:text-[hsl(315_85%_78%)] dark:border-[hsl(315_50%_50%/0.45)]' },
  { label: 'Color 20', hue: 93, value: 'bg-[hsl(93_70%_92%)] text-[hsl(93_65%_28%)] border border-[hsl(93_45%_70%)] dark:bg-[hsl(93_45%_50%/0.18)] dark:text-[hsl(93_85%_78%)] dark:border-[hsl(93_50%_50%/0.45)]' },
  { label: 'Color 21', hue: 230, value: 'bg-[hsl(230_70%_92%)] text-[hsl(230_65%_28%)] border border-[hsl(230_45%_70%)] dark:bg-[hsl(230_45%_50%/0.18)] dark:text-[hsl(230_85%_78%)] dark:border-[hsl(230_50%_50%/0.45)]' },
  { label: 'Color 22', hue: 8, value: 'bg-[hsl(8_70%_92%)] text-[hsl(8_65%_28%)] border border-[hsl(8_45%_70%)] dark:bg-[hsl(8_45%_50%/0.18)] dark:text-[hsl(8_85%_78%)] dark:border-[hsl(8_50%_50%/0.45)]' },
  { label: 'Color 23', hue: 145, value: 'bg-[hsl(145_70%_92%)] text-[hsl(145_65%_28%)] border border-[hsl(145_45%_70%)] dark:bg-[hsl(145_45%_50%/0.18)] dark:text-[hsl(145_85%_78%)] dark:border-[hsl(145_50%_50%/0.45)]' },
  { label: 'Color 24', hue: 283, value: 'bg-[hsl(283_70%_92%)] text-[hsl(283_65%_28%)] border border-[hsl(283_45%_70%)] dark:bg-[hsl(283_45%_50%/0.18)] dark:text-[hsl(283_85%_78%)] dark:border-[hsl(283_50%_50%/0.45)]' }
];

// Técnicos creados antes de esta paleta guardan una clase sólida de Tailwind
// (o un hsl sólido de la paleta anterior). No se migran en Firestore: al
// mostrarlos se traducen al matiz equivalente de la paleta tenue.
const HUE_LEGACY = {
  'bg-fuchsia-500': 295, 'bg-green-500': 138, 'bg-cyan-400': 190, 'bg-yellow-400': 53,
  'bg-purple-400': 275, 'bg-red-500': 0, 'bg-blue-500': 210, 'bg-orange-500': 20,
  'bg-pink-500': 328, 'bg-lime-400': 93,
};

export function estiloTecnico(colorGuardado) {
  const texto = String(colorGuardado || '');
  let hue = HUE_LEGACY[texto.split(' ')[0]];
  if (hue === undefined) {
    const m = texto.match(/^bg-\[hsl\((\d+)_70%_/);
    if (m) hue = Number(m[1]);
  }
  if (hue === undefined) return colorGuardado;
  return COLOR_PALETTE.find(c => c.hue === hue)?.value ?? colorGuardado;
}

// Primer color de la paleta sin uso (contando también los técnicos con color
// antiguo, por su equivalente). Si ya están todos en uso, el menos usado
// (empata por orden), así los repetidos se reparten parejo.
export function siguienteColorTecnico(technicians) {
  const usos = new Map(COLOR_PALETTE.map(c => [c.value, 0]));
  for (const t of technicians) {
    const valor = estiloTecnico(t.color);
    if (usos.has(valor)) usos.set(valor, usos.get(valor) + 1);
  }
  let mejor = COLOR_PALETTE[0].value;
  for (const [valor, n] of usos) {
    if (n < usos.get(mejor)) mejor = valor;
  }
  return mejor;
}

export const TIPOS_TRABAJO = ['INSTALACIÓN', 'AVERÍA', 'RECONEXIÓN', 'VALIDACION NAP', 'MUDANZA', 'GARANTIA', 'LOW SIGNAL', 'RETIRO EQUIPO'];

// Opciones del campo TIPO, dependientes del TRABAJO seleccionado. Los tipos de
// trabajo que no aparecen aquí no tienen sub-tipo definido todavía.
export const TIPOS_POR_TRABAJO = {
  'INSTALACIÓN': ['MRTV', 'MTV', 'MR', 'SM'],
  'AVERÍA': ['LOS', 'Verificación de servicio', 'Verificación de equipos', 'Configuración de router', 'Tensado de drop'],
};

export const ROLES = { ADMIN: 'ADMIN', USUARIO: 'USUARIO', TECNICO: 'TECNICO' };

// Firebase Auth requires an email-shaped identifier. Usuarios inician sesión solo
// con su nombre de usuario; este dominio ficticio nunca recibe correos reales.
export const AUTH_EMAIL_DOMAIN = 'usuarios.seguimientons-f2026.internal';
