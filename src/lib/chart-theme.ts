// Tema único dos gráficos (recharts) de todo o sistema. Qualquer gráfico novo ou
// ajustado deve importar daqui em vez de repetir cores e estilos.
// Padrão v3: grade tracejada só na horizontal, eixos sem linhas, linhas finas sem
// pontos (o ponto aparece no hover), barras com cantos de 4px e largura máxima.

export const BRAND = { blue: "#243746", yellow: "#fcbf00", green: "#2f8f5b", red: "#c23b3b", steel: "#6b8cae", orange: "#e07a2f" };

/** Série de apoio, em tons neutros, para quando há várias categorias. */
export const SERIES = ["#243746", "#fcbf00", "#6b8cae", "#2f8f5b", "#a9b8c3", "#e07a2f"];

export const GRID_COLOR = "#e9eef2";
export const TICK_STYLE = { fontSize: 11, fill: "#8a9ba5" };
export const TOOLTIP_STYLE = { borderRadius: 10, border: "1px solid #e1e7eb", fontSize: 12, boxShadow: "0 4px 16px rgba(23,36,44,0.08)" };
export const CURSOR_STYLE = { fill: "rgba(36,55,70,0.04)" };

/** Props prontas: <CartesianGrid {...GRID_PROPS} />, <XAxis {...AXIS_PROPS} />. */
export const GRID_PROPS = { stroke: GRID_COLOR, strokeDasharray: "3 4", vertical: false } as const;
export const AXIS_PROPS = { tick: TICK_STYLE, axisLine: false, tickLine: false } as const;
export const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
export const BAR_MAX = 28;
export const ACTIVE_DOT = { r: 4, strokeWidth: 2, stroke: "#fff" };

/** Altura padrão dos gráficos dentro de cards (Tailwind), por densidade. */
export const CHART_HEIGHT = { compact: "h-56", default: "h-64 sm:h-72", tall: "h-72 sm:h-80" } as const;
