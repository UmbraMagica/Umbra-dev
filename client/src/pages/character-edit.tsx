import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, Lock } from "lucide-react";
import { apiFetch } from "@/lib/queryClient";

const API_URL = import.meta.env.VITE_API_URL || '';

interface Character {
  id: number;
  userId: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  birthDate: string;
  school?: string;
  description?: string;
  avatar?: string;
  residence?: string;
  height?: number;
  weight?: number;
  characterHistory?: string;
  showHistoryToOthers?: boolean;
  isActive: boolean;
}

const MAGICAL_SCHOOLS = [
  "Bradavice",
  "Krásnohůlky",
  "Kruval",
  "Ilvermorny",
  "Salemská škola pro čarodějky",
  "Uagadou",
  "Mahoutokoto",
  "Castelobruxo",
  "Koldovstoretz",
  "Valšebnyj puť",
  "Domácí vzdělávání"
];

export default function CharacterEdit() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Get character ID from URL params or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const characterIdFromUrl = urlParams.get('characterId');
  const characterIdFromStorage = localStorage.getItem('selectedCharacterId');
  const characterId = characterIdFromUrl || characterIdFromStorage;

  const [formData, setFormData] = useState({
    school: '',
    description: '',
    avatar: '',
    residence: '',
    height: '',
    weight: '',
    characterHistory: '',
    showHistoryToOthers: true
  });

  // Load character data
  const { data: character, isLoading } = useQuery<Character>({
    queryKey: [`/api/characters/${characterId}`],
    enabled: !!characterId && !!user,
    queryFn: async () => {
      return apiFetch(`${API_URL}/api/characters/${characterId}`);
    },
  });

  // Load user's characters to ensure access
  const { data: userCharacters = [] } = useQuery({
    queryKey: ['/api/characters'],
    enabled: !!user,
  });

  // Update form when character data loads
  useEffect(() => {
    if (character) {
      setFormData({
        school: character.school || '',
        description: character.description || '',
        avatar: character.avatar || '',
        residence: character.residence || '',
        height: character.height?.toString() || '',
        weight: character.weight?.toString() || '',
        characterHistory: character.characterHistory || '',
        showHistoryToOthers: character.showHistoryToOthers !== false
      });
    }
  }, [character]);

  // Update character mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/characters/${characterId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Nepodařilo se aktualizovat postavu');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Úspěch",
        description: "Postava byla úspěšně aktualizována",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${characterId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/characters'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updateData = {
      school: formData.school || null,
      description: formData.description || null,
      avatar: formData.avatar || null,
      residence: formData.residence || null,
      height: formData.height ? Number(formData.height) : null,
      weight: formData.weight ? Number(formData.weight) : null,
      characterHistory: formData.characterHistory || null,
      showHistoryToOthers: formData.showHistoryToOthers,
    };
    
    updateMutation.mutate(updateData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Check if user has access to this character
  const hasAccess = user?.role === 'admin' || 
    userCharacters.some((char: any) => char.id === Number(characterId) && char.userId === user?.id);

  // Determine if fields are editable
  const isSchoolEditable = !character?.school; // Only editable if not set
  const isHeightEditable = !character?.height; // Only editable if not set

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <p className="text-slate-300">Přihlašte se prosím</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!characterId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <p className="text-slate-300">Nebyla vybrána žádná postava k editaci.</p>
              <Button onClick={() => setLocation('/')} className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                Zpět na domovskou stránku
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
                <p className="text-slate-300 ml-4">Načítání...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-4xl mx-auto p-6">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <p className="text-slate-300">Nemáte oprávnění k editaci této postavy.</p>
              <Button onClick={() => setLocation('/')} className="mt-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                Zpět na domovskou stránku
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět na domovskou stránku
          </Button>
          <h1 className="text-3xl font-bold text-white">
            Editace postavy: {character?.firstName} {character?.lastName}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Základní informace - pouze zobrazení */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-slate-400" />
                  Základní informace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-slate-300">Křestní jméno</Label>
                    <Input
                      id="firstName"
                      value={character?.firstName || ''}
                      disabled
                      className="bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-slate-300">Příjmení</Label>
                    <Input
                      id="lastName"
                      value={character?.lastName || ''}
                      disabled
                      className="bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="middleName" className="text-slate-300">Prostřední jméno</Label>
                  <Input
                    id="middleName"
                    value={character?.middleName || ''}
                    disabled
                    className="bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <Label htmlFor="birthDate" className="text-slate-300">Datum narození</Label>
                  <Input
                    id="birthDate"
                    value={character?.birthDate ? formatDate(character.birthDate) : ''}
                    disabled
                    className="bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed"
                  />
                </div>

                <div>
                  <Label htmlFor="school" className="text-slate-300 flex items-center gap-2">
                    Škola
                    {!isSchoolEditable && <Lock className="h-4 w-4 text-slate-400" />}
                  </Label>
                  {isSchoolEditable ? (
                    <Select
                      value={formData.school}
                      onValueChange={(value) => handleInputChange('school', value)}
                    >
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                        <SelectValue placeholder="Vyberte školu" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        {MAGICAL_SCHOOLS.map((school) => (
                          <SelectItem key={school} value={school}>
                            {school}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={character?.school || 'Nezadáno'}
                      disabled
                      className="bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fyzické charakteristiky */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200">Fyzické charakteristiky</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="avatar" className="text-slate-300">URL avatara</Label>
                  <Input
                    id="avatar"
                    value={formData.avatar}
                    onChange={(e) => handleInputChange('avatar', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="height" className="text-slate-300 flex items-center gap-2">
                      Výška (cm)
                      {!isHeightEditable && <Lock className="h-4 w-4 text-slate-400" />}
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.height}
                      onChange={(e) => handleInputChange('height', e.target.value)}
                      min="120"
                      max="250"
                      disabled={!isHeightEditable}
                      className={`${isHeightEditable 
                        ? 'bg-slate-700 border-slate-600 text-slate-200' 
                        : 'bg-slate-700/50 border-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight" className="text-slate-300">Váha (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleInputChange('weight', e.target.value)}
                      min="30"
                      max="300"
                      className="bg-slate-700 border-slate-600 text-slate-200"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="residence" className="text-slate-300">Bydliště</Label>
                  <Input
                    id="residence"
                    value={formData.residence}
                    onChange={(e) => handleInputChange('residence', e.target.value)}
                    placeholder="Např. Bradavice, Londýn..."
                    className="bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Popis postavy */}
            <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-slate-200">Popis postavy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="description" className="text-slate-300">Obecný popis</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Popište vzhled, osobnost a další charakteristiky vaší postavy..."
                    rows={4}
                    className="bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
                  />
                </div>

                <div>
                  <Label htmlFor="characterHistory" className="text-slate-300">Historie postavy</Label>
                  <Textarea
                    id="characterHistory"
                    value={formData.characterHistory}
                    onChange={(e) => handleInputChange('characterHistory', e.target.value)}
                    placeholder="Napište historii vaší postavy, její minulost, rodinu, zážitky..."
                    rows={6}
                    className="bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-400"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showHistoryToOthers"
                    checked={formData.showHistoryToOthers}
                    onChange={(e) => handleInputChange('showHistoryToOthers', e.target.checked)}
                    className="rounded border-slate-600 bg-slate-700 text-purple-600"
                  />
                  <Label htmlFor="showHistoryToOthers" className="text-slate-300">
                    Zobrazit historii ostatním hráčům
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="min-w-[120px] bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Ukládám...' : 'Uložit změny'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
