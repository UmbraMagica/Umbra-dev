
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
import { ArrowLeft, Save } from "lucide-react";
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
    firstName: '',
    middleName: '',
    lastName: '',
    birthDate: '',
    school: 'Bradavice',
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
        firstName: character.firstName || '',
        middleName: character.middleName || '',
        lastName: character.lastName || '',
        birthDate: character.birthDate || '',
        school: character.school || 'Bradavice',
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
      ...formData,
      height: formData.height ? Number(formData.height) : null,
      weight: formData.weight ? Number(formData.weight) : null,
    };
    
    updateMutation.mutate(updateData);
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Check if user has access to this character
  const hasAccess = user?.role === 'admin' || 
    userCharacters.some((char: any) => char.id === Number(characterId) && char.userId === user?.id);

  if (!user) {
    return <div>Přihlašte se prosím</div>;
  }

  if (!characterId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="p-6">
            <p>Nebyla vybrána žádná postava k editaci.</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              Zpět na domovskou stránku
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="p-6">
            <p>Načítání...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card>
          <CardContent className="p-6">
            <p>Nemáte oprávnění k editaci této postavy.</p>
            <Button onClick={() => setLocation('/')} className="mt-4">
              Zpět na domovskou stránku
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět na domovskou stránku
          </Button>
          <h1 className="text-3xl font-bold text-foreground">
            Editace postavy: {character?.firstName} {character?.lastName}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Základní informace */}
            <Card>
              <CardHeader>
                <CardTitle>Základní informace</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Křestní jméno *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Příjmení *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="middleName">Prostřední jméno</Label>
                  <Input
                    id="middleName"
                    value={formData.middleName}
                    onChange={(e) => handleInputChange('middleName', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="birthDate">Datum narození *</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => handleInputChange('birthDate', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="school">Škola</Label>
                  <Select
                    value={formData.school}
                    onValueChange={(value) => handleInputChange('school', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bradavice">Bradavice</SelectItem>
                      <SelectItem value="Beauxbatons">Beauxbatons</SelectItem>
                      <SelectItem value="Durmstrang">Durmstrang</SelectItem>
                      <SelectItem value="Jiná">Jiná</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Fyzické charakteristiky */}
            <Card>
              <CardHeader>
                <CardTitle>Fyzické charakteristiky</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="avatar">URL avatara</Label>
                  <Input
                    id="avatar"
                    value={formData.avatar}
                    onChange={(e) => handleInputChange('avatar', e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="height">Výška (cm)</Label>
                    <Input
                      id="height"
                      type="number"
                      value={formData.height}
                      onChange={(e) => handleInputChange('height', e.target.value)}
                      min="50"
                      max="250"
                    />
                  </div>
                  <div>
                    <Label htmlFor="weight">Váha (kg)</Label>
                    <Input
                      id="weight"
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleInputChange('weight', e.target.value)}
                      min="20"
                      max="200"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="residence">Bydliště</Label>
                  <Input
                    id="residence"
                    value={formData.residence}
                    onChange={(e) => handleInputChange('residence', e.target.value)}
                    placeholder="Např. Bradavice, Londýn..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Popis postavy */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Popis postavy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="description">Obecný popis</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Popište vzhled, osobnost a další charakteristiky vaší postavy..."
                    rows={4}
                  />
                </div>

                <div>
                  <Label htmlFor="characterHistory">Historie postavy</Label>
                  <Textarea
                    id="characterHistory"
                    value={formData.characterHistory}
                    onChange={(e) => handleInputChange('characterHistory', e.target.value)}
                    placeholder="Napište historii vaší postavy, její minulost, rodinu, zážitky..."
                    rows={6}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showHistoryToOthers"
                    checked={formData.showHistoryToOthers}
                    onChange={(e) => handleInputChange('showHistoryToOthers', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="showHistoryToOthers">
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
              className="min-w-[120px]"
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
