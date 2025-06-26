
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface Character {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  avatar?: string | null;
}

interface CharacterAvatarProps {
  character: Character | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm", 
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg"
};

export function CharacterAvatar({ character, size = "md", className = "" }: CharacterAvatarProps) {
  // Safety check for character existence and required fields
  if (!character || !character.firstName || !character.lastName) {
    console.warn('[CharacterAvatar] Invalid character data:', character);
    return (
      <Avatar className={`${sizeClasses[size]} ${className}`}>
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    );
  }

  // Generate initials safely
  const getInitials = () => {
    try {
      const firstInitial = character.firstName?.charAt(0)?.toUpperCase() || '?';
      const lastInitial = character.lastName?.charAt(0)?.toUpperCase() || '?';
      return `${firstInitial}${lastInitial}`;
    } catch (error) {
      console.error('[CharacterAvatar] Error generating initials:', error, character);
      return '??';
    }
  };

  const initials = getInitials();

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {character.avatar && (
        <AvatarImage 
          src={character.avatar} 
          alt={`${character.firstName} ${character.lastName}`}
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
