import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { insertHousingRequestSchema } from "@shared/types";
import { z } from "zod";
import { 
  User, 
  Settings, 
  Palette, 
  Home, 
  ChevronDown, 
  ChevronUp,
  Plus,
  Eye,
  ArrowLeft
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || '';

// Helper function to safely parse character order
function parseCharacterOrder(order: any): number[] {
  try {
    if (Array.isArray(order)) {
      return order.filter(id => typeof id === 'number' && id > 0);
    }
    if (typeof order === 'string') {
      const parsed = JSON.parse(order);
      if (Array.isArray(parsed)) {
        return parsed.filter(id => typeof id === 'number' && id > 0);
      }
    }
    return [];
  } catch (error) {
    console.warn('[parseCharacterOrder] Failed to parse character order:', error);
    return [];
  }
}

// Helper function to safely validate array data
function ensureArray<T>(data: any, fallback: T[] = []): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  console.warn('[ensureArray] Expected array but got:', typeof data, data);
  return fallback;
}

export default function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Safe state initialization
  const [characterOrder, setCharacterOrder] = useState<number[]>([]);
  const [highlightWords, setHighlightWords] = useState("");
  const [highlightColor, setHighlightColor] = useState("yellow");
  const [narratorColor, setNarratorColor] = useState("#8B5CF6");
  const [showHousingDialog, setShowHousingDialog] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({
    housing: true,
    characterOrder: true,
    highlighting: true,
    narrator: true
  });

  // Housing form state with validation
  const [housingForm, setHousingForm] = useState({
    characterId: 0,
    requestType: "",
    size: "",
    location: "",
    customLocation: "",
    selectedArea: "",
    description: "",
    housingName: "",
    housingPassword: ""
  });

  // Query for housing requests with safe data handling
  const { data: housingRequestsData = [], isLoading: isLoadingHousing } = useQuery({
    queryKey: [`${API_URL}/api/user/housing-requests`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!user,
  });

  // Safely ensure housing requests is an array
  const housingRequests = ensureArray(housingRequestsData);

  // Initialize settings from user data
  useEffect(() => {
    if (user) {
      console.log('[UserSettings] Initializing from user data:', {
        characterOrder: user.characterOrder,
        characterOrderType: typeof user.characterOrder,
        characters: user.characters?.length || 0
      });

      try {
        // Safe character order parsing
        const parsedOrder = parseCharacterOrder(user.characterOrder);
        setCharacterOrder(parsedOrder);

        // Safe string initialization
        setHighlightWords(user.highlightWords || "");
        setHighlightColor(user.highlightColor || "yellow");
        setNarratorColor(user.narratorColor || "#8B5CF6");
      } catch (error) {
        console.error('[UserSettings] Error initializing settings:', error);
        // Set safe defaults
        setCharacterOrder([]);
        setHighlightWords("");
        setHighlightColor("yellow");
        setNarratorColor("#8B5CF6");
      }
    }
  }, [user]);

  // Safe character order generation
  useEffect(() => {
    if (user?.characters && Array.isArray(user.characters) && characterOrder.length === 0) {
      console.log('[UserSettings] Auto-generating character order from characters');
      const autoOrder = user.characters.map((char: any) => char.id).filter(id => typeof id === 'number');
      setCharacterOrder(autoOrder);
    }
  }, [user?.characters, characterOrder.length]);

  // Mutations with better error handling
  const updateCharacterOrderMutation = useMutation({
    mutationFn: async (newOrder: number[]) => {
      if (!Array.isArray(newOrder)) {
        throw new Error('Character order must be an array');
      }
      return apiRequest("POST", `${API_URL}/api/user/character-order`, { 
        characterOrder: newOrder 
      });
    },
    onSuccess: () => {
      toast({
        title: "Úspěch",
        description: "Pořadí postav bylo aktualizováno",
      });
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
    },
    onError: (error: any) => {
      console.error('[UserSettings] Error updating character order:', error);
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se aktualizovat pořadí postav",
        variant: "destructive",
      });
    },
  });

  const updateHighlightSettingsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `${API_URL}/api/user/highlight-settings`, {
        highlightWords: highlightWords || null,
        highlightColor: highlightColor || "yellow"
      });
    },
    onSuccess: () => {
      toast({
        title: "Úspěch",
        description: "Nastavení zvýrazňování bylo aktualizováno",
      });
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se aktualizovat nastavení",
        variant: "destructive",
      });
    },
  });

  const updateNarratorColorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `${API_URL}/api/user/narrator-color`, {
        narratorColor: narratorColor || "#8B5CF6"
      });
    },
    onSuccess: () => {
      toast({
        title: "Úspěch",
        description: "Barva vypravěče byla aktualizována",
      });
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se aktualizovat barvu",
        variant: "destructive",
      });
    },
  });

  const createHousingRequestMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertHousingRequestSchema>) => {
      return apiRequest("POST", `${API_URL}/api/user/housing-requests`, data);
    },
    onSuccess: () => {
      toast({
        title: "Úspěch",
        description: "Žádost o bydlení byla odeslána",
      });
      setShowHousingDialog(false);
      setHousingForm({
        characterId: 0,
        requestType: "",
        size: "",
        location: "",
        customLocation: "",
        selectedArea: "",
        description: "",
        housingName: "",
        housingPassword: ""
      });
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/user/housing-requests`] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se odeslat žádost",
        variant: "destructive",
      });
    },
  });

  // Helper functions
  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Čeká na vyřízení", variant: "secondary" as const },
      approved: { label: "Schváleno", variant: "default" as const },
      rejected: { label: "Zamítnuto", variant: "destructive" as const },
      returned: { label: "Vráceno k úpravě", variant: "outline" as const }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || 
      { label: status, variant: "secondary" as const };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleHousingSubmit = () => {
    try {
      const validatedData = insertHousingRequestSchema.parse(housingForm);
      createHousingRequestMutation.mutate(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Chyba validace",
          description: error.errors.map(err => err.message).join(", "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Chyba",
          description: "Nepodařilo se odeslat žádost",
          variant: "destructive",
        });
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Přihlašte se prosím</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Safe character array handling
  const userCharacters = ensureArray(user.characters);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Uživatelská nastavení</h1>
              <p className="text-muted-foreground">Správa vašich osobních preferencí</p>
            </div>
          </div>
        </div>

        {/* Housing Requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle 
                className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                onClick={() => toggleSection('housing')}
              >
                <Home className="h-5 w-5" />
                Žádosti o bydlení ({housingRequests.length})
                {collapsedSections.housing ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronUp className="h-4 w-4" />
                }
              </CardTitle>
              {!collapsedSections.housing && (
                <Dialog open={showHousingDialog} onOpenChange={setShowHousingDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nová žádost
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Nová žádost o bydlení</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="character">Postava</Label>
                        <Select 
                          value={housingForm.characterId.toString()} 
                          onValueChange={(value) => setHousingForm(prev => ({ ...prev, characterId: parseInt(value) }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte postavu" />
                          </SelectTrigger>
                          <SelectContent>
                            {userCharacters.map((char: any) => (
                              <SelectItem key={char.id} value={char.id.toString()}>
                                {char.firstName} {char.lastName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="requestType">Typ bydlení</Label>
                        <Select 
                          value={housingForm.requestType} 
                          onValueChange={(value) => setHousingForm(prev => ({ ...prev, requestType: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte typ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dormitory">Ubytovna/Kolej</SelectItem>
                            <SelectItem value="shared">Sdílené bydlení</SelectItem>
                            <SelectItem value="apartment">Byt</SelectItem>
                            <SelectItem value="house">Dům</SelectItem>
                            <SelectItem value="mansion">Sídlo</SelectItem>
                            <SelectItem value="custom">Vlastní</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="location">Lokalita</Label>
                        <Input
                          id="location"
                          value={housingForm.location}
                          onChange={(e) => setHousingForm(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Zadejte lokalitu"
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Popis a požadavky</Label>
                        <Textarea
                          id="description"
                          value={housingForm.description}
                          onChange={(e) => setHousingForm(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Popište své požadavky na bydlení..."
                          rows={4}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowHousingDialog(false)}>
                          Zrušit
                        </Button>
                        <Button 
                          onClick={handleHousingSubmit}
                          disabled={createHousingRequestMutation.isPending}
                        >
                          Odeslat žádost
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          {!collapsedSections.housing && (
            <CardContent>
              {isLoadingHousing ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              ) : housingRequests.length > 0 ? (
                <div className="space-y-4">
                  {housingRequests.map((request: any) => (
                    <Card key={request.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">
                                {request.character?.firstName} {request.character?.lastName}
                              </h4>
                              {getStatusBadge(request.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {request.requestType} • {request.location}
                            </p>
                            <p className="text-sm">{request.description}</p>
                            {request.reviewNote && (
                              <div className="mt-2 p-2 bg-muted rounded text-sm">
                                <strong>Poznámka administrátora:</strong> {request.reviewNote}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(request.createdAt).toLocaleDateString('cs-CZ')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Zatím nemáte žádné žádosti o bydlení</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Klikněte na tlačítko výše pro vytvoření nové žádosti
                  </p>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Character Order Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle 
                className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                onClick={() => toggleSection('characterOrder')}
              >
                <User className="h-5 w-5" />
                Pořadí postav v chatu
                {collapsedSections.characterOrder ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronUp className="h-4 w-4" />
                }
              </CardTitle>
            </div>
          </CardHeader>
          {!collapsedSections.characterOrder && (
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Nastavte pořadí, v jakém se budou vaše postavy zobrazovat v seznamu pro odesílání zpráv.
              </p>

              {userCharacters.length > 0 ? (
                <div className="space-y-2">
                  {characterOrder.map((charId, index) => {
                    const character = userCharacters.find((c: any) => c.id === charId);
                    if (!character) return null;

                    return (
                      <div key={charId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground font-mono">
                            #{index + 1}
                          </span>
                          <div>
                            <p className="font-medium">
                              {character.firstName} {character.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {character.school || 'Neznámá škola'}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={index === 0}
                            onClick={() => {
                              console.log('Moving up - before:', characterOrder);
                              const newOrder = [...characterOrder];
                              [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
                              console.log('Moving up - after:', newOrder);
                              setCharacterOrder(newOrder);
                              // Auto-save immediately
                              updateCharacterOrderMutation.mutate(newOrder);
                            }}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={index === characterOrder.length - 1}
                            onClick={() => {
                              console.log('Moving down - before:', characterOrder);
                              const newOrder = [...characterOrder];
                              [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                              console.log('Moving down - after:', newOrder);
                              setCharacterOrder(newOrder);
                              // Auto-save immediately
                              updateCharacterOrderMutation.mutate(newOrder);
                            }}
                          >
                            ↓
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nemáte žádné postavy</p>
                  <Button
                    variant="outline"
                    onClick={() => setLocation('/character-edit')}
                    className="mt-4"
                  >
                    Vytvořit první postavu
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Highlight Settings */}
        <Card>
          <CardHeader>
            <CardTitle 
              className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
              onClick={() => toggleSection('highlighting')}
            >
              <Palette className="h-5 w-5" />
              Zvýrazňování textu
              {collapsedSections.highlighting ? 
                <ChevronDown className="h-4 w-4" /> : 
                <ChevronUp className="h-4 w-4" />
              }
            </CardTitle>
          </CardHeader>
          {!collapsedSections.highlighting && (
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="highlightWords">Slova k zvýraznění (oddělte čárkami)</Label>
                <Input
                  id="highlightWords"
                  value={highlightWords}
                  onChange={(e) => setHighlightWords(e.target.value)}
                  placeholder="např: moje postava, důležité, pozor"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Zadaná slova budou zvýrazněna v chatových zprávách
                </p>
              </div>

              <div>
                <Label htmlFor="highlightColor">Barva zvýraznění</Label>
                <Select value={highlightColor} onValueChange={setHighlightColor}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yellow">Žlutá</SelectItem>
                    <SelectItem value="green">Zelená</SelectItem>
                    <SelectItem value="blue">Modrá</SelectItem>
                    <SelectItem value="red">Červená</SelectItem>
                    <SelectItem value="purple">Fialová</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => updateHighlightSettingsMutation.mutate()}
                disabled={updateHighlightSettingsMutation.isPending}
                className="w-full"
              >
                Uložit nastavení zvýrazňování
              </Button>
            </CardContent>
          )}
        </Card>

        {/* Narrator Color Settings */}
        {(user.role === 'admin' || user.canNarrate) && (
          <Card>
            <CardHeader>
              <CardTitle 
                className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                onClick={() => toggleSection('narrator')}
              >
                <Settings className="h-5 w-5" />
                Nastavení vypravěče
                {collapsedSections.narrator ? 
                  <ChevronDown className="h-4 w-4" /> : 
                  <ChevronUp className="h-4 w-4" />
                }
              </CardTitle>
            </CardHeader>
            {!collapsedSections.narrator && (
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="narratorColor">Barva vypravěčského textu</Label>
                  <div className="flex gap-2">
                    <Input
                      id="narratorColor"
                      type="color"
                      value={narratorColor}
                      onChange={(e) => setNarratorColor(e.target.value)}
                      className="w-20"
                    />
                    <Input
                      value={narratorColor}
                      onChange={(e) => setNarratorColor(e.target.value)}
                      placeholder="#8B5CF6"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tato barva se použije pro vaše vypravěčské zprávy
                  </p>
                </div>

                <div className="p-3 border rounded-lg" style={{ color: narratorColor }}>
                  <p className="font-medium">Náhled vypravěčského textu</p>
                  <p className="text-sm">Takto bude vypadat váš vypravěčský text v chatu.</p>
                </div>

                <Button
                  onClick={() => updateNarratorColorMutation.mutate()}
                  disabled={updateNarratorColorMutation.isPending}
                  className="w-full"
                >
                  Uložit barvu vypravěče
                </Button>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}