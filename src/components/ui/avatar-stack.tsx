import { cn } from "@/lib/utils/cn";
import { Avatar, AvatarFallback, AvatarImage, type AvatarSize } from "@/components/ui/avatar";

const chipSizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export type AvatarStackMember = {
  id: string;
  name: string;
  imageUrl?: string;
};

export type AvatarStackProps = {
  members: AvatarStackMember[];
  max?: number;
  size?: AvatarSize;
  className?: string;
};

/** Initials from up to the first two words of a name, e.g. "Jane Doe" -> "JD". */
function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function AvatarStack({ members, max = 4, size = "sm", className }: AvatarStackProps) {
  const visible = members.slice(0, max);
  const overflowCount = members.length - visible.length;

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((member, index) => (
        <span
          key={member.id}
          className="first:ml-0 -ml-2 rounded-full ring-2 ring-card"
          style={{ zIndex: index }}
        >
          <Avatar size={size}>
            {member.imageUrl ? <AvatarImage src={member.imageUrl} alt={member.name} /> : null}
            <AvatarFallback size={size}>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
        </span>
      ))}
      {overflowCount > 0 ? (
        <span
          className={cn(
            "-ml-2 flex shrink-0 items-center justify-center rounded-full border border-hairline bg-elevated font-mono tabular-nums text-text-secondary ring-2 ring-card",
            chipSizeClasses[size],
          )}
          style={{ zIndex: visible.length }}
        >
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
}
