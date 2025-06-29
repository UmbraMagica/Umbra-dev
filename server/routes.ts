import type { Express } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { registrationSchema, loginSchema, insertHousingRequestSchema } from "../shared/schema";
import { z } from "zod";
import multer from "multer";
import sharp from "sharp";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { supabase } from "./supabaseClient";
import chatMessagesRoutes from './routes/chatMessages';



// JWT payload do req.user
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      username: string;
      role: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'umbra-magica-jwt-secret-key-fixed-2024';

function generateJwt(user: any) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyJwt(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

// Paměťová mapa pro sledování online uživatelů
const userActivityMap = new Map();

function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = auth.slice(7);
  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid token" });
  }
  req.user = payload;
  // Sledování aktivity uživatele
  userActivityMap.set(req.user.id, {
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    lastActiveAt: Date.now()
  });
  console.log("Decoded JWT user:", req.user);
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  requireAuth(req, res, () => {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

// Helper function to validate and filter characters
function validateAndFilterCharacters(characters: any[]): any[] {
  if (!Array.isArray(characters)) {
    console.warn('Characters is not an array:', typeof characters);
    return [];
  }

  return characters.filter((char, index) => {
    try {
      if (!char || typeof char !== 'object') {
        console.warn(`[validateAndFilterCharacters] Invalid character object ${index}:`, char);
        return false;
      }

      // Extra null/undefined checks for critical string fields
      if (char.firstName === null || char.firstName === undefined) {
        console.warn(`[validateAndFilterCharacters] Character ${index} has null/undefined firstName`);
        return false;
      }

      if (char.lastName === null || char.lastName === undefined) {
        console.warn(`[validateAndFilterCharacters] Character ${index} has null/undefined lastName`);
        return false;
      }

      const hasValidId = typeof char.id === 'number' && char.id > 0;
      const hasValidFirstName = typeof char.firstName === 'string' && char.firstName.trim() !== '';
      const hasValidLastName = typeof char.lastName === 'string' && char.lastName.trim() !== '';
      const hasValidUserId = typeof char.userId === 'number' && char.userId > 0;
      const isNotSystem = !char.isSystem;
      const isAlive = !char.deathDate;

      const isValid = hasValidId && hasValidFirstName && hasValidLastName && hasValidUserId && isNotSystem && isAlive;

      if (!isValid) {
        console.warn(`[validateAndFilterCharacters] Invalid character ${index} filtered out:`, {
          id: char.id,
          firstName: char.firstName,
          lastName: char.lastName,
          userId: char.userId,
          isSystem: char.isSystem,
          deathDate: char.deathDate,
          firstNameType: typeof char.firstName,
          lastNameType: typeof char.lastName,
          issues: {
            invalidId: !hasValidId,
            invalidFirstName: !hasValidFirstName,
            invalidLastName: !hasValidLastName,
            invalidUserId: !hasValidUserId,
            isSystem: !isNotSystem,
            isDead: !isAlive
          }
        });
      }

      return isValid;
    } catch (error) {
      console.error(`[validateAndFilterCharacters] Error validating character ${index}:`, error, char);
      return false;
    }
  });
}

export async function registerRoutes(app: Express): Promise<void> {
  // HTTP a WebSocket server
  const httpServer = createServer(app);

  // Start HTTP server first
  const serverPort = parseInt(process.env.PORT || "5000", 10) || 5000;
  httpServer.listen(serverPort, "0.0.0.0", () => {
    console.log(`Server running on port ${serverPort}`);
  });

  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    verifyClient: (info) => {
      try {
        const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token');

        if (!token) {
          console.log('WebSocket: No token provided');
          return false;
        }

        const payload = verifyJwt(token);
        if (!payload) {
          console.log('WebSocket: Invalid token');
          return false;
        }

        // Store user info for later use
        (info.req as any).user = payload;
        console.log('WebSocket: Authentication successful for user', payload.username);
        return true;
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        return false;
      }
    }
  });

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    const user = (req as any).user;
    console.log(`WebSocket connected: ${user.username}`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message received:', message);

        if (message.type === 'authenticate') {
          ws.send(JSON.stringify({ type: 'authenticated', success: true }));
        } else if (message.type === 'join_room') {
          ws.send(JSON.stringify({ type: 'room_joined', roomId: message.roomId }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket disconnected: ${user.username}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Multer config pro uploady
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    },
  });

  // LOGIN
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.validateUser(username, password);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const token = generateJwt(user);
      const characters = await storage.getCharactersByUserId(user.id);
      const validCharacters = validateAndFilterCharacters(characters);
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          characters: validCharacters,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        if (!res.headersSent) return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      if (!res.headersSent) res.status(500).json({ message: "Login failed" });
    }
  });

  // LOGOUT
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  // Registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      console.log('[DEBUG] Registration request body:', req.body);

      const result = registrationSchema.safeParse(req.body);
      if (!result.success) {
        console.log('[DEBUG] Validation errors:', result.error.issues);
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: result.error.issues 
        });
      }

      const { username, email, password, inviteCode, firstName, middleName, lastName, birthDate } = result.data;

      // Check if invite code exists and is unused via storage
      console.log('[DEBUG] Checking invite code:', inviteCode);
      const inviteCodeData = await storage.getInviteCode(inviteCode);
      if (!inviteCodeData || inviteCodeData.isUsed) {
        console.log('[DEBUG] Invalid invite code:', { inviteCodeData });
        return res.status(400).json({ message: "Invalid or already used invite code" });
      }

      // Check if user already exists via storage
      console.log('[DEBUG] Checking existing user:', email);
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log('[DEBUG] User already exists:', existingUser.id);
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user via storage system
      console.log('[DEBUG] Creating user:', { username, email, role: 'user' });
      const newUser = await storage.createUser({
        username,
        email,
        password,
        role: 'user'
      });

      if (!newUser) {
        throw new Error('Failed to create user');
      }
      console.log('[DEBUG] User created successfully:', newUser.id);

      // Mark invite code as used
      console.log('[DEBUG] Marking invite code as used:', inviteCodeData.code);
      const inviteUsed = await storage.useInviteCode(inviteCodeData.code, newUser.id);
      if (!inviteUsed) {
        throw new Error('Failed to mark invite code as used');
      }

      // Create character via storage system
      console.log('[DEBUG] Creating character for user:', newUser.id);
      const newCharacter = await storage.createCharacter({
        userId: newUser.id,
        firstName,
        middleName: middleName || null,
        lastName,
        birthDate: new Date(birthDate).toISOString(),
        isActive: true,
        isSystem: false,
        showHistoryToOthers: true
      });
      console.log('[DEBUG] Character created successfully:', newCharacter.id);

      // Generate token with same structure as login
      const token = generateJwt(newUser);

      // Get characters for response (consistent with login)
      const characters = await storage.getCharactersByUserId(newUser.id);
      const validCharacters = validateAndFilterCharacters(characters);

      console.log('[DEBUG] Registration completed successfully');
      res.json({
        token,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          characters: validCharacters,
        }
      });

    } catch (error) {
      console.error('[DEBUG] Registration error:', error);
      console.error('[DEBUG] Error stack:', error.stack);
      res.status(500).json({ 
        message: "Registration failed", 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // GET USER
  app.get("/api/auth/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const characters = await storage.getCharactersByUserId(user.id);
      const validCharacters = validateAndFilterCharacters(characters);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        canNarrate: user.canNarrate,
        characterOrder: user.characterOrder ? JSON.parse(user.characterOrder) : null,
        highlightWords: user.highlightWords,
        highlightColor: user.highlightColor,
        narratorColor: user.narratorColor,
        characters: validCharacters,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Endpoint pro seznam všech postav (HLAVNÍ ENDPOINT)
  app.get("/api/characters", requireAuth, async (req, res) => {
    try {
      // ALWAYS return only user's own characters, regardless of admin status
      // Admins can use /api/characters/all for all characters
      const characters = await storage.getCharactersByUserId(req.user!.id);

      if (!characters || !Array.isArray(characters)) {
        console.warn(`[CHARACTERS] No characters or invalid format for user ${req.user!.id}`);
        return res.json({ characters: [] });
      }

      const validCharacters = validateAndFilterCharacters(characters);

      // Extra validation: ensure all characters belong to the requesting user
      const userOwnedCharacters = validCharacters.filter(char => {
        const belongsToUser = char.userId === req.user!.id;
        if (!belongsToUser) {
          console.warn(`[CHARACTERS] Character ${char.id} does not belong to user ${req.user!.id}`);
        }
        return belongsToUser;
      });

      // Always return in { characters: [] } format for consistency
      res.json({ characters: userOwnedCharacters });
    } catch (error) {
      console.error("Chyba při načítání postav:", error);
      res.status(500).json({ message: "Chyba serveru", error: error?.message });
    }
  });

  // Soví pošta: počet nepřečtených zpráv pro postavu
  app.get("/api/owl-post/unread-count/:characterId", requireAuth, async (req, res) => {
    try {
      const characterId = Number(req.params.characterId);
      if (!characterId || isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid characterId" });
      }

      // Ověř, že postava patří uživateli (nebo je admin)
      if (req.user!.role !== 'admin') {
        const characters = await storage.getCharactersByUserId(req.user!.id);
        if (!characters.some((char: any) => char.id === characterId)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const count = await storage.getUnreadOwlPostCount(characterId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Soví pošta: inbox pro postavu
  app.get("/api/owl-post/inbox/:characterId", requireAuth, async (req, res) => {
    try {
      const characterId = Number(req.params.characterId);
      if (!characterId || isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid characterId" });
      }

      if (req.user!.role !== 'admin') {
        const characters = await storage.getCharactersByUserId(req.user!.id);
        if (!characters.some((char: any) => char.id === characterId)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const inbox = await storage.getOwlPostInbox(characterId);
      res.json(Array.isArray(inbox) ? inbox : []);
    } catch (error) {
      console.error("Error getting inbox:", error);
      res.status(500).json({ message: "Failed to get inbox" });
    }
  });

  // Soví pošta: sent zprávy pro postavu  
  app.get("/api/owl-post/sent/:characterId", requireAuth, async (req, res) => {
    try {
      const characterId = Number(req.params.characterId);
      if (!characterId || isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid characterId" });
      }

      if (req.user!.role !== 'admin') {
        const characters = await storage.getCharactersByUserId(req.user!.id);
        if (!characters.some((char: any) => char.id === characterId)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const sent = await storage.getOwlPostSent(characterId);
      res.json(Array.isArray(sent) ? sent : []);
    } catch (error) {
      console.error("Error getting sent messages:", error);
      res.status(500).json({ message: "Failed to get sent messages" });
    }
  });

  // Soví pošta: odeslání nové zprávy
  app.post("/api/owl-post", requireAuth, async (req, res) => {
    try {
      console.log("[OWL-POST] === REQUEST START ===");
      console.log("[OWL-POST] Request received from user:", req.user!.username);
      console.log("[OWL-POST] User details:", {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      });
      console.log("[OWL-POST] Request body:", req.body);
      console.log("[OWL-POST] Request headers:", {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Bearer [HIDDEN]' : 'None'
      });

      const { senderCharacterId, recipientCharacterId, subject, content } = req.body;

      console.log("[OWL-POST] === VALIDATING REQUEST FIELDS ===");
      console.log("[OWL-POST] Extracted fields:", {
        senderCharacterId,
        recipientCharacterId,
        subject,
        contentLength: content?.length
      });

      // Validace povinných polí
      if (!senderCharacterId || !recipientCharacterId || !subject || !content) {
        const missingFields = [];
        if (!senderCharacterId) missingFields.push('senderCharacterId');
        if (!recipientCharacterId) missingFields.push('recipientCharacterId');
        if (!subject) missingFields.push('subject');
        if (!content) missingFields.push('content');

        console.error("[OWL-POST] Missing required fields:", missingFields);
        return res.status(400).json({ 
          message: "Missing required fields: senderCharacterId, recipientCharacterId, subject, content",
          missingFields
        });
      }

      // Konverze na čísla pokud jsou stringy
      console.log("[OWL-POST] === CONVERTING TO NUMBERS ===");
      const senderCharacterIdNum = typeof senderCharacterId === 'string' ? parseInt(senderCharacterId, 10) : senderCharacterId;
      const recipientCharacterIdNum = typeof recipientCharacterId === 'string' ? parseInt(recipientCharacterId, 10) : recipientCharacterId;

      console.log("[OWL-POST] Converted values:", {
        senderCharacterIdNum,
        recipientCharacterIdNum,
        senderType: typeof senderCharacterIdNum,
        recipientType: typeof recipientCharacterIdNum
      });

      // Validace číselných hodnot
      if (isNaN(senderCharacterIdNum) || senderCharacterIdNum <= 0) {
        console.error("[OWL-POST] Invalid senderCharacterId:", { original: senderCharacterId, converted: senderCharacterIdNum });
        return res.status(400).json({ message: "Invalid senderCharacterId" });
      }

      if (isNaN(recipientCharacterIdNum) || recipientCharacterIdNum <= 0) {
        console.error("[OWL-POST] Invalid recipientCharacterId:", { original: recipientCharacterId, converted: recipientCharacterIdNum });
        return res.status(400).json({ message: "Invalid recipientCharacterId" });
      }

      console.log("[OWL-POST] === CHECKING USER PERMISSIONS ===");
      // Ověř, že odesílatelská postava patří uživateli (nebo je admin)
      if (req.user!.role !== 'admin') {
        console.log("[OWL-POST] User is not admin, checking character ownership...");
        const characters = await storage.getCharactersByUserId(req.user!.id);
        console.log("[OWL-POST] User characters:", characters?.map((c: any) => ({ id: c.id, name: `${c.firstName} ${c.lastName}` })));

        if (!characters || !Array.isArray(characters) || !characters.some((char: any) => char.id === senderCharacterIdNum)) {
          console.error("[OWL-POST] Character does not belong to user:", {
            userId: req.user!.id,
            senderCharacterIdNum,
            userCharacterIds: characters?.map((c: any) => c.id)
          });
          return res.status(403).json({ message: "Character does not belong to user" });
        }
        console.log("[OWL-POST] Character ownership verified");
      } else {
        console.log("[OWL-POST] User is admin, skipping character ownership check");
      }

      console.log("[OWL-POST] === CALLING STORAGE FUNCTION ===");
      console.log("[OWL-POST] Sending message from character", senderCharacterIdNum, "to", recipientCharacterIdNum);

      const msg = await storage.sendOwlPostMessage(senderCharacterIdNum, recipientCharacterIdNum, subject, content);

      console.log("[OWL-POST] === MESSAGE SENT SUCCESSFULLY ===");
      console.log("[OWL-POST] Message sent successfully:", {
        id: msg.id,
        senderCharacterId: msg.senderCharacterId,
        recipientCharacterId: msg.recipientCharacterId,
        subject: msg.subject
      });

      console.log("[OWL-POST] === REQUEST END SUCCESS ===");
      res.status(201).json(msg);
    } catch (error: any) {
      console.error("[OWL-POST] === REQUEST END ERROR ===");
      console.error("[OWL-POST] Error message:", error.message);
      console.error("[OWL-POST] Error code:", error.code);
      console.error("[OWL-POST] Error details:", error.details);
      console.error("[OWL-POST] Full error object:", {
        name: error.name,
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        stack: error.stack
      });

      res.status(500).json({ 
        message: error.message || "Failed to send message",
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error.code,
        details: error.details
      });
    }
  });

  // Soví pošta: označení zprávy jako přečtené
  app.post("/api/owl-post/:messageId/read", requireAuth, async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);
      const { characterId } = req.body;
      if (!messageId || isNaN(messageId) || !characterId) {
        return res.status(400).json({ message: "Invalid messageId or characterId" });
      }

      // Ověř, že postava patří uživateli (nebo je admin)
      if (req.user!.role !== 'admin') {
        const characters = await storage.getCharactersByUserId(req.user!.id);
        if (!characters.some((char: any) => char.id === characterId)) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const ok = await storage.markOwlPostMessageRead(messageId, characterId);
      if (ok) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Message not found or not allowed" });
      }
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Seznam všech postav (pro adminy všechny, pro uživatele jen jejich)
  app.get("/api/characters/all", requireAuth, async (req, res) => {
    try {
      let characters;
      if (req.user!.role === 'admin') {
        characters = await storage.getAllCharacters();
      } else {
        characters = await storage.getCharactersByUserId(req.user!.id);
      }

      const validCharacters = validateAndFilterCharacters(characters);
      res.json(validCharacters);
    } catch (error) {
      console.error("Error fetching characters:", error);
      res.status(500).json({ message: "Failed to fetch characters" });
    }
  });

  // Seznam online postav - jen ty, které jsou skutečně v chatech
  app.get("/api/characters/online", requireAuth, async (_req, res) => {
    try {
      console.log("[ONLINE] Fetching characters currently in chat rooms...");

      // Získáme postavy, které mají aktivní přítomnost v chatových místnostech
      const onlineCharacters = await storage.getCharactersInChatRooms();

      if (!onlineCharacters || !Array.isArray(onlineCharacters)) {
        console.warn("[ONLINE] No online characters or invalid format");
        return res.json([]);
      }

      console.log(`[ONLINE] Found ${onlineCharacters.length} characters in chat rooms`);

      const validOnlineCharacters = onlineCharacters
        .filter((char: any) => {
          if (!char || typeof char !== 'object') {
            console.warn("[ONLINE] Invalid character object:", char);
            return false;
          }

          const hasValidId = typeof char.id === 'number' && char.id > 0;
          const hasValidFirstName = typeof char.firstName === 'string' && char.firstName?.trim() !== '';
          const hasValidLastName = typeof char.lastName === 'string' && char.lastName?.trim() !== '';
          const isAlive = !char.deathDate;
          const isNotSystem = !char.isSystem;
          const hasValidRoomId = typeof char.roomId === 'number' && char.roomId > 0;
          const hasValidUserId = typeof char.userId === 'number' && char.userId > 0;

          return hasValidId && hasValidFirstName && hasValidLastName && isAlive && isNotSystem && hasValidRoomId && hasValidUserId;
        })
        .map((char: any) => {
          const fullName = `${char.firstName}${char.middleName ? ` ${char.middleName}` : ''} ${char.lastName}`;

          return {
            id: char.id,
            fullName: fullName,
            firstName: char.firstName,
            middleName: char.middleName || null,
            lastName: char.lastName,
            location: char.roomName || "Neznámá místnost",
            roomId: char.roomId,
            avatar: char.avatar || null,
            userId: char.userId,
            isOnline: true
          };
        });

      console.log(`[ONLINE] Returning ${validOnlineCharacters.length} characters currently in chat rooms`);

      res.json(validOnlineCharacters);
    } catch (error) {
      console.error("[ONLINE] Error fetching online characters:", error);
      res.status(500).json({ message: "Failed to fetch online characters", characters: [] });
    }
  });

  // Hůlka postavy
  app.get("/api/characters/:id/wand", requireAuth, async (req, res) => {
    try {
      const characterId = Number(req.params.id);
      if (!characterId || isNaN(characterId)) {
        return res.status(400).json({ message: "Invalid characterId" });
      }

      // Check character ownership
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== req.user!.id) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      const wand = await storage.getCharacterWand(characterId);
      if (!wand) {
        return res.status(404).json({ message: "Character has no wand" });
      }

      res.json(wand);
    } catch (error) {
      console.error("Error fetching character wand:", error);
      res.status(500).json({ message: "Failed to fetch wand" });
    }
  });

  // Poslední chat postavy (název a id místnosti, kde naposledy poslala zprávu)
  app.get("/api/characters/:id/last-chat", requireAuth, async (req, res) => {
    try {
      const characterId = Number(req.params.id);
      if (!characterId || isNaN(characterId)) return res.json(null);
      const lastMessage = await storage.getLastMessageByCharacter(characterId);
      if (!lastMessage || !lastMessage.roomId) return res.json(null);
      const room = await storage.getChatRoom(lastMessage.roomId);
      if (!room) return res.json(null);
      res.json({ room: { id: room.id, name: room.name } });
    } catch (e) {
      res.json(null);
    }
  });

  // Chat messages endpoint
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    try {
      // Check if character belongs to user or is admin
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== req.user!.id) {
          return res.status(403).json({ message: "Character not found or access denied" });
        }
      }

      const spells = await storage.getCharacterSpells(characterId);
      console.log(`Found ${spells.length} spells for character ${characterId}`);
      res.json(spells || []);
    } catch (error) {
      console.error("Error fetching character spells:", error);
      res.status(500).json({ message: "Failed to fetch spells" });
    }
  });

  // Initialize default spells for all characters if they don't have any
  app.post("/api/admin/initialize-default-spells", requireAdmin, async (req, res) => {
    try {
      await storage.initializeDefaultSpells();
      res.json({ message: "Default spells initialized successfully" });
    } catch (error) {
      console.error("Error initializing default spells:", error);
      res.status(500).json({ message: "Failed to initialize default spells" });
    }
  });

  // Cast spell endpoint
  app.post("/api/game/cast-spell", requireAuth, async (req, res) => {
    const { roomId, characterId, spellId, message } = req.body;

    if (!roomId || !characterId || !spellId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      const character = await storage.getCharacterById(characterId);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Check if character has a wand
      const wand = await storage.getCharacterWand(characterId);
      if (!wand) {
        return res.status(400).json({ message: "Vaše postava potřebuje hůlku pro sesílání kouzel." });
      }

      // Check if character knows the spell
      const characterSpells = await storage.getCharacterSpells(characterId);
      const knownSpell = characterSpells.find((cs: any) => cs.spell.id === spellId);
      if (!knownSpell) {
        return res.status(400).json({ message: "Character doesn't know this spell" });
      }

      const spell = knownSpell.spell;
      const spellContent = message 
        ? `✨ ${character.firstName} ${character.lastName} seslal kouzlo "${spell.name}": ${message}`
        : `✨ ${character.firstName} ${character.lastName} seslal kouzlo "${spell.name}"`;

      const chatMessage = await storage.createChatMessage({
        roomId: Number(roomId),
        characterId: Number(characterId),
        userId: req.user!.id,
        content: spellContent,
        messageType: 'spell'
      });

      res.json({ spell, message: chatMessage });
    } catch (error) {
      console.error("Error casting spell:", error);
      res.status(500).json({ message: "Failed to cast spell" });
    }
  });

  // User settings endpoints
  app.post("/api/user/character-order", requireAuth, async (req, res) => {
    const { characterOrder } = req.body;
    const userId = req.user!.id;

    if (!Array.isArray(characterOrder)) {
      return res.status(400).json({ message: "Character order must be an array" });
    }

    try {
      await storage.updateUserSettings(userId, { characterOrder });
      res.json({ message: "Character order updated successfully" });
    } catch (error) {
      console.error("Error updating character order:", error);
      res.status(500).json({ message: "Failed to update character order" });
    }
  });

  app.post("/api/user/highlight-settings", requireAuth, async (req, res) => {
    const { highlightWords, highlightColor } = req.body;
    const userId = req.user!.id;

    try {
      await storage.updateUserSettings(userId, { 
        highlightWords: highlightWords || null,
        highlightColor: highlightColor || 'yellow'
      });
      res.json({ message: "Highlight settings updated successfully" });
    } catch (error) {
      console.error("Error updating highlight settings:", error);
      res.status(500).json({ message: "Failed to update highlight settings" });
    }
  });

  app.post("/api/user/narrator-color", requireAuth, async (req, res) => {
    const { narratorColor } = req.body;
    const userId = req.user!.id;

    if (!narratorColor) {
      return res.status(400).json({ message: "Narrator color is required" });
    }

    try {
      await storage.updateUserSettings(userId, { narratorColor });
      res.json({ message: "Narrator color updated successfully" });
    } catch (error) {
      console.error("Error updating narrator color:", error);
      res.status(500).json({ message: "Failed to update narrator color" });
    }
  });

  // Narrator message endpoint
  app.post("/api/chat/narrator-message", requireAuth, async (req, res) => {
    const { roomId, content } = req.body;

    console.log(`[NARRATOR][POST] Message request:`, { roomId, content: content?.substring(0, 50), userId: req.user!.id });

    if (!roomId || !content?.trim()) {
      return res.status(400).json({ message: "Missing required fields: roomId and content" });
    }

    // Get user data to check narrator permissions
    const user = await storage.getUser(req.user!.id);
    if (!user || (user.role !== 'admin' && !user.canNarrate)) {
      return res.status(403).json({ message: "Nemáte oprávnění k vypravování" });
    }

    try {
      console.log(`[NARRATOR][POST] Creating narrator message for room ${roomId}`);

      // Create narrator message with messageType 'narrator'
      const message = await storage.createChatMessage({
        roomId: Number(roomId),
        characterId: 0,
        userId: req.user!.id,
        content: content.trim(),
        messageType: 'narrator'
      });

      console.log(`[NARRATOR][POST] Message created successfully:`, { messageId: message.id });
      res.status(201).json(message);
    } catch (error) {
      console.error("Error sending narrator message:", error);
      res.status(500).json({ message: "Failed to send narrator message", error: error?.message || 'Unknown error' });
    }
  });

  // Archive messages
  app.post("/api/chat/rooms/:roomId/archive", requireAdmin, async (req, res) => {
    const roomId = Number(req.params.roomId);
    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid roomId" });
    }

    try {
      const result = await storage.archiveChatMessages(roomId);
      res.json({ message: `Archivováno ${result.count} zpráv` });
    } catch (error) {
      console.error("Error archiving messages:", error);
      res.status(500).json({ message: "Failed to archive messages" });
    }
  });

  // Clear messages (admin only)
  app.delete("/api/admin/rooms/:roomId/clear", requireAdmin, async (req, res) => {
    const roomId = Number(req.params.roomId);
    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid roomId" });
    }

    try {
      const result = await storage.clearChatMessages(roomId);
      res.json({ message: `Smazáno ${result.count} zpráv` });
    } catch (error) {
      console.error("Error clearing messages:", error);
      res.status(500).json({ message: "Failed to clear messages" });
    }
  });

  // Room presence
  app.get("/api/chat/rooms/:roomId/presence", requireAuth, async (req, res) => {
    const roomId = Number(req.params.roomId);
    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid roomId" });
    }

    try {
      const presence = await storage.getRoomPresence(roomId);
      res.json(presence || []);
    } catch (error) {
      console.error("Error fetching room presence:", error);
      res.status(500).json({ message: "Failed to fetch presence" });
    }
  });

  // Character routes
  app.get("/api/characters/:id", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Neplatné characterId" });
    }

    const character = await storage.getCharacterById(characterId);
    if (!character) {
      return res.status(404).json({ message: "Postava nenalezena" });
    }

    // Admin může přistupovat ke všem postavám
    if (req.user!.role !== 'admin') {
      // Uživatel může přistupovat pouze ke svým postavám
      if (character.userId !== req.user!.id) {
        return res.status(403).json({ message: "Zakázáno" });
      }
    }

    // Přidej user data
    const user = await storage.getUser(character.userId);
    const characterWithUser = {
      ...character,
      user: user ? { 
        username: user.username, 
        email: user.email,
        lastLoginAt: user.lastLoginAt 
      } : null
    };

    res.json(characterWithUser);
  });

  // Editace postavy
  app.put("/api/characters/:id", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Neplatné characterId" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) {
      return res.status(404).json({ message: "Postava nenalezena" });
    }

    // Ověř přístup k postavě
    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Zakázáno" });
    }

    try {
      const updatedCharacter = await storage.updateCharacter(characterId, req.body);
      if (!updatedCharacter) {
        return res.status(500).json({ message: "Nepodařilo se aktualizovat postavu" });
      }
      res.json(updatedCharacter);
    } catch (error) {
      console.error("Error updating character:", error);
      res.status(500).json({ message: "Chyba při aktualizaci postavy" });
    }
  });

  // Aktualizace historie postavy
  app.put("/api/characters/:id/history", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    const { history, showHistoryToOthers } = req.body;

    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    // Ověř přístup k postavě
    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedCharacter = await storage.updateCharacter(characterId, {
      characterHistory: history,
      showHistoryToOthers: showHistoryToOthers
    });

    if (!updatedCharacter) {
      return res.status(500).json({ message: "Failed to update character" });
    }

    res.json(updatedCharacter);
  });

  // Komponenty pro tvorbu hůlek
  app.get("/api/wand-components", requireAuth, async (_req, res) => {
    try {
      const components = await storage.getAllWandComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching wand components:", error);
      res.status(500).json({ message: "Failed to fetch wand components" });
    }
  });

  // Chat kategorie (vrací data z databáze)
  app.get("/api/chat/categories", requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role || 'user';
      console.log(`[CHAT][CATEGORIES] User ${req.user?.username} (${userRole}) requesting categories`);
      const categories = await storage.getChatCategoriesWithChildren(userRole);
      console.log(`[CHAT][CATEGORIES] Returning ${categories.length} categories`);
      res.json(Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.error('[CHAT][CATEGORIES] Error:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Chat místnosti (vrací data z databáze)
  app.get("/api/chat/rooms", requireAuth, async (req, res) => {
    try {
      const userRole = req.user?.role || 'user';
      console.log(`[CHAT][ROOMS] User ${req.user?.username} (${userRole}) requesting rooms`);
      const rooms = await storage.getAllChatRooms(userRole);
      console.log(`[CHAT][ROOMS] Returning ${rooms.length} rooms`);
      res.json(Array.isArray(rooms) ? rooms : []);
    } catch (error) {
      console.error('[CHAT][ROOMS] Error:', error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  // Character inventory routes
  app.get("/api/characters/:id/inventory", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    console.log('[INVENTORY][REQ]', {
      user: req.user,
      characterId,
      params: req.params,
      url: req.originalUrl,
    });
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    // Check access
    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const { data, error } = await supabase
        .from("character_inventory")
        .select("*")
        .eq("character_id", characterId)
        .order("acquired_at", { ascending: false });

      console.log('[INVENTORY][DB]', { data, error });

      if (error) {
        console.error("[INVENTORY][ERROR] Inventory fetch error:", error);
        return res.status(500).json({ message: "DB error", error: error.message });
      }

      console.log(`[INVENTORY][RESULT] Inventory for character ${characterId}:`, data);
      res.json(data || []);
    } catch (error) {
      console.error("[INVENTORY][ERROR] Inventory fetch error (catch):", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/characters/:id/inventory", requireAuth, async (req, res) => {
    try {
      const character_id = parseInt(req.params.id, 10);
      const {
        item_type,
        item_id,
        price,
        item_name,
        quantity,
        rarity,
        description,
        notes,
        category,
      } = req.body;

      console.log("Inventory POST payload:", req.body);

      // Kontrola povinných polí
      if (!item_type || price === undefined || isNaN(Number(price)) || !category) {
        return res.status(400).json({
          message: 'Missing required fields: item_type, price, or category',
        });
      }

      // Zákaz přidání hůlky ručně
      if (item_type === 'wand') {
        return res.status(403).json({ message: "Nelze přidat hůlku ručně do inventáře." });
      }

      // Vložení do databáze
      const { data, error } = await supabase
        .from("character_inventory")
        .insert({
          character_id,
          item_type,
          item_id: item_id || 1,
          price: Number(price),
          item_name: item_name || null,
          quantity: quantity || 1,
          rarity: rarity || null,
          description: description || null,
          notes: notes || null,
          category: category || null,
        })
        .select()
        .single();

      if (error) {
        console.error("[INVENTORY][POST][ERROR]", error);
        return res.status(500).json({ message: "Database error", error: error.message });
      }

      console.log(`[INVENTORY][POST][SUCCESS] Added item to character ${character_id}:`, data);
      res.status(201).json(data);
    } catch (error) {
      console.error("[INVENTORY][POST][ERROR] Server error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/inventory/:id", requireAuth, async (req, res) => {
    const itemId = Number(req.params.id);
    if (!itemId || isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const item = await storage.getInventoryItem(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const character = await storage.getCharacter(item.character_id);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const updatedItem = await storage.updateInventoryItem(itemId, req.body);
      res.json(updatedItem);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/inventory/:id", requireAuth, async (req, res) => {
    const itemId = Number(req.params.id);
    if (!itemId || isNaN(itemId)) {
      return res.status(400).json({ message: "Invalid itemId" });
    }

    const item = await storage.getInventoryItem(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const character = await storage.getCharacter(item.character_id);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deleted = await storage.deleteInventoryItem(itemId);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Character journal routes
  app.get("/api/characters/:id/journal", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    // Check access
    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const journal = await storage.getCharacterJournal(characterId);
    res.json(journal);
  });

  app.post("/api/characters/:id/journal", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    const character = await storage.getCharacter(characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const journalEntry = await storage.addJournalEntry({
        characterId,
        ...req.body
      });
      res.status(201).json(journalEntry);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/journal/:id", requireAuth, async (req, res) => {
    const entryId = Number(req.params.id);
    if (!entryId || isNaN(entryId)) {
      return res.status(400).json({ message: "Invalid entryId" });
    }

    const entry = await storage.getJournalEntry(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const character = await storage.getCharacter(entry.characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const updatedEntry = await storage.updateJournalEntry(entryId, req.body);
      res.json(updatedEntry);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/journal/:id", requireAuth, async (req, res) => {
    const entryId = Number(req.params.id);
    if (!entryId || isNaN(entryId)) {
      return res.status(400).json({ message: "Invalid entryId" });
    }

    const entry = await storage.getJournalEntry(entryId);
    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const character = await storage.getCharacter(entry.characterId);
    if (!character) {
      return res.status(404).json({ message: "Character not found" });
    }

    if (req.user!.role !== 'admin' && character.userId !== req.user!.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const deleted = await storage.deleteJournalEntry(entryId);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  // Get all spells
  app.get("/api/spells", requireAuth, async (req, res) => {
    try {
      const spells = await storage.getAllSpells();
      res.json(spells);
    } catch (error) {
      console.error("Error fetching spells:", error);
      res.status(500).json({ message: "Failed to fetch spells" });
    }
  });

  // Get spells for a character
  app.get("/api/characters/:id/spells", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    if (!characterId || isNaN(characterId)) {
      return res.status(400).json({ message: "Invalid characterId" });
    }

    try {
      // Check if character belongs to user or is admin
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== req.user!.id) {
          return res.status(403).json({ message: "Character not found or access denied" });
        }
      }

      const spells = await storage.getCharacterSpells(characterId);
      res.json(spells || []);
    } catch (error) {
      console.error("Error fetching character spells:", error);
      res.status(500).json({ message: "Failed to fetch spells" });
    }
  });

  // Add spell to character
  app.post("/api/characters/:id/spells", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    const { spellId } = req.body;

    if (!characterId || !spellId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    try {
      // Check character ownership
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const characterSpell = await storage.addSpellToCharacter(characterId, spellId);
      res.json(characterSpell);
    } catch (error) {
      console.error("Error adding spell to character:", error);
      res.status(500).json({ message: "Failed to add spell" });
    }
  });

  // Remove spell from character
  app.delete("/api/characters/:id/spells/:spellId", requireAuth, async (req, res) => {
    const characterId = Number(req.params.id);
    const spellId = Number(req.params.spellId);

    try {
      // Check character ownership
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== req.user!.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const success = await storage.removeSpellFromCharacter(characterId, spellId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Spell not found" });
      }
    } catch (error) {
      console.error("Error removing spell from character:", error);
      res.status(500).json({ message: "Failed to remove spell" });
    }
  });

  // Cemetery - get dead characters
  app.get("/api/cemetery", requireAuth, async (req, res) => {
    try {
      const deadCharacters = await storage.getDeadCharacters();
      res.json(deadCharacters);
    } catch (error) {
      console.error("Error fetching dead characters:", error);
      res.status(500).json({ message: "Failed to fetch cemetery" });
    }
  });

  // Admin: Kill character
  app.post("/api/admin/characters/:id/kill", requireAdmin, async (req, res) => {
    const characterId = Number(req.params.id);
    const { deathReason } = req.body;

    try {
      const character = await storage.killCharacter(characterId, deathReason, req.user!.id);
      if (character) {
        res.json(character);
      } else {
        res.status(404).json({ message: "Character not found" });
      }
    } catch (error) {
      console.error("Error killing character:", error);
      res.status(500).json({ message: "Failed to kill character" });
    }
  });

  // Admin: Revive character
  app.post("/api/admin/characters/:id/revive", requireAdmin, async (req, res) => {
    const characterId = Number(req.params.id);

    try {
      const character = await storage.reviveCharacter(characterId);
      if (character) {
        res.json(character);
      } else {
        res.status(404).json({ message: "Character not found" });
      }
    } catch (error) {
      console.error("Error reviving character:", error);
      res.status(500).json({ message: "Failed to revive character" });
    }
  });

  // Influence system routes - fixed with proper error handling
  app.get("/api/influence-bar", requireAuth, async (req, res) => {
    try {
      const influence = await storage.getInfluenceBar();
      res.json(influence);
    } catch (error) {
      console.error("Error fetching influence bar:", error);
      res.status(500).json({ message: "Failed to fetch influence data" });
    }
  });

  app.get("/api/influence-history", requireAuth, async (req, res) => {
    try {
      const history = await storage.getInfluenceHistory();
      res.json(history);
    } catch (error) {
      console.error("Error fetching influence history:", error);
      res.status(500).json({ message: "Failed to fetch influence history" });
    }
  });

  // Admin influence routes
  app.post("/api/admin/influence-bar/adjust-with-history", requireAdmin, async (req, res) => {
    try {
      const { changeType, points, reason } = req.body;
      if (!changeType || !points || !reason) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const currentData = await storage.getInfluenceBar();
      const previousTotal = changeType === 'grindelwald' ? currentData.grindelwaldPoints : currentData.dumbledorePoints;
      const newTotal = Math.max(0, previousTotal + points);

      const newGrindelwaldPoints = changeType === 'grindelwald' ? newTotal : currentData.grindelwaldPoints;
      const newDumbledorePoints = changeType === 'dumbledore' ? newTotal : currentData.dumbledorePoints;

      await storage.setInfluence(newGrindelwaldPoints, newDumbledorePoints, req.user!.id, reason, changeType);

      res.json({ message: "Influence adjusted successfully" });
    } catch (error) {
      console.error("Error adjusting influence:", error);
      res.status(500).json({ message: "Failed to adjust influence" });
    }
  });

  app.post("/api/admin/influence-bar/reset", requireAdmin, async (req, res) => {
    try {
      const { type } = req.body;
      if (!type || (type !== "0:0" && type !== "50:50")) {
        return res.status(400).json({ message: "Reset type must be '0:0' or '50:50'" });
      }

      const resetValues = type === "0:0" ? { grindelwald: 0, dumbledore: 0 } : { grindelwald: 50, dumbledore: 50 };
      await storage.setInfluence(resetValues.grindelwald, resetValues.dumbledore, req.user!.id, "reset", null);

      res.json({ message: "Influence reset successfully" });
    } catch (error) {
      console.error("Error resetting influence:", error);
      res.status(500).json({ message: "Failed to reset influence" });
    }
  });

  // Owl Post routes
  app.get("/api/owl-post/unread-total", requireAuth, async (req, res) => {
    try {
      let totalCount = 0;
      const characterIdParam = req.query.characterId;
      const characterId = characterIdParam ? Number(characterIdParam) : undefined;

      if (characterIdParam && (isNaN(characterId) || characterId <= 0)) {
        return res.status(400).json({ message: "Invalid characterId" });
      }

      if (characterId) {
        // Ověření přístupu k postavě
        if (req.user!.role !== 'admin') {
          const characters = await storage.getCharactersByUserId(req.user!.id);
          if (!characters.some((char: any) => char.id === characterId)) {
            return res.status(403).json({ message: "Forbidden" });
          }
        }
        totalCount = await storage.getUnreadOwlPostCount(characterId);
      } else {
        const userCharacters = await storage.getCharactersByUserId(req.user!.id);
        if (!userCharacters || userCharacters.length === 0) {
          return res.json({ count: 0 });
        }
        for (const char of userCharacters) {
          totalCount += await storage.getUnreadOwlPostCount(char.id);
        }
      }
      res.json({ count: totalCount });
    } catch (error) {
      console.error("Error fetching unread total:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/owl-post/characters", requireAuth, async (req, res) => {
    try {
      const allCharacters = await storage.getAllCharacters();
      const safeAllCharacters = Array.isArray(allCharacters) ? allCharacters : [];
      const activeCharacters = safeAllCharacters.filter((char: any) => !char.deathDate && !char.isSystem);
      const charactersWithFullName = activeCharacters.map((char: any) => ({
        ...char,
        fullName: `${char.firstName} ${char.middleName ? char.middleName + ' ' : ''}${char.lastName}`
      }));
      console.log(`[OWL-POST] Returning ${charactersWithFullName.length} characters for owl post`);
      res.json(charactersWithFullName);
    } catch (error) {
      console.error("Error loading owl-post characters:", error);
      res.status(500).json({ message: "Failed to load characters", characters: [] });
    }
  });

  app.delete("/api/owl-post/message/:messageId", requireAuth, async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);
      if (!messageId || isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid messageId" });
      }

      const success = await storage.deleteOwlPostMessage(messageId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ message: "Message not found" });
      }
    } catch (error: any) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: error.message || "Failed to delete message" });
    }
  });

  // Wand components route for admin interface
  app.get("/api/admin/wand-components", requireAuth, async (req, res) => {
    try {
      const components = await storage.getAllWandComponents();
      res.json(components);
    } catch (error) {
      console.error("Error fetching wand components:", error);
      res.status(500).json({ message: "Failed to fetch wand components" });
    }
  });

  app.post("/api/admin/wand-components", requireAdmin, async (req, res) => {
    try {
      const { components } = req.body;
      await storage.updateWandComponents(components);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating wand components:", error);
      res.status(500).json({ message: "Failed to update wand components" });
    }
  });

  // Seznam všech uživatelů (pouze pro adminy)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const includeSystem = req.query.includeSystem === "true";
      const users = await storage.getAllUsers(includeSystem);
      res.json(users);
    } catch (error) {
      console.error("Chyba při načítání uživatelů:", error);
      res.status(500).json({ message: "Chyba serveru", error: error?.message || error });
    }
  });

  // --- ADMIN: Vytváření invite kódů ---
  app.post("/api/admin/invite-codes", requireAdmin, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Chybí kód" });
      }
      const createdByUserId = req.user?.id;
      const newInvite = await storage.createInviteCode({ code, createdByUserId });
      res.status(200).json(newInvite);
    } catch (error) {
      console.error("Chyba při vytváření invite kódu:", error);
      res.status(500).json({ message: "Chyba při vytváření invite kódu" });
    }
  });

  // --- ADMIN: Získání všech invite kódů ---
  app.get("/api/admin/invite-codes", requireAdmin, async (req, res) => {
    try {
      const codes = await storage.getAllInviteCodes();
      res.json(codes);
    } catch (error) {
      console.error("Chyba při načítání invite kódů:", error);
      res.status(500).json({ message: "Chyba při načítání invite kódů", error: error?.message || error });
    }
  });

  // Seznam všech uživatelů (pro adminy, pro kompatibilitu s frontendem)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Chyba při načítání uživatelů:", error);
      res.status(500).json({ message: "Chyba serveru", error: error?.message || error });
    }
  });

  // --- ADMIN: Reset hesla uživatele ---
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    try {
      // Vygeneruj nové náhodné heslo (např. 10 znaků)
      const newPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await storage.hashPassword(newPassword);
      await storage.resetUserPassword(userId, hashedPassword);
      res.json({ newPassword });
    } catch (error) {
      console.error("Chyba při resetu hesla:", error);
      res.status(500).json({ message: "Nepodařilo se resetovat heslo", error: error?.message || error });
    }
  });

  // --- Změna hesla uživatele ---
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Chybí aktuální nebo nové heslo" });
    }
    try {
      // Ověř aktuální heslo
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Uživatel nenalezen" });
      const isValid = await storage.validateUser(user.username, currentPassword);
      if (!isValid) return res.status(401).json({ message: "Aktuální heslo je špatně" });
      // Ulož nové heslo
      const hashedPassword = await storage.hashPassword(newPassword);
      await storage.updateUserPassword(userId, hashedPassword);
      res.json({ success: true });
    } catch (error) {
      console.error("Chyba při změně hesla:", error);
      res.status(500).json({ message: "Nepodařilo se změnit heslo", error: error?.message || error });
    }
  });

  // --- ADMIN: Uložení komponent hůlek ---
  app.put("/api/admin/wand-components", requireAdmin, async (req, res) => {
    try {
      const { woods, cores, lengths, flexibilities } = req.body;
      await storage.updateWandComponents({ woods, cores, lengths, flexibilities });
      res.json({ success: true });
    } catch (error) {
      console.error("Chyba při ukládání komponent hůlek:", error);
      res.status(500).json({ message: "Nepodařilo se uložit komponenty hůlek", error: error?.message || error });
    }
  });

  // Visit Ollivanders (get random wand)
  app.post('/api/characters/:id/visit-ollivanders', requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if character belongs to user
      const character = await storage.getCharacterById(characterId);
      if (!character || character.userId !== userId) {
        return res.status(403).json({ error: "Character not found or access denied" });
      }

      // Check if character already has a wand
      const existingWand = await storage.getCharacterWand(characterId);
      if (existingWand) {
        return res.status(400).json({ error: "Character already has a wand" });
      }

      const wand = await storage.generateRandomWand(characterId);
      res.json(wand);
    } catch (error: any) {
      console.error('Error visiting Ollivanders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create custom wand
  app.post('/api/characters/:id/create-custom-wand', requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { wood, core, length, flexibility, description } = req.body;

      // Check if character belongs to user
      const character = await storage.getCharacterById(characterId);
      if (!character || character.userId !== userId) {
        return res.status(403).json({ error: "Character not found or access denied" });
      }

      // Check if character already has a wand
      const existingWand = await storage.getCharacterWand(characterId);
      if (existingWand) {
        return res.status(400).json({ error: "Character already has a wand" });
      }

      // Validate required fields
      if (!wood || !core || !length || !flexibility) {
        return res.status(400).json({ error: "All wand components are required" });
      }

      const wandData = {
        character_id: characterId,
        wood,
        core,
        length,
        flexibility,
        description: description || `A ${length} wand made of ${wood} wood with a ${core} core, ${flexibility}`,
        acquired_at: new Date().toISOString()
      };

      const wand = await storage.createWand(wandData);
      res.json(wand);
    } catch (error: any) {
      console.error('Error creating custom wand:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get character's wand
  app.get('/api/characters/:id/wand', requireAuth, async (req, res) => {
    try {
      const characterId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if character belongs to user or is admin
      if (req.user!.role !== 'admin') {
        const character = await storage.getCharacterById(characterId);
        if (!character || character.userId !== userId) {
          return res.status(403).json({ error: "Character not found or access denied" });
        }
      }

      const wand = await storage.getCharacterWand(characterId);
      if (!wand) {
        return res.status(404).json({ error: "Character has no wand" });
      }

      res.json(wand);
    } catch (error: any) {
      console.error('Error fetching character wand:', error);
      res.status(500).json({ error: error.message });
    }
  });

// ✅ Test
  app.get('/api/test', (req: Request, res: Response) => {
    res.json({ message: 'Backend funguje!' });
  });

  // 🧪 Debug – seznam rout
  app.get('/api/debug/routes', (req, res) => {
    res.json({
      routes: app._router.stack
        .filter(r => r.route)
        .map(r => r.route.path)
    });
  });

  // 🔍 Comprehensive debug endpoint
  app.get('/api/debug/status', requireAuth, async (req, res) => {
    try {
      const debugInfo = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        port: process.env.PORT,
        user: {
          id: req.user?.id,
          username: req.user?.username,
          role: req.user?.role
        },
        supabase: {
          url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
          key: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
        },
        database: {
          url: process.env.DATABASE_URL ? 'SET' : 'MISSING'
        },
        jwt: {
          secret: process.env.JWT_SECRET ? 'SET' : 'USING_DEFAULT'
        }
      };

      // Test database connection
      try {
        const testUser = await storage.getUser(1);
        debugInfo.database.connection = testUser ? 'OK' : 'NO_DATA';
      } catch (error) {
        debugInfo.database.connection = `ERROR: ${error.message}`;
      }

      // Test Supabase connection
      try {
        const { data, error } = await supabase.from('users').select('count').limit(1);
        debugInfo.supabase.connection = error ? `ERROR: ${error.message}` : 'OK';
      } catch (error) {
        debugInfo.supabase.connection = `ERROR: ${error.message}`;
      }

      res.json(debugInfo);
    } catch (error) {
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Debug endpoint for testing owl post message creation
  app.post('/api/debug/owl-post-test', requireAuth, async (req, res) => {
    try {
      console.log("[DEBUG][OWL-POST-TEST] Testing owl post message creation");

      // Test basic database connection
      const { data: testQuery, error: testError } = await supabase
        .from('messages')
        .select('count')
        .limit(1);

      if (testError) {
        return res.status(500).json({ 
          error: 'Database connection failed', 
          details: testError 
        });
      }

      // Test character existence
      const { data: characters } = await supabase
        .from('characters')
        .select('id, first_name, last_name')
        .limit(5);

      // Test messages table structure
      const { data: messageStructure, error: structureError } = await supabase
        .from('messages')
        .select('*')
        .limit(1);

      res.json({
        success: true,
        database: {
          connection: 'OK',
          messagesTable: structureError ? `ERROR: ${structureError.message}` : 'OK',
          sampleCharacters: characters || [],
          messagesSample: messageStructure || []
        }
      });
    } catch (error) {
      console.error("[DEBUG][OWL-POST-TEST] Error:", error);
      res.status(500).json({ 
        error: error.message, 
        stack: error.stack 
      });
    }
  });

  // Chat zprávy pro konkrétní místnost
  app.get("/api/chat/:roomId/messages", requireAuth, async (req, res) => {
    const roomId = Number(req.params.roomId);
    if (!roomId || isNaN(roomId)) {
      return res.status(400).json({ message: "Invalid room ID" });
    }

    try {
      console.log(`[ROUTES][chat-messages] User ${req.user?.username} requesting messages for room ${roomId}`);
      const messages = await storage.getChatMessages(roomId);
      console.log(`[ROUTES][chat-messages] Returning ${messages.length} messages for room ${roomId}`);

      if (messages.length > 0) {
        console.log(`[ROUTES][chat-messages] First message sample:`, {
          id: messages[0].id,
          characterId: messages[0].characterId,
          messageType: messages[0].messageType,
          hasCharacter: !!messages[0].character,
          characterData: messages[0].character
        });
      }

      res.json(messages);
    } catch (error) {
      console.error("[ROUTES][chat-messages] Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // --- ROOM PRESENCE ENDPOINTS ---
  app.post('/api/room-presence/join', requireAuth, async (req, res) => {
    const { characterId, roomId } = req.body;
    if (!characterId || !roomId) {
      return res.status(400).json({ message: 'Chybí characterId nebo roomId' });
    }
    const { error } = await supabase
      .from('room_presence')
      .upsert([
        {
          character_id: characterId,
          room_id: roomId,
          is_online: true,
          last_active_at: new Date().toISOString(),
          joined_at: new Date().toISOString()
        }
      ], { onConflict: ['character_id', 'room_id'] });
    if (error) {
      return res.status(500).json({ message: 'Chyba při zápisu přítomnosti', error });
    }
    res.json({ success: true });
  });

  app.post('/api/room-presence/leave', requireAuth, async (req, res) => {
    const { characterId, roomId } = req.body;
    if (!characterId || !roomId) {
      return res.status(400).json({ message: 'Chybí characterId nebo roomId' });
    }
    const { error } = await supabase
      .from('room_presence')
      .update({ is_online: false, last_active_at: new Date().toISOString() })
      .eq('character_id', characterId)
      .eq('room_id', roomId);
    if (error) {
      return res.status(500).json({ message: 'Chyba při odchodu z místnosti', error });
    }
    res.json({ success: true });
  });

  // --- ADMIN: Změna role uživatele ---
  app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const { role } = req.body;
    if (!userId || !role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: "Invalid user id or role" });
    }
    try {
      await storage.updateUserRole(userId, role);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user role", error: error?.message || error });
    }
  });

  // --- ADMIN: Změna vypravěče ---
  app.patch("/api/admin/users/:id/narrator", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const { canNarrate, reason } = req.body;
    if (!userId || typeof canNarrate !== "boolean") {
      return res.status(400).json({ message: "Invalid user id or canNarrate" });
    }
    try {
      await storage.updateUserNarrator(userId, canNarrate, reason);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update narrator permission", error: error?.message || error });
    }
  });

  // --- ADMIN: Banování uživatele ---
  app.post("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    const { reason } = req.body;
    if (!userId || !reason) {
      return res.status(400).json({ message: "Invalid user id or reason" });
    }
    try {
      await storage.banUser(userId, reason);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to ban user", error: error?.message || error });
    }
  });

  // --- Žádost o novou postavu ---
  app.post("/api/character-requests", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, middleName, lastName, birthDate, school, description, reason } = req.body;
      if (!firstName || !lastName || !birthDate || !school || !reason) {
        return res.status(400).json({ message: "Chybí povinné údaje" });
      }
      const request = await storage.createCharacterRequest({
        userId,
        firstName,
        middleName,
        lastName,
        birthDate,
        school,
        description,
        reason
      });
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Nepodařilo se vytvořit žádost o postavu", error: error?.message || error });
    }
  });

  // --- ADMIN: Schválení žádosti o novou postavu ---
  app.post("/api/admin/character-requests/:id/approve", requireAdmin, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const adminId = req.user.id;
      const { reviewNote } = req.body;
      const character = await storage.approveCharacterRequest(requestId, adminId, reviewNote);
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Nepodařilo se schválit žádost", error: error?.message || error });
    }
  });

  // --- ADMIN: Zamítnutí žádosti o novou postavu ---
  app.post("/api/admin/character-requests/:id/reject", requireAdmin, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const adminId = req.user.id;
      const { reason } = req.body;
      const request = await storage.rejectCharacterRequest(requestId, adminId, reason);
      res.json(request);
    } catch (error) {
      res.status(500).json({ message: "Nepodařilo se zamítnout žádost", error: error?.message || error });
    }
  });

  app.get("/api/character-requests/my", requireAuth, async (req, res) => {
    try {
      const requests = await storage.getCharacterRequestsByUserId(req.user.id);
      res.json(requests);
    } catch (error) {
      console.error("[character-requests/my] Error:", error);
      res.status(500).json({ message: "Nepodařilo se načíst žádosti o postavu" });
    }
  });

  app.get("/api/admin/character-requests", requireAdmin, async (req, res) => {
    try {
      const requests = await storage.getAllCharacterRequests();
      res.json(requests);
    } catch (error) {
      console.error("[admin/character-requests] Error:", error);
      res.status(500).json({ message: "Nepodařilo se načíst žádosti o postavu" });
    }
  });

  app.get("/api/admin/online-users", requireAdmin, async (_req, res) => {
    try {
      const now = Date.now();
      const ONLINE_WINDOW = 10 * 60 * 1000; // 10 minut
      const onlineUsers = Array.from(userActivityMap.values()).filter(u => now - u.lastActiveAt <= ONLINE_WINDOW);
      res.json(onlineUsers);
    } catch (error) {
      console.error("[admin/online-users] Error:", error);
      res.status(500).json({ message: "Nepodařilo se načíst online uživatele" });
    }
  });

  // === HOUSING REQUESTS USER ENDPOINTS ===
  app.post('/api/housing-requests', requireAuth, async (req, res) => {
    try {
      const parsed = insertHousingRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid data', errors: parsed.error.errors });
      }
      const data = parsed.data;
      const userId = req.user!.id;
      // Ověř, že postava patří uživateli
      const character = await storage.getCharacter(data.characterId);
      if (!character || character.userId !== userId) {
        return res.status(403).json({ message: 'Character does not belong to user' });
      }
      // Převod na snake_case
      const snakeData = toSnake(data);
      // Vytvoř žádost
      const request = await supabase
        .from('housing_requests')
        .insert({ ...snakeData, user_id: userId, status: 'pending' })
        .select()
        .single();
      if (request.error) {
        return res.status(500).json({ message: 'Failed to create request', error: request.error });
      }
      res.status(201).json(request.data);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // Seznam žádostí aktuálního uživatele
  app.get('/api/housing-requests/my', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Zkusím různé varianty joinu na postavu
      const { data, error } = await supabase
        .from('housing_requests')
        .select(`
          *,
          character:character_id (id, first_name, middle_name, last_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback: zkusím jiný název klíče
        const { data: altData, error: altError } = await supabase
          .from('housing_requests')
          .select(`
            *,
            character:characterId (id, first_name, middle_name, last_name)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (altError) return res.status(500).json({ message: 'Failed to fetch requests', error: altError });
        return res.json(altData || []);
      }
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // Smazání žádosti (pouze pokud patří uživateli a není schválená)
  app.delete('/api/housing-requests/:id', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const requestId = Number(req.params.id);
      if (!requestId) return res.status(400).json({ message: 'Invalid request id' });
      const { data: request, error } = await supabase
        .from('housing_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error || !request) return res.status(404).json({ message: 'Request not found' });
      if (request.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
      if (request.status === 'approved') return res.status(400).json({ message: 'Cannot delete approved request' });
      const { error: delError } = await supabase
        .from('housing_requests')
        .delete()
        .eq('id', requestId);
      if (delError) return res.status(500).json({ message: 'Failed to delete request', error: delError });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // === HOUSING REQUESTS ADMIN ENDPOINTS ===
  app.get('/api/admin/housing-requests', requireAdmin, async (req, res) => {
    try {
      // Zkusím různé varianty joinu na postavu
      const { data, error } = await supabase
        .from('housing_requests')
        .select(`
          *,
          user:user_id (id, username, email),
          character:character_id (id, first_name, middle_name, last_name)
        `)
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback: zkusím jiný název klíče
        const { data: altData, error: altError } = await supabase
          .from('housing_requests')
          .select(`
            *,
            user:user_id (id, username, email),
            character:characterId (id, first_name, middle_name, last_name)
          `)
          .order('created_at', { ascending: false });
        if (altError) return res.status(500).json({ message: 'Failed to fetch requests', error: altError });
        return res.json(altData || []);
      }
      res.json(data || []);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // Schválení žádosti
  app.post('/api/admin/housing-requests/:id/approve', requireAdmin, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { assignedAddress, reviewNote } = req.body;
      if (!assignedAddress) return res.status(400).json({ message: 'Missing assignedAddress' });
      const { data: request, error } = await supabase
        .from('housing_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error || !request) return res.status(404).json({ message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });
      // --- ZALOŽENÍ CHATU ---
      const chatName = request.housing_name;
      const chatCategoryName = request.selected_area;
      const chatPassword = request.housing_password || null;
      const chatDescription = request.description || null;
      let chatCategoryId = null;
      if (chatCategoryName) {
        const category = await storage.getChatCategoryByName(chatCategoryName);
        if (category) chatCategoryId = category.id;
      }
      // Ověření, zda už chat v oblasti se stejným názvem existuje
      let existingRoom = null;
      if (chatName && chatCategoryId) {
        existingRoom = await storage.getChatRoomByName(chatName);
        if (!(existingRoom && existingRoom.categoryId === chatCategoryId)) {
          // Založ nový privátní chat
          await storage.createChatRoom({
            name: chatName,
            categoryId: chatCategoryId,
            isPublic: false,
            password: chatPassword,
            description: chatDescription,
          });
        }
      }
      // --- KONEC ZALOŽENÍ CHATU ---
      const { data: updated, error: updError } = await supabase
        .from('housing_requests')
        .update({ status: 'approved', assigned_address: assignedAddress, review_note: reviewNote || null, reviewed_by: req.user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      if (updError) return res.status(500).json({ message: 'Failed to approve request', error: updError });
      // Odeslání sovy
      const housingAdmin = await storage.getCharacterByName('Správa', 'ubytování');
      if (housingAdmin && request.character_id) {
        await storage.sendOwlPostMessage(
          housingAdmin.id,
          request.character_id,
          'Žádost o bydlení schválena',
          `Vaše žádost o bydlení byla schválena. Adresa: ${assignedAddress}${reviewNote ? '\nPoznámka: ' + reviewNote : ''}`
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // Vrácení žádosti k úpravě
  app.post('/api/admin/housing-requests/:id/return', requireAdmin, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { reviewNote } = req.body;
      if (!reviewNote) return res.status(400).json({ message: 'Missing reviewNote' });
      const { data: request, error } = await supabase
        .from('housing_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error || !request) return res.status(404).json({ message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });
      const { data: updated, error: updError } = await supabase
        .from('housing_requests')
        .update({ status: 'returned', review_note: reviewNote, reviewed_by: req.user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      if (updError) return res.status(500).json({ message: 'Failed to return request', error: updError });
      // Odeslání sovy
      const housingAdmin = await storage.getCharacterByName('Správa', 'ubytování');
      if (housingAdmin && request.character_id) {
        await storage.sendOwlPostMessage(
          housingAdmin.id,
          request.character_id,
          'Žádost o bydlení vrácena k úpravě',
          `Vaše žádost o bydlení byla vrácena k úpravě.\nPoznámka: ${reviewNote}`
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });

  // Zamítnutí žádosti
  app.post('/api/admin/housing-requests/:id/reject', requireAdmin, async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { reviewNote } = req.body;
      if (!reviewNote) return res.status(400).json({ message: 'Missing reviewNote' });
      const { data: request, error } = await supabase
        .from('housing_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error || !request) return res.status(404).json({ message: 'Request not found' });
      if (request.status !== 'pending') return res.status(400).json({ message: 'Request is not pending' });
      const { data: updated, error: updError } = await supabase
        .from('housing_requests')
        .update({ status: 'rejected', review_note: reviewNote, reviewed_by: req.user!.id, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();
      if (updError) return res.status(500).json({ message: 'Failed to reject request', error: updError });
      // Odeslání sovy
      const housingAdmin = await storage.getCharacterByName('Správa', 'ubytování');
      if (housingAdmin && request.character_id) {
        await storage.sendOwlPostMessage(
          housingAdmin.id,
          request.character_id,
          'Žádost o bydlení zamítnuta',
          `Vaše žádost o bydlení byla zamítnuta.\nPoznámka: ${reviewNote}`
        );
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error?.message });
    }
  });
}

// Pokud není v souboru dostupná funkce toSnake, přidám ji na konec souboru:
function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
      toSnake(v)
    ])
  );
}