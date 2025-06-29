import {
  users,
  characters,
  inviteCodes,
  chatCategories,
  chatRooms,
  messages,
  archivedMessages,
  characterRequests,
  adminActivityLog,
  spells,
  characterSpells,
  characterInventory,
  characterJournal,
  configuration,
  housingRequests,
  owlPostMessages,
  wandWoods,
  wandCores,
  wandLengths,
  wandFlexibilities,
  influenceBar,
  influenceHistory,
  type User,
  type InsertUser,
  type Character,
  type InsertCharacter,
  type InviteCode,
  type InsertInviteCode,
  type ChatCategory,
  type InsertChatCategory,
  type ChatRoom,
  type InsertChatRoom,
  type Message,
  type InsertMessage,
  type ArchivedMessage,
  type CharacterRequest,
  type InsertCharacterRequest,
  type AdminActivityLog,
  type InsertAdminActivityLog,
  type Spell,
  type InsertSpell,
  type CharacterSpell,
  type InsertCharacterSpell,
  type InventoryItem,
  type InsertInventoryItem,
  type JournalEntry,
  type InsertJournalEntry,
  type Wand,
  type InsertWand,
  type HousingRequest,
  type InsertHousingRequest,
  type OwlPostMessage,
  type InsertOwlPostMessage,
  type WandWood,
  type InsertWandWood,
  type WandCore,
  type InsertWandCore,
  type WandLength,
  type InsertWandLength,
  type WandFlexibility,
  type InsertWandFlexibility,
  wands,
} from "../shared/schema";
import { supabase } from "./supabaseClient";
import bcrypt from 'bcrypt';

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;
  updateUserNarratorPermission(id: number, canNarrate: boolean): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  banUser(id: number, banReason: string): Promise<void>;
  resetUserPassword(id: number, hashedPassword: string): Promise<void>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  updateUserEmail(id: number, email: string): Promise<void>;
  updateUserSettings(id: number, settings: { characterOrder?: string; highlightWords?: string; highlightColor?: string; narratorColor?: string }): Promise<void>;
  getUserById(id: number): Promise<User | undefined>;

  // Character operations
  getCharacter(id: number): Promise<Character | undefined>;
  getCharactersByUserId(userId: number): Promise<Character[]>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: number, updates: Partial<InsertCharacter>): Promise<Character | undefined>;
  getAllCharacters(): Promise<Character[]>;


  // Invite code operations
  getInviteCode(code: string): Promise<InviteCode | undefined>;
  getAllInviteCodes(): Promise<InviteCode[]>;
  createInviteCode(code: InsertInviteCode): Promise<InviteCode>;
  useInviteCode(code: string, userId: number): Promise<boolean>;

  // Authentication
  validateUser(username: string, password: string): Promise<User | null>;
  hashPassword(password: string): Promise<string>;

  // Chat category operations
  getChatCategory(id: number): Promise<ChatCategory | undefined>;
  getChatCategoryByName(name: string): Promise<ChatCategory | undefined>;
  createChatCategory(category: InsertChatCategory): Promise<ChatCategory>;
  updateChatCategory(id: number, updates: Partial<InsertChatCategory>): Promise<ChatCategory | undefined>;
  deleteChatCategory(id: number): Promise<boolean>;
  getAllChatCategories(): Promise<ChatCategory[]>;
  getChatCategoriesWithChildren(userRole: string): Promise<(ChatCategory & { children: ChatCategory[], rooms: ChatRoom[] })[]>;

  // Chat operations
  getChatRoom(id: number): Promise<ChatRoom | undefined>;
  getChatRoomByName(name: string): Promise<ChatRoom | undefined>;
  createChatRoom(room: InsertChatRoom): Promise<ChatRoom>;
  updateChatRoom(id: number, updates: Partial<InsertChatRoom>): Promise<ChatRoom | undefined>;
  deleteChatRoom(id: number): Promise<boolean>;
  getAllChatRooms(userRole: string): Promise<ChatRoom[]>;
  getChatRoomsByCategory(categoryId: number): Promise<ChatRoom[]>;
  validateRoomPassword(roomId: number, password: string): Promise<boolean>;

  // Message operations
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByRoom(roomId: number, limit?: number, offset?: number): Promise<(Message & { character: { firstName: string; middleName?: string | null; lastName: string; avatar?: string | null } })[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(id: number): Promise<boolean>;
  updateMessageCharacter(messageId: number, characterId: number): Promise<void>;

  // Archive operations
  archiveMessages(roomId: number, beforeDate?: Date): Promise<number>;
  getArchivedMessages(roomId: number, limit?: number, offset?: number): Promise<ArchivedMessage[]>;

  // Additional message operations
  deleteAllMessages(): Promise<void>;
  clearRoomMessages(roomId: number): Promise<number>;
  getArchiveDates(roomId: number): Promise<string[]>;
  getArchiveDatesWithCounts(roomId: number): Promise<{ date: string; count: number }[]>;
  getArchivedMessagesByDate(roomId: number, archiveDate: string, limit?: number, offset?: number): Promise<ArchivedMessage[]>;
  getLastMessageByCharacter(characterId: number): Promise<Message | undefined>;

  // Character request operations
  createCharacterRequest(request: InsertCharacterRequest): Promise<CharacterRequest>;
  getCharacterRequestsByUserId(userId: number): Promise<CharacterRequest[]>;
  getCharacterRequestById(requestId: number): Promise<CharacterRequest | undefined>;
  deleteCharacterRequest(requestId: number): Promise<boolean>;
  getAllCharacterRequests(): Promise<(CharacterRequest & { user: { username: string; email: string } })[]>;
  getPendingCharacterRequests(): Promise<(CharacterRequest & { user: { username: string; email: string } })[]>;
  approveCharacterRequest(requestId: number, adminId: number, reviewNote?: string): Promise<Character>;
  rejectCharacterRequest(requestId: number, adminId: number, reviewNote: string): Promise<CharacterRequest>;

  // Admin activity log operations
  logAdminActivity(activity: InsertAdminActivityLog): Promise<AdminActivityLog>;
  getAdminActivityLog(limit?: number, offset?: number): Promise<(AdminActivityLog & { admin: { username: string }; targetUser?: { username: string } })[]>;

  // Multi-character operations

  // Cemetery operations
  killCharacter(characterId: number, deathReason: string, adminId: number): Promise<Character | undefined>;
  reviveCharacter(characterId: number): Promise<Character | undefined>;
  getDeadCharacters(): Promise<Character[]>;
  getActiveCharacters(): Promise<Character[]>;

  // Spell operations
  getAllSpells(): Promise<Spell[]>;
  getSpell(id: number): Promise<Spell | undefined>;
  getSpellByName(name: string): Promise<Spell | undefined>;
  createSpell(spell: InsertSpell): Promise<Spell>;
  updateSpell(id: number, updates: Partial<InsertSpell>): Promise<Spell | undefined>;
  deleteSpell(id: number): Promise<boolean>;

  // Character spell operations
  getCharacterSpells(characterId: number): Promise<(CharacterSpell & { spell: Spell })[]>;
  addSpellToCharacter(characterId: number, spellId: number): Promise<CharacterSpell>;
  removeSpellFromCharacter(characterId: number, spellId: number): Promise<boolean>;

  // Character inventory operations
  getCharacterInventory(characterId: number): Promise<any[]>;
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  addInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: number, updates: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: number): Promise<boolean>;

  // Character journal operations
  getCharacterJournal(characterId: number): Promise<JournalEntry[]>;
  getJournalEntry(id: number): Promise<JournalEntry | undefined>;
  addJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(id: number, updates: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined>;
  deleteJournalEntry(id: number): Promise<boolean>;

  // Wand operations
  getCharacterWand(characterId: number): Promise<Wand | undefined>;
  createWand(wand: InsertWand): Promise<Wand>;
  updateWand(wandId: number, updates: Partial<InsertWand>): Promise<Wand | undefined>;
  deleteWand(wandId: number): Promise<boolean>;
  generateRandomWand(characterId: number): Promise<Wand>;
  getAllWandComponents(): Promise<{
    woods: { name: string; shortDescription: string; longDescription: string; availableForRandom?: boolean }[];
    cores: { name: string; category: string; description: string; availableForRandom?: boolean }[];
    lengths: { name: string; description: string; availableForRandom?: boolean }[];
    flexibilities: { name: string; description: string; availableForRandom?: boolean }[];
  }>;
  migrateExistingWandsToInventory(): Promise<number>;
  updateWandComponents(components: {
    woods: { name: string; shortDescription: string; longDescription: string; availableForRandom?: boolean; id?: number }[];
    cores: { name: string; category: string; description: string; availableForRandom?: boolean; id?: number }[];
    lengths: { name: string; description: string; availableForRandom?: boolean; id?: number }[];
    flexibilities: { name: string; description: string; availableForRandom?: boolean; id?: number }[]
  }): Promise<void>;

  // Influence operations
  getInfluenceBar(): Promise<{ grindelwaldPoints: number; dumbledorePoints: number }>;
  getInfluenceHistory(): Promise<any[]>;
  adjustInfluence(side: 'grindelwald' | 'dumbledore', points: number, userId: number): Promise<void>;
  setInfluence(grindelwaldPoints: number, dumbledorePoints: number, userId: number, reason: string, side?: 'grindelwald' | 'dumbledore'): Promise<void>;

  // Přidávám implementaci chybějící funkce pro admin rozhraní
  getPendingHousingRequests(): Promise<HousingRequest[]>;

  // Owl Post operations
  getUnreadOwlPostCount(characterId: number): Promise<number>;
  getOwlPostInbox(characterId: number): Promise<OwlPostMessage[]>;
  getOwlPostSent(characterId: number): Promise<OwlPostMessage[]>;
  sendOwlPostMessage(senderCharacterId: number, recipientCharacterId: number, subject: string, content: string): Promise<OwlPostMessage>;
  markOwlPostMessageRead(messageId: number, characterId: number): Promise<boolean>;

  // Přidání předmětu do inventáře včetně ceny
  addItemToInventory(
    characterId: number,
    itemType: string,
    itemId: number,
    price?: number
  ): Promise<void>;

    // Chat methods
    getChatMessages(roomId: number): Promise<any>;
    createChatMessage(messageData: any): Promise<any>;
    archiveChatMessages(roomId: number): Promise<{ count: number }>;
    clearChatMessages(roomId: number): Promise<{ count: number }>;
    getRoomPresence(roomId: number): Promise<any>;

  // ... existing code ...
  getCharactersInChatRooms(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').select('*').ilike('username', username);
    const user = Array.isArray(data) && data.length > 0 ? data[0] : null;
    console.log('getUserByUsername:', { username, user, error });
    if (error) return undefined;
    return user ? toCamel(user) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const { data, error } = await supabase
      .from("users")
      .insert({
        username: user.username,
        email: user.email,
        password: hashedPassword,
        role: user.role || 'user'
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating user:", error);
      throw error;
    }
    return toCamel(data);
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').update({ role, updated_at: new Date() }).eq('id', id).select().single();
    if (error) return undefined;
    return toCamel(data);
  }

  async updateUserNarratorPermission(id: number, canNarrate: boolean): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').update({ can_narrate: canNarrate, updated_at: new Date() }).eq('id', id).select().single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getAllUsers(includeSystem = false): Promise<User[]> {
    let query = supabase.from('users').select('*');
    if (!includeSystem) {
      query = query.eq('is_system', false);
    }
    const { data, error } = await query;
    if (error) {
      console.error("getAllUsers error:", error);
      return [];
    }
    if (!data || data.length === 0) {
      console.warn("No users found", { data });
    }
    return toCamel(data || []);
  }

  async banUser(id: number, banReason: string): Promise<void> {
    await supabase.from('users').update({ is_banned: true, ban_reason: banReason, banned_at: new Date() }).eq('id', id);
  }

  async resetUserPassword(id: number, hashedPassword: string): Promise<void> {
    await supabase.from('users').update({ password: hashedPassword }).eq('id', id);
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await supabase.from('users').update({ password: hashedPassword, updated_at: new Date() }).eq('id', id);
  }

  async updateUserEmail(id: number, email: string): Promise<void> {
    await supabase.from('users').update({ email, updated_at: new Date() }).eq('id', id);
  }

  async updateUserSettings(id: number, settings: { characterOrder?: string; highlightWords?: string; highlightColor?: string; narratorColor?: string }): Promise<void> {
    // Převedu camelCase na snake_case pro klíče
    const snakeSettings: any = {};
    if (settings.characterOrder !== undefined) snakeSettings.character_order = settings.characterOrder;
    if (settings.highlightWords !== undefined) snakeSettings.highlight_words = settings.highlightWords;
    if (settings.highlightColor !== undefined) snakeSettings.highlight_color = settings.highlightColor;
    if (settings.narratorColor !== undefined) snakeSettings.narrator_color = settings.narratorColor;
    snakeSettings.updated_at = new Date();
    await supabase.from('users').update(snakeSettings).eq('id', id);
  }

  async getUserById(id: number): Promise<User | undefined> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return undefined;
    return data as User;
  }

  // Character operations
  async getCharacter(id: number): Promise<Character | undefined> {
    const { data, error } = await supabase.from('characters').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getCharacterById(id: number) {
    console.log(`[STORAGE] getCharacterById called with ID: ${id}`);

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error(`[STORAGE] Error fetching character by ID ${id}:`, error);
      return null;
    }

    console.log(`[STORAGE] Character ${id} found:`, data ? 'YES' : 'NO');
    return toCamel(data);
  }

  async getCharactersByUserId(userId: number): Promise<Character[]> {
    console.log(`[STORAGE] getCharactersByUserId called for user: ${userId}`);

    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .or('is_system.eq.false,is_system.is.null')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("[STORAGE] getCharactersByUserId error:", { userId, error });
      return [];
    }

    console.log(`[STORAGE] Raw DB response for user ${userId}:`, data);

    if (!data || data.length === 0) {
      console.log(`[STORAGE] No characters found for user ${userId}`);
      return [];
    }

    // Extra safety check - filter again to ensure only characters belonging to this user
    const filteredData = data.filter(char => char.user_id === userId);
    console.log(`[STORAGE] After filtering: ${filteredData.length} characters for user ${userId}`);

    const camelCaseData = toCamel(filteredData);
    console.log(`[STORAGE] Returning characters:`, camelCaseData.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, userId: c.userId })));

    return camelCaseData;
  }

  async getChatMessages(roomId: number) {
    try {
      console.log(`[STORAGE][getChatMessages] Starting fetch for room ${roomId}`);

      // 1. Načti všechny zprávy v místnosti
      const { data: rawMessages, error: msgError } = await supabase
        .from("messages")
        .select(`
          id,
          room_id,
          character_id,
          content,
          message_type,
          created_at
        `)
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (msgError) {
        console.error('[STORAGE][getChatMessages] Error fetching messages:', msgError);
        return [];
      }
      if (!rawMessages || rawMessages.length === 0) {
        console.log(`[STORAGE][getChatMessages] No messages found for room ${roomId}`);
        return [];
      }

      console.log(`[STORAGE][getChatMessages] Found ${rawMessages.length} messages`);
      console.log(`[STORAGE][getChatMessages] First 3 messages:`, rawMessages.slice(0, 3));

      // 2. Najdi všechny unikátní character_id (kromě 0)
      const characterIds = [
        ...new Set(
          rawMessages
            .map((msg) => msg.character_id)
            .filter((id) => id && id !== 0)
        ),
      ];

      console.log(`[STORAGE][getChatMessages] Found character IDs:`, characterIds);

      // 3. Načti všechny postavy najednou
      let characterMap = new Map();
      if (characterIds.length > 0) {
        console.log(`[STORAGE][getChatMessages] Fetching characters for IDs:`, characterIds);

        const { data: characters, error: charError } = await supabase
          .from("characters")
          .select("id, first_name, middle_name, last_name, avatar, user_id")
          .in("id", characterIds);

        if (charError) {
          console.error("[STORAGE][getChatMessages] Error fetching characters:", charError);
        } else if (characters) {
          console.log(`[STORAGE][getChatMessages] Fetched ${characters.length} characters:`, characters);

          characters.forEach((c) => {
            characterMap.set(c.id, {
              id: c.id,
              firstName: c.first_name,
              middleName: c.middle_name,
              lastName: c.last_name,
              avatar: c.avatar,
              userId: c.user_id,
            });
          });

          console.log(`[STORAGE][getChatMessages] Character map keys:`, Array.from(characterMap.keys()));
        } else {
          console.log(`[STORAGE][getChatMessages] No characters returned from query`);
        }
      } else {
        console.log(`[STORAGE][getChatMessages] No character IDs to fetch`);
      }

      // 4. Spoj zprávy s postavami
      const messages = rawMessages.map((msg, index) => {
        const char =
          msg.character_id === 0 || msg.message_type === "narrator"
            ? undefined
            : characterMap.get(msg.character_id);

        // Debug log for character mapping
        if (msg.character_id > 0 && msg.message_type !== "narrator" && !char) {
          console.log(`[STORAGE][getChatMessages] Warning: Character not found for message ${msg.id}, characterId: ${msg.character_id}`);
          console.log(`[STORAGE][getChatMessages] Available character IDs in map:`, Array.from(characterMap.keys()));
          console.log(`[STORAGE][getChatMessages] Message type: ${msg.message_type}`);
        }

        if (index < 3) {
          console.log(`[STORAGE][getChatMessages] Message ${index} - ID: ${msg.id}, CharID: ${msg.character_id}, Type: ${msg.message_type}, Character found: ${!!char}`);
        }

        return {
          id: msg.id,
          roomId: msg.room_id,
          characterId: msg.character_id,
          content: msg.content,
          messageType: msg.message_type,
          createdAt: msg.created_at,
          character: char,
        };
      });

      console.log(`[STORAGE][getChatMessages] Returning ${messages.length} messages`);
      return messages;
    } catch (error) {
      console.error("[STORAGE][getChatMessages] Error fetching chat messages:", error);
      return [];
    }
  }

  async createChatMessage(messageData: {
    roomId: number;
    characterId: number;
    userId: number;
    content: string;
    messageType: string;
  }) {
    try {
      console.log(`[STORAGE] Creating message:`, messageData);

      // For narrator messages, always use character_id = 0 and messageType = 'narrator'
      const characterId = messageData.messageType === 'narrator' ? 0 : messageData.characterId;
      const messageType = messageData.messageType || 'text';

      // Insert the message
      const { data: insertData, error: insertError } = await supabase
        .from('messages')
        .insert({
          room_id: messageData.roomId,
          character_id: characterId,
          content: messageData.content,
          message_type: messageType,
          created_at: new Date().toISOString()
        })
        .select('*')
        .single();

      console.log('[DEBUG][createChatMessage] Inserted:', JSON.stringify(insertData, null, 2));
      if (insertData) {
        console.log('[DEBUG][createChatMessage] typeof insertData:', typeof insertData);
        console.log('[DEBUG][createChatMessage] insertData.character_id:', insertData.character_id);
      }

      if (insertError) {
        console.error('Database error in createChatMessage:', insertError);
        throw insertError;
      }

      // Handle narrator messages
      if (messageType === 'narrator' || !insertData.character_id) {
        const message = {
          id: insertData.id,
          roomId: insertData.room_id,
          characterId: 0,
          content: insertData.content,
          messageType: insertData.message_type,
          createdAt: insertData.created_at,
          character: {
            id: 0,
            firstName: 'Vypravěč',
            middleName: null,
            lastName: '',
            avatar: null,
            userId: messageData.userId
          }
        };
        console.log(`[DEBUG][createChatMessage] narrator/system:`, JSON.stringify(message, null, 2));
        return message;
      }

      // Fetch character data for regular messages
      const { data: characterData, error: characterError } = await supabase
        .from('characters')
        .select('id, first_name, middle_name, last_name, avatar, user_id')
        .eq('id', insertData.character_id)
        .single();

      console.log('[DEBUG][createChatMessage] characterData:', JSON.stringify(characterData, null, 2));
      if (characterData) {
        console.log('[DEBUG][createChatMessage] typeof characterData:', typeof characterData);
        console.log('[DEBUG][createChatMessage] characterData.id:', characterData.id);
      }

      if (characterError) {
        console.error('Error fetching character for message:', characterError);
        // Return with fallback character data
        return {
          id: insertData.id,
          roomId: insertData.room_id,
          characterId: insertData.character_id,
          content: insertData.content,
          messageType: insertData.message_type,
          createdAt: insertData.created_at,
          character: {
            id: insertData.character_id,
            firstName: 'Neznámá',
            middleName: null,
            lastName: 'postava',
            avatar: null,
            userId: 0
          }
        };
      }

      const message = {
        id: insertData.id,
        roomId: insertData.room_id,
        characterId: insertData.character_id,
        content: insertData.content,
        messageType: insertData.message_type,
        createdAt: insertData.created_at,
        character: {
          id: characterData.id,
          firstName: characterData.first_name,
          middleName: characterData.middle_name,
          lastName: characterData.last_name,
          avatar: characterData.avatar,
          userId: characterData.user_id
        }
      };

      console.log(`[DEBUG][createChatMessage] complete:`, JSON.stringify(message, null, 2));
      return message;
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw error;
    }
  }

  async archiveChatMessages(roomId: number) {
    try {
      // First, get all messages to archive
      const { data: messages, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId);

      if (fetchError) throw fetchError;

      if (messages && messages.length > 0) {
        // Move to archive table
        const { error: archiveError } = await supabase
          .from('archived_messages')
          .insert(messages.map(msg => ({ 
            ...msg, 
            original_message_id: msg.id,
            archived_at: new Date().toISOString() 
          })));

        if (archiveError) throw archiveError;
      }

      return { count: messages?.length || 0 };
    } catch (error) {
      console.error('Error archiving messages:', error);
      throw error;
    }
  }

  async clearChatMessages(roomId: number) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', roomId)
        .select('id');

      if (error) throw error;
      return { count: data?.length || 0 };
    } catch (error) {
      console.error('Error clearing messages:', error);
      throw error;
    }
  }

  async getRoomPresence(roomId: number) {
    try {
      // This would be implemented with real-time presence tracking
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error fetching room presence:', error);
      return [];
    }
  }



  async updateCharacter(id: number, updates: Partial<InsertCharacter>): Promise<Character | undefined> {
    // Převod camelCase na snake_case pro databázi
    const dbUpdates: any = { updated_at: new Date() };

    if (updates.characterHistory !== undefined) dbUpdates.character_history = updates.characterHistory;
    if (updates.showHistoryToOthers !== undefined) dbUpdates.show_history_to_others = updates.showHistoryToOthers;
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.middleName !== undefined) dbUpdates.middle_name = updates.middleName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
    if (updates.school !== undefined) dbUpdates.school = updates.school;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.residence !== undefined) dbUpdates.residence = updates.residence;
    if (updates.height !== undefined) dbUpdates.height = updates.height;
    if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

    const { data, error } = await supabase.from('characters').update(dbUpdates).eq('id', id).select().single();
    if (error) {
      console.error('Database error in updateCharacter:', error);
      return undefined;
    }
    return toCamel(data);
  }

  async getCharacterByName(firstName: string, lastName: string): Promise<Character | undefined> {
    const { data, error } = await supabase.from('characters').select('*').eq('first_name', firstName).eq('last_name', lastName).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getAllCharacters(includeSystem = false): Promise<Character[]> {
    let query = supabase
      .from('characters')
      .select('*, user:user_id(username)')
      .eq('is_active', true)
      .is('death_date', null);

    if (!includeSystem) {
      query = query.or('is_system.eq.false,is_system.is.null');
    }
    const { data, error } = await query;
    if (error) {
      console.error("getAllCharacters error:", error);
      return [];
    }
    if (!data || data.length === 0) {
      console.warn("No characters found", { data });
    } else {
      console.log(`Loaded ${data.length} characters`, { data });
    }
    return toCamel(data || []);
  }

  // Authentication and invite codes remain same...

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    console.log('validateUser - user:', user);
    if (!user) return null;

    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('validateUser - isValidPassword:', isValidPassword, 'hash:', user.password, 'input:', password);
    return isValidPassword ? user : null;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  // Chat operations (keeping existing implementation)
  async getChatRoom(id: number): Promise<ChatRoom | undefined> {
    const { data, error } = await supabase.from('chat_rooms').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getChatRoomByName(name: string): Promise<ChatRoom | undefined> {
    const { data, error } = await supabase.from('chat_rooms').select('*').eq('name', name).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async createChatRoom(insertChatRoom: InsertChatRoom): Promise<ChatRoom> {
    const { data, error } = await supabase.from('chat_rooms').insert([insertChatRoom]).select().single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  }

  async updateChatRoom(id: number, updates: Partial<InsertChatRoom>): Promise<ChatRoom | undefined> {
    if (updates.password) {
      updates.password = await this.hashPassword(updates.password);
    }
    const { data, error } = await supabase.from('chat_rooms').update({ ...updates, updated_at: new Date() }).eq('id', id).select().single();
    if (error) return undefined;
    return toCamel(data);
  }

  async deleteChatRoom(id: number): Promise<boolean> {
    await supabase.from('messages').delete().eq('room_id', id);
    const { error } = await supabase.from('chat_rooms').delete().eq('id', id);
    return !error;
  }

  async getChatRoomsByCategory(categoryId: number): Promise<ChatRoom[]> {
    const { data, error } = await supabase.from('chat_rooms').select('*').eq('category_id', categoryId).order('sort_order', { ascending: true });
    if (error) return [];
    return toCamel(data || []);
  }

  async validateRoomPassword(roomId: number, password: string): Promise<boolean> {
    const room = await this.getChatRoom(roomId);
    if (!room) return false;
    if (!room.password) return true;
    return bcrypt.compare(password, room.password);
  }

  async updateChatCategorySortOrder(id: number, sortOrder: number): Promise<ChatCategory | undefined> {
    const { data, error } = await supabase.from('chat_categories').update({ sortOrder }).eq('id', id).select().single();
    if (error) return undefined;
    return data;
  }

  async updateChatRoomSortOrder(id: number, sortOrder: number): Promise<ChatRoom | undefined> {
    const { data, error } = await supabase.from('chat_rooms').update({ sortOrder }).eq('id', id).select().single();
    if (error) return undefined;
    return data;
  }

  async getChatCategory(id: number): Promise<ChatCategory | undefined> {
    const { data, error } = await supabase.from('chat_categories').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getChatCategoryByName(name: string): Promise<ChatCategory | undefined> {
    const { data, error } = await supabase.from('chat_categories').select('*').eq('name', name).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async createChatCategory(insertChatCategory: InsertChatCategory): Promise<ChatCategory> {
    const { data, error } = await supabase.from('chat_categories').insert([insertChatCategory]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateChatCategory(id: number, updates: Partial<InsertChatCategory>): Promise<ChatCategory | undefined> {
    const { data, error } = await supabase.from('chat_categories').update(updates).eq('id', id).select().single();
    if (error) return undefined;
    return data;
  }

  async deleteChatCategory(id: number): Promise<boolean> {
    // Zkontrolujeme, jestli má podkategorie nebo místnosti
    const { data: children } = await supabase.from('chat_categories').select('id').eq('parentId', id);
    if (children && children.length > 0) return false;
    const { data: rooms } = await supabase.from('chat_rooms').select('id').eq('category_id', id);
    if (rooms && rooms.length > 0) return false;
    const { error } = await supabase.from('chat_categories').delete().eq('id', id);
    return !error;
  }

  async getAllChatCategories(): Promise<ChatCategory[]> {
    const { data, error } = await supabase.from('chat_categories').select('*').order('sort_order');
    if (error) {
      console.error("getAllChatCategories error:", error);
      return [];
    }
    if (!data || data.length === 0) {
      console.warn("No chat categories found", { data });
    }
    return toCamel(data || []);
  }

  async getChatCategoriesWithChildren(userRole: string = 'user'): Promise<(ChatCategory & { children: ChatCategory[], rooms: ChatRoom[] })[]> {
    // Fetch all categories
    const { data: categories, error: categoriesError } = await supabase
      .from('chat_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching chat categories:', categoriesError);
      return [];
    }

    // Fetch all rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('sort_order', { ascending: true });

    if (roomsError) {
      console.error('Error fetching chat rooms:', roomsError);
      return [];
    }

    // Filtruj místnosti pro běžné uživatele
    const filteredRooms = userRole !== 'admin'
      ? (rooms || []).filter((room: any) => room.is_public !== false && room.is_test !== true)
      : (rooms || []);

    // Build hierarchical structure
    const categoryMap = new Map<number, any>();
    const rootCategories: any[] = [];

    // First pass: create all categories
    categories?.forEach(cat => {
      const category = toCamel(cat);
      category.children = [];
      category.rooms = [];
      categoryMap.set(category.id, category);
    });

    // Second pass: assign rooms to categories
    filteredRooms?.forEach(room => {
      const camelRoom = toCamel(room);
      if (camelRoom.category_id && categoryMap.has(camelRoom.category_id)) {
        categoryMap.get(camelRoom.category_id).rooms.push(camelRoom);
      }
    });

    // Third pass: build hierarchy
    categories?.forEach(cat => {
      const category = categoryMap.get(cat.id);
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id).children.push(category);
      } else {
        rootCategories.push(category);
      }
    });

    return rootCategories;
  }

  async getAllChatRooms(userRole: string = 'user'): Promise<ChatRoom[]> {
    let query = supabase.from('chat_rooms').select('*').order('sort_order');

    const { data, error } = await query;
    if (error) {
      console.error('[DEBUG][getAllChatRooms][error]', error);
      return [];
    }

    if (userRole !== 'admin') {
      // Filtruj pouze veřejné a netestovací místnosti pro běžné uživatele
      const filtered = (data || []).filter((room: any) => 
        room.is_public !== false && room.is_test !== true
      );
      console.log('[DEBUG][getAllChatRooms][filtered]', filtered);
      return toCamel(filtered);
    }

    console.log('[DEBUG][getAllChatRooms][data]', data);
    return toCamel(data || []);
  }

  // Message operations (keeping existing)
  async getMessage(id: number): Promise<Message | undefined> {
    const { data, error } = await supabase.from('messages').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getMessagesByRoom(roomId: number, limit: number = 50, offset: number = 0): Promise<(Message & { character: { firstName: string; middleName?: string | null; lastName: string; avatar?: string | null } })[]> {
    const { data, error } = await supabase.from('messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error) {
      console.error("getMessagesByRoom error:", { roomId, error });
      return [];
    }
    if (!data || data.length === 0) {
      console.warn("No messages found for room", { roomId, data });
    }
    return toCamel(data || []);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const { data, error } = await supabase.from('messages').insert([insertMessage]).select().single();
    if (error) {
      console.error("createMessage error:", { insertMessage, error });
      throw new Error(error.message);
    }
    console.log("Message created", { message: data });
    return toCamel(data);
  }

  async deleteMessage(id: number): Promise<boolean> {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    return !error;
  }

  async updateMessageCharacter(messageId: number, characterId: number): Promise<void> {
    await supabase.from('messages').update({ character_id: characterId }).eq('id', messageId);
  }

  // Archive operations (keeping existing)
  async archiveMessages(roomId: number, beforeDate?: Date): Promise<number> {
    // Supabase neumí server-side archivaci, takže by to mělo být řešeno jinak (např. přes funkci v backendu)
    // Zde pouze příklad: přesunout zprávy do archivedMessages a smazat je z messages
    const { data: messages, error } = await supabase.from('messages').select('*').eq('roomId', roomId).lt('createdAt', beforeDate ? beforeDate.toISOString() : new Date().toISOString());
    if (error || !messages) return 0;
    for (const msg of messages) {
      await supabase.from('archivedMessages').insert([{
        originalMessageId: msg.id,
        roomId: msg.roomId,
        characterId: msg.characterId,
        characterName: '', // Pokud potřebuješ, doplň jméno postavy
        content: msg.content,
        messageType: msg.messageType,
        originalCreatedAt: msg.createdAt,
        archivedAt: new Date().toISOString(),
      }]);
      await supabase.from('messages').delete().eq('id', msg.id);
    }
    return messages.length;
  }

  async getArchivedMessages(roomId: number, limit: number = 50, offset: number = 0): Promise<ArchivedMessage[]> {
    const { data, error } = await supabase.from('archivedMessages').select('*').eq('roomId', roomId).order('archivedAt', { ascending: false }).range(offset, offset + limit - 1);
    if (error) return [];
    return data || [];
  }

  async deleteAllMessages(): Promise<void> {
    await supabase.from('messages').delete();
    await supabase.from('archivedMessages').delete();
  }

  async clearRoomMessages(roomId: number): Promise<number> {
    // Oprava: .select('*') bez druhého argumentu
    const { data, error } = await supabase.from('messages').delete().eq('roomId', roomId).select('*');
    if (error) return 0;
    if (Array.isArray(data)) return data.length;
    return 0;
  }

  async getArchiveDates(roomId: number): Promise<string[]> {
    const { data, error } = await supabase.from('archivedMessages').select('archivedAt').eq('roomId', roomId).order('archivedAt');
    if (error || !data) return [];
    const uniqueDates = Array.from(new Set(data.map(d => d.archivedAt && d.archivedAt.split('T')[0])));
    return uniqueDates;
  }

  async getArchiveDatesWithCounts(roomId: number): Promise<{ date: string; count: number }[]> {
    const { data, error } = await supabase.from('archivedMessages').select('archivedAt').eq('roomId', roomId).order('archivedAt');
    if (error || !data) return [];
    const counts: Record<string, number> = {};
    for (const row of data) {
      const date = row.archivedAt && row.archivedAt.split('T')[0];
      if (date) counts[date] = (counts[date] || 0) + 1;
    }
    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }

  async getArchivedMessagesByDate(roomId: number, archiveDate: string, limit: number = 50, offset: number = 0): Promise<ArchivedMessage[]> {
    const startDate = new Date(archiveDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const { data, error } = await supabase.from('archivedMessages').select('*').eq('roomId', roomId).gte('archivedAt', startDate.toISOString()).lt('archivedAt', endDate.toISOString()).order('originalCreatedAt').range(offset, offset + limit - 1);
    if (error) return [];
    return data || [];
  }

  async getLastMessageByCharacter(characterId: number): Promise<Message | undefined> {
    const { data, error } = await supabase.from('messages').select('*').eq('characterId', characterId).order('createdAt', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return undefined;
    return data[0];
  }

  // Character request operations
  async createCharacterRequest(request: InsertCharacterRequest): Promise<CharacterRequest> {
    console.log('[createCharacterRequest] Incoming request:', request);
    const safeRequest = {
      ...request,
      middleName: request.middleName && request.middleName.trim() !== '' ? request.middleName : null,
      description: request.description && request.description.trim() !== '' ? request.description : null,
      school: request.school && request.school.trim() !== '' ? request.school : null,
    };
    const snakeRequest = toSnake(safeRequest);
    console.log('[createCharacterRequest] Snake_case request:', snakeRequest);
    const { data, error } = await supabase.from('character_requests').insert([snakeRequest]).select().single();
    console.log('[createCharacterRequest] Supabase response:', { data, error });
    if (error) {
      console.error('[createCharacterRequest] Supabase error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        full: error
      });
      throw new Error(`Supabase error: ${error.message} | Details: ${error.details || ''} | Hint: ${error.hint || ''} | Code: ${error.code || ''}`);
    }
    return data;
  }

  async getCharacterRequestsByUserId(userId: number): Promise<CharacterRequest[]> {
    const { data, error } = await supabase.from('character_requests').select('*').eq('user_id', userId);
    if (error) return [];
    return data || [];
  }

  async getCharacterRequestById(requestId: number): Promise<CharacterRequest | undefined> {
    const { data, error } = await supabase.from('character_requests').select('*').eq('id', requestId).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async deleteCharacterRequest(requestId: number): Promise<boolean> {
    const { error } = await supabase.from('character_requests').delete().eq('id', requestId);
    return !error;
  }

  async getAllCharacterRequests(): Promise<(CharacterRequest & { user: { username: string; email: string } })[]> {
    const { data: requests, error } = await supabase.from('character_requests').select('*');
    if (error || !requests) return [];
    const { data: usersData } = await supabase.from('users').select('id,username,email');
    return toCamel(requests.map(r => ({
      ...r,
      user: usersData?.find(u => u.id === r.user_id) || { username: '', email: '' }
    })));
  }

  async getPendingCharacterRequests(): Promise<(CharacterRequest & { user: { username: string; email: string } })[]> {
    const { data: requests, error } = await supabase.from('character_requests').select('*').eq('status', 'pending');
    if (error || !requests) return [];
    const { data: usersData } = await supabase.from('users').select('id,username,email');
    return toCamel(requests.map(r => ({
      ...r,
      user: usersData?.find(u => u.id === r.user_id) || { username: '', email: '' }
    })));
  }

  async approveCharacterRequest(requestId: number, adminId: number, reviewNote?: string): Promise<Character> {
    // Změníme status requestu a vytvoříme postavu
    const { data: request, error } = await supabase.from('characterRequests').select('*').eq('id', requestId).single();
    if (error || !request) throw new Error('Request not found');
    await supabase.from('characterRequests').update({ status: 'approved', reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNote }).eq('id', requestId);
    const { data: character, error: charError } = await supabase.from('characters').insert([{
      userId: request.userId,
      firstName: request.firstName,
      middleName: request.middleName,
      lastName: request.lastName,
      birthDate: request.birthDate,
      school: request.school,
      description: request.description,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }]).select().single();
    if (charError) throw new Error(charError.message);
    await this.logAdminActivity({
      adminId,
      action: 'approve_character',
      targetUserId: request.userId,
      targetRequestId: requestId,
      details: `Approved character request: ${request.firstName} ${request.lastName}`
    });
    return character;
  }

  async rejectCharacterRequest(requestId: number, adminId: number, reviewNote: string): Promise<CharacterRequest> {
    const { data: request, error } = await supabase.from('characterRequests').select('*').eq('id', requestId).single();
    if (error || !request) throw new Error('Request not found');
    await supabase.from('characterRequests').update({ status: 'rejected', reviewedBy: adminId, reviewedAt: new Date().toISOString(), reviewNote }).eq('id', requestId);
    await this.logAdminActivity({
      adminId,
      action: 'reject_character',
      targetUserId: request.userId,
      targetRequestId: requestId,
      details: `Rejected character request: ${request.firstName} ${request.lastName}`
    });
    return { ...request, status: 'rejected', reviewNote };
  }

  // Admin activity log operations
  async logAdminActivity(activity: InsertAdminActivityLog): Promise<AdminActivityLog> {
    const { data, error } = await supabase.from('adminActivityLog').insert([activity]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async getAdminActivityLog(limit: number = 50, offset: number = 0): Promise<(AdminActivityLog & { admin: { username: string }; targetUser?: { username: string } })[]> {
    const { data: logs, error } = await supabase.from('adminActivityLog').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (error || !logs) return [];
    const { data: usersData } = await supabase.from('users').select('id,username');
    return toCamel(logs.map(l => ({
      ...l,
      admin: usersData?.find(u => u.id === l.admin_id) || { username: '' },
      targetUser: l.target_user_id ? (usersData?.find(u => u.id === l.target_user_id) || { username: '' }) : undefined
    })));
  }

  // Multi-character operations


  // Cemetery operations
  async killCharacter(characterId: number, deathReason: string, adminId: number): Promise<Character | undefined> {
    const character = await this.getCharacter(characterId);
    if (!character) throw new Error('Character not found');
    const { data, error } = await supabase.from('characters').update({ isActive: false, deathDate: new Date().toISOString().split('T')[0], deathReason, updatedAt: new Date().toISOString() }).eq('id', characterId).select().single();
    if (error) return undefined;
    await this.logAdminActivity({
      adminId,
      action: 'kill_character',
      targetUserId: character.userId,
      targetCharacterId: characterId,
      details: `Killed character: ${character.firstName} ${character.lastName}. Reason: ${deathReason}`
    });
    return data;
  }

  async reviveCharacter(characterId: number): Promise<Character | undefined> {
    const { data, error } = await supabase.from('characters').update({ deathDate: null, deathReason: null, updatedAt: new Date().toISOString() }).eq('id', characterId).select().single();
    if (error) return undefined;
    return data;
  }

  async getDeadCharacters(): Promise<any[]> {
    const { data, error } = await supabase
      .from('characters')
      .select(`
        *,
        users:user_id (username, email)
      `)
      .not('death_date', 'is', null)
      .order('death_date', { ascending: false });

    if (error) {
      console.error("Error fetching dead characters:", error);
      throw error;
    }

    return toCamel(data || []);
  }

  async getActiveCharacters(): Promise<any[]> {
    try {
      console.log("[STORAGE] Fetching active characters from database...");

      const { data, error } = await supabase
        .from('characters')
        .select(`
          id,
          user_id,
          first_name,
          middle_name,
          last_name,
          birth_date,
          school,
          description,
          avatar,
          residence,
          height,
          weight,
          character_history,
          show_history_to_others,
          is_active,
          death_date,
          is_system,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .is('death_date', null)
        .eq('is_system', false);

      if (error) {
        console.error('[STORAGE] Error fetching active characters:', error);
        return [];
      }

      if (!data || data.length === 0) {
        console.warn('[STORAGE] No active characters found');
        return [];
      }

      console.log(`[STORAGE] Found ${data.length} active characters`);

      // Transformace dat do správného formátu
      const transformedData = data.map((char: any) => ({
        id: char.id,
        userId: char.user_id,
        firstName: char.first_name,
        middleName: char.middle_name,
        lastName: char.last_name,
        birthDate: char.birth_date,
        school: char.school,
        description: char.description,
        avatar: char.avatar,
        residence: char.residence,
        height: char.height,
        weight: char.weight,
        characterHistory: char.character_history,
        showHistoryToOthers: char.show_history_to_others,
        isActive: char.is_active,
        deathDate: char.death_date,
        isSystem: char.is_system,
        createdAt: char.created_at,
        updatedAt: char.updated_at
      }));

      console.log("[STORAGE] Sample transformed character:", transformedData[0] ? {
        id: transformedData[0].id,
        firstName: transformedData[0].firstName,
        lastName: transformedData[0].lastName
      } : "No characters");

      return transformedData;
    } catch (error) {
      console.error('[STORAGE] Error in getActiveCharacters:', error);
      return [];
    }
  }

  // Spell operations
  async getAllSpells(): Promise<Spell[]> {
    const { data, error } = await supabase.from('spells').select('*').order('category').order('name');
    if (error) return [];
    return toCamel(data || []);
  }

  async getSpell(id: number): Promise<Spell | undefined> {
    const { data, error } = await supabase.from('spells').select('*').eq('id', id).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async getSpellByName(name: string): Promise<Spell | undefined> {
    const { data, error } = await supabase.from('spells').select('*').eq('name', name).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async createSpell(insertSpell: InsertSpell): Promise<Spell> {
    const { data, error } = await supabase.from('spells').insert([insertSpell]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateSpell(id: number, updates: Partial<InsertSpell>): Promise<Spell | undefined> {
    const { data, error } = await supabase.from('spells').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id).select().single();
    if (error) return undefined;
    return data;
  }

  async deleteSpell(id: number): Promise<boolean> {
    await supabase.from('characterSpells').delete().eq('spellId', id);
    const { error } = await supabase.from('spells').delete().eq('id', id);
    return !error;
  }

  // Character spell operations
  async getCharacterSpells(characterId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from('character_spells')
      .select(`
        *,
        spell:spells(*)
      `)
      .eq('character_id', characterId);

    if (error) {
      console.error('Error fetching character spells:', error);
      return [];
    }

    return (data || []).map(toCamel);
  }

  async addSpellToCharacter(characterId: number, spellId: number): Promise<CharacterSpell> {
    const { data, error } = await supabase.from('characterSpells').insert([{ character_id: characterId, spell_id: spellId }]).select().single();
    if (error) throw new Error(error.message);
    return toCamel(data);
  }

  async removeSpellFromCharacter(characterId: number, spellId: number): Promise<boolean> {
    const { error } = await supabase.from('characterSpells').delete().eq('character_id', characterId).eq('spell_id', spellId);
    return !error;
  }

  async initializeDefaultSpells(): Promise<void> {
    const defaultSpells = [
      {
        name: "Carpe Retractum",
        description: "Vytvoří světelné lano, které slouží k přitažení předmětu k sesílateli",
        effect: "Vytvoří světelné lano, které slouží k přitažení předmětu k sesílateli, pokud je použito na pevně ukotvený předmět, může se naopak přitáhnout sesílatel.",
        category: "Kouzelné formule",
        type: "Základní",
        target_type: "object",
      },
      {
        name: "Lumos",
        description: "Rozsvítí konec hůlky jako svítilnu",
        effect: "Rozsvítí konec hůlky jako svítilnu.",
        category: "Kouzelné formule",
        type: "Základní",
        target_type: "self",
      },
      {
        name: "Nox",
        description: "Zhasne světlo vyvolané kouzlem Lumos",
        effect: "Zhasne světlo vyvolané kouzlem Lumos.",
        category: "Kouzelné formule",
        type: "Základní",
        target_type: "self",
      }
    ];

    // Create spells if they don't exist
    for (const spellData of defaultSpells) {
      // Check if spell already exists
      const { data: existingSpells } = await supabase.from('spells').select('*').eq('name', spellData.name);
      let spell;
      if (!existingSpells || existingSpells.length === 0) {
        const { data: inserted, error } = await supabase.from('spells').insert([spellData]).select().single();
        if (error) throw new Error(error.message);
        spell = inserted;
        console.log(`Created spell: ${spell.name}`);
      } else {
        spell = existingSpells[0];
        console.log(`Spell already exists: ${spell.name}`);
      }

      // Add spell to all existing characters who don't have it
      const { data: allCharacters } = await supabase.from('characters').select('*');
      if (!allCharacters) continue;

      for (const character of allCharacters) {
        // Check if character already has this spell
        const { data: existingCharacterSpell } = await supabase
          .from('character_spells')
          .select('*')
          .eq('character_id', character.id)
          .eq('spell_id', spell.id);

        if (!existingCharacterSpell || existingCharacterSpell.length === 0) {
          await supabase.from('character_spells').insert([{
            character_id: character.id,
            spell_id: spell.id,
            learned_at: new Date().toISOString()
          }]);
          console.log(`Added spell ${spell.name} to character ${character.first_name} ${character.last_name}`);
        }
      }
    }
  }

  // Character inventory operations
  async getCharacterInventory(characterId: number): Promise<any[]> {
    // Získáme všechny položky inventáře
    const { data: inventory, error } = await supabase
      .from('character_inventory')
      .select('*')
      .eq('character_id', characterId);
    if (error || !inventory) return [];

    // Najdeme všechny wand itemy a jejich ID
    const wandItems = inventory.filter(item => item.item_type === 'wand');
    const wandIds = wandItems.map(item => item.item_id);
    let wandsMap: Record<number, any> = {};
    if (wandIds.length > 0) {
      const { data: wands, error: wandError } = await supabase
        .from('wands')
        .select('id, wood, core, length, flexibility, description')
        .in('id', wandIds);
      if (wands) {
        wandsMap = Object.fromEntries(wands.map(w => [w.id, w]));
      }
    }

    // Přidáme wand detaily k příslušným položkám
    const result = inventory.map(item => {
      if (item.item_type === 'wand' && wandsMap[item.item_id]) {
        return {
          ...item,
          wand_wood: wandsMap[item.item_id].wood,
          wand_core: wandsMap[item.item_id].core,
          wand_length: wandsMap[item.item_id].length,
          wand_flexibility: wandsMap[item.item_id].flexibility,
          wand_description: wandsMap[item.item_id].description,
        };
      }
      return item;
    });
    return toCamel(result);
  }

  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    const { data, error } = await supabase.from('character_inventory').select('*').eq('id', id).single();
    if (error) return undefined;
    return data;
  }

  async addInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const { data, error } = await supabase.from('character_inventory').insert([item]).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateInventoryItem(id: number, updates: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const { data, error } = await supabase.from('character_inventory').update(updates).eq('id', id).select().single();
    if (error) return undefined;
    return data;
  }

  async deleteInventoryItem(id: number): Promise<boolean> {
    const { error } = await supabase.from('character_inventory').delete().eq('id', id);
    return !error;
  }

  // Character journal operations
  async getCharacterJournal(characterId: number): Promise<JournalEntry[]> {
    const { data, error } = await supabase
      .from('character_journal')
      .select('*')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error("getCharacterJournal error:", { characterId, error });
      return [];
    }
    if (!data || data.length === 0) {
      console.warn("No journal entries found for character", { characterId, data });
    } else {
      console.log(`Loaded ${data.length} journal entries for character`, { characterId });
    }
    return toCamel(data || []);
  }

  async getJournalEntry(id: number): Promise<JournalEntry | undefined> {
    const { data, error } = await supabase.from('characterJournal').select('*').eq('id', id).single();
    if (error) return undefined;
    return data;
  }

  async addJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const { data, error } = await supabase
      .from('character_journal')
      .insert([entry])
      .select()
      .single();
    if (error) {
      console.error("addJournalEntry error:", { entry, error });
      throw new Error(error.message);
    }
    console.log("Journal entry added", { entry });
    return toCamel(data);
  }

  async updateJournalEntry(id: number, updates: Partial<InsertJournalEntry>): Promise<JournalEntry | undefined> {
    const { data, error } = await supabase
      .from('character_journal')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error("updateJournalEntry error:", { id, updates, error });
      return undefined;
    }
    console.log("Journal entry updated", { id, updates });
    return toCamel(data);
  }

  async deleteJournalEntry(id: number): Promise<boolean> {
    const { error } = await supabase
      .from('character_journal')
      .delete()
      .eq('id', id);
    if (error) {
      console.error("deleteJournalEntry error:", { id, error });
      return false;
    }
    console.log("Journal entry deleted", { id });
    return true;
  }

  // Wand operations
  async getCharacterWand(characterId: number): Promise<Wand | undefined> {
    const { data, error } = await supabase.from('wands').select('*').eq('character_id', characterId).single();
    if (error) return undefined;
    return toCamel(data);
  }

  async createWand(wand: InsertWand): Promise<Wand> {
    const wandToInsert = {
      character_id: wand.character_id,
      wood: wand.wood,
      core: wand.core,
      length: wand.length,
      flexibility: wand.flexibility,
      description: wand.description,
      acquired_at: wand.acquired_at || new Date().toISOString()
    };
    const { data, error } = await supabase.from('wands').insert([wandToInsert]).select().single();
    if (error) throw new Error(error.message);
    await this.addItemToInventory(data.character_id, 'wand', data.id, 7);
    return {
      id: data.id,
      character_id: data.character_id,
      wood: data.wood,
      core: data.core,
      length: data.length,
      flexibility: data.flexibility,
      description: data.description,
      acquired_at: data.acquired_at
    };
  }

  async updateWand(wandId: number, updates: Partial<InsertWand>): Promise<Wand | undefined> {
    const { data, error } = await supabase.from('wands').update(updates).eq('id', wandId).select().single();
    if (error) return undefined;
    return data;
  }

  async deleteWand(wandId: number): Promise<boolean> {
    const { error } = await supabase.from('wands').delete().eq('id', wandId);
    return !error;
  }

  async generateRandomWand(characterId: number): Promise<Wand> {
    try {
      const components = await this.getAllWandComponents();

      // Filter only components available for random selection
      const availableWoods = components.woods.filter(w => w.availableForRandom !== false);
      const availableCores = components.cores.filter(c => c.availableForRandom !== false);
      const availableLengths = components.lengths.filter(l => l.availableForRandom !== false);
      const availableFlexibilities = components.flexibilities.filter(f => f.availableForRandom !== false);

      if (availableWoods.length === 0 || availableCores.length === 0 ||
        availableLengths.length === 0 || availableFlexibilities.length === 0) {
        throw new Error("Not enough components available for random generation");
      }

      // Random selection
      const randomWood = availableWoods[Math.floor(Math.random() * availableWoods.length)];
      const randomCore = availableCores[Math.floor(Math.random() * availableCores.length)];
      const randomLength = availableLengths[Math.floor(Math.random() * availableLengths.length)];
      const randomFlexibility = availableFlexibilities[Math.floor(Math.random() * availableFlexibilities.length)];

      const wandData = {
        character_id: characterId,
        wood: randomWood.name,
        core: randomCore.name,
        length: randomLength.name,
        flexibility: randomFlexibility.name,
        description: `A ${randomLength.name} wand made of ${randomWood.name} wood with a ${randomCore.name} core, ${randomFlexibility.name}`,
        acquired_at: new Date().toISOString()
      };

      console.log("Wand data being inserted:", wandData);
      const { data, error } = await supabase.from('wands').insert([wandData]).select().single();
      if (error) throw error;
      await this.addItemToInventory(characterId, 'wand', data.id, 7);
      return {
        id: data.id,
        character_id: data.character_id,
        wood: data.wood,
        core: data.core,
        length: data.length,
        flexibility: data.flexibility,
        description: data.description,
        acquired_at: data.acquired_at
      };
    } catch (error: any) {
      console.error('Error generating random wand:', error);
      throw new Error('Failed to generate random wand');
    }
  }

  async getAllWandComponents(): Promise<{
    woods: WandWood[];
    cores: WandCore[];
    lengths: WandLength[];
    flexibilities: WandFlexibility[];
  }> {
    try {
      const [woods, cores, lengths, flexibilities] = await Promise.all([
        supabase.from('wand_woods').select('*').order('sort_order'),
        supabase.from('wand_cores').select('*').order('sort_order'),
        supabase.from('wand_lengths').select('*').order('sort_order'),
        supabase.from('wand_flexibilities').select('*').order('name'),
      ]);

      if (woods.error) {
        console.error('Error fetching wand_woods:', woods.error);
        throw woods.error;
      }
      if (cores.error) {
        console.error('Error fetching wand_cores:', cores.error);
        throw cores.error;
      }
      if (lengths.error) {
        console.error('Error fetching wand_lengths:', lengths.error);
        throw lengths.error;
      }
      if (flexibilities.error) {
        console.error('Error fetching wand_flexibilities:', flexibilities.error);
        throw flexibilities.error;
      }

      return {
        woods: (woods.data || []).map(toCamel),
        cores: (cores.data || []).map(toCamel),
        lengths: (lengths.data || []).map(toCamel),
        flexibilities: (flexibilities.data || []).map(toCamel),
      };
    } catch (error) {
      console.error('Error in getAllWandComponents:',error);
      throw error;
    }
  }

  async migrateExistingWandsToInventory(): Promise<number> {
    // Implementation needed
    throw new Error("Method not implemented");
  }

  async updateWandComponents(components: { woods?: { name: string; shortDescription: string; longDescription: string; availableForRandom?: boolean; id?: number }[]; cores?: { name: string; category: string; description: string; availableForRandom?: boolean; id?: number }[]; lengths?: { name: string; description: string; availableForRandom?: boolean; id?: number }[]; flexibilities?: { name: string; description: string; availableForRandom?: boolean; id?: number }[] }): Promise<void> {
    try {
      if (components.woods) {
        for (const wood of components.woods) {
          if (wood.id) {
            await supabase.from('wand_woods').update(toSnake(wood)).eq('id', wood.id);
          } else {
            await supabase.from('wand_woods').insert([toSnake(wood)]);
          }
        }
      }

      if (components.cores) {
        for (const core of components.cores) {
          if (core.id) {
            await supabase.from('wand_cores').update(toSnake(core)).eq('id', core.id);
          } else {
            await supabase.from('wand_cores').insert([toSnake(core)]);
          }
        }
      }

      if (components.lengths) {
        for (const length of components.lengths) {
          if (length.id) {
            await supabase.from('wand_lengths').update(toSnake(length)).eq('id', length.id);
          } else {
            await supabase.from('wand_lengths').insert([toSnake(length)]);
          }
        }
      }

      if (components.flexibilities) {
        for (const flexibility of components.flexibilities) {
          if (flexibility.id) {
            await supabase.from('wand_flexibilities').update(toSnake(flexibility)).eq('id', flexibility.id);
          } else {
            await supabase.from('wand_flexibilities').insert([toSnake(flexibility)]);
          }
        }
      }
    } catch (error) {
      console.error('Error updating wand components:', error);
      throw error;
    }
  }

  // Influence operations
  async getInfluenceBar(): Promise<{ grindelwaldPoints: number; dumbledorePoints: number }> {
    try {
      const { data, error } = await supabase.from('influence_bar').select('*').single();
      if (error) {
        console.log("No influence_bar record found, creating default:", error.message);
        // Vytvoř výchozí záznam pokud neexistuje
        const { data: newData, error: createError } = await supabase
          .from('influence_bar')
          .insert([{ grindelwald_points: 50, dumbledore_points: 50 }])
          .select()
          .single();
        if (createError) {
          console.error("Error creating influence bar:", createError);
          return { grindelwaldPoints: 50, dumbledorePoints: 50 };
        }
        return { grindelwaldPoints: newData.grindelwald_points, dumbledorePoints: newData.dumbledore_points };
      }
      return { grindelwaldPoints: data.grindelwald_points, dumbledorePoints: data.dumbledore_points };
    } catch (error) {
      console.error("Error fetching influence bar:", error);
      return { grindelwaldPoints: 50, dumbledorePoints: 50 };
    }
  }

  async getInfluenceHistory(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('influence_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error("Error fetching influence history:", error);
        return [];
      }
      if (!data || data.length === 0) {
        console.warn("No influence history found", { data });
      }
      return toCamel(data || []);
    } catch (error) {
      console.error("Error fetching influence history:", error);
      return [];        }
  }

  async adjustInfluence(side: 'grindelwald' | 'dumbledore', points: number, userId: number): Promise<void> {
    try {
      const current = await this.getInfluenceBar();
      const newGrindelwaldPoints = side === 'grindelwald' ? current.grindelwaldPoints + points : current.grindelwaldPoints;
      const newDumbledorePoints = side === 'dumbledore' ? current.dumbledorePoints + points : current.dumbledorePoints;
      await this.setInfluence(newGrindelwaldPoints, newDumbledorePoints, userId, '', side);
    } catch (error) {
      console.error("Error adjusting influence:", error);
      throw error;
    }
  }

  async setInfluence(grindelwaldPoints: number, dumbledorePoints: number, userId: number, reason: string, side?: 'grindelwald' | 'dumbledore'): Promise<void> {
    const now = new Date().toISOString();

    // Získej původní body
    const { data: existing, error: readError } = await supabase
      .from('influence_bar')
      .select('grindelwald_points, dumbledore_points')
      .eq('id', 1)
      .single();

    const prevGrindelwald = existing ? existing.grindelwald_points : 0;
    const prevDumbledore = existing ? existing.dumbledore_points : 0;

    // Aktualizuj influence_bar
    const { error: updateError } = await supabase
      .from('influence_bar')
      .upsert([{
        id: 1,
        grindelwald_points: grindelwaldPoints,
        dumbledore_points: dumbledorePoints,
        updated_at: now
      }], { onConflict: 'id' });

    if (updateError) {
      console.error("Error updating influence_bar:", updateError);
      throw updateError;
    }

    // Připrav history zápis podle změněné strany
    let historyRows = [];
    if (side === 'grindelwald') {
      historyRows.push({
        change_type: 'manual',
        points_changed: grindelwaldPoints - prevGrindelwald,
        previous_total: prevGrindelwald,
        new_total: grindelwaldPoints,
        reason,
        admin_id: userId,
        side: 'grindelwald',
        created_at: now
      });
    } else if (side === 'dumbledore') {
      historyRows.push({
        change_type: 'manual',
        points_changed: dumbledorePoints - prevDumbledore,
        previous_total: prevDumbledore,
        new_total: dumbledorePoints,
        reason,
        admin_id: userId,
        side: 'dumbledore',
        created_at: now
      });
    } else {
      // Reset nebo změna obou stran
      if (grindelwaldPoints !== prevGrindelwald) {
        historyRows.push({
          change_type: 'manual',
          points_changed: grindelwaldPoints - prevGrindelwald,
          previous_total: prevGrindelwald,
          new_total: grindelwaldPoints,
          reason: reason || 'reset',
          admin_id: userId,
          side: 'grindelwald',
          created_at: now
        });
      }
      if (dumbledorePoints !== prevDumbledore) {
        historyRows.push({
          change_type: 'manual',
          points_changed: dumbledorePoints - prevDumbledore,
          previous_total: prevDumbledore,
          new_total: dumbledorePoints,
          reason: reason || 'reset',
          admin_id: userId,
          side: 'dumbledore',
          created_at: now
        });
      }
    }

    if (historyRows.length > 0) {
      const { error: histError } = await supabase
        .from('influence_history')
        .insert(historyRows);
      if (histError) {
        console.error("Error inserting influence_history:", histError);
        throw histError;
      }
    }
  }

  async assignHousingAdminToSystemUser() {
    // Najdi postavu Správa ubytování
    const { data: character } = await supabase.from('characters').select('*').eq('firstName', 'Správa').eq('lastName', 'ubytování').single();
    if (character) {
      await supabase.from('characters').update({ userId: 6, is_system: true }).eq('id', character.id);
    }
  }

  // Přidávám implementaci chybějící funkce pro admin rozhraní
  async getPendingHousingRequests(): Promise<HousingRequest[]> {
    const { data, error } = await supabase.from('housingRequests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (error) return [];
    return toCamel(data || []);
  }

  // Owl Post operations - používá tabulku messages s room_id = -1 a message_type = 'owl_post'
  async getUnreadOwlPostCount(characterId: number): Promise<number> {
    // Spočítáme nepřečtené zprávy typu owl_post určené pro danou postavu
    // Zpráva je nepřečtená, pokud není v tabulce read_messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id')
      .eq('room_id', -1)
      .eq('message_type', 'owl_post')
      .like('content', `%"recipientCharacterId":${characterId}%`);

    if (error || !messages) return 0;

    // Zkontrolujeme, které z těchto zpráv jsou nepřečtené
    let unreadCount = 0;
    for (const message of messages) {
      const { data: readRecord } = await supabase
        .from('read_messages')
        .select('id')
        .eq('message_id', message.id)
        .eq('character_id', characterId)
        .single();

      if (!readRecord) {
        unreadCount++;
      }
    }

    return unreadCount;
  }

  async getOwlPostInbox(characterId: number): Promise<any[]> {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', -1)
      .eq('message_type', 'owl_post')
      .like('content', `%"recipientCharacterId":${characterId}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("getOwlPostInbox error:", { characterId, error });
      return [];
    }

    const inbox = [];
    for (const message of messages || []) {
      try {
        const messageData = JSON.parse(message.content);

        // Získáme informace o odesílateli
        const { data: sender } = await supabase
          .from('characters')
          .select('first_name, middle_name, last_name')
          .eq('id', messageData.senderCharacterId)
          .single();

        // Zkontrolujeme, zda je zpráva přečtená
        const { data: readRecord } = await supabase
          .from('read_messages')
          .select('id')
          .eq('message_id', message.id)
          .eq('character_id', characterId)
          .single();

        inbox.push({
          id: message.id,
          senderCharacterId: messageData.senderCharacterId,
          recipientCharacterId: messageData.recipientCharacterId,
          subject: messageData.subject,
          content: messageData.messageContent,
          isRead: !!readRecord,
          sentAt: message.created_at,
          readAt: readRecord ? readRecord.created_at : null,
          sender: sender ? {
            firstName: sender.first_name,
            middleName: sender.middle_name,
            lastName: sender.last_name
          } : null
        });
      } catch (e) {
        console.error("Error parsing owl post message:", e);
      }
    }

    return inbox;
  }

  async getOwlPostSent(characterId: number): Promise<any[]> {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', -1)
      .eq('message_type', 'owl_post')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("getOwlPostSent error:", { characterId, error });
      return [];
    }

    const sent = [];
    for (const message of messages || []) {
      try {
        const messageData = JSON.parse(message.content);

        // Získáme informace o příjemci
        const { data: recipient } = await supabase
          .from('characters')
          .select('first_name, middle_name, last_name')
          .eq('id', messageData.recipientCharacterId)
          .single();

        sent.push({
          id: message.id,
          senderCharacterId: messageData.senderCharacterId,
          recipientCharacterId: messageData.recipientCharacterId,
          subject: messageData.subject,
          content: messageData.messageContent,
          sentAt: message.created_at,
          recipient: recipient ? {
            firstName: recipient.first_name,
            middleName: recipient.middle_name,
            lastName: recipient.last_name
          } : null
        });
      } catch (e) {
        console.error("Error parsing owl post message:", e);
      }
    }

    return sent;
  }

  async sendOwlPostMessage(senderCharacterId: number, recipientCharacterId: number, subject: string, content: string): Promise<any> {
    try {
      console.log("[STORAGE][sendOwlPostMessage] === FUNCTION START ===");
      console.log("[STORAGE][sendOwlPostMessage] Function called with params:", { 
        senderCharacterId, 
        recipientCharacterId, 
        subject: subject?.substring(0, 50), 
        contentLength: content?.length
      });

      // Validate that both characters exist and get their details
      console.log("[STORAGE][sendOwlPostMessage] === VALIDATING CHARACTER EXISTENCE ===");

      // Validace vstupních parametrů
      console.log("[STORAGE][sendOwlPostMessage] === VALIDATING PARAMETERS ===");
      if (!senderCharacterId || !recipientCharacterId || !subject || !content) {
        const missingFields = [];
        if (!senderCharacterId) missingFields.push('senderCharacterId');
        if (!recipientCharacterId) missingFields.push('recipientCharacterId');
        if (!subject) missingFields.push('subject');
        if (!content) missingFields.push('content');
        console.error("[STORAGE][sendOwlPostMessage] Missing fields:", missingFields);
        throw new Error(`Missing required parameters: ${missingFields.join(', ')}`);
      }

      // Validace typů
      if (typeof senderCharacterId !== 'number' || senderCharacterId <= 0) {
        console.error("[STORAGE][sendOwlPostMessage] Invalid senderCharacterId:", senderCharacterId);
        throw new Error(`Invalid senderCharacterId: ${senderCharacterId}`);
      }
      if (typeof recipientCharacterId !== 'number' || recipientCharacterId <= 0) {
        console.error("[STORAGE][sendOwlPostMessage] Invalid recipientCharacterId:", recipientCharacterId);
        throw new Error(`Invalid recipientCharacterId: ${recipientCharacterId}`);
      }

      console.log("[STORAGE][sendOwlPostMessage] Parameters valid, proceeding...");

      // Ověř, že obě postavy existují
      console.log("[STORAGE][sendOwlPostMessage] === CHECKING SENDER CHARACTER ===");
      const { data: senderExists, error: senderError } = await supabase
        .from('characters')
        .select('id, first_name, last_name, user_id')
        .eq('id', senderCharacterId)
        .single();

      console.log("[STORAGE][sendOwlPostMessage] Sender query result:", { data: senderExists, error: senderError });

      if (senderError) {
        console.error("[STORAGE][sendOwlPostMessage] Sender character query error:", { senderCharacterId, error: senderError });
        throw new Error(`Database error looking up sender character ${senderCharacterId}: ${senderError.message}`);
      }

      if (!senderExists) {
        console.error("[STORAGE][sendOwlPostMessage] Sender character not found:", { senderCharacterId });
        throw new Error(`Sender character ${senderCharacterId} not found`);
      }

      console.log("[STORAGE][sendOwlPostMessage] === CHECKING RECIPIENT CHARACTER ===");
      const { data: recipientExists, error: recipientError } = await supabase
        .from('characters')
        .select('id, first_name, last_name, user_id')
        .eq('id', recipientCharacterId)
        .single();

      console.log("[STORAGE][sendOwlPostMessage] Recipient query result:", { data: recipientExists, error: recipientError });

      if (recipientError) {
        console.error("[STORAGE][sendOwlPostMessage] Recipient character query error:", { recipientCharacterId, error: recipientError });
        throw new Error(`Database error looking up recipient character ${recipientCharacterId}: ${recipientError.message}`);
      }

      if (!recipientExists) {
        console.error("[STORAGE][sendOwlPostMessage] Recipient character not found:", { recipientCharacterId });
        throw new Error(`Recipient character ${recipientCharacterId} not found`);
      }

      console.log("[STORAGE][sendOwlPostMessage] Characters found:", { 
        sender: `${senderExists.first_name} ${senderExists.last_name}`, 
        recipient: `${recipientExists.first_name} ${recipientExists.last_name}` 
      });

      // Vytvoříme JSON obsah zprávy
      console.log("[STORAGE][sendOwlPostMessage] === PREPARING MESSAGE CONTENT ===");
      const messageContent = JSON.stringify({
        senderCharacterId,
        recipientCharacterId,
        subject,
        messageContent: content
      });

      console.log("[STORAGE][sendOwlPostMessage] Message content prepared:", {
        contentLength: messageContent.length,
        contentPreview: messageContent.substring(0, 100)
      });

      // Nejdříve zkontrolujme, jestli existuje room_id = -1
      console.log("[STORAGE][sendOwlPostMessage] === CHECKING FOR OWL POST ROOM ===");
      const { data: owlRoom, error: owlRoomError } = await supabase
        .from('chat_rooms')
        .select('id, name')
        .eq('id', -1)
        .single();

      console.log("[STORAGE][sendOwlPostMessage] Owl post room check:", { data: owlRoom, error: owlRoomError });

      // Pokud místnost neexistuje, vytvoříme ji
      if (owlRoomError && owlRoomError.code === 'PGRST116') {
        console.log("[STORAGE][sendOwlPostMessage] === CREATING OWL POST ROOM ===");
        const { data: newRoom, error: createRoomError } = await supabase
          .from('chat_rooms')
          .insert([{
            id: -1,
            name: 'Owl Post System',
            description: 'Virtual room for owl post messages',
            is_public: false,
            password: null,
            category_id: null,
            sort_order: -1,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        console.log("[STORAGE][sendOwlPostMessage] Room creation result:", { data: newRoom, error: createRoomError });

        if (createRoomError) {
          console.error("[STORAGE][sendOwlPostMessage] Failed to create owl post room:", createRoomError);
          throw new Error(`Failed to create owl post room: ${createRoomError.message}`);
        }
        console.log("[STORAGE][sendOwlPostMessage] Owl post room created successfully");
      } else if (owlRoomError) {
        console.error("[STORAGE][sendOwlPostMessage] Error checking owl post room:", owlRoomError);
        throw new Error(`Error checking owl post room: ${owlRoomError.message}`);
      } else {
        console.log("[STORAGE][sendOwlPostMessage] Owl post room already exists");
      }

      console.log("[STORAGE][sendOwlPostMessage] === INSERTING MESSAGE ===");
      const insertData = {
        room_id: -1,
        character_id: senderCharacterId,
        content: messageContent,
        message_type: 'owl_post',
        created_at: new Date().toISOString()
      };

      console.log("[STORAGE][sendOwlPostMessage] Insert data:", insertData);

      const { data, error } = await supabase
        .from('messages')
        .insert([insertData])
        .select()
        .single();

      console.log("[STORAGE][sendOwlPostMessage] Insert result:", { data, error });

      if (error) {
        console.error("[STORAGE][sendOwlPostMessage] Database insert error:", {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Database error: ${error.message}`);
      }

      if (!data) {
        console.error("[STORAGE][sendOwlPostMessage] No data returned from insert");
        throw new Error("No data returned from insert");
      }

      const result = {
        id: data.id,
        senderCharacterId,
        recipientCharacterId,
        subject,
        content,
        sentAt: data.created_at
      };

      console.log("[STORAGE][sendOwlPostMessage] Message sent successfully:", result);
      console.log("[STORAGE][sendOwlPostMessage] === FUNCTION END SUCCESS ===");
      return result;
    } catch (error: any) {
      console.error("[STORAGE][sendOwlPostMessage] === FUNCTION END ERROR ===");
      console.error("[STORAGE][sendOwlPostMessage] Error details:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        details: error.details
      });
      throw error;
    }
  }

  async markOwlPostMessageRead(messageId: number, characterId: number): Promise<boolean> {
    // Vytvoříme záznam v read_messages tabulce
    const { error } = await supabase
      .from('read_messages')
      .upsert([{
        message_id: messageId,
        character_id: characterId,
        created_at: new Date().toISOString()
      }], { onConflict: 'message_id,character_id' });

    if (error) {
      console.error("markOwlPostMessageRead error:", { messageId, characterId, error });
      return false;
    }

    console.log("Owl post message marked as read", { messageId, characterId });
    return true;
  }

  async getOwlPostMessage(messageId: number): Promise<any> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .eq('room_id', -1)
      .eq('message_type', 'owl_post')
      .single();

    if (error) return undefined;

    try {
      const messageData = JSON.parse(data.content);
      return {
        id: data.id,
        senderCharacterId: messageData.senderCharacterId,
        recipientCharacterId: messageData.recipientCharacterId,
        subject: messageData.subject,
        content: messageData.messageContent,
        sentAt: data.created_at
      };
    } catch (e) {
      return undefined;
    }
  }

  async deleteOwlPostMessage(messageId: number): Promise<boolean> {
    try {
      // Nejdříve smažeme odkazy v read_messages
      const { error: readError } = await supabase
        .from('read_messages')
        .delete()
        .eq('message_id', messageId);

      if (readError) {
        console.error("Error deleting read_messages:", readError);
      }

      // Pak smažeme samotnou zprávu
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('room_id', -1)
        .eq('message_type', 'owl_post');

      return !error;
    } catch (error) {
      console.error("Error in deleteOwlPostMessage:", error);
      return false;
    }
  }

  async addItemToInventory(
    characterId: number,
    itemType: string,
    itemId: number,
    price?: number
  ) {
    const item: InsertInventoryItem = {
      character_id: characterId,
      item_type: itemType,
      item_id: itemId,
      price: price || 0,
    };
    const { error } = await supabase.from('character_inventory').insert([item]);
    if (error) {
      console.error('Error adding item to inventory:', error);
      throw new Error('Failed to add item to inventory');
    }
  }

  async updateUser(id: number, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
  }

  async getInviteCode(code: string): Promise<any> {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, code, is_used, created_at, updated_at, created_by_user_id")
      .eq("code", code)
      .single();
    if (error) {
      console.error("Error fetching invite code:", error);
      return null;
    }
    return data;
  }

  async useInviteCode(code: string, userId: number): Promise<boolean> {
    const { data: invite, error } = await supabase
      .from('invite_codes')
      .select('id, is_used')
      .eq('code', code)
      .single();
    if (error || !invite) {
      console.error('useInviteCode: Invite code not found', { code, error });
      return false;
    }
    if (invite.is_used) {
      console.warn('useInviteCode: Invite code already used', { code });
      return false;
    }
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({
        is_used: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', invite.id);
    if (updateError) {
      console.error('useInviteCode: Failed to mark as used', { code, updateError });
      return false;
    }
    return true;
  }

  async getAllInviteCodes(): Promise<any[]> {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('id, code, is_used, created_at, updated_at, created_by_user_id')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('getAllInviteCodes: Error fetching invite codes', error);
      return [];
    }
    return toCamel(data || []);
  }

  async createInviteCode(codeObj: { code: string, createdByUserId: number }): Promise<any> {
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        code: codeObj.code,
        is_used: false,
        created_by_user_id: codeObj.createdByUserId
      })
      .select('id, code, is_used, created_at, updated_at, created_by_user_id')
      .single();
    if (error) {
      console.error('createInviteCode: Error creating invite code', error);
      throw error;
    }
    return data;
  }

  async getCharactersInChatRooms(): Promise<any[]> {
    // Získáme aktuální přítomnost v místnostech
    const { data, error } = await supabase
      .from('room_presence')
      .select(`character_id, room_id, characters:character_id (id, first_name, middle_name, last_name, avatar, is_system, death_date), rooms:room_id (id, name)`)
      .eq('is_online', true);
    if (error) {
      console.error('getCharactersInChatRooms: Error fetching presence', error);
      return [];
    }
    // Transformace na požadovaný formát
    return (data || []).map((row: any) => {
      const char = row.characters;
      const room = row.rooms;
      return {
        id: char.id,
        firstName: char.first_name,
        middleName: char.middle_name,
        lastName: char.last_name,
        avatar: char.avatar,
        isSystem: char.is_system,
        deathDate: char.death_date,
        roomId: room.id,
        roomName: room.name
      };
    });
  }

  async createCharacter(character: any): Promise<any> {
    throw new Error('Not implemented: createCharacter');
  }

  // Alias pro updateUserNarratorPermission kvůli konzistenci s routes.ts
  async updateUserNarrator(id: number, canNarrate: boolean, reason?: string): Promise<User | undefined> {
    // Optionally log the reason somewhere
    return this.updateUserNarratorPermission(id, canNarrate);
  }
}

export const storage = new DatabaseStorage();

// Utilita pro převod snake_case na camelCase
function toCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toCamel);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = toCamel(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}

function toSnake(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(toSnake);
  } else if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((result, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnake(obj[key]);
      return result;
    }, {} as any);
  }
  return obj;
}