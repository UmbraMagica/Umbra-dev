import React, { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface Character {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  deathDate?: string;
  isSystem?: boolean;
  isActive?: boolean;
  name?: string;
}

interface SelectedCharacterContextType {
  selectedCharacter: Character | null;
  userCharacters: Character[];
  changeCharacter: (char: Character | string | null) => void;
  isLoading: boolean;
  canSendAsNarrator: boolean;
}

const SelectedCharacterContext = createContext<SelectedCharacterContextType | null>(null);

// Helper function to validate character object
function isValidCharacter(char: any): char is Character {
  return char && 
         typeof char === 'object' && 
         typeof char.id === 'number' && 
         typeof char.firstName === 'string' && 
         char.firstName.trim() !== '';
}

// Helper function to filter and validate characters
function filterValidCharacters(characters: any[]): Character[] {
  if (!Array.isArray(characters)) {
    return [];
  }

  return characters.filter(isValidCharacter);
}

export function SelectedCharacterProvider({ children, roomId, canSendAsNarrator }: { children: React.ReactNode, roomId: string, canSendAsNarrator: boolean }) {
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  // Fetch user's characters (always return array)
  const { data: userCharactersRaw = { characters: [] }, isLoading } = useQuery({
    queryKey: ["/api/characters"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    queryFn: async () => {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('/api/characters', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error('Failed to fetch characters');
      }

      return await res.json();
    }
  });

  // Process and validate characters
  const userCharacters: Character[] = (() => {
    try {
      // Handle different response formats
      let charactersArray: any[] = [];

      if (Array.isArray(userCharactersRaw)) {
        charactersArray = userCharactersRaw;
      } else if (userCharactersRaw && Array.isArray(userCharactersRaw.characters)) {
        charactersArray = userCharactersRaw.characters;
      } else if (userCharactersRaw && typeof userCharactersRaw === 'object') {
        // If it's an object but not in expected format, try to extract characters
        charactersArray = Object.values(userCharactersRaw).filter(Array.isArray).flat();
      }

      return filterValidCharacters(charactersArray);
    } catch (error) {
      console.error('Error processing characters:', error);
      return [];
    }
  })();

  useEffect(() => {
    if (!roomId) return;

    // Get available characters (alive, non-system)
    const availableChars = userCharacters.filter((c: Character) => 
      isValidCharacter(c) && !c.deathDate && !c.isSystem
    );

    // Create all options including narrator if allowed
    let allOptions: Character[] = [...availableChars];
    if (canSendAsNarrator) {
      allOptions = [{ id: 0, firstName: 'Vypravěč', lastName: '', name: 'Vypravěč' }, ...allOptions];
    }

    if (allOptions.length === 0) {
      setSelectedCharacter(null);
      if (roomId) localStorage.removeItem(`selectedCharacterId_${roomId}`);
      return;
    }

    // Try to restore saved character or select default
    const savedId = localStorage.getItem(`selectedCharacterId_${roomId}`);
    let targetCharacter: Character | null = null;

    if (savedId) {
      if (savedId === '0' && canSendAsNarrator) {
        targetCharacter = { id: 0, firstName: 'Vypravěč', lastName: '', name: 'Vypravěč' };
      } else {
        targetCharacter = allOptions.find((c: Character) => c.id === parseInt(savedId)) || null;
      }
    }

    // Pokud je uložené ID neplatné (nepatří aktuálnímu uživateli), vyber první živou postavu
    if (!targetCharacter) {
      targetCharacter = allOptions.find((c: Character) => c.isActive) || allOptions[0] || null;
      if (targetCharacter) {
        localStorage.setItem(`selectedCharacterId_${roomId}`, targetCharacter.id.toString());
      }
    }

    // Only update if different from current
    if (targetCharacter && (!selectedCharacter || targetCharacter.id !== selectedCharacter.id)) {
      setSelectedCharacter(targetCharacter);
    }
  }, [userCharacters, isLoading, roomId, canSendAsNarrator]);

  const changeCharacter = (charOrId: Character | string | null) => {
    let char: Character | null = null;
    
    // Handle string ID (for owl-post compatibility)
    if (typeof charOrId === 'string') {
      const characterId = parseInt(charOrId);
      char = userCharacters.find((c: Character) => c.id === characterId) || null;
    } else {
      char = charOrId;
    }

    // Validate character data before setting
    if (char && !isValidCharacter(char)) {
      console.error('Invalid character data:', char);
      return;
    }

    setSelectedCharacter(char);
    if (char && roomId) {
      localStorage.setItem(`selectedCharacterId_${roomId}`, char.id.toString());
    } else if (roomId) {
      localStorage.removeItem(`selectedCharacterId_${roomId}`);
    }
  };

  const contextValue: SelectedCharacterContextType = {
    selectedCharacter,
    userCharacters,
    changeCharacter,
    isLoading,
    canSendAsNarrator,
  };

  return (
    <SelectedCharacterContext.Provider value={contextValue}>
      {children}
    </SelectedCharacterContext.Provider>
  );
}

export function useSelectedCharacter(): SelectedCharacterContextType {
  const context = useContext(SelectedCharacterContext);
  if (!context) {
    throw new Error("useSelectedCharacter must be used within SelectedCharacterProvider");
  }
  return context;
}