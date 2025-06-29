import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = import.meta.env.VITE_API_URL || '';

export default function ChatDebug() {
  const { user } = useAuth();

  const { data: allUserCharacters = [] } = useQuery<any[]>({
    queryKey: ["/api/characters"],
    enabled: !!user,
    queryFn: async () => {
      const token = localStorage.getItem('jwt_token');
      const response = await fetch(`${API_URL}/api/characters`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch characters');
      }
      const data = await response.json();
      return data.characters || [];
    }
  });

  const filteredCharacters = allUserCharacters.filter((char: any) => !(char.deathDate ?? char.death_date) && !char.isSystem);
  
  const userCharacters = allUserCharacters.filter((char: any) => !(char.deathDate ?? char.death_date) && !char.isSystem && char.userId === user?.id);

  const needsCharacter = user?.role !== 'admin';

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat Access Debug</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium">User Info:</h3>
            <p>Username: {user?.username || 'N/A'}</p>
            <p>Role: {user?.role || 'N/A'}</p>
            <p>Needs Character: {needsCharacter ? 'Yes' : 'No'}</p>
          </div>

          <div>
            <h3 className="font-medium">All User Characters ({allUserCharacters.length}):</h3>
            {allUserCharacters.length === 0 ? (
              <p>No characters found</p>
            ) : (
              <ul className="space-y-1">
                {allUserCharacters.map((char: any) => (
                  <li key={char.id} className="text-sm">
                    {char.id}: {char.firstName} {char.middleName ? `${char.middleName} ` : ''}{char.lastName} 
                    {char.deathDate ?? char.death_date ? ' (DEAD)' : ''}
                    {char.isSystem && ' (SYSTEM)'}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium">Filtered Characters ({userCharacters.length}):</h3>
            {userCharacters.length === 0 ? (
              <p>No available characters</p>
            ) : (
              <ul className="space-y-1">
                {userCharacters.map((char: any) => (
                  <li key={char.id} className="text-sm">
                    {char.id}: {char.firstName} {char.middleName ? `${char.middleName} ` : ''}{char.lastName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="font-medium">Access Decision:</h3>
            {!user ? (
              <p className="text-red-600">No user - login required</p>
            ) : needsCharacter && userCharacters.length === 0 ? (
              <p className="text-red-600">Character required but none available</p>
            ) : needsCharacter && userCharacters.length > 0 ? (
              <p className="text-green-600">Character available - should allow access</p>
            ) : (
              <p className="text-green-600">Admin - should allow access</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}