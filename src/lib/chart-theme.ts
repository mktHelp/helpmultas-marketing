// Tema único dos gráficos (recharts) de todo o sistema. Qualquer gráfico novo ou
// ajustado deve importar daqui em vez de repetir cores e estilos.

export const BRAND = { blue: "#243746", yellow: "#fcbf00", green: "#2f8f5b", red: "#c23b3b", steel: "#5b7fa6", orange: "#e07a2f" };

/** Série de apoio, em tons neutros, para quando há várias categorias. */
export const SERIES = ["#243746", "#fcbf00", "#5b7fa6", "#2f8f5b", "#9db0bc", "#e07a2f"];

export const GRID_COLOR = "#eef2f4";
export const TICK_STYLE = { fontSize: 11, fill: "#7c8e98" };
export const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #d8e0e4", fontSize: 13, boxShadow: "0 6px 20px rgba(23,36,44,0.10)" };
export const CURSOR_STYLE = { fill: "rgba(36,55,70,0.04)" };

/** Altura padrão dos gráficos dentro de cards (Tailwind), por densidade. */
export const CHART_HEIGHT = { compact: "h-56", default: "h-64 sm:h-72", tall: "h-72 sm:h-80" } as const;
