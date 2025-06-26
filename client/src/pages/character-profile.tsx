import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Calendar, User, Mail, Clock, Edit3, GraduationCap, FileText, Package, BookOpen, Wand2, Home, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { calculateGameAge } from "@/lib/gameDate";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, apiFetch } from "@/lib/queryClient";
import DOMPurify from 'dompurify';

interface Character {
  id: number;
  userId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  isActive: boolean;
  school?: string;
  description?: string;
  avatar?: string | null;
  residence?: string;
  characterHistory?: string;
  showHistoryToOthers?: boolean;
  height?: number;
  weight?: number;
  user: {
    username: string;
    email: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL || '';

export default function CharacterProfile() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for history editing
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [historyText, setHistoryText] = useState("");
  const [showHistoryToOthers, setShowHistoryToOthers] = useState(true);
  
  // Get the 'from' parameter from URL to determine navigation
  const urlParams = new URLSearchParams(window.location.search);
  const fromPage = urlParams.get('from');

  const { data: character, isLoading, error } = useQuery<Character>({
    queryKey: [`/api/characters/${id}`],
    enabled: !!id && !!user,
    queryFn: async () => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/characters/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Postava nenalezena');
      return response.json();
    },
  });

  // Initialize history state when character data loads
  useEffect(() => {
    if (character) {
      setHistoryText(character.characterHistory || "");
      setShowHistoryToOthers(character.showHistoryToOthers === true);
    }
  }, [character]);

  // History update mutation
  const updateHistoryMutation = useMutation({
    mutationFn: async (data: { history: string; showHistoryToOthers: boolean }) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/characters/${id}/history`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update history');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Historie aktualizována",
        description: "Historie postavy byla úspěšně uložena.",
      });
      setIsEditingHistory(false);
      queryClient.invalidateQueries({ queryKey: [`/api/characters/${id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se aktualizovat historii postavy.",
        variant: "destructive",
      });
    },
  });

  const handleSaveHistory = () => {
    updateHistoryMutation.mutate({
      history: historyText,
      showHistoryToOthers: showHistoryToOthers,
    });
  };

  const handleCancelHistoryEdit = () => {
    setHistoryText(character?.characterHistory || "");
    setShowHistoryToOthers(character?.showHistoryToOthers !== false);
    setIsEditingHistory(false);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(fromPage === 'admin' ? '/admin' : '/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {fromPage === 'admin' ? 'Zpět do administrace' : 'Zpět na hlavní stránku'}
          </Button>
        </div>
        <div className="text-center">Načítání profilu postavy...</div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation(fromPage === 'admin' ? '/admin' : '/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {fromPage === 'admin' ? 'Zpět do administrace' : 'Zpět na hlavní stránku'}
          </Button>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Postava nenalezena</h3>
          <p className="text-muted-foreground">
            Požadovaná postava neexistuje nebo není dostupná.
          </p>
        </div>
      </div>
    );
  }

  const getCharacterInitials = (character: Character) => {
    if (!character.firstName || !character.lastName) return "??";
    return `${character.firstName.charAt(0)}${character.lastName.charAt(0)}`;
  };

  const getFullName = (character: Character) => {
    if (!character?.firstName || !character?.lastName) return "Neznámá postava";
    return `${character.firstName}${character.middleName ? ` ${character.middleName}` : ''} ${character.lastName}`;
  };

  // Only character owner can edit through profile page, admins use admin interface
  const canEdit = user && user.id === character.userId;

  const characterAge = calculateGameAge(character.birthDate);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(fromPage === 'admin' ? '/admin' : '/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {fromPage === 'admin' ? 'Zpět do administrace' : 'Zpět na hlavní stránku'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Profile Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <CharacterAvatar character={character} size="lg" className="h-20 w-20" />
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-2xl mb-2">
                        {getFullName(character)}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={character.isActive ? "default" : "secondary"}>
                          {character.isActive ? "Hráčská postava" : "Neaktivní postava"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Hraje: @{character.user?.username || 'Neznámý uživatel'}</div>
                        {character.user?.lastLoginAt && (
                          <div className="mt-1">
                            Naposledy online: {new Date(character.user.lastLoginAt).toLocaleDateString('cs-CZ')}
                          </div>
                        )}
                      </div>
                    </div>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation('/character-edit')}
                        className="flex items-center gap-2"
                      >
                        <Edit3 className="h-4 w-4" />
                        Upravit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3">Základní informace</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Celé jméno</div>
                        <div className="text-sm text-muted-foreground">
                          {getFullName(character)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">Datum narození a věk</div>
                        <div className="text-sm text-muted-foreground">
                          {character.birthDate ? 
                            (() => {
                              try {
                                const date = new Date(character.birthDate);
                                const day = date.getDate().toString().padStart(2, '0');
                                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                                const year = date.getFullYear();
                                return `${day}.${month}.${year} (${calculateGameAge(character.birthDate)} let)`;
                              } catch {
                                return `${character.birthDate} (${calculateGameAge(character.birthDate)} let)`;
                              }
                            })()
                            : 'Nezadáno'
                          }
                        </div>
                      </div>
                    </div>
                    {(character.height || character.weight) && (
                      <div className="flex items-center gap-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Fyzické vlastnosti</div>
                          <div className="text-sm text-muted-foreground">
                            {character.height && character.weight 
                              ? `${character.height} cm, ${character.weight} kg`
                              : character.height 
                                ? `${character.height} cm`
                                : `${character.weight} kg`
                            }
                          </div>
                        </div>
                      </div>
                    )}
                    {character.residence && (
                      <div className="flex items-center gap-3">
                        <Home className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">Bydliště</div>
                          <div className="text-sm text-muted-foreground">
                            {character.residence}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {character.school && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-3">Škola</h3>
                      <div className="flex items-center gap-3">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          {character.school}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {character.description && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-3">Popis postavy</h3>
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div 
                          className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(character.description) }}
                        />
                      </div>
                    </div>
                  </>
                )}


              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Osobní archiv</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLocation(`/characters/${character.id}/inventory`)}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Inventář postavy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLocation(`/characters/${character.id}/journal`)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Deník postavy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLocation(`/characters/${character.id}/history`)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Historie postavy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setLocation('/my-spells')}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Moje kouzla
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}