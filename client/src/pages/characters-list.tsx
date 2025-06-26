import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Calendar, MapPin, Edit3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { calculateGameAge } from "@/lib/gameDate";
import { CharacterAvatar } from "@/components/CharacterAvatar";

interface Character {
  id: number;
  userId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  isActive: boolean;
  isSystem?: boolean;
  avatar?: string | null;
  user: {
    username: string;
  };
}

export default function CharactersList() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const isAdmin = user?.role === 'admin';

  const { data: characters = [], isLoading } = useQuery<Character[]>({
    queryKey: ["/api/characters/all"],
  });

  const getCharacterInitials = (character: Character) => {
    return `${character.firstName.charAt(0)}${character.lastName.charAt(0)}`;
  };

  const getFullName = (character: Character) => {
    return `${character.firstName}${character.middleName ? ` ${character.middleName}` : ''} ${character.lastName}`;
  };

  // Filtrování systémových postav - admin vidí všechny, ostatní jen nesystémové
  const visibleCharacters = characters.filter(char => {
    if (isAdmin) return true; // Admin vidí všechny postavy
    return !char.isSystem; // Ostatní nevidí systémové postavy
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět na hlavní stránku
          </Button>
        </div>
        <div className="text-center">Načítání postav...</div>
      </div>
    );
  }

  const activeCharacters = visibleCharacters.filter(char => char.isActive);

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět na hlavní stránku
        </Button>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h1 className="text-2xl font-bold">Seznam postav</h1>
        </div>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Celkem aktivních postav: {activeCharacters.length}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeCharacters.filter(character => character && character.firstName).map((character) => (
          <Card key={character.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <CharacterAvatar character={character} size="md" />
                <div className="flex-1 min-w-0">
                  <Link href={`/characters/${character.id}`}>
                    <CardTitle className="text-lg truncate hover:text-primary transition-colors cursor-pointer">
                      {getFullName(character)}
                    </CardTitle>
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    @{character.user.username}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{calculateGameAge(character.birthDate)} let</span>
                  <span className="text-muted-foreground">
                    (nar. {format(new Date(character.birthDate), 'd. MMMM yyyy', { locale: cs })})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {character.firstName} {character.middleName ? `${character.middleName} ` : ''}{character.lastName}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activeCharacters.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Žádné aktivní postavy</h3>
          <p className="text-muted-foreground">
            V současné době nejsou v systému žádné aktivní postavy.
          </p>
        </div>
      )}
    </div>
  );
}