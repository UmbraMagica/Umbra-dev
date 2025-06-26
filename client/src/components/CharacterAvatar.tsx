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
  character: {
    id?: number;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    avatar?: string;
    fullName?: string;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm", 
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg"
};

export function CharacterAvatar({ character, size = "md", className }: CharacterAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-base"
  };

  // Bezpečné získání jména s kontrolou na null/undefined
  const firstName = character.firstName || '';
  const lastName = character.lastName || '';
  const displayName = character.fullName || `${firstName} ${lastName}`.trim();

  // Bezpečné vytvoření iniciál
  let initials = "?";
  if (displayName && displayName.trim() !== '') {
    initials = displayName
      .split(' ')
      .filter(name => name && name.trim() !== '') // Filtrujeme prázdné části
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  } else if (firstName && lastName) {
    initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  } else if (firstName) {
    initials = firstName.charAt(0).toUpperCase();
  } else if (lastName) {
    initials = lastName.charAt(0).toUpperCase();
  }

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {character.avatar ? (
        <AvatarImage src={character.avatar} alt={displayName || "Postava"} />
      ) : null}
      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}