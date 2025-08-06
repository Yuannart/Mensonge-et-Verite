import { 
  type User, 
  type InsertUser, 
  type GameState, 
  type Player, 
  type Card, 
  type GameEvent,
  CardType 
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Game methods
  createGame(hostPlayer: Player): Promise<GameState>;
  getGame(id: string): Promise<GameState | undefined>;
  updateGame(gameState: GameState): Promise<GameState>;
  addPlayerToGame(gameId: string, player: Player): Promise<GameState>;
  removePlayerFromGame(gameId: string, playerId: string): Promise<GameState>;
  getAllGames(): Promise<GameState[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private games: Map<string, GameState>;

  constructor() {
    this.users = new Map();
    this.games = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createGame(hostPlayer: Player): Promise<GameState> {
    const gameId = this.generateGameId();
    
    // Initialize deck and deal cards
    const deck = this.createDeck();
    const playerCards = deck.splice(0, 7);
    
    const gameState: GameState = {
      id: gameId,
      phase: "waiting",
      players: [{
        ...hostPlayer,
        cards: playerCards,
        cardCount: playerCards.length
      }],
      currentPlayerId: hostPlayer.id,
      centerPile: [],
      events: [{
        id: randomUUID(),
        type: "join",
        playerId: hostPlayer.id,
        playerName: hostPlayer.name,
        timestamp: Date.now(),
        message: `${hostPlayer.name} a créé la partie`
      }],
      turnTimer: 45,
      maxPlayers: 6,
      minPlayers: 2,
    };

    this.games.set(gameId, gameState);
    return gameState;
  }

  async getGame(id: string): Promise<GameState | undefined> {
    return this.games.get(id);
  }

  async updateGame(gameState: GameState): Promise<GameState> {
    this.games.set(gameState.id, gameState);
    return gameState;
  }

  async addPlayerToGame(gameId: string, player: Player): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.players.length >= game.maxPlayers) {
      throw new Error("Game is full");
    }

    // Deal cards to new player
    const deck = this.createDeck();
    const playerCards = deck.splice(0, 7);
    
    const newPlayer: Player = {
      ...player,
      cards: playerCards,
      cardCount: playerCards.length
    };

    game.players.push(newPlayer);
    
    game.events.push({
      id: randomUUID(),
      type: "join",
      playerId: player.id,
      playerName: player.name,
      timestamp: Date.now(),
      message: `${player.name} a rejoint la partie`
    });

    // Start game automatically when minimum players are reached
    if (game.players.length >= game.minPlayers && game.phase === "waiting") {
      game.phase = "playing";
      game.events.push({
        id: randomUUID(),
        type: "game_start",
        playerId: "",
        playerName: "",
        timestamp: Date.now(),
        message: `La partie commence avec ${game.players.length} joueurs !`
      });
    }

    // Start game if we have enough players
    if (game.players.length >= game.minPlayers && game.phase === "waiting") {
      game.phase = "playing";
    }

    this.games.set(gameId, game);
    return game;
  }

  async removePlayerFromGame(gameId: string, playerId: string): Promise<GameState> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      throw new Error("Player not found in game");
    }

    const player = game.players[playerIndex];
    game.players.splice(playerIndex, 1);

    game.events.push({
      id: randomUUID(),
      type: "leave",
      playerId: player.id,
      playerName: player.name,
      timestamp: Date.now(),
      message: `${player.name} a quitté la partie`
    });

    // End game if not enough players
    if (game.players.length < game.minPlayers) {
      game.phase = "finished";
    }

    this.games.set(gameId, game);
    return game;
  }

  async getAllGames(): Promise<GameState[]> {
    return Array.from(this.games.values());
  }

  private generateGameId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private createDeck(): Card[] {
    const deck: Card[] = [];
    
    // Create a balanced deck with truth and lie cards
    for (let i = 0; i < 30; i++) {
      deck.push({
        id: randomUUID(),
        type: "truth" as CardType
      });
    }
    
    for (let i = 0; i < 30; i++) {
      deck.push({
        id: randomUUID(),
        type: "lie" as CardType
      });
    }
    
    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }
}

export const storage = new MemStorage();
