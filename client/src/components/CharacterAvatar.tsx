import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface CharacterAvatarProps {
  character?: {
    firstName: string;
    middleName?: string;
    lastName: string;
    avatar?: string;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CharacterAvatar({ character, size = "md", className }: CharacterAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10", 
    lg: "h-12 w-12"
  };

  const getInitials = () => {
    if (!character) return "?";

    // Ensure we have string values before calling charAt
    const firstName = character.firstName;
    const lastName = character.lastName;

    if (!firstName || typeof firstName !== 'string') return "?";
    if (!lastName || typeof lastName !== 'string') return "?";

    const firstTrimmed = firstName.trim();
    const lastTrimmed = lastName.trim();

    if (!firstTrimmed || !lastTrimmed) return "?";

    const first = firstTrimmed.charAt(0) || "";
    const last = lastTrimmed.charAt(0) || "";

    const initials = (first + last).toUpperCase();
    return initials || "?";
  };

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {character?.avatar ? (
        <AvatarImage src={character.avatar} alt="Avatar" />
      ) : (
        <AvatarFallback>{getInitials()}</AvatarFallback>
      )}
    </Avatar>
  );
}