import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { characterRequestSchema, insertHousingRequestSchema } from "@shared/types";
import { z } from "zod";
import { 
  User, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Home,
  ArrowLeft,
  UserPlus,
  Settings,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Trash2
} from "lucide-react";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { Select, SelectTrigger, SelectValue, SelectItem, SelectContent } from "@/components/ui/select";

type CharacterRequestForm = z.infer<typeof characterRequestSchema>;
type HousingRequestForm = z.infer<typeof insertHousingRequestSchema>;

interface CharacterRequest {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  school?: string;
  description?: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewNote?: string;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || '';

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

export default function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showNewRequestForm, setShowNewRequestForm] = useState(false);
  
  // Password and email change states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Email form state
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    confirmPassword: ''
  });

  // Housing form state
  const [showHousingForm, setShowHousingForm] = useState(false);
  const [housingType, setHousingType] = useState<'dormitory' | 'custom' | 'shared' | null>(null);
  const [locationType, setLocationType] = useState<'area' | 'custom' | null>(null);
  
  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    characterRequests: true,
    housingRequests: true,
    accountSettings: false,
    characterOrder: true,
    highlightWords: true
  });

  // Character order state
  const [characterOrder, setCharacterOrder] = useState<number[]>([]);
  const [highlightWords, setHighlightWords] = useState('');
  const [highlightColor, setHighlightColor] = useState('yellow');
  const [narratorColor, setNarratorColor] = useState('purple');
  
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Delete housing request mutation
  const deleteHousingRequestMutation = useMutation({
    mutationFn: (requestId: number) => 
      apiRequest("DELETE", `${API_URL}/api/housing-requests/${requestId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/housing-requests/my"] });
      toast({
        title: "Žádost byla stažena",
        description: "Vaše žádost o bydlení byla úspěšně stažena",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při stahování žádosti",
        description: error.message || "Nepodařilo se stáhnout žádost",
        variant: "destructive",
      });
    },
  });

  // Character order mutation
  const updateCharacterOrderMutation = useMutation({
    mutationFn: async (order: number[]) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/user/character-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ characterOrder: order })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nepodařilo se uložit pořadí postav');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate user data to reflect changes
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
      toast({
        title: "Pořadí postav uloženo",
        description: "Vaše nastavení pořadí postav bylo úspěšně uloženo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při ukládání",
        description: error.message || "Nepodařilo se uložit pořadí postav",
        variant: "destructive",
      });
    },
  });

  // Highlight words mutation
  const updateHighlightWordsMutation = useMutation({
    mutationFn: async (data: { words: string; color: string }) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/user/highlight-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          highlightWords: data.words,
          highlightColor: data.color 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nepodařilo se uložit zvýrazňovaná slova');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update local state immediately
      setHighlightWords(variables.words);
      setHighlightColor(variables.color);
      // Invalidate user data to refresh the cache
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
      toast({
        title: "Zvýrazňovaná slova uložena",
        description: "Vaše nastavení zvýrazňování slov bylo úspěšně uloženo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při ukládání",
        description: error.message || "Nepodařilo se uložit zvýrazňovaná slova",
        variant: "destructive",
      });
    },
  });

  // Narrator color mutation
  const updateNarratorColorMutation = useMutation({
    mutationFn: async (data: { color: string }) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/user/narrator-color`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          narratorColor: data.color 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nepodařilo se uložit barvu vypravěče');
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Update local state immediately
      setNarratorColor(variables.color);
      // Invalidate user data to refresh the cache
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
      toast({
        title: "Barva vypravěče uložena",
        description: "Vaše nastavení barvy vypravěče bylo úspěšně uloženo",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při ukládání",
        description: error.message || "Nepodařilo se uložit barvu vypravěče",
        variant: "destructive",
      });
    },
  });

  const form = useForm<CharacterRequestForm>({
    resolver: zodResolver(characterRequestSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      birthDate: "",
      school: "",
      description: "",
      reason: "",
    },
  });

  const housingForm = useForm<HousingRequestForm>({
    resolver: zodResolver(insertHousingRequestSchema),
    defaultValues: {
      requestType: "",
      size: "",
      location: "",
      customLocation: "",
      selectedArea: "",
      description: "",
    },
  });

  // Fetch user's character requests
  const { data: characterRequests = [] } = useQuery<CharacterRequest[]>({
    queryKey: ["/api/character-requests/my"],
    enabled: !!user,
  });

  // Fetch user's housing requests
  const { data: housingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/housing-requests/my"],
    enabled: !!user,
  });

  // Fetch chat categories for location selection
  const { data: chatCategories = [] } = useQuery({
    queryKey: ["/api/chat/categories"],
    enabled: !!user && housingType === 'custom' && locationType === 'area',
  });

  // Fetch user's characters using useAuth hook which already handles character loading
  const { data: allUserCharacters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user,
    queryFn: async () => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/characters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) {
        console.error('Failed to fetch characters:', response.status, response.statusText);
        throw new Error('Failed to fetch characters');
      }
      const data = await response.json();
      console.log('[user-settings] Characters response:', data);
      
      // Handle different response formats
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.characters)) {
        return data.characters;
      } else {
        console.warn('[user-settings] Unexpected characters data format:', data);
        return [];
      }
    }
  });

  // Also try to get characters from useAuth if available
  const authCharacters = user?.characters || [];
  
  // Merge characters from both sources and deduplicate
  const allCharacters = [
    ...(Array.isArray(allUserCharacters) ? allUserCharacters : []),
    ...(Array.isArray(authCharacters) ? authCharacters : [])
  ];
  const uniqueCharacters = allCharacters.filter((char, index, self) =>
    char &&
    typeof char.id === 'number' &&
    self.findIndex(c => c && c.id === char.id) === index
  );

  // Filter only alive characters (not in cemetery) and exclude system characters
  const userCharacters = Array.isArray(uniqueCharacters)
    ? uniqueCharacters.filter((char: any) => {
        return char && !char.deathDate && !char.isSystem;
      })
    : [];

  console.log('[user-settings] Final userCharacters:', userCharacters);

  // Initialize user settings from user data
  useEffect(() => {
    if (user) {
      // Initialize highlight words
      if (user.highlightWords) {
        setHighlightWords(user.highlightWords);
      }
      
      // Initialize highlight color
      if (user.highlightColor) {
        setHighlightColor(user.highlightColor);
      }
      
      // Initialize narrator color
      if (user.narratorColor) {
        setNarratorColor(user.narratorColor);
      }
    }
  }, [user]);

  // Initialize character order when userCharacters is loaded
  useEffect(() => {
    console.log('[user-settings] Character order effect triggered:', { 
      userCharactersLength: userCharacters.length, 
      userCharacterOrder: user?.characterOrder,
      currentCharacterOrder: characterOrder 
    });
    
    if (userCharacters && userCharacters.length > 0) {
      if (user?.characterOrder && Array.isArray(user.characterOrder) && user.characterOrder.length > 0) {
        // Filter saved order to only include existing characters
        const validOrder = user.characterOrder.filter(id => 
          userCharacters.some((char: any) => char.id === id)
        );
        
        // Add any new characters not in the saved order
        const newCharacterIds = userCharacters
          .map((char: any) => char.id)
          .filter(id => !validOrder.includes(id));
        
        const finalOrder = [...validOrder, ...newCharacterIds];
        
        if (JSON.stringify(finalOrder) !== JSON.stringify(characterOrder)) {
          console.log('Setting character order from user preferences:', finalOrder);
          setCharacterOrder(finalOrder);
        }
      } else {
        // Create initial order from current characters
        const initialOrder = userCharacters.map((char: any) => char.id);
        if (JSON.stringify(initialOrder) !== JSON.stringify(characterOrder)) {
          console.log('Creating initial character order:', initialOrder);
          setCharacterOrder(initialOrder);
        }
      }
    } else if (userCharacters.length === 0 && characterOrder.length > 0) {
      // Clear character order if no characters available
      console.log('Clearing character order - no characters available');
      setCharacterOrder([]);
    }
  }, [userCharacters, user?.characterOrder]);


  // Create character request mutation
  const createRequestMutation = useMutation({
    mutationFn: async (data: CharacterRequestForm) => {
      const response = await apiRequest("POST", `${API_URL}/api/character-requests`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Žádost odeslána",
        description: "Vaše žádost o novou postavu byla odeslána k posouzení administrátorům.",
      });
      form.reset();
      setShowNewRequestForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/character-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/characters/all"] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se odeslat žádost",
        variant: "destructive",
      });
    },
  });

  // Delete character request mutation
  const deleteRequestMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await apiRequest("DELETE", `${API_URL}/api/character-requests/${requestId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Žádost stažena",
        description: "Vaše žádost o novou postavu byla úspěšně stažena.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/character-requests/my"] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se stáhnout žádost",
        variant: "destructive",
      });
    },
  });

  // Create housing request mutation
  const createHousingRequestMutation = useMutation({
    mutationFn: async (data: HousingRequestForm) => {
      const response = await apiRequest("POST", `${API_URL}/api/housing-requests`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Nepodařilo se odeslat žádost o bydlení");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/housing-requests/my"] });
      toast({
        title: "Žádost odeslána",
        description: "Vaše žádost o bydlení byla úspěšně odeslána a čeká na vyřízení.",
      });
      housingForm.reset();
      setShowHousingForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při odesílání žádosti",
        description: error.message || "Nepodařilo se odeslat žádost o bydlení",
        variant: "destructive",
      });
    },
  });



  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", `${API_URL}/api/auth/change-password`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Nepodařilo se změnit heslo");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Heslo změněno",
        description: "Vaše heslo bylo úspěšně změněno.",
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při změně hesla",
        description: error.message || "Nepodařilo se změnit heslo",
        variant: "destructive",
      });
    },
  });

  // Change email mutation
  const changeEmailMutation = useMutation({
    mutationFn: async (data: { newEmail: string; confirmPassword: string }) => {
      const response = await apiRequest("POST", `${API_URL}/api/auth/change-email`, data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Nepodařilo se změnit email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Email změněn",
        description: "Váš email byl úspěšně změněn.",
      });
      setEmailForm({ newEmail: '', confirmPassword: '' });
      setShowEmailForm(false);
      queryClient.invalidateQueries({ queryKey: [`${API_URL}/api/auth/user`] });
    },
    onError: (error: any) => {
      toast({
        title: "Chyba při změně emailu",
        description: error.message || "Nepodařilo se změnit email",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CharacterRequestForm) => {
    createRequestMutation.mutate(data);
  };

  const onHousingSubmit = (data: HousingRequestForm) => {
    if (!user) return;
    
    // Pro ubytovnu automaticky nastavíme požadované hodnoty
    if (housingType === 'dormitory') {
      createHousingRequestMutation.mutate({
        ...data,
        requestType: 'dormitory',
        size: 'jednolůžkový pokoj',
        location: 'Ubytovna U starého Šeptáka',
        description: 'Žádost o pokoj na ubytovně',
      });
    } else if (housingType === 'shared') {
      // Pro sdílené bydlení nastavíme speciální hodnoty
      createHousingRequestMutation.mutate({
        ...data,
        requestType: 'shared',
        location: 'shared',
        size: null, // Není relevantní pro sdílené bydlení
      });
    } else {
      createHousingRequestMutation.mutate(data);
    }
  };

  // Validation functions
  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return "Heslo musí mít alespoň 8 znaků";
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return "Heslo musí obsahovat alespoň jedno malé písmeno";
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return "Heslo musí obsahovat alespoň jedno velké písmeno";
    }
    if (!/(?=.*\d)/.test(password)) {
      return "Heslo musí obsahovat alespoň jednu číslici";
    }
    return null;
  };

  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Neplatný formát emailu";
    }
    return null;
  };

  // Handler functions
  const handlePasswordChange = () => {
    const passwordError = validatePassword(passwordForm.newPassword);
    if (passwordError) {
      toast({
        title: "Neplatné heslo",
        description: passwordError,
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Hesla se neshodují",
        description: "Nové heslo a potvrzení hesla se musí shodovat",
        variant: "destructive",
      });
      return;
    }

    if (!passwordForm.currentPassword) {
      toast({
        title: "Chybí současné heslo",
        description: "Pro změnu hesla musíte zadat současné heslo",
        variant: "destructive",
      });
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const handleEmailChange = () => {
    const emailError = validateEmail(emailForm.newEmail);
    if (emailError) {
      toast({
        title: "Neplatný email",
        description: emailError,
        variant: "destructive",
      });
      return;
    }

    if (!emailForm.confirmPassword) {
      toast({
        title: "Chybí heslo",
        description: "Pro změnu emailu musíte zadat současné heslo",
        variant: "destructive",
      });
      return;
    }

    changeEmailMutation.mutate({
      newEmail: emailForm.newEmail,
      confirmPassword: emailForm.confirmPassword,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Čeká na posouzení</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Schváleno</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Zamítnuto</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Přihlaste se pro přístup k nastavení</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět na hlavní stránku
            </Button>
            <div className="flex items-center space-x-2">
              <Settings className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Nastavení uživatele</h1>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              <User className="mr-1 h-3 w-3" />
              {user.username}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Account Security Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Bezpečnost účtu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Account Info */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">Aktuální údaje</h4>
                    <p className="text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 inline mr-2" />
                      Email: {user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Change Password */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">Změna hesla</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                    >
                      {showPasswordForm ? "Zrušit" : "Změnit heslo"}
                    </Button>
                  </div>
                  
                  {showPasswordForm && (
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="currentPassword">Současné heslo</Label>
                        <div className="relative">
                          <Input
                            id="currentPassword"
                            type={showCurrentPassword ? "text" : "password"}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                            placeholder="Zadejte současné heslo"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="newPassword">Nové heslo</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                            placeholder="Zadejte nové heslo"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Minimálně 8 znaků, obsahuje velké a malé písmeno a číslici
                        </p>
                      </div>
                      
                      <div>
                        <Label htmlFor="confirmPassword">Potvrzení nového hesla</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                            placeholder="Potvrďte nové heslo"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <Button
                        onClick={handlePasswordChange}
                        disabled={changePasswordMutation.isPending}
                        className="w-full"
                      >
                        {changePasswordMutation.isPending ? "Měním heslo..." : "Změnit heslo"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Change Email */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">Změna emailu</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowEmailForm(!showEmailForm)}
                    >
                      {showEmailForm ? "Zrušit" : "Změnit email"}
                    </Button>
                  </div>
                  
                  {showEmailForm && (
                    <div className="space-y-3 p-4 border rounded-lg">
                      <div>
                        <Label htmlFor="newEmail">Nový email</Label>
                        <Input
                          id="newEmail"
                          type="email"
                          value={emailForm.newEmail}
                          onChange={(e) => setEmailForm({...emailForm, newEmail: e.target.value})}
                          placeholder="Zadejte nový email"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="confirmPasswordEmail">Potvrďte heslem</Label>
                        <Input
                          id="confirmPasswordEmail"
                          type="password"
                          value={emailForm.confirmPassword}
                          onChange={(e) => setEmailForm({...emailForm, confirmPassword: e.target.value})}
                          placeholder="Zadejte současné heslo"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Pro změnu emailu musíte zadat současné heslo
                        </p>
                      </div>
                      
                      <Button
                        onClick={handleEmailChange}
                        disabled={changeEmailMutation.isPending}
                        className="w-full"
                      >
                        {changeEmailMutation.isPending ? "Měním email..." : "Změnit email"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Character Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Správa postav
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userCharacters.length > 0 ? (
                <div className="space-y-3">
                  {userCharacters.map((character: any) => (
                    <div key={character.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <CharacterAvatar character={character} size="md" />
                        
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-foreground">
                              {character.firstName} {character.middleName} {character.lastName}
                            </h4>

                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/characters/${character.id}`}
                        >
                          Zobrazit profil
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/character/edit?characterId=${character.id}`}
                        >
                          Upravit
                        </Button>

                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Zatím nemáte žádné postavy</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Požádejte o vytvoření nové postavy níže
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Character Requests Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                  onClick={() => toggleSection('characterRequests')}
                >
                  <UserPlus className="h-5 w-5" />
                  Žádosti o nové postavy
                  {collapsedSections.characterRequests ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronUp className="h-4 w-4" />
                  }
                </CardTitle>
                {!showNewRequestForm && !collapsedSections.characterRequests && (
                  <Button 
                    onClick={() => setShowNewRequestForm(true)}
                    className="bg-accent hover:bg-accent/90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Požádat o novou postavu
                  </Button>
                )}
              </div>
            </CardHeader>
            {!collapsedSections.characterRequests && (
            <CardContent className="space-y-4">
              {/* New Request Form */}
              {showNewRequestForm && (
                <Card className="border-2 border-accent/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Nová žádost o postavu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="firstName">Křestní jméno *</Label>
                          <Input
                            id="firstName"
                            {...form.register("firstName")}
                            placeholder="Křestní jméno"
                          />
                          {form.formState.errors.firstName && (
                            <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="middleName">Prostřední jméno</Label>
                          <Input
                            id="middleName"
                            {...form.register("middleName")}
                            placeholder="Prostřední jméno (volitelné)"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Příjmení *</Label>
                          <Input
                            id="lastName"
                            {...form.register("lastName")}
                            placeholder="Příjmení"
                          />
                          {form.formState.errors.lastName && (
                            <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="birthDate">Datum narození *</Label>
                          <Input
                            id="birthDate"
                            type="date"
                            min="1860-01-01"
                            max="1910-12-31"
                            {...form.register("birthDate")}
                            onFocus={(e) => {
                              // Nastavit výchozí rok na herní dobu
                              if (!e.target.value) {
                                e.target.value = "1900-01-01";
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Roky 1860-1910 (věk v roce 1926: 16-66 let)
                          </p>
                          {form.formState.errors.birthDate && (
                            <p className="text-sm text-destructive">{form.formState.errors.birthDate.message}</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="school">Škola *</Label>
                          <Select
                            value={form.watch("school") || ""}
                            onValueChange={value => form.setValue("school", value)}
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
                          {form.formState.errors.school && (
                            <p className="text-sm text-destructive">{form.formState.errors.school.message}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="description">Popis postavy</Label>
                        <Textarea
                          id="description"
                          {...form.register("description")}
                          placeholder="Stručný popis vzhledu, osobnosti, pozadí..."
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="reason">Důvod pro vytvoření postavy *</Label>
                        <Textarea
                          id="reason"
                          {...form.register("reason")}
                          placeholder="Vysvětlete, proč chcete vytvořit tuto postavu a jak zapadne do příběhu..."
                          rows={4}
                        />
                        {form.formState.errors.reason && (
                          <p className="text-sm text-destructive">{form.formState.errors.reason.message}</p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowNewRequestForm(false);
                            form.reset();
                          }}
                        >
                          Zrušit
                        </Button>
                        <Button
                          type="submit"
                          disabled={createRequestMutation.isPending}
                          className="bg-accent hover:bg-accent/90"
                        >
                          {createRequestMutation.isPending ? "Odesílám..." : "Odeslat žádost"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Existing Requests */}
              {characterRequests.length > 0 ? (
                <div className="space-y-3">
                  {characterRequests.map((request) => (
                    <Card key={request.id} className="border-l-4 border-l-accent/30">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-medium">
                                {request.firstName} {request.middleName} {request.lastName}
                              </h4>
                              {getStatusBadge(request.status)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <p>Datum narození: {formatDate(request.birthDate)}</p>
                              {request.school && <p>Škola: {request.school}</p>}
                            </div>
                            <p className="text-sm">{request.reason}</p>
                            {request.reviewNote && (
                              <div className="p-3 bg-muted/50 rounded">
                                <p className="text-sm font-medium">Poznámka administrátora:</p>
                                <p className="text-sm">{request.reviewNote}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-xs text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </div>
                            {request.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm("Opravdu chcete stáhnout tuto žádost? Tato akce je nevratná.")) {
                                    deleteRequestMutation.mutate(request.id);
                                  }
                                }}
                                disabled={deleteRequestMutation.isPending}
                                className="text-xs"
                              >
                                Stáhnout žádost
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Zatím nemáte žádné žádosti o nové postavy</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Klikněte na tlačítko výše pro vytvoření nové žádosti
                  </p>
                </div>
              )}
            </CardContent>
            )}
          </Card>

          {/* Housing Requests Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                  onClick={() => toggleSection('housingRequests')}
                >
                  <Home className="h-5 w-5" />
                  Žádosti o bydlení
                  {collapsedSections.housingRequests ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronUp className="h-4 w-4" />
                  }
                </CardTitle>
                {!collapsedSections.housingRequests && (
                <Button 
                  onClick={() => setShowHousingForm(!showHousingForm)}
                  className="bg-accent hover:bg-accent/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Požádat o bydlení
                </Button>
                )}
              </div>
            </CardHeader>
            {!collapsedSections.housingRequests && (
            <CardContent className="space-y-4">
              {/* Housing Request Form */}
              {showHousingForm && (
                <Card className="border-2 border-accent/20">
                  <CardHeader>
                    <CardTitle className="text-lg">Nová žádost o bydlení</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Požádejte o přidělení bytu, domu, sídla nebo pokoje na ubytovně pro svou postavu. Po schválení bude adresa přidána do profilu postavy a bude vytvořena soukromá místnost pro roleplay, v případě ubytovny se jedná o veřejný chat.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={housingForm.handleSubmit(onHousingSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="characterId" className="text-foreground">Postava *</Label>
                        <select
                          id="characterId"
                          {...housingForm.register("characterId", { valueAsNumber: true })}
                          className="w-full p-2 border rounded-md bg-background text-foreground"
                        >
                          <option value="">Vyberte postavu</option>
                          {userCharacters?.map((character: any) => (
                            <option key={character.id} value={character.id}>
                              {character.firstName} {character.middleName ? `${character.middleName} ` : ''}{character.lastName}
                            </option>
                          ))}
                        </select>
                        {housingForm.formState.errors.characterId && (
                          <p className="text-sm text-destructive">{housingForm.formState.errors.characterId.message}</p>
                        )}
                      </div>

                      {/* Typ bydlení - checkboxy */}
                      <div className="space-y-3">
                        <Label className="text-foreground">Typ žádosti *</Label>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="custom-housing"
                              checked={housingType === 'custom'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setHousingType('custom');
                                  housingForm.setValue('requestType', 'apartment');
                                } else {
                                  setHousingType(null);
                                  housingForm.setValue('requestType', '');
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <label htmlFor="custom-housing" className="text-foreground">Vlastní bydlení</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="dormitory-housing"
                              checked={housingType === 'dormitory'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setHousingType('dormitory');
                                  housingForm.setValue('requestType', 'dormitory');
                                } else {
                                  setHousingType(null);
                                  housingForm.setValue('requestType', '');
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <label htmlFor="dormitory-housing" className="text-foreground">Pokoj na ubytovně</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="shared-housing"
                              checked={housingType === 'shared'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setHousingType('shared');
                                  housingForm.setValue('requestType', 'shared');
                                } else {
                                  setHousingType(null);
                                  housingForm.setValue('requestType', '');
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <label htmlFor="shared-housing" className="text-foreground">Přiřazení k existující adrese</label>
                          </div>
                        </div>
                      </div>

                      {/* Pokud je vybrána ubytovna */}
                      {housingType === 'dormitory' && (
                        <div className="bg-accent/10 p-4 rounded-md">
                          <h3 className="text-lg font-semibold text-foreground mb-2">Vítejte v ubytovně U starého Šeptáka</h3>
                          <p className="text-muted-foreground">
                            Vaše žádost o pokoj na ubytovně bude automaticky schválena. Ubytovna poskytuje základní ubytování pro začínající čaroděje.
                          </p>
                        </div>
                      )}

                      {/* Pokud je vybráno sdílené bydlení */}
                      {housingType === 'shared' && (
                        <div className="space-y-4">
                          <div className="bg-blue-500/10 p-4 rounded-md">
                            <h3 className="text-lg font-semibold text-foreground mb-2">Přiřazení k existující adrese</h3>
                            <p className="text-muted-foreground">
                              Tato možnost vám umožní požádat o přiřazení k již existující adrese, kde už někdo bydlí. 
                              Ideální pro postavy, které chtějí bydlet spolu (manželé, sourozenci, přátelé, atd.).
                            </p>
                          </div>
                          
                          <div>
                            <Label htmlFor="existingAddress" className="text-foreground">Existující adresa *</Label>
                            <Input
                              id="existingAddress"
                              {...housingForm.register("customLocation")}
                              placeholder="Zadejte přesnou adresu, ke které chcete být přiřazeni"
                              className="bg-background text-foreground"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              Ujistěte se, že adresa existuje a má správný formát (např. "Londýn - Vila Rosewood, Kensington").
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Pokud je vybráno vlastní bydlení */}
                      {housingType === 'custom' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="requestType" className="text-foreground">Typ bydlení *</Label>
                              <select
                                id="requestType"
                                {...housingForm.register("requestType")}
                                className="w-full p-2 border rounded-md bg-background text-foreground"
                              >
                                <option value="">Vyberte typ</option>
                                <option value="apartment">Byt</option>
                                <option value="house">Dům</option>
                                <option value="mansion">Sídlo</option>
                              </select>
                              {housingForm.formState.errors.requestType && (
                                <p className="text-sm text-destructive">{housingForm.formState.errors.requestType.message}</p>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="size" className="text-foreground">Velikost</Label>
                              <Input
                                id="size"
                                {...housingForm.register("size")}
                                placeholder="např. 2+1, malý dům, prostorné sídlo"
                                className="bg-background text-foreground"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="housingName" className="text-foreground">Název bydlení</Label>
                              <Input
                                id="housingName"
                                {...housingForm.register("housingName")}
                                placeholder="např. Villa Rosewood, Apartmán u Zlaté Konvice"
                                className="bg-background text-foreground"
                              />
                            </div>
                            <div>
                              <Label htmlFor="housingPassword" className="text-foreground">Heslo pro vstup</Label>
                              <Input
                                id="housingPassword"
                                {...housingForm.register("housingPassword")}
                                placeholder="heslo pro přístup do soukromé místnosti"
                                className="bg-background text-foreground"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Umístění pouze pro vlastní bydlení */}
                      {housingType === 'custom' && (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-foreground">Umístění *</Label>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="area-location"
                                  checked={locationType === 'area'}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setLocationType('area');
                                      housingForm.setValue('location', 'area');
                                      housingForm.setValue('customLocation', '');
                                    } else {
                                      setLocationType(null);
                                      housingForm.setValue('location', '');
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <label htmlFor="area-location" className="text-foreground">Oblast z nabídky</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  id="custom-location"
                                  checked={locationType === 'custom'}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setLocationType('custom');
                                      housingForm.setValue('location', 'custom');
                                      housingForm.setValue('selectedArea', '');
                                    } else {
                                      setLocationType(null);
                                      housingForm.setValue('location', '');
                                    }
                                  }}
                                  className="w-4 h-4"
                                />
                                <label htmlFor="custom-location" className="text-foreground">Vlastní adresa</label>
                              </div>
                            </div>
                          </div>

                          {/* Oblast z nabídky */}
                          {locationType === 'area' && (
                            <div>
                              <Label htmlFor="selectedArea" className="text-foreground">Vyberte oblast</Label>
                              <select
                                id="selectedArea"
                                {...housingForm.register("selectedArea")}
                                className="w-full p-2 border rounded-md bg-background text-foreground"
                              >
                                <option value="">Vyberte oblast</option>
                                {chatCategories && chatCategories.length > 0 ? (
                                  chatCategories.map((category: any) => (
                                    <optgroup key={category.id} label={category.name}>
                                      {category.children && category.children.map((subcategory: any) => (
                                        <option key={subcategory.id} value={subcategory.name}>
                                          {subcategory.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))
                                ) : (
                                  <>
                                    <option value="Kouzelnický Londýn">Kouzelnický Londýn</option>
                                    <option value="Příčná ulice">Příčná ulice</option>
                                    <option value="Obrtlá ulice">Obrtlá ulice</option>
                                    <option value="Ministerstvo kouzel">Ministerstvo kouzel</option>
                                    <option value="Nemocnice u sv. Munga">Nemocnice u sv. Munga</option>
                                    <option value="Katakomby">Katakomby</option>
                                  </>
                                )}
                              </select>
                            </div>
                          )}

                          {/* Vlastní adresa */}
                          {locationType === 'custom' && (
                            <div>
                              <Label htmlFor="customLocation" className="text-foreground">Vlastní adresa</Label>
                              <Input
                                id="customLocation"
                                {...housingForm.register("customLocation")}
                                placeholder="Zadejte konkrétní adresu"
                                className="bg-background text-foreground"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Popis pouze pokud není ubytovna */}
                      {housingType && housingType !== 'dormitory' && (
                        <div>
                          <Label htmlFor="description" className="text-foreground">Popis žádosti *</Label>
                          <Textarea
                            id="description"
                            {...housingForm.register("description")}
                            placeholder={
                              housingType === 'shared' 
                                ? "Popište důvod pro sdílení bydlení, vztah k ostatním obyvatelům a jakékoliv další informace pro administrátory..."
                                : "Popište důvod žádosti, specifické požadavky a jakékoliv další informace pro administrátory..."
                            }
                            rows={4}
                            className="bg-background text-foreground"
                          />
                          {housingForm.formState.errors.description && (
                            <p className="text-sm text-destructive">{housingForm.formState.errors.description.message}</p>
                          )}
                        </div>
                      )}

                      {/* Tlačítko odesílání - vždy zobrazeno */}
                      {housingType && (
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            disabled={createHousingRequestMutation.isPending}
                            className="bg-accent hover:bg-accent/90"
                          >
                            {createHousingRequestMutation.isPending ? "Odesílám..." : "Odeslat žádost"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowHousingForm(false);
                              setHousingType(null);
                              setLocationType(null);
                              housingForm.reset();
                            }}
                          >
                            Zrušit
                          </Button>
                        </div>
                      )}
                    </form>
                  </CardContent>
                </Card>
              )}

              {/* Existing Housing Requests */}
              {housingRequests && housingRequests.length > 0 ? (
                <div className="space-y-3">
                  {housingRequests.map((request: any) => (
                    <Card key={request.id} className="border-l-4 border-l-accent">
                      <CardContent className="pt-6">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                request.status === 'pending' ? 'default' :
                                request.status === 'approved' ? 'secondary' : 'destructive'
                              }>
                                {request.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {request.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                                {request.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                                {request.status === 'pending' ? 'Čeká na vyřízení' :
                                 request.status === 'approved' ? 'Schváleno' : 'Zamítnuto'}
                              </Badge>
                              <span className="font-medium">
                                {request.requestType === 'apartment' ? 'Byt' :
                                 request.requestType === 'house' ? 'Dům' : 'Kolej'}
                              </span>
                              {request.size && <span className="text-muted-foreground">({request.size})</span>}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Postava:</span> {request.character?.firstName} {request.character?.lastName}
                            </div>
                            <div>
                              <span className="font-medium">Umístění:</span> {
                                request.location === 'area' ? request.selectedArea : request.customLocation
                              }
                            </div>
                          </div>

                          {request.assignedAddress && (
                            <div className="text-sm">
                              <span className="font-medium text-green-600">Přidělená adresa:</span> {request.assignedAddress}
                            </div>
                          )}

                          <div className="text-sm">
                            <span className="font-medium">Popis:</span> {request.description}
                          </div>

                          {request.reviewNote && (
                            <div className="text-sm">
                              <span className="font-medium">Poznámka administrátora:</span> {request.reviewNote}
                            </div>
                          )}

                          {request.status === 'pending' && (
                            <div className="flex justify-end mt-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (confirm("Opravdu chcete stáhnout tuto žádost? Tato akce je nevratná.")) {
                                    deleteHousingRequestMutation.mutate(request.id);
                                  }
                                }}
                                disabled={deleteHousingRequestMutation.isPending}
                                className="text-xs"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Stáhnout žádost
                              </Button>
                            </div>
                          )}
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
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Nastavte pořadí, ve kterém se budou vaše postavy zobrazovat v chat rozhraní při výběru postavy.
                </p>
                
                {userCharacters && userCharacters.length > 0 ? (
                  <div className="space-y-2">
                    {characterOrder.map((characterId: number, index: number) => {
                      const character = userCharacters.find((char: any) => char.id === characterId);
                      if (!character) return null;
                      
                      return (
                        <div key={character.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <CharacterAvatar character={character} size="sm" />
                            <div>
                              <div className="font-medium">
                                {character.firstName} {character.middleName} {character.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {character.deathDate ? 'Zemřel(a)' : 'Aktivní'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
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
                    <Button 
                      onClick={() => updateCharacterOrderMutation.mutate(characterOrder)}
                      disabled={updateCharacterOrderMutation.isPending}
                      className="w-full"
                    >
                      {updateCharacterOrderMutation.isPending ? 'Ukládám...' : 'Uložit pořadí'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Nemáte žádné postavy pro nastavení pořadí.
                  </p>
                )}
              </div>
            </CardContent>
            )}
          </Card>

          {/* Highlight Words Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="flex items-center gap-2 cursor-pointer hover:text-accent-foreground"
                  onClick={() => toggleSection('highlightWords')}
                >
                  <Eye className="h-5 w-5" />
                  Zvýrazňování slov v chatu
                  {collapsedSections.highlightWords ? 
                    <ChevronDown className="h-4 w-4" /> : 
                    <ChevronUp className="h-4 w-4" />
                  }
                </CardTitle>
              </div>
            </CardHeader>
            {!collapsedSections.highlightWords && (
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Zadejte slova oddělená mezerami, která chcete zvýraznit v chat zprávách. Jména postav se zvýrazňují automaticky.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="highlightWords">Slova k zvýraznění</Label>
                    <Input
                      id="highlightWords"
                      value={highlightWords}
                      onChange={(e) => setHighlightWords(e.target.value)}
                      placeholder="např: magie kouzlo ministerstvo"
                      className="bg-background text-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Slova oddělujte čárkou, bez mezery. Nerozlišují se malá a velká písmena.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="highlightColor">Barva zvýraznění</Label>
                    <select
                      id="highlightColor"
                      value={highlightColor}
                      onChange={(e) => setHighlightColor(e.target.value)}
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                    >
                      <option value="yellow">Žlutá</option>
                      <option value="purple">Fialová</option>
                      <option value="blue">Modrá</option>
                      <option value="green">Zelená</option>
                      <option value="red">Červená</option>
                      <option value="pink">Růžová</option>
                    </select>
                  </div>

                  <div className="p-3 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-2">Náhled:</p>
                    <div className="text-sm">
                      Toto je ukázka textu s <span 
                        className={`px-1 rounded ${
                          highlightColor === 'yellow' ? 'bg-yellow-200 text-yellow-900' :
                          highlightColor === 'purple' ? 'bg-purple-200 text-purple-900' :
                          highlightColor === 'blue' ? 'bg-blue-200 text-blue-900' :
                          highlightColor === 'green' ? 'bg-green-200 text-green-900' :
                          highlightColor === 'red' ? 'bg-red-200 text-red-900' :
                          'bg-pink-200 text-pink-900'
                        }`}
                      >
                        zvýrazněným slovem
                      </span> v chat zprávě.
                    </div>
                  </div>

                  <Button 
                    onClick={() => updateHighlightWordsMutation.mutate({ words: highlightWords, color: highlightColor })}
                    disabled={updateHighlightWordsMutation.isPending}
                    className="w-full"
                  >
                    {updateHighlightWordsMutation.isPending ? 'Ukládám...' : 'Uložit nastavení'}
                  </Button>
                </div>
              </div>
            </CardContent>
            )}
          </Card>

          {/* Narrator Settings */}
          {(user?.canNarrate || user?.role === 'admin') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">V</span>
                  </div>
                  Nastavení vypravěče
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="narratorColor">Barva vypravěčských zpráv</Label>
                    <select
                      id="narratorColor"
                      value={narratorColor}
                      onChange={(e) => setNarratorColor(e.target.value)}
                      className="w-full p-2 border rounded-md bg-background text-foreground"
                    >
                      <option value="yellow">Žlutá</option>
                      <option value="red">Červená</option>
                      <option value="blue">Modrá</option>
                      <option value="green">Zelená</option>
                      <option value="pink">Růžová</option>
                      <option value="purple">Fialová</option>
                    </select>
                  </div>

                  <div className="p-3 border rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-2">Náhled vypravěčské zprávy:</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center"
                           style={{
                             backgroundColor: 
                               narratorColor === 'yellow' ? '#fbbf24' :
                               narratorColor === 'red' ? '#ef4444' :
                               narratorColor === 'blue' ? '#3b82f6' :
                               narratorColor === 'green' ? '#10b981' :
                               narratorColor === 'pink' ? '#ec4899' :
                               '#8b5cf6'
                           }}>
                        <span className="text-xs font-bold text-white">V</span>
                      </div>
                      <div className="text-sm italic"
                           style={{
                             color: 
                               narratorColor === 'yellow' ? '#fbbf24' :
                               narratorColor === 'red' ? '#ef4444' :
                               narratorColor === 'blue' ? '#3b82f6' :
                               narratorColor === 'green' ? '#10b981' :
                               narratorColor === 'pink' ? '#ec4899' :
                               '#8b5cf6'
                           }}>
                        Toto je ukázka vypravěčské zprávy...
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={() => updateNarratorColorMutation.mutate({ color: narratorColor })}
                    disabled={updateNarratorColorMutation.isPending}
                    className="w-full"
                  >
                    {updateNarratorColorMutation.isPending ? 'Ukládám...' : 'Uložit barvu vypravěče'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}