export const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const numberFormatter = new Intl.NumberFormat("pt-BR");

// "YYYY-MM-DD" → "dd/mm/aaaa", read directly to avoid any timezone shift.
export function formatDay(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
