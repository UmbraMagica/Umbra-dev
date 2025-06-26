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

    const firstName = character.firstName?.trim() || "";
    const lastName = character.lastName?.trim() || "";

    const first = firstName.charAt(0) || "";
    const last = lastName.charAt(0) || "";

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