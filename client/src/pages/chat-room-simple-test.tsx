import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChatRoomSimpleTest() {
  const { user } = useAuth();

  const { data: allUserCharacters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user,
  });

  const { data: rooms = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/rooms"],
    enabled: !!user,
  });

  // Filtr pro výběr postavy uživatelem:
  const userCharacters = Array.isArray(allUserCharacters) ? allUserCharacters.filter((char: any) => !(char.deathDate ?? char.death_date) && !char.isSystem && char.userId === user?.id) : [];

  // Simple access check
  const canAccess = user?.role === 'admin' || userCharacters.length > 0;

  if (!user) {
    return <div>Prosím přihlaste se.</div>;
  }

  if (!canAccess) {
    return <div>Pro přístup do chatu potřebujete alespoň jednu postavu.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat Test - Přístup Povolen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Uživatel: {user.username}</h3>
              <p>Role: {user.role}</p>
            </div>
            
            <div>
              <h3 className="font-medium">Dostupné postavy ({userCharacters.length}):</h3>
              {userCharacters.map((char: any) => (
                <div key={char.id} className="p-2 border rounded">
                  {char.firstName} {char.middleName ? `${char.middleName} ` : ''} {char.lastName} (ID: {char.id})
                </div>
              ))}
            </div>

            <div>
              <h3 className="font-medium">Dostupné chatovací místnosti ({rooms.length}):</h3>
              {rooms.map((room: any) => (
                <div key={room.id} className="p-2 border rounded">
                  <a href={`/chat/room/${room.id}`} className="text-blue-600 hover:underline">
                    {room.name} (ID: {room.id})
                  </a>
                </div>
              ))}
            </div>

            <div className="bg-green-100 p-4 rounded">
              <p className="text-green-800">✅ Přístup do chatu je povolen!</p>
              <p className="text-sm mt-2">
                Zkuste kliknout na některou z místností výše nebo přejít přímo na /chat/room/2
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}