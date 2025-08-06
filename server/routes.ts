import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  CreateGameRequest, 
  JoinGameRequest, 
  PlayCardRequest, 
  AccusePlayerRequest,
  type WebSocketMessage,
  type GameState,
  type Player,
  type GameEvent
} from "@shared/schema";
import { randomUUID } from "crypto";

interface ClientConnection {
  ws: WebSocket;
  gameId?: string;
  playerId?: string;
}

const clients = new Map<string, ClientConnection>();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create game room
  app.post("/api/games", async (req, res) => {
    try {
      const request = CreateGameRequest.parse(req.body);
      
      const player: Player = {
        id: randomUUID(),
        name: request.playerName,
        cardCount: 0,
        cards: [],
        avatar: request.playerName.charAt(0).toUpperCase(),
        isOnline: true
      };

      const game = await storage.createGame(player);
      
      res.json({ game, playerId: player.id });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });

  // Join game room
  app.post("/api/games/join", async (req, res) => {
    try {
      const request = JoinGameRequest.parse(req.body);
      
      const game = await storage.getGame(request.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const player: Player = {
        id: randomUUID(),
        name: request.playerName,
        cardCount: 0,
        cards: [],
        avatar: request.playerName.charAt(0).toUpperCase(),
        isOnline: true
      };

      const updatedGame = await storage.addPlayerToGame(request.gameId, player);
      
      // Broadcast to all clients in the game
      broadcastToGame(request.gameId, {
        type: "player_joined",
        data: { game: updatedGame, newPlayer: player }
      });

      res.json({ game: updatedGame, playerId: player.id });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not join game" });
    }
  });

  // Get game state
  app.get("/api/games/:gameId", async (req, res) => {
    try {
      const game = await storage.getGame(req.params.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: "Failed to get game" });
    }
  });

  // Play card
  app.post("/api/games/:gameId/play", async (req, res) => {
    try {
      const request = PlayCardRequest.parse({
        ...req.body,
        gameId: req.params.gameId
      });
      
      const game = await storage.getGame(request.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      const player = game.players.find(p => p.id === request.playerId);
      if (!player) {
        return res.status(404).json({ message: "Player not found" });
      }

      if (game.currentPlayerId !== request.playerId) {
        return res.status(400).json({ message: "Not your turn" });
      }

      const cardIndex = player.cards.findIndex(c => c.id === request.cardId);
      if (cardIndex === -1) {
        return res.status(400).json({ message: "Card not found" });
      }

      const playedCard = player.cards.splice(cardIndex, 1)[0];
      player.cardCount = player.cards.length;
      
      game.centerPile.push(playedCard);
      game.lastPlayedCard = playedCard;
      game.lastPlayerId = request.playerId;

      // Check win condition
      if (player.cards.length === 0) {
        game.phase = "finished";
        const event: GameEvent = {
          id: randomUUID(),
          type: "card_played",
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now(),
          message: `${player.name} a gagné la partie !`
        };
        game.events.push(event);
      } else {
        // Move to next player
        const currentIndex = game.players.findIndex(p => p.id === request.playerId);
        const nextIndex = (currentIndex + 1) % game.players.length;
        game.currentPlayerId = game.players[nextIndex].id;

        const event: GameEvent = {
          id: randomUUID(),
          type: "card_played",
          playerId: player.id,
          playerName: player.name,
          timestamp: Date.now(),
          message: `${player.name} a joué une carte`
        };
        game.events.push(event);
      }

      const updatedGame = await storage.updateGame(game);

      // Broadcast to all clients
      broadcastToGame(request.gameId, {
        type: "card_played",
        data: updatedGame
      });

      res.json(updatedGame);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not play card" });
    }
  });

  // Accuse player
  app.post("/api/games/:gameId/accuse", async (req, res) => {
    try {
      const request = AccusePlayerRequest.parse({
        ...req.body,
        gameId: req.params.gameId
      });
      
      const game = await storage.getGame(request.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (!game.lastPlayedCard || !game.lastPlayerId) {
        return res.status(400).json({ message: "No card to accuse" });
      }

      const accusingPlayer = game.players.find(p => p.id === request.accusingPlayerId);
      const accusedPlayer = game.players.find(p => p.id === request.accusedPlayerId);
      
      if (!accusingPlayer || !accusedPlayer) {
        return res.status(404).json({ message: "Player not found" });
      }

      game.phase = "revelation";
      game.revealedCard = game.lastPlayedCard;
      game.accusingPlayerId = request.accusingPlayerId;

      // Determine penalty
      const wasLie = game.lastPlayedCard.type === "lie";
      const penaltyPlayer = wasLie ? accusedPlayer : accusingPlayer;
      
      // Add 3 penalty cards
      const deck = createPenaltyCards();
      const penaltyCards = deck.splice(0, 3);
      penaltyPlayer.cards.push(...penaltyCards);
      penaltyPlayer.cardCount = penaltyPlayer.cards.length;

      const event: GameEvent = {
        id: randomUUID(),
        type: "accusation",
        playerId: accusingPlayer.id,
        playerName: accusingPlayer.name,
        targetId: accusedPlayer.id,
        targetName: accusedPlayer.name,
        cardType: game.lastPlayedCard.type,
        timestamp: Date.now(),
        message: `${accusingPlayer.name} a accusé ${accusedPlayer.name} - ${wasLie ? 'Mensonge révélé!' : 'Vérité révélée!'}`
      };
      game.events.push(event);

      const updatedGame = await storage.updateGame(game);

      // Broadcast revelation
      broadcastToGame(request.gameId, {
        type: "accusation",
        data: updatedGame
      });

      res.json(updatedGame);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Could not accuse player" });
    }
  });

  // Continue game after revelation
  app.post("/api/games/:gameId/continue", async (req, res) => {
    try {
      const game = await storage.getGame(req.params.gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      game.phase = "playing";
      game.revealedCard = undefined;
      game.accusingPlayerId = undefined;

      const updatedGame = await storage.updateGame(game);

      broadcastToGame(req.params.gameId, {
        type: "game_state",
        data: updatedGame
      });

      res.json(updatedGame);
    } catch (error) {
      res.status(500).json({ message: "Could not continue game" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const clientId = randomUUID();
    clients.set(clientId, { ws });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'join_game') {
          const client = clients.get(clientId);
          if (client) {
            client.gameId = message.gameId;
            client.playerId = message.playerId;
            clients.set(clientId, client);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', async () => {
      const client = clients.get(clientId);
      if (client && client.gameId && client.playerId) {
        try {
          await storage.removePlayerFromGame(client.gameId, client.playerId);
          
          broadcastToGame(client.gameId, {
            type: "player_left",
            data: { playerId: client.playerId }
          });
        } catch (error) {
          console.error('Error removing player:', error);
        }
      }
      clients.delete(clientId);
    });
  });

  function broadcastToGame(gameId: string, message: WebSocketMessage) {
    clients.forEach((client) => {
      if (client.gameId === gameId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function createPenaltyCards() {
    const cards = [];
    for (let i = 0; i < 10; i++) {
      cards.push({
        id: randomUUID(),
        type: Math.random() > 0.5 ? "truth" as const : "lie" as const
      });
    }
    return cards;
  }

  return httpServer;
}
