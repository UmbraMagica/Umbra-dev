import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen, Send, Reply, Search, Bird, Home, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow } from "date-fns";
import { cs } from "date-fns/locale";
import { apiFetch, getQueryFn, getAuthToken } from "@/lib/queryClient";
import { useSelectedCharacter } from "@/contexts/SelectedCharacterContext";

const API_URL = import.meta.env.VITE_API_URL || '';

// Message form schema
const messageSchema = z.object({
  recipientCharacterId: z.number().min(1, "Vyberte adresáta"),
  subject: z.string().min(1, "Předmět je povinný").max(200),
  content: z.string().min(1, "Obsah zprávy je povinný").max(5000),
});

type MessageForm = z.infer<typeof messageSchema>;

interface Character {
  id: number;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
}

interface OwlPostMessage {
  id: number;
  senderCharacterId: number;
  recipientCharacterId: number;
  subject: string;
  content: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string | null;
  sender?: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
  recipient?: {
    firstName: string;
    middleName?: string | null;
    lastName: string;
  };
}

function OwlPost() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<OwlPostMessage | null>(null);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { selectedCharacter, changeCharacter } = useSelectedCharacter();

  // Get user's characters - ensure consistent array format
  const { data: userCharactersData } = useQuery({
    queryKey: ["/api/characters"],
    enabled: !!user,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Extract characters array safely
  const userCharacters = (() => {
    if (!userCharactersData) return [];
    if (Array.isArray(userCharactersData)) return userCharactersData;
    if (userCharactersData.characters && Array.isArray(userCharactersData.characters)) return userCharactersData.characters;
    console.warn('[OwlPost] userCharacters is not array:', userCharactersData);
    return [];
  })();

  // Get all characters for owl post - ensure array format
  const { data: owlPostCharactersData } = useQuery({
    queryKey: ["/api/owl-post/characters"],
    enabled: !!user,
    queryFn: async () => {
      const response = await apiFetch(`${API_URL}/api/owl-post/characters`);
      console.log('[OwlPost] Raw owl-post characters response:', response);
      return response;
    },
  });

  // Extract owl post characters array safely
  const owlPostCharacters = (() => {
    if (!owlPostCharactersData) return [];
    if (Array.isArray(owlPostCharactersData)) return owlPostCharactersData;
    if (owlPostCharactersData.characters && Array.isArray(owlPostCharactersData.characters)) return owlPostCharactersData.characters;
    console.warn('[OwlPost] owlPostCharacters is not array:', owlPostCharactersData);
    return [];
  })();

  // Get inbox messages - ensure array format  
  const { data: inboxData } = useQuery({
    queryKey: [`/api/owl-post/inbox/${selectedCharacter?.id}`],
    enabled: !!selectedCharacter,
    queryFn: async () => {
      const response = await apiFetch(`${API_URL}/api/owl-post/inbox/${selectedCharacter?.id}`);
      console.log('[OwlPost] Raw inbox response:', response);
      return response;
    },
  });

  const inboxMessages = Array.isArray(inboxData) ? inboxData : [];

  // Get sent messages - ensure array format
  const { data: sentData } = useQuery({
    queryKey: [`/api/owl-post/sent/${selectedCharacter?.id}`],
    enabled: !!selectedCharacter,
    queryFn: async () => {
      const response = await apiFetch(`${API_URL}/api/owl-post/sent/${selectedCharacter?.id}`);
      console.log('[OwlPost] Raw sent response:', response);
      return response;
    },
  });

  const sentMessages = Array.isArray(sentData) ? sentData : [];

  // Get unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [`/api/owl-post/unread-count/${selectedCharacter?.id}`],
    enabled: !!selectedCharacter,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Get unread total
  const { data: unreadTotalData } = useQuery<{ count: number }>({
    queryKey: ["/api/owl-post/unread-total"],
    enabled: !!user,
    queryFn: async () => {
      return apiFetch(`${API_URL}/api/owl-post/unread-total`);
    },
  });

  const unreadCount = unreadData?.count || 0;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: MessageForm & { senderCharacterId: number }) => {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/owl-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Dopis byl úspěšně odeslán!" });
      setIsComposeOpen(false);
      setIsReplyOpen(false);
      form.reset();
      replyForm.reset();
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/sent/${selectedCharacter?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/inbox/${selectedCharacter?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/unread-count/${selectedCharacter?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/owl-post/unread-total"] });
    },
    onError: () => {
      toast({ title: "Chyba při odesílání dopisu", variant: "destructive" });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/owl-post/message/${messageId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete message");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Zpráva byla úspěšně smazána!" });
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/sent/${selectedCharacter?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/inbox/${selectedCharacter?.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/owl-post/unread-count/${selectedCharacter?.id}`] });
    },
    onError: () => {
      toast({ title: "Chyba při mazání zprávy", variant: "destructive" });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/owl-post/${messageId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ characterId: selectedCharacter?.id }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to mark as read");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate specific queries for current character
      if (selectedCharacter?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/owl-post/inbox/${selectedCharacter.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/owl-post/unread-count/${selectedCharacter.id}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/owl-post/unread-total"] });
      }
      // Also invalidate general queries for backward compatibility
      queryClient.invalidateQueries({ queryKey: ["/api/owl-post/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owl-post/unread-count"] });
    },
  });

  const form = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      subject: "",
      content: "",
    },
  });

  const replyForm = useForm<MessageForm>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      subject: "",
      content: "",
    },
  });

  // Debug: log při odpovědi na zprávu
  const handleReply = (message: OwlPostMessage) => {
    console.log("[OwlPost] Odpovídám na zprávu:", message, "pro postavu:", selectedCharacter?.id);
    setSelectedMessage(message);
    replyForm.setValue("recipientCharacterId", message.senderCharacterId);
    replyForm.setValue("subject", message.subject.startsWith("Re: ") ? message.subject : `Re: ${message.subject}`);
    replyForm.setValue("content", "");
    setIsReplyOpen(true);
  };

  // Debug: log při odeslání zprávy
  const onSubmit = (data: MessageForm) => {
    console.log("[OwlPost] Odesílám zprávu od postavy:", selectedCharacter?.id, "na adresáta:", data.recipientCharacterId, "data:", data);
    if (!selectedCharacter) return;
    sendMessageMutation.mutate({
      ...data,
      senderCharacterId: selectedCharacter.id,
    }, {
      onSuccess: (resp) => console.log("[OwlPost] Zpráva úspěšně odeslána, odpověď:", resp),
      onError: (err) => console.error("[OwlPost] Chyba při odesílání zprávy:", err)
    });
  };

  const onReplySubmit = (data: MessageForm) => {
    if (!selectedCharacter) return;
    sendMessageMutation.mutate({
      ...data,
      senderCharacterId: selectedCharacter.id,
    });
  };

  const formatSenderName = (sender: { firstName: string; middleName?: string | null; lastName: string }) => {
    return `${sender.firstName} ${sender.middleName ? sender.middleName + ' ' : ''}${sender.lastName}`;
  };

  const formatRecipientName = (recipient: { firstName: string; middleName?: string | null; lastName: string }) => {
    return `${recipient.firstName} ${recipient.middleName ? recipient.middleName + ' ' : ''}${recipient.lastName}`;
  };

  // Debug: log načítání postav
  useEffect(() => {
    if (userCharacters) {
      console.log("[OwlPost] Načteno userCharacters:", userCharacters);
    }
  }, [userCharacters]);

  // Debug: log načítání všech postav pro soví poštu
  useEffect(() => {
    if (owlPostCharacters) {
      console.log("[OwlPost] Načteno owlPostCharacters:", owlPostCharacters);
    }
  }, [owlPostCharacters]);

  // Debug: log aktivní postavu při načítání inboxu/sentu
  useEffect(() => {
    if (selectedCharacter) {
      console.log("[OwlPost] Načítám inbox/sent pro postavu:", selectedCharacter.id, selectedCharacter);
    }
  }, [selectedCharacter]);

  // Debug: log při otevření zprávy
  const handleOpenMessage = (message: OwlPostMessage) => {
    console.log("[OwlPost] Otevírám zprávu:", message, "pro postavu:", selectedCharacter?.id);
    setSelectedMessage(message);
    if (!message.isRead) {
      console.log("[OwlPost] Označuji zprávu jako přečtenou:", message.id);
      markAsReadMutation.mutate(message.id, {
        onSuccess: (data) => console.log("[OwlPost] Označeno jako přečtené, odpověď:", data),
        onError: (err) => console.error("[OwlPost] Chyba při označení jako přečtené:", err)
      });
    }
  };

  // Debug: log načítání inboxu
  useEffect(() => {
    if (inboxMessages) {
      console.log("[OwlPost] Načten inboxMessages:", inboxMessages);
    }
  }, [inboxMessages]);

  // Debug: log načítání sent
  useEffect(() => {
    if (sentMessages) {
      console.log("[OwlPost] Načten sentMessages:", sentMessages);
    }
  }, [sentMessages]);

  // Debug: log načítání počtu nepřečtených
  useEffect(() => {
    if (unreadData) {
      console.log("[OwlPost] Načten unreadData:", unreadData);
    }
  }, [unreadData]);
  useEffect(() => {
    if (unreadTotalData) {
      console.log("[OwlPost] Načten unreadTotalData:", unreadTotalData);
    }
  }, [unreadTotalData]);

  if (!user) {
    return <div>Přihlaste se prosím</div>;
  }

  if (!selectedCharacter) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center py-8">
          <Bird className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nemáte vytvořenou žádnou postavu</p>
        </div>
      </div>
    );
  }

  const filteredInboxMessages = inboxMessages.filter(message =>
    message && message.subject && (
      message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (message.sender && formatSenderName(message.sender).toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  const filteredSentMessages = sentMessages.filter(message =>
    message && message.subject && (
      message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (message.recipient && formatRecipientName(message.recipient).toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Button 
          variant="outline" 
          size="default" 
          onClick={() => window.location.href = '/'}
          className="mr-4 border-border hover:bg-muted"
        >
          <Home className="h-4 w-4 mr-2" />
          Domů
        </Button>
        <Bird className="h-8 w-8 text-amber-600" />
        <div>
          <h1 className="text-3xl font-bold">Soví pošta</h1>
          {selectedCharacter && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Aktivní postava:</span>
              <Select 
                value={selectedCharacter?.id?.toString() || ""} 
                onValueChange={(value) => {
                  const characterId = parseInt(value);
                  const character = userCharacters.find((char: any) => char.id === characterId);
                  if (character) {
                    changeCharacter(character);
                  }
                }}
              >
                <SelectTrigger className="w-40 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {userCharacters.filter((char: any) => !char.deathDate && !char.isSystem).map((character: any) => (
                    <SelectItem key={character.id} value={character.id.toString()}>
                      {character.firstName} {character.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hledat zprávy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="h-4 w-4 mr-2" />
                Napsat dopis
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bird className="h-5 w-5" />
                  Napsat nový dopis
                </DialogTitle>
                <DialogDescription>
                  Vyberte adresáta a napište zprávu
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="recipientCharacterId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Adresát</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Vyberte adresáta" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.isArray(owlPostCharacters) ? owlPostCharacters.map((character) => (
                              <SelectItem key={character.id} value={character.id.toString()}>
                                {character.fullName}
                              </SelectItem>
                            )) : []}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Předmět</FormLabel>
                        <FormControl>
                          <Input placeholder="Předmět zprávy" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Obsah dopisu</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Napište zde svůj dopis..."
                            className="min-h-[200px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Bird className="h-4 w-4" />
                      <span>Sova doručí dopis během několika minut</span>
                    </div>
                    <Button type="submit" disabled={sendMessageMutation.isPending}>
                      {sendMessageMutation.isPending ? "Odesílání..." : "Odeslat dopis"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Přijatá pošta
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Odeslaná pošta
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          {filteredInboxMessages.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Žádné zprávy neodpovídají vašemu hledání" : "Zatím nemáte žádné dopisy"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredInboxMessages.map((message) => (
              <Card key={message.id} className={`cursor-pointer transition-colors hover:bg-muted/50 ${!message.isRead ? 'border-l-4 border-l-blue-500' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1" onClick={() => handleOpenMessage(message)}>
                      <div className="mt-1">
                        {message.isRead ? (
                          <MailOpen className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Mail className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className={`font-medium ${!message.isRead ? 'font-bold' : ''}`}>
                            {message.sender ? formatSenderName(message.sender) : 'Neznámý odesílatel'}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true, locale: cs })}
                          </span>
                        </div>
                        <h3 className={`text-sm mb-2 ${!message.isRead ? 'font-semibold' : ''}`}>
                          {message.subject}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReply(message);
                        }}
                      >
                        <Reply className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Opravdu chcete smazat tuto zprávu?')) {
                            deleteMessageMutation.mutate(message.id);
                          }
                        }}
                        disabled={deleteMessageMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          {filteredSentMessages.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Send className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "Žádné zprávy neodpovídají vašemu hledání" : "Zatím jste neodeslali žádné dopisy"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredSentMessages.map((message) => (
              <Card key={message.id} className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1" onClick={() => setSelectedMessage(message)}>
                      <div className="mt-1">
                        <Send className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">
                            Pro: {message.recipient ? formatRecipientName(message.recipient) : 'Neznámý příjemce'}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(message.sentAt), { addSuffix: true, locale: cs })}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium mb-2">{message.subject}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {message.content}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Opravdu chcete smazat tuto zprávu?')) {
                          deleteMessageMutation.mutate(message.id);
                        }
                      }}
                      disabled={deleteMessageMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          {selectedMessage && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bird className="h-5 w-5" />
                  {selectedMessage.subject}
                </DialogTitle>
                <DialogDescription>
                  Soví pošta - detail zprávy
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    <strong>Od:</strong> {selectedMessage.sender ? formatSenderName(selectedMessage.sender) : 'Neznámý odesílatel'}
                  </div>
                  <div>
                    {formatDistanceToNow(new Date(selectedMessage.sentAt), { addSuffix: true, locale: cs })}
                  </div>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{selectedMessage.content}</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                    Zavřít
                  </Button>
                  {selectedMessage.sender && (
                    <Button onClick={() => handleReply(selectedMessage)}>
                      <Reply className="h-4 w-4 mr-2" />
                      Odpovědět
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="h-5 w-5" />
              Odpovědět na dopis
            </DialogTitle>
            <DialogDescription>
              Napište odpověď na obdržený dopis
            </DialogDescription>
          </DialogHeader>
          <Form {...replyForm}>
            <form onSubmit={replyForm.handleSubmit(onReplySubmit)} className="space-y-4">
              <FormField
                control={replyForm.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Předmět</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={replyForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odpověď</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Napište zde svou odpověď..."
                        className="min-h-[200px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bird className="h-4 w-4" />
                  <span>Sova doručí odpověď během několika minut</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsReplyOpen(false)}>
                    Zrušit
                  </Button>
                  <Button type="submit" disabled={sendMessageMutation.isPending}>
                    {sendMessageMutation.isPending ? "Odesílání..." : "Odeslat odpověď"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OwlPost;