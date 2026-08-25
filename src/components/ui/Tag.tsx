export function Tag({ label, color = "#4a6a80" }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      #{label}
    </span>
  );
}
