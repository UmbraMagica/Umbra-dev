import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Download, Archive, ArrowLeft, Dices, Coins, Trash2, Wand2 } from "lucide-react";
import { format } from "date-fns";
import { RoomDescription } from "@/components/RoomDescription";

interface ChatRoom {
  id: number;
  name: string;
  description?: string;
  longDescription?: string;
  isPublic: boolean;
  createdAt: string;
}

interface ChatMessage {
  id: number;
  roomId: number;
  characterId: number;
  content: string;
  body?: string;      // <-- přidat
  messageType: string;
  createdAt: string;
  character: {
    id: number;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    userId: number;
  };
}
const getMessageText = (msg: ChatMessage) =>
  msg.content ?? msg.body ?? '';      // vrátí tělo zprávy

const MAX_MESSAGE_LENGTH = 5000;
const MIN_MESSAGE_LENGTH = 1;
const API_URL = import.meta.env.VITE_API_URL || '';

// Helper function to safely get character name
function getCharacterName(message: any): string {
  console.log('getCharacterName called with:', { 
    messageId: message.id,
    characterId: message.characterId, 
    character: message.character,
    messageType: message.messageType 
  });

  // 1. Pokud je to narrator zpráva (characterId === 0)
  if (message.characterId === 0 || message.messageType === 'narrator') {
    return 'Vypravěč';
  }

  // 2. Pokud máme načtenou postavu, použijeme její jméno
  if (message.character && message.character.firstName) {
    const { firstName, middleName, lastName } = message.character;
    return [firstName, middleName, lastName].filter(Boolean).join(' ');
  }

  // 3. Pokud má characterId, ale postava není načtená
  if (message.characterId && message.characterId > 0) {
    return `Postava #${message.characterId}`;
  }

  // 4. Fallback
  return 'Neznámá postava';
}

// Helper function to safely get character initials
function getCharacterInitials(obj: any): string {
  if (!obj) return 'NP';
  if (obj.firstName && obj.lastName) {
    return `${obj.firstName.charAt(0) || 'N'}${obj.lastName.charAt(0) || 'P'}`;
  }
  if (obj.character && obj.character.firstName && obj.character.lastName) {
    return `${obj.character.firstName.charAt(0) || 'N'}${obj.character.lastName.charAt(0) || 'P'}`;
  }
  return 'NP';
}

export default function ChatRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messageInput, setMessageInput] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<any>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isNarratorMode, setIsNarratorMode] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentRoomId = roomId ? parseInt(roomId) : null;

  // Use characters from useAuth
  const { user, isLoading: authLoading } = useAuth();
  const [showPresence, setShowPresence] = useState(false);
  const [showRoomDescription, setShowRoomDescription] = useState(false);

  // Function to highlight words in message content
  const renderMessageWithHighlight = (content: string, highlightWords?: string, highlightColor?: string) => {
    if (!highlightWords || !highlightWords.trim()) {
      return content;
    }

    const words = highlightWords.split(',').map(word => word.trim()).filter(word => word.length > 0);
    if (words.length === 0) {
      return content;
    }

    const colorClass = {
      'yellow': 'bg-yellow-200/60 text-yellow-900 dark:bg-yellow-400/30 dark:text-yellow-100',
      'purple': 'bg-purple-200/60 text-purple-900 dark:bg-purple-400/30 dark:text-purple-100',
      'blue': 'bg-blue-200/60 text-blue-900 dark:bg-blue-400/30 dark:text-blue-100',
      'green': 'bg-green-200/60 text-green-900 dark:bg-green-400/30 dark:text-green-100',
      'red': 'bg-red-200/60 text-red-900 dark:bg-red-400/30 dark:text-red-100',
      'pink': 'bg-pink-200/60 text-pink-900 dark:bg-pink-400/30 dark:text-pink-100'
    }[highlightColor || 'yellow'] || 'bg-yellow-200/60 text-yellow-900 dark:bg-yellow-400/30 dark:text-yellow-100';

    let highlightedContent = content;

    words.forEach(word => {
      // Escape special regex characters
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Remove word boundaries to allow partial matches and case insensitive search
      const regex = new RegExp(`(${escapedWord})`, 'gi');
      highlightedContent = highlightedContent.replace(regex, `<span class="${colorClass}">$1</span>`);
    });

    return <span dangerouslySetInnerHTML={{ __html: highlightedContent }} />;
  };

  // Safe character processing
  const userCharactersRaw = user?.characters || [];
  const charactersLoading = authLoading;
  const getMessageContent = (msg: any) =>
    msg?.content ?? msg?.body ?? msg?.text ?? "";

  console.log('[ChatRoom] FULL DEBUG - User characters raw:', userCharactersRaw);
  console.log('[ChatRoom] FULL DEBUG - User characters count:', userCharactersRaw.length);
  console.log('[ChatRoom] FULL DEBUG - Current user ID:', user?.id);

  // Process user characters - only alive, non-system characters belonging to the user
  const userCharactersFiltered = Array.isArray(userCharactersRaw) ? 
    userCharactersRaw.filter(char => 
      char && 
      !char.deathDate && 
      !char.isSystem &&
      char.userId === user?.id
    ) : [];

  // Apply character ordering from user settings
  const userCharacters = React.useMemo(() => {
    if (!userCharactersFiltered.length) return [];
    
    const characterOrder = user?.characterOrder;
    if (!characterOrder || !Array.isArray(characterOrder) || characterOrder.length === 0) {
      return userCharactersFiltered;
    }

    // Create ordered array based on user preferences
    const orderedCharacters: any[] = [];
    const remainingCharacters = [...userCharactersFiltered];

    // First, add characters in the specified order
    characterOrder.forEach((characterId: number) => {
      const characterIndex = remainingCharacters.findIndex(char => char.id === characterId);
      if (characterIndex !== -1) {
        orderedCharacters.push(remainingCharacters[characterIndex]);
        remainingCharacters.splice(characterIndex, 1);
      }
    });

    // Then add any remaining characters that weren't in the order
    orderedCharacters.push(...remainingCharacters);

    return orderedCharacters;
  }, [userCharactersFiltered, user?.characterOrder]);

  console.log('[ChatRoom] FULL DEBUG - Filtered user characters:', userCharacters);
  console.log('[ChatRoom] FULL DEBUG - Filtered characters count:', userCharacters.length);

  // Fetch current room info
  const { data: rooms = [], isLoading: roomsLoading } = useQuery<ChatRoom[]>({
    queryKey: ["/api/chat/rooms"],
    enabled: !!user,
    retry: 3,
    staleTime: 30000,
  });

  const currentRoom = rooms.find(r => r.id === currentRoomId);

  // Fetch messages for current room
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/rooms", currentRoomId, "messages"],
    queryFn: async () => {
      console.log(`[CHAT-ROOM][fetch] Fetching messages for room ${currentRoomId}`);
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/rooms/${currentRoomId}/messages`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });
      if (!response.ok) {
        console.error(`[CHAT-ROOM][fetch] Failed to fetch messages: ${response.status} ${response.statusText}`);
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      console.log(`[CHAT-ROOM][fetch] Načtené zprávy z API:`, data);
      console.log(`[CHAT-ROOM][fetch] Total messages: ${data.length}`);

      // Debug: zkontroluj každou zprávu
      data.forEach((msg: any, index: number) => {
        if (index < 5) { // First 5 messages only
          console.log(`[CHAT-ROOM][fetch] Message ${index}:`, {
            id: msg.id,
            characterId: msg.characterId,
            messageType: msg.messageType,
            hasCharacter: !!msg.character,
            characterData: msg.character,
            content: msg.content?.substring(0, 50) + "..."
          });
        }
      });

      return data;
    },
    enabled: !!currentRoomId && !!user,
    retry: 3,
    staleTime: 10000,
  });

  // Auto-select first character when characters load, or enable narrator mode for admin without characters
  useEffect(() => {
    console.log('[ChatRoom] useEffect - Character selection check:', {
      selectedCharacter: selectedCharacter ? { id: selectedCharacter.id, name: getCharacterName(selectedCharacter) } : null,
      userCharactersLength: userCharacters.length,
      charactersLoading,
      isNarratorMode,
      userRole: user?.role
    });

    if (!selectedCharacter && userCharacters.length > 0 && !charactersLoading && !isNarratorMode) {
      console.log('[ChatRoom] Auto-selecting first character:', userCharacters[0]);
      setSelectedCharacter(userCharacters[0]);
    } else if (!selectedCharacter && userCharacters.length === 0 && user?.role === 'admin' && !isNarratorMode) {
      console.log('[ChatRoom] Admin has no own characters, enabling narrator mode');
      setIsNarratorMode(true);
    }
  }, [userCharacters, selectedCharacter, charactersLoading, isNarratorMode, user?.role]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user || !roomId) return;

    const token = localStorage.getItem('jwt_token');
    if (!token) {
      console.warn('No JWT token found for WebSocket connection');
      return;
    }

    try {
      const wsBaseUrl = import.meta.env.VITE_WS_URL || window.location.protocol.replace('http', 'ws') + '//' + window.location.host;
      const wsUrl = `${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);
      setWs(ws);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (data.type === 'new_message') {
            queryClient.invalidateQueries({ 
              queryKey: ["/api/chat/rooms", currentRoomId, "messages"] 
            });
          }
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [user, roomId, currentRoomId, queryClient]);

  // Keep scroll position at top for newest messages
  useEffect(() => {
    // No auto-scroll needed since newest messages appear at top
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string; messageType?: string; characterId: number }) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          roomId: currentRoomId,
          content: messageData.content,
          messageType: messageData.messageType || 'text',
          characterId: messageData.characterId,
        }),
      });

      if (!response.ok) {
        throw new Error('Nepodařilo se odeslat zprávu');
      }

      return response.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", currentRoomId, "messages"] });
    },
    onError: (error) => {
      console.error('Chyba při odesílání:', error);
      toast({
        title: "Chyba při odesílání zprávy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send narrator message mutation
  const sendNarratorMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/narrator-message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: currentRoomId,
          content: content.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Nepodařilo se odeslat vypravěčskou zprávu');
      }

      return response.json();
    },
    onSuccess: () => {
      setMessageInput("");
      setIsNarratorMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", currentRoomId, "messages"] });
    },
    onError: (error) => {
      console.error('Chyba při odesílání:', error);
      toast({
        title: "Chyba při odesílání zprávy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Archive messages mutation
  const archiveMessagesMutation = useMutation({
    mutationFn: async (roomId: number) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/rooms/${roomId}/archive`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Archivace se nezdařila");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Zprávy archivovány",
        description: "Chat byl úspěšně archivován a vymazán.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", currentRoomId, "messages"] });
    },
    onError: () => {
      toast({
        title: "Chyba při archivaci",
        description: "Nepodařilo se archivovat zprávy.",
        variant: "destructive",
      });
    },
  });

  // Dice roll mutation
  const diceRollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCharacter || !selectedCharacter.id) {
        throw new Error("Vyberte postavu");
      }

      if (!currentRoomId) {
        throw new Error("Neplatná místnost");
      }

      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/game/dice-roll`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          roomId: currentRoomId,
          characterId: selectedCharacter.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nepodařilo se hodit kostkou');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", currentRoomId, "messages"] });
    },
    onError: (error) => {
      console.error('Dice roll error:', error);
      toast({
        title: "Chyba při hodu kostkou",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Coin flip mutation
  const coinFlipMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCharacter || !selectedCharacter.id) {
        throw new Error("Vyberte postavu");
      }

      if (!currentRoomId) {
        throw new Error("Neplatná místnost");
      }

      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/game/coin-flip`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          roomId: currentRoomId,
          characterId: selectedCharacter.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Nepodařilo se hodit mincí');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms", currentRoomId, "messages"] });
    },
    onError: (error) => {
      console.error('Coin flip error:', error);
      toast({
        title: "Chyba při hodu mincí",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update room description mutation
  const updateRoomDescriptionMutation = useMutation({
    mutationFn: async (description: string) => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/rooms/${currentRoomId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ longDescription: description }),
      });

      if (!response.ok) {
        throw new Error('Nepodařilo se aktualizovat popis místnosti');
      }

      return response.json();
    },
    onSuccess: () => {
      setIsEditingDescription(false);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
      toast({
        title: "Popis aktualizován",
        description: "Popis místnosti byl úspěšně aktualizován.",
      });
    },
    onError: (error) => {
      toast({
        title: "Chyba při aktualizaci",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditDescription = () => {
    setEditedDescription(currentRoom?.longDescription || '');
    setIsEditingDescription(true);
  };

  const handleSaveDescription = () => {
    updateRoomDescriptionMutation.mutate(editedDescription);
  };

  const handleCancelEdit = () => {
    setIsEditingDescription(false);
    setEditedDescription('');
  };

  // Export chat function
  const exportChat = async () => {
    if (!currentRoomId) return;

    try {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/rooms/${currentRoomId}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Export se nezdařil');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `chat-export-${currentRoomId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Chat exportován",
        description: "Soubor byl stažen do vašeho počítače.",
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat chat.",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) {
      toast({
        title: "Chyba",
        description: "Zpráva nemůže být prázdná",
        variant: "destructive",
      });
      return;
    }
    if (!currentRoomId) {
      toast({
        title: "Chyba",
        description: "Neplatná místnost",
        variant: "destructive",
      });
      return;
    }
    if (isNarratorMode) {
      if (!canSendAsNarrator) {
        toast({
          title: "Chyba",
          description: "Nemáte oprávnění k vypravování",
          variant: "destructive",
        });
        return;
      }
      sendNarratorMessageMutation.mutate(messageInput.trim());
    } else {
      if (!selectedCharacter || !selectedCharacter.id) {
        toast({
          title: "Chyba",
          description: "Vyberte postavu pro odeslání zprávy",
          variant: "destructive",
        });
        return;
      }
      if (selectedCharacter.deathDate) {
        toast({
          title: "Chyba",
          description: "Nelze odesílat zprávy s mrtvou postavou",
          variant: "destructive",
        });
        return;
      }
      console.log('Odesílám zprávu:', {
        content: messageInput.trim(),
        characterId: selectedCharacter.id,
      });
      sendMessageMutation.mutate({
        content: messageInput.trim(),
        characterId: selectedCharacter.id,
      });
    }
  };

  // Check if user can send as narrator
  const canSendAsNarrator = user?.role === 'admin' || user?.canNarrate;

  const formatMessageTime = (dateString: string) => {
    return format(new Date(dateString), "dd.MM.yyyy HH:mm");
  };

  useEffect(() => {
    if (user && userCharacters.length === 0 && !canSendAsNarrator) {
      setLocation('/');
    }
  }, [user, userCharacters, canSendAsNarrator, setLocation]);

  // Debug log pro načtené zprávy
  useEffect(() => {
    console.log('Načtené zprávy z API:', messages);
    messages.forEach((msg, idx) => {
      console.log(`Message ${idx}:`, {
        id: msg.id,
        content: msg.content,
        messageType: msg.messageType,
        characterId: msg.characterId,
        character: msg.character,
        createdAt: msg.createdAt
      });
    });
  }, [messages]);

  // Přítomnost v místnosti (room_presence)
  useEffect(() => {
    if (!selectedCharacter || !selectedCharacter.id || !currentRoomId) return;
    const token = localStorage.getItem('jwt_token');
    // Vstup do místnosti
    fetch(`${API_URL}/api/room-presence/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ characterId: selectedCharacter.id, roomId: currentRoomId })
    });
    // Odchod z místnosti při unmountu nebo změně místnosti/postavy
    return () => {
      fetch(`${API_URL}/api/room-presence/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ characterId: selectedCharacter.id, roomId: currentRoomId })
      });
    };
  }, [selectedCharacter, currentRoomId]);

  // Loading states
  if (authLoading || roomsLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Načítání...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Pro přístup k chatu se musíte přihlásit.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userCharacters.length === 0 && !canSendAsNarrator) {
    return null;
  }

  if (!currentRoom) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Chatová místnost nebyla nalezena.</p>
            <Button 
              className="mt-4" 
              onClick={() => setLocation('/chat')}
            >
              Zpět na seznam chatů
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messageInputLength = messageInput.length;
  const isMessageValid = messageInputLength >= MIN_MESSAGE_LENGTH && messageInputLength <= MAX_MESSAGE_LENGTH;

  // Sort messages - newest first (latest at top)
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-row h-[calc(100vh-4rem)] w-full">
      {/* Levý sloupec: Chat */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Horní lišta */}
        <div className="flex items-center justify-between mb-2 px-6 pt-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLocation('/chat')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Opustit chat
            </Button>
            <span className="font-bold text-lg">{currentRoom?.name || 'Místnost'}</span>
            <span className="text-sm text-muted-foreground">{currentRoom?.description}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportChat}>
              <Download className="h-4 w-4 mr-2" />
              Stáhnout
            </Button>
            {user?.role === 'admin' && (
              <>
                <Button variant="outline" size="sm" onClick={() => currentRoomId && archiveMessagesMutation.mutate(currentRoomId)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archivovat
                </Button>
                <Button variant="destructive" size="sm" onClick={() => {/* zde přidej logiku pro archivovat a smazat */}}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Archivovat a smazat
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Chat zprávy */}
        <ScrollArea className="flex-1 bg-muted/10 rounded-lg p-4 mb-2 mx-6">
          <div className="space-y-4">
            {messagesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Načítání zpráv...</p>
              </div>
            ) : sortedMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Žádné zprávy v této místnosti.</p>
              </div>
            ) : (
              sortedMessages.map((message) => {
                // Debug logy pro ladění jmen a postav
                console.log("Message:", message);
                console.log("Character:", message.character);
                console.log("Resolved name:", getCharacterName(message));
                return (
                  <div className="flex gap-3 items-start">
                    {(() => {
                      const isNarratorMessage = message.messageType === 'narrator' || message.characterId === 0;
                      const narratorColor = user?.narratorColor || 'purple';

                      if (isNarratorMessage) {
                        return (
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarFallback 
                              className="font-semibold text-white"
                              style={{
                                backgroundColor: 
                                  narratorColor === 'yellow' ? '#fbbf24' :
                                  narratorColor === 'red' ? '#ef4444' :
                                  narratorColor === 'blue' ? '#3b82f6' :
                                  narratorColor === 'green' ? '#10b981' :
                                  narratorColor === 'pink' ? '#ec4899' :
                                  '#8b5cf6'
                              }}
                            >
                              V
                            </AvatarFallback>
                          </Avatar>
                        );
                      } else {
                        return (
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            <AvatarImage src={message.character?.avatar || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                              {getCharacterName(message)
                                .split(' ')
                                .map((part) => part[0])
                                .join('')
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        );
                      }
                    })()}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        {(() => {
                          const isNarratorMessage = message.messageType === 'narrator' || message.characterId === 0;
                          const narratorColor = user?.narratorColor || 'purple';

                          if (isNarratorMessage) {
                            return (
                              <span 
                                className="font-semibold italic"
                                style={{
                                  color: 
                                    narratorColor === 'yellow' ? '#fbbf24' :
                                    narratorColor === 'red' ? '#ef4444' :
                                    narratorColor === 'blue' ? '#3b82f6' :
                                    narratorColor === 'green' ? '#10b981' :
                                    narratorColor === 'pink' ? '#ec4899' :
                                    '#8b5cf6'
                                }}
                              >
                                Vypravěč
                              </span>
                            );
                          } else {
                            return (
                              <span className="font-semibold text-foreground">
                                {getCharacterName(message)}
                              </span>
                            );
                          }
                        })()}
                        <span className="text-xs text-muted-foreground">
                          {formatMessageTime(message.createdAt)}
                        </span>
                      </div>
                      <div className={`rounded-lg p-3 ${
                        message.messageType === 'narrator' || message.characterId === 0 
                          ? 'border-l-4 italic' 
                          : 'bg-muted/30'
                      }`}
                      style={
                        message.messageType === 'narrator' || message.characterId === 0 
                          ? {
                              backgroundColor: (() => {
                                const narratorColor = user?.narratorColor || 'purple';
                                return narratorColor === 'yellow' ? 'rgba(251, 191, 36, 0.1)' :
                                       narratorColor === 'red' ? 'rgba(239, 68, 68, 0.1)' :
                                       narratorColor === 'blue' ? 'rgba(59, 130, 246, 0.1)' :
                                       narratorColor === 'green' ? 'rgba(16, 185, 129, 0.1)' :
                                       narratorColor === 'pink' ? 'rgba(236, 72, 153, 0.1)' :
                                       'rgba(139, 92, 246, 0.1)';
                              })(),
                              borderLeftColor: (() => {
                                const narratorColor = user?.narratorColor || 'purple';
                                return narratorColor === 'yellow' ? '#fbbf24' :
                                       narratorColor === 'red' ? '#ef4444' :
                                       narratorColor === 'blue' ? '#3b82f6' :
                                       narratorColor === 'green' ? '#10b981' :
                                       narratorColor === 'pink' ? '#ec4899' :
                                       '#8b5cf6';
                              })()
                            }
                          : {}
                      }>
                        <div className="text-sm whitespace-pre-wrap break-words">
                          {renderMessageWithHighlight(
                            message.content || message.body || 'Žádný obsah zprávy',
                            user?.highlightWords,
                            user?.highlightColor
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Kompaktní dolní lišta */}
        <div className="flex flex-col gap-2 px-6 pb-4">
          {/* První řádek: Avatar + pole pro zprávu + tlačítko odeslat */}
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarImage src={selectedCharacter?.avatar || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {selectedCharacter ? getCharacterInitials(selectedCharacter) : (isNarratorMode ? 'V' : 'NP')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Textarea
                className="min-h-[40px] max-h-[100px] resize-none pr-16"
                placeholder="Napište zprávu..."
                value={messageInput}
                onChange={e =>setMessageInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={!isConnected}
              />
              <div className="absolute bottom-1 right-1 text-xs text-muted-foreground">
                {messageInputLength}/{MAX_MESSAGE_LENGTH}
              </div>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleSendMessage}
              disabled={!isMessageValid || !isConnected}
              className="px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Druhý řádek: Výběr postavy a akční tlačítka */}
          <div className="flex gap-2 items-center">
            {!isNarratorMode && (
              <Select
                value={selectedCharacter?.id?.toString() || ''}
                onValueChange={val => {
                  if (val) {
                    const char = userCharacters.find(c => c.id.toString() === val);
                    if (char) setSelectedCharacter(char);
                  }
                }}
                disabled={userCharacters.length === 0}
              >
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder={userCharacters.length === 0 ? "Žádné postavy" : "Vyber postavu"} />
                </SelectTrigger>
                <SelectContent>
                  {userCharacters.filter(c => c && typeof c.firstName === 'string').map(char => (
                    <SelectItem key={char.id} value={char.id.toString()}>
                      {char.firstName}{char.middleName ? ' ' + char.middleName : ''} {char.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isNarratorMode && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => diceRollMutation.mutate()} 
                  disabled={!selectedCharacter || !selectedCharacter.id || diceRollMutation.isPending}
                  className="h-8 gap-1"
                  title="Hodit kostkou (1-10)"
                >
                  <Dices className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">
                    {diceRollMutation.isPending ? 'Házím...' : 'Kostka'}
                  </span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => coinFlipMutation.mutate()} 
                  disabled={!selectedCharacter || !selectedCharacter.id || coinFlipMutation.isPending}
                  className="h-8 gap-1"
                  title="Hodit mincí"
                >
                  <Coins className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-600 font-medium">
                    {coinFlipMutation.isPending ? 'Házím...' : 'Mince'}
                  </span>
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={!selectedCharacter}
                  className="h-8 gap-1"
                  title="Seslat kouzlo"
                >
                  <Wand2 className="h-4 w-4 text-purple-600" />
                  <span className="text-xs text-purple-600 font-medium">Kouzla</span>
                </Button>
              </>
            )}

            {canSendAsNarrator && (
              <Button 
                variant={isNarratorMode ? "default" : "outline"} 
                size="sm"
                onClick={() => setIsNarratorMode(!isNarratorMode)}
                className="h-8"
              >
                {isNarratorMode ? 'Vypravěč (aktivní)' : 'Vypravěč'}
              </Button>
            )}
            </div>
          </div>
        </div>

        {/* Pravý panel: Popis místnosti a tlačítko Upravit pro admina */}
        <div className="w-80 border-l bg-muted/20 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-sm mb-0">Informace o místnosti</h3>
            {!isEditingDescription && user?.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={handleEditDescription}>
                Upravit
              </Button>
            )}
            {isEditingDescription && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  Zrušit
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleSaveDescription}
                  disabled={updateRoomDescriptionMutation.isPending}
                >
                  {updateRoomDescriptionMutation.isPending ? 'Ukládá...' : 'Uložit'}
                </Button>
              </div>
            )}
          </div>
          <div className="p-4">
            <h4 className="font-semibold text-sm mb-3">Popis místnosti</h4>
            {isEditingDescription ? (
              <div>
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="min-h-[200px] text-sm"
                  placeholder="Zadejte popis místnosti..."
                />
                <div className="mt-3 p-3 bg-muted/30 rounded-lg border">
                  <h5 className="text-xs font-semibold mb-2 text-muted-foreground">Nápověda k formátování:</h5>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div><strong>**text**</strong> - tučné písmo</div>
                    <div><em>*text*</em> - kurzíva</div>
                    <div><u>__text__</u> - podtržené</div>
                    <div><span className="text-blue-500 underline">[Název místnosti]</span> - odkaz na jinou místnost</div>
                  </div>
                </div>
              </div>
            ) : (
              <RoomDescription 
                description={currentRoom?.longDescription || 'Žádný popis není k dispozici.'} 
                roomName={currentRoom?.name}
              />
            )}
          </div>
        </div>
      </div>
    );
  }