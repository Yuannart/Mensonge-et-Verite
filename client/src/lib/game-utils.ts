import type { GameState, Player, Card } from "@shared/schema";

export function getPlayerById(game: GameState, playerId: string): Player | undefined {
  return game.players.find(p => p.id === playerId);
}

export function getOtherPlayers(game: GameState, currentPlayerId: string): Player[] {
  return game.players.filter(p => p.id !== currentPlayerId);
}

export function getNextPlayer(game: GameState, currentPlayerId: string): Player | undefined {
  const currentIndex = game.players.findIndex(p => p.id === currentPlayerId);
  if (currentIndex === -1) return undefined;
  
  const nextIndex = (currentIndex + 1) % game.players.length;
  return game.players[nextIndex];
}

export function canPlayerAccuse(game: GameState, playerId: string): boolean {
  return !!(
    game.lastPlayerId && 
    game.lastPlayerId !== playerId && 
    game.phase === "playing" &&
    game.lastPlayedCard
  );
}

export function isPlayerTurn(game: GameState, playerId: string): boolean {
  return game.currentPlayerId === playerId && game.phase === "playing";
}

export function getCardTypeColor(cardType: "truth" | "lie"): string {
  return cardType === "truth" ? "var(--truth-card)" : "var(--lie-card)";
}

export function getCardTypeIcon(cardType: "truth" | "lie"): string {
  return cardType === "truth" ? "check" : "x";
}

export function formatGameEvent(event: any): string {
  switch (event.type) {
    case "card_played":
      return `${event.playerName} a joué une carte`;
    case "accusation":
      return `${event.playerName} a accusé ${event.targetName} - ${event.cardType === "lie" ? "Mensonge révélé!" : "Vérité révélée!"}`;
    case "join":
      return `${event.playerName} a rejoint la partie`;
    case "leave":
      return `${event.playerName} a quitté la partie`;
    case "penalty":
      return `${event.playerName} pioche ${event.penaltyCards || 3} cartes`;
    default:
      return event.message || "";
  }
}

export function generateAvatarColor(name: string): string {
  const colors = [
    "from-blue-500 to-purple-600",
    "from-green-500 to-teal-600", 
    "from-red-500 to-pink-600",
    "from-yellow-500 to-orange-600",
    "from-purple-500 to-indigo-600",
    "from-pink-500 to-rose-600"
  ];
  
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}
