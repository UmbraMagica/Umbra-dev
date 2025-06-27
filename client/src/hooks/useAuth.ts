import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn, getAuthToken } from "@/lib/queryClient";
import { useLocation } from "wouter";
import type { User } from "@shared/types";

interface AuthUser extends User {
  characters: Character[];
}

interface Character {
  id: number;
  userId: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  isActive: boolean;
  deathDate?: string;
  isSystem?: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// Helper function to validate character object
function isValidCharacter(char: any): char is Character {
  if (!char || typeof char !== 'object') {
    console.warn('[isValidCharacter] Invalid character object:', char);
    return false;
  }

  const checks = {
    hasValidId: typeof char.id === 'number' && char.id > 0,
    hasValidFirstName: typeof char.firstName === 'string' && char.firstName?.trim() !== '',
    hasValidLastName: typeof char.lastName === 'string' && char.lastName?.trim() !== '',
    hasValidUserId: typeof char.userId === 'number' && char.userId > 0
  };

  const isValid = checks.hasValidId && checks.hasValidFirstName && checks.hasValidLastName && checks.hasValidUserId;

  if (!isValid) {
    console.warn('[isValidCharacter] Character validation failed:', {
      character: char,
      checks,
      firstName: char.firstName,
      lastName: char.lastName,
      firstNameType: typeof char.firstName,
      lastNameType: typeof char.lastName
    });
  }

  return isValid;
}

// Helper function to safely process characters
function processCharacters(charactersData: any): Character[] {
  try {
    if (!charactersData) {
      console.warn('[processCharacters] No characters data provided');
      return [];
    }

    // Simplified logic - expect array directly since we extract it above
    let charactersArray: any[] = [];

    if (Array.isArray(charactersData)) {
      charactersArray = charactersData;
    } else {
      console.warn('[processCharacters] Expected array but got:', typeof charactersData);
      return [];
    }

    const validCharacters = charactersArray.filter((char, index) => {
      try {
        if (!char || typeof char !== 'object') {
          console.warn(`[processCharacters] Invalid character object at index ${index}:`, char);
          return false;
        }

        // Additional safety checks for critical fields
        if (char.firstName === null || char.firstName === undefined) {
          console.warn(`[processCharacters] Character ${index} has null/undefined firstName:`, char);
          return false;
        }

        if (char.lastName === null || char.lastName === undefined) {
          console.warn(`[processCharacters] Character ${index} has null/undefined lastName:`, char);
          return false;
        }

        const isValid = isValidCharacter(char);
        return isValid;
      } catch (error) {
        console.error(`[processCharacters] Error processing character at index ${index}:`, error, char);
        return false;
      }
    });

    console.log(`[processCharacters] Processed ${validCharacters.length} valid characters from ${charactersArray.length} total`);
    return validCharacters;
  } catch (error) {
    console.error('[processCharacters] Error processing characters:', error);
    return [];
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<AuthUser | null>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const token = getAuthToken();
      if (!token) return null;

      try {
        const response = await fetch(`${API_URL}/api/auth/user`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401 || response.status === 404) {
          localStorage.removeItem('jwt_token');
          return null;
        }

        if (!response.ok) {
          console.error('Failed to fetch user:', response.status, response.statusText);
          throw new Error('Failed to fetch user');
        }

        const userData = await response.json();

        if (!userData) return null;

        // Vždy načti postavy zvlášť pro aktuální data
        try {
          const charactersResponse = await fetch(`${API_URL}/api/characters`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (charactersResponse.ok) {
            const charactersData = await charactersResponse.json();

            // Backend vrací { characters: [...] }, takže extrahujme přímo characters array
            const charactersArray = charactersData?.characters || charactersData || [];

            userData.characters = processCharacters(charactersArray);
          } else {
            console.warn('[useAuth] Failed to fetch characters, status:', charactersResponse.status);
            userData.characters = [];
          }
        } catch (error) {
          console.error('[useAuth] FULL DEBUG - Failed to fetch characters:', error);
          userData.characters = [];
        }

        return userData;
      } catch (error) {
        console.error('[useAuth] Query error:', error);
        throw error;
      }
    },
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error instanceof Error && error.message.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!getAuthToken(),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const response = await apiRequest("POST", `${API_URL}/api/auth/login`, credentials);
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('jwt_token', data.token);
      }
      localStorage.removeItem('selectedCharacterId');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('selectedCharacterId_')) {
          localStorage.removeItem(key);
        }
      });
      return data.user || null;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['/api/auth/user']);
      queryClient.invalidateQueries(['/api/characters']);
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('selectedCharacterId');
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('selectedCharacterId_')) {
          localStorage.removeItem(key);
        }
      });
      queryClient.setQueryData(['/api/auth/user'], null);
    },
    onSuccess: () => {
      queryClient.removeQueries();
      setLocation("/login");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      username: string;
      email: string;
      password: string;
      passwordConfirm: string;
      inviteCode: string;
      firstName: string;
      middleName?: string;
      lastName: string;
      birthDate: string;
    }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Clear any existing selectedCharacterId to prevent wrong character selection
      localStorage.removeItem('selectedCharacterId');

      queryClient.setQueryData(['/api/auth/user'], data);
      queryClient.invalidateQueries();
      setLocation("/");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
    isRegisterPending: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}