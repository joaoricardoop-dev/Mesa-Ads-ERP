import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-emerald-600", "bg-blue-600", "bg-violet-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
  "bg-orange-600", "bg-pink-600", "bg-lime-600", "bg-fuchsia-600",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const SIZE_MAP = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
} as const;

interface RestaurantAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export default function RestaurantAvatar({ name, logoUrl, size = "sm", className }: RestaurantAvatarProps) {
  const colorClass = AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
  const sizeClass = SIZE_MAP[size];

  return (
    <Avatar className={cn(sizeClass, "shrink-0", className)}>
      {logoUrl && (
        <AvatarImage src={logoUrl} alt={`Logo de ${name}`} className="object-contain p-0.5" />
      )}
      <AvatarFallback className={cn(colorClass, "text-white font-semibold")}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
