import { initials, cn } from "@/lib/utils";

const palette = [
  "#243746", "#2c4356", "#4a6a80", "#e0a900", "#7c8e98", "#375367",
];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-9 w-9 text-sm", lg: "h-14 w-14 text-lg" };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white",
        sizes[size],
        className
      )}
      style={{ backgroundColor: colorFor(name || "?") }}
      title={name}
    >
      {initials(name || "?")}
    </span>
  );
}
