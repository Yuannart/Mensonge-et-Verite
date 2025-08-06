import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Game-specific schemas
export const CardType = z.enum(["truth", "lie"]);
export type CardType = z.infer<typeof CardType>;

export const Card = z.object({
  id: z.string(),
  type: CardType,
});
export type Card = z.infer<typeof Card>;

export const Player = z.object({
  id: z.string(),
  name: z.string(),
  cardCount: z.number(),
  cards: z.array(Card),
  avatar: z.string(),
  isOnline: z.boolean(),
});
export type Player = z.infer<typeof Player>;

export const GamePhase = z.enum(["waiting", "playing", "accusation", "revelation", "finished"]);
export type GamePhase = z.infer<typeof GamePhase>;

export const GameEvent = z.object({
  id: z.string(),
  type: z.enum(["card_played", "accusation", "revelation", "penalty", "join", "leave", "game_start"]),
  playerId: z.string(),
  playerName: z.string(),
  targetId: z.string().optional(),
  targetName: z.string().optional(),
  cardType: CardType.optional(),
  timestamp: z.number(),
  message: z.string(),
});
export type GameEvent = z.infer<typeof GameEvent>;

export const GameState = z.object({
  id: z.string(),
  phase: GamePhase,
  players: z.array(Player),
  currentPlayerId: z.string(),
  centerPile: z.array(Card),
  lastPlayedCard: Card.optional(),
  lastPlayerId: z.string().optional(),
  accusingPlayerId: z.string().optional(),
  revealedCard: Card.optional(),
  events: z.array(GameEvent),
  turnTimer: z.number(),
  maxPlayers: z.number().default(6),
  minPlayers: z.number().default(2),
});
export type GameState = z.infer<typeof GameState>;

export const CreateGameRequest = z.object({
  playerName: z.string().min(1).max(20),
});
export type CreateGameRequest = z.infer<typeof CreateGameRequest>;

export const JoinGameRequest = z.object({
  gameId: z.string(),
  playerName: z.string().min(1).max(20),
});
export type JoinGameRequest = z.infer<typeof JoinGameRequest>;

export const PlayCardRequest = z.object({
  gameId: z.string(),
  playerId: z.string(),
  cardId: z.string(),
});
export type PlayCardRequest = z.infer<typeof PlayCardRequest>;

export const AccusePlayerRequest = z.object({
  gameId: z.string(),
  accusingPlayerId: z.string(),
  accusedPlayerId: z.string(),
});
export type AccusePlayerRequest = z.infer<typeof AccusePlayerRequest>;

export const WebSocketMessage = z.object({
  type: z.enum(["game_state", "player_joined", "player_left", "card_played", "accusation", "revelation", "error"]),
  data: z.any(),
});
export type WebSocketMessage = z.infer<typeof WebSocketMessage>;
