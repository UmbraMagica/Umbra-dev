import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Users, MapPin, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/queryClient";

interface ChatCategory {
  id: number;
  name: string;
  description?: string;
  parentId?: number;
  sortOrder: number;
  children: ChatCategory[];
  rooms: ChatRoom[];
}

interface ChatRoom {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  isPublic: boolean;
  sortOrder: number;
}

const API_URL = import.meta.env.VITE_API_URL || '';

function SubCategoryCollapsible({ subCategory }: { subCategory: ChatCategory }) {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [passwordDialog, setPasswordDialog] = useState<{ isOpen: boolean; roomId: number | null }>({
    isOpen: false,
    roomId: null
  });
  const [password, setPassword] = useState("");

  const handleRoomClick = async (room: ChatRoom) => {
    if (room.isPublic) {
      window.open(`/chat/room/${room.id}`, '_blank');
    } else {
      setPasswordDialog({ isOpen: true, roomId: room.id });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!passwordDialog.roomId) return;

    try {
      const response = await fetch(`${API_URL}/api/chat/rooms/${passwordDialog.roomId}/verify-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: password }),
      });

      const data = await response.json();
      console.log("Password verification response:", data);

      if (data && data.success === true) {
        const roomId = passwordDialog.roomId;
        setPasswordDialog({ isOpen: false, roomId: null });
        setPassword("");
        window.open(`/chat/room/${roomId}`, '_blank');
        toast({
          title: "Úspěch",
          description: "Heslo je správné, vstupujete do místnosti",
        });
      } else {
        toast({
          title: "Nesprávné heslo",
          description: "Zadané heslo není správné",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Password verification error:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se ověřit heslo",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between p-3 h-auto border rounded-lg hover:bg-muted/50"
          >
            <div className="text-left">
              <h5 className="font-medium">{subCategory.name}</h5>
              {subCategory.description && (
                <p className="text-sm text-muted-foreground mt-1">{subCategory.description}</p>
              )}
            </div>
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 ml-4 space-y-2">
          {subCategory.rooms && Array.isArray(subCategory.rooms) && subCategory.rooms.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">Chatovací místnosti</h4>
              {subCategory.rooms.map((room) => (
                room.isPublic ? (
                  <a
                    key={room.id}
                    href={`/chat/room/${room.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start h-auto p-3"
                      asChild
                    >
                      <span className="text-left flex flex-col">
                        <span className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{room.name}</span>
                        </span>
                        {room.description && (
                          <span className="text-sm text-muted-foreground mt-1">
                            {room.description}
                          </span>
                        )}
                      </span>
                    </Button>
                  </a>
                ) : (
                  <Button
                    key={room.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => handleRoomClick(room)}
                  >
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{room.name}</span>
                        {!room.isPublic && <Lock className="h-3 w-3 text-yellow-600" />}
                      </div>
                      {room.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {room.description}
                        </p>
                      )}
                    </div>
                  </Button>
                )
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={passwordDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setPasswordDialog({ isOpen: false, roomId: null });
          setPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zadejte heslo místnosti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Heslo místnosti"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={handlePasswordSubmit} className="flex-1">
                Vstoupit
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setPasswordDialog({ isOpen: false, roomId: null })}
                className="flex-1"
              >
                Zrušit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryCard({ category }: { category: ChatCategory }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {category.name}
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </CardTitle>
            {category.description && (
              <CardDescription>{category.description}</CardDescription>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Subcategories */}
            {category.children.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Oblasti</h4>
                <div className="space-y-2">
                  {category.children.map((subCategory) => (
                    <SubCategoryCollapsible key={subCategory.id} subCategory={subCategory} />
                  ))}
                </div>
              </div>
            )}

            {/* Direct rooms under this category */}
            {category.rooms.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  {category.children.length > 0 ? "Další místa" : "Chatovací místnosti"}
                </h4>
                <div className="grid gap-2">
                  {category.rooms.map((room) => (
                    <Link key={room.id} href={`/chat/room/${room.id}`} target="_blank">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start h-auto p-3"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">{room.name}</span>
                          </div>
                          {room.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {room.description}
                            </p>
                          )}
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function ChatCategories() {
  const { user } = useAuth();
  
  // Fetch chat categories
  const { data: categoriesRaw, isLoading, error } = useQuery<ChatCategory[]>({
    queryKey: ["/api/chat/categories"],
    queryFn: async () => {
      const result = await apiFetch("/api/chat/categories");
      return Array.isArray(result) ? result : [];
    },
    enabled: true,
  });
  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];

  const { data: allRooms } = useQuery({
    queryKey: ["/api/chat/rooms"],
    queryFn: async () => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/chat/rooms`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("Failed to fetch chat rooms");
      }
      if (response.headers.get("content-type")?.includes("application/json")) {
        return response.json() as Promise<ChatRoom[]>;
      } else {
        const text = await response.text();
        throw new Error(text);
      }
    },
  });

  // Get rooms without categories (legacy rooms) - only show to admins
  const uncategorizedRooms = (user?.role === 'admin') 
    ? (allRooms?.filter(room => !room.categoryId) || [])
    : [];

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zpět na hlavní stranu
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Chatovací místnosti</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Chyba při načítání chatovacích místností.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zpět na hlavní stranu
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Chatovací místnosti</h1>
      </div>

      <div className="space-y-6">
        {/* Categorized rooms */}
        {categories?.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}

        {/* Uncategorized rooms (legacy) */}
        {uncategorizedRooms.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Obecné chatovací místnosti
              </CardTitle>
              <CardDescription>
                Hlavní chatovací místnosti dostupné pro všechny hráče
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {uncategorizedRooms.map((room) => (
                  <Link key={room.id} href={`/chat/room/${room.id}`}>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start h-auto p-3"
                    >
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-medium">{room.name}</span>
                        </div>
                        {room.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {room.description}
                          </p>
                        )}
                      </div>
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}