import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

interface DeadCharacter {
  id: number;
  userId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  school?: string;
  description?: string;
  deathDate: string;
  deathReason: string;
  isMainCharacter: boolean;
  createdAt: string;
}

export default function Cemetery() {
  const { data: deadCharacters = [], isLoading } = useQuery<DeadCharacter[]>({
    queryKey: ["/api/cemetery"],
  });

  // Format date to show game year (1926) instead of real year
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${day}. ${month}. 1926`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-black p-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-slate-900 to-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center text-purple-300 hover:text-purple-200 transition-colors mb-6 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Zpět na hlavní stránku
          </Link>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
            ⚰️ Hřbitov
          </h1>
          
          <p className="text-purple-300 text-lg max-w-2xl mx-auto">
            Místo věčného odpočinku pro naše padlé hrdiny. Jejich příběhy zůstávají navždy v našich srdcích.
          </p>
        </div>

        {/* Dead Characters Grid */}
        {deadCharacters.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🕊️</div>
            <h2 className="text-2xl font-semibold text-purple-200 mb-2">
              Hřbitov je prázdný
            </h2>
            <p className="text-purple-400">
              Zatím zde nespočívají žádné postavy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deadCharacters.map((character) => (
              <Card key={character.id} className="bg-slate-800/50 border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-purple-200 text-xl flex items-center gap-2">
                      ⚰️
                      {character.firstName}
                      {character.middleName && ` ${character.middleName}`}
                      {" "}
                      {character.lastName}
                    </CardTitle>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="text-sm text-purple-300">
                    <strong>Datum smrti:</strong> {character.deathDate || character.death_date ? new Date(character.deathDate ?? character.death_date).toLocaleDateString('cs-CZ') : 'Neznámé datum'}
                  </div>
                  
                  {character.deathReason && (
                    <div className="text-sm text-purple-300">
                      <strong>Důvod smrti:</strong> {character.deathReason}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}