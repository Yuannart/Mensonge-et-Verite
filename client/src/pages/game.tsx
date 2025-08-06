import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  VenetianMask, 
  DoorClosed, 
  Clock, 
  HelpCircle, 
  AlertTriangle,
  Check,
  X,
  Star,
  History,
  LayersIcon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { GameState, Card as GameCard, PlayCardRequest, AccusePlayerRequest } from "@shared/schema";

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [showRules, setShowRules] = useState(false);
  const [showRevelation, setShowRevelation] = useState(false);
  const [showGameEnd, setShowGameEnd] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(45);
  
  const playerId = localStorage.getItem("playerId");
  const playerName = localStorage.getItem("playerName");

  // WebSocket connection
  const { connected } = useWebSocket(`/ws`, {
    onMessage: (message) => {
      if (message.type === "game_state" || message.type === "card_played" || message.type === "accusation" || message.type === "revelation") {
        queryClient.setQueryData(["/api/games", gameId], message.data);
        if (message.type === "accusation") {
          setShowRevelation(true);
        } else if (message.type === "revelation" || (message.type === "game_state" && message.data?.phase === "playing")) {
          // Close revelation dialog when game continues
          setShowRevelation(false);
        } else if (message.type === "card_played" && message.data?.phase === "finished") {
          // Show game end when someone wins
          const winningPlayer = message.data.players.find((p: any) => p.cardCount === 0);
          if (winningPlayer) {
            setWinner(winningPlayer.name);
            setShowGameEnd(true);
          }
        }
      }
    },
    onConnect: (ws) => {
      ws.send(JSON.stringify({
        type: 'join_game',
        gameId,
        playerId
      }));
    }
  });

  // Game state query
  const { data: game, isLoading } = useQuery<GameState>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
  });

  // Mutations
  const playCardMutation = useMutation({
    mutationFn: async (request: PlayCardRequest) => {
      const res = await apiRequest("POST", `/api/games/${gameId}/play`, {
        playerId: request.playerId,
        cardId: request.cardId
      });
      return res.json();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const accusePlayerMutation = useMutation({
    mutationFn: async (request: AccusePlayerRequest) => {
      const res = await apiRequest("POST", `/api/games/${gameId}/accuse`, {
        accusingPlayerId: request.accusingPlayerId,
        accusedPlayerId: request.accusedPlayerId
      });
      return res.json();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const continueGameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/games/${gameId}/continue`);
      return res.json();
    },
    onSuccess: () => {
      setShowRevelation(false);
    },
  });

  useEffect(() => {
    if (!playerId || !playerName) {
      navigate("/");
    }
  }, [playerId, playerName, navigate]);

  // Check if game is already finished when component loads or game state updates
  useEffect(() => {
    if (game && game.phase === "finished") {
      const winningPlayer = game.players.find(p => p.cardCount === 0);
      if (winningPlayer && !showGameEnd) {
        setWinner(winningPlayer.name);
        setShowGameEnd(true);
      }
    }
  }, [game, showGameEnd]);

  // Timer management - reset when turn changes
  useEffect(() => {
    if (game?.phase === "playing" || game?.phase === "accusation") {
      setTimeLeft(45);
    }
  }, [game?.currentPlayerId, game?.phase]);

  // Timer countdown
  useEffect(() => {
    if ((game?.phase === "playing" || game?.phase === "accusation") && timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [timeLeft, game?.phase]);

  const handleLeaveGame = () => {
    navigate("/");
  };

  const handlePlayCard = () => {
    if (!selectedCardId || !playerId) return;
    
    playCardMutation.mutate({
      gameId: gameId!,
      playerId,
      cardId: selectedCardId
    });
    setSelectedCardId("");
  };

  const handleAccusePlayer = () => {
    if (!playerId || !game?.lastPlayerId) return;
    
    accusePlayerMutation.mutate({
      gameId: gameId!,
      accusingPlayerId: playerId,
      accusedPlayerId: game.lastPlayerId
    });
  };

  const handleContinueGame = () => {
    continueGameMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Chargement de la partie...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Partie introuvable</h1>
            <Button onClick={() => navigate("/")} className="w-full">
              Retour au lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentPlayer = game.players.find(p => p.id === playerId);
  const otherPlayers = game.players.filter(p => p.id !== playerId);
  const isCurrentPlayerTurn = game.currentPlayerId === playerId;
  const canAccuse = game.lastPlayerId && game.lastPlayerId !== playerId && game.phase === "playing";
  const lastPlayer = game.lastPlayerId ? game.players.find(p => p.id === game.lastPlayerId) : null;
  const selectedCard = currentPlayer?.cards.find(c => c.id === selectedCardId);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[var(--game-secondary)]/80 backdrop-blur-sm border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[var(--game-accent)] rounded-lg flex items-center justify-center">
              <VenetianMask className="text-white text-lg" />
            </div>
            <h1 className="text-2xl font-bold">Menteur</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-300">
              <span>Partie: <span className="text-[var(--game-accent)] font-mono">#{game.id}</span></span>
              <span className="mx-2">•</span>
              <span>{game.players.length}</span>/{game.maxPlayers} joueurs
            </div>
            
            <Button
              onClick={handleLeaveGame}
              variant="destructive"
              size="sm"
            >
              <DoorClosed className="mr-2 h-4 w-4" />
              Quitter
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-7xl mx-auto">
        
        {/* Game Status Bar */}
        <div className="bg-[var(--game-secondary)]/60 backdrop-blur-sm rounded-xl p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-[var(--game-success)] rounded-full animate-pulse"></div>
                <span className="text-lg font-medium">
                  Tour de <span className="text-[var(--game-accent)]">
                    {game.players.find(p => p.id === game.currentPlayerId)?.name}
                  </span>
                </span>
              </div>
              
              <div className="text-sm text-gray-300">
                Cartes en jeu: <span className="text-white font-semibold">{game.centerPile.length}</span>
              </div>

              {game.phase === "finished" && (
                <Badge className="bg-[var(--game-success)] text-white">
                  Partie terminée
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRules(true)}
                className="text-gray-400 hover:text-white"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center space-x-2 text-sm">
                <Clock className={`h-4 w-4 ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-gray-400'}`} />
                <span className={`font-mono ${timeLeft <= 10 ? 'text-red-400 font-bold' : ''}`}>
                  0:{timeLeft.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Game Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Center Game Area */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Other Players Display */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {otherPlayers.map((player) => (
                <div key={player.id} className="bg-[var(--game-secondary)]/40 rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {player.avatar}
                      </div>
                      <span className="font-medium">{player.name}</span>
                      {player.isOnline && (
                        <div className="w-2 h-2 bg-[var(--game-success)] rounded-full"></div>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">{player.cardCount} cartes</span>
                  </div>
                  
                  <div className="flex -space-x-1">
                    {Array.from({ length: Math.min(player.cardCount, 3) }).map((_, i) => (
                      <div key={i} className="w-8 h-12 bg-gradient-to-br from-indigo-600 to-purple-700 rounded border-2 border-gray-600 shadow-md"></div>
                    ))}
                    {player.cardCount > 3 && (
                      <div className="text-sm text-gray-400 ml-2 self-center">+{player.cardCount - 3}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Center Play Area */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-green-800/20 rounded-2xl p-8 border-2 border-emerald-700/30 min-h-64 flex flex-col items-center justify-center relative">
              <div className="absolute top-4 left-4 text-sm text-emerald-300 font-medium">
                <LayersIcon className="inline mr-2 h-4 w-4" />
                Pile centrale
              </div>
              
              <div className="relative">
                {game.centerPile.length > 0 ? (
                  <div className="relative transform -rotate-2">
                    <div className="w-24 h-36 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-gray-600 shadow-2xl absolute"></div>
                    <div className="w-24 h-36 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-gray-600 shadow-2xl absolute transform translate-x-1 translate-y-1"></div>
                    <div className="w-24 h-36 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg border-2 border-gray-600 shadow-2xl relative transform translate-x-2 translate-y-2 flex items-center justify-center">
                      <HelpCircle className="text-white text-2xl" />
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-center">
                    <LayersIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucune carte jouée</p>
                  </div>
                )}
                
                {lastPlayer && (
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
                    <div className="bg-[var(--game-secondary)]/80 backdrop-blur-sm rounded-lg px-3 py-1 text-sm text-emerald-300 border border-emerald-700/50">
                      {lastPlayer.name} a joué une carte
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
          
          {/* Action Panel */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Accusation Button */}
            {canAccuse && (
              <div className="bg-gradient-to-br from-red-900/40 to-red-800/40 rounded-xl p-6 border-2 border-red-700/50">
                <h3 className="text-lg font-bold text-red-300 mb-3 flex items-center">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Accusation
                </h3>
                
                <p className="text-sm text-gray-300 mb-4">
                  Accusez <span className="text-red-300 font-semibold">{lastPlayer?.name}</span> de mentir sur sa dernière carte ?
                </p>
                
                <Button
                  onClick={handleAccusePlayer}
                  disabled={accusePlayerMutation.isPending}
                  className="w-full bg-[var(--game-danger)] hover:bg-red-600 text-white font-bold text-lg py-3 transform hover:scale-105 transition-all"
                >
                  <VenetianMask className="mr-2 h-5 w-5" />
                  MENTEUR !
                </Button>
                
                <div className="mt-3 text-xs text-gray-400 text-center">
                  Risque : +3 cartes si vous vous trompez
                </div>
              </div>
            )}
            
            {/* Game Log */}
            <div className="bg-[var(--game-secondary)]/40 rounded-xl p-4 border border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center">
                <History className="mr-2 h-4 w-4" />
                Historique du jeu
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {game.events.slice(-5).reverse().map((event) => (
                  <div 
                    key={event.id} 
                    className={`text-sm py-2 px-3 rounded-lg ${
                      event.type === "accusation" 
                        ? "bg-red-900/20 border-l-2 border-red-500" 
                        : "bg-[var(--game-secondary)]/30"
                    }`}
                  >
                    {event.message}
                    <span className="text-xs text-gray-400 ml-2">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Player Hand */}
        {currentPlayer && (
          <div className="mt-8 bg-[var(--game-secondary)]/60 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  {currentPlayer.avatar}
                </div>
                Votre main
                <span className="ml-2 text-sm text-gray-400">({currentPlayer.cardCount} cartes)</span>
              </h2>
              
              <div className="text-sm text-gray-300">
                {isCurrentPlayerTurn ? (
                  <span className="text-[var(--game-accent)]">Votre tour - Choisissez une carte à jouer</span>
                ) : (
                  <span>En attente de votre tour</span>
                )}
              </div>
            </div>
            
            {/* Player's Cards */}
            <div className="flex space-x-3 overflow-x-auto pb-4">
              {currentPlayer.cards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => isCurrentPlayerTurn && setSelectedCardId(card.id)}
                  className={`flex-shrink-0 w-20 h-28 rounded-lg border-2 cursor-pointer transform transition-all shadow-lg relative group ${
                    card.type === "truth"
                      ? "bg-gradient-to-br from-[var(--truth-card)] to-emerald-600 border-emerald-500"
                      : "bg-gradient-to-br from-[var(--lie-card)] to-red-600 border-red-500"
                  } ${
                    selectedCardId === card.id
                      ? "ring-2 ring-amber-400 border-amber-400 scale-105"
                      : "hover:scale-105"
                  } ${
                    !isCurrentPlayerTurn ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    {card.type === "truth" ? (
                      <Check className="text-lg mb-1" />
                    ) : (
                      <X className="text-lg mb-1" />
                    )}
                    <span className="text-xs font-bold">
                      {card.type === "truth" ? "VÉRITÉ" : "MENSONGE"}
                    </span>
                  </div>
                  
                  {selectedCardId === card.id && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center">
                      <Star className="text-black text-xs" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"></div>
                </div>
              ))}
            </div>
            
            {/* Play Action */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-300">
                {selectedCard ? (
                  <span>
                    Carte sélectionnée: <span className={`font-semibold ${selectedCard.type === "truth" ? "text-emerald-400" : "text-red-400"}`}>
                      {selectedCard.type === "truth" ? "Vérité" : "Mensonge"}
                    </span>
                  </span>
                ) : (
                  <span>Aucune carte sélectionnée</span>
                )}
              </div>
              
              <Button
                onClick={handlePlayCard}
                disabled={!selectedCardId || !isCurrentPlayerTurn || playCardMutation.isPending}
                className="bg-[var(--game-accent)] hover:bg-amber-600 text-black font-bold transform hover:scale-105 transition-all"
              >
                <div className="mr-2 w-0 h-0 border-l-4 border-l-black border-t-2 border-t-transparent border-b-2 border-b-transparent"></div>
                Jouer la carte
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Rules Modal */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="bg-[var(--game-secondary)] border-gray-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center text-white">
              <HelpCircle className="mr-3 text-[var(--game-accent)]" />
              Règles du jeu
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 text-gray-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🎯 Objectif</h3>
              <p>Soyez le premier joueur à vous débarrasser de toutes vos cartes !</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🎴 Les cartes</h3>
              <ul className="space-y-1 ml-4">
                <li>• <span className="text-[var(--truth-card)] font-semibold">Cartes Vérité</span> : cartes honnêtes</li>
                <li>• <span className="text-[var(--lie-card)] font-semibold">Cartes Mensonge</span> : cartes de bluff</li>
                <li>• Chaque joueur commence avec 7 cartes</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🔄 Déroulement</h3>
              <ol className="space-y-2 ml-4 list-decimal">
                <li>À votre tour, jouez une carte <strong>face cachée</strong> au centre</li>
                <li>Le joueur suivant peut soit :
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>- Jouer une carte à son tour</li>
                    <li>- Cliquer sur <span className="text-[var(--game-danger)] font-bold">"MENTEUR!"</span> pour vous accuser</li>
                  </ul>
                </li>
                <li>Si accusé, votre carte est révélée :
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>- Si c'était un <span className="text-[var(--lie-card)]">Mensonge</span> : vous piochez 3 cartes</li>
                    <li>- Si c'était une <span className="text-[var(--truth-card)]">Vérité</span> : l'accusateur pioche 3 cartes</li>
                  </ul>
                </li>
              </ol>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">🏆 Victoire</h3>
              <p>Le premier joueur à se débarrasser de toutes ses cartes remporte la partie !</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Revelation Modal */}
      <Dialog open={showRevelation} onOpenChange={setShowRevelation}>
        <DialogContent className="bg-[var(--game-secondary)] border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-white">
              Révélation de la carte !
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center space-y-6">
            {game.revealedCard && (
              <>
                <div className="w-32 h-44 mx-auto rounded-xl border-2 flex flex-col items-center justify-center text-white shadow-2xl"
                     style={{
                       background: game.revealedCard.type === "truth" 
                         ? "linear-gradient(to bottom right, var(--truth-card), #059669)"
                         : "linear-gradient(to bottom right, var(--lie-card), #dc2626)",
                       borderColor: game.revealedCard.type === "truth" ? "#10b981" : "#ef4444"
                     }}>
                  {game.revealedCard.type === "truth" ? (
                    <Check className="text-4xl mb-3" />
                  ) : (
                    <X className="text-4xl mb-3" />
                  )}
                  <span className="text-lg font-bold">
                    {game.revealedCard.type === "truth" ? "VÉRITÉ" : "MENSONGE"}
                  </span>
                </div>
                
                <div className="space-y-3 text-gray-300">
                  {(() => {
                    const accusedPlayer = game.players.find(p => p.id === game.lastPlayerId);
                    const accusingPlayer = game.players.find(p => p.id === game.accusingPlayerId);
                    const wasLie = game.revealedCard.type === "lie";
                    
                    return (
                      <>
                        <p>
                          <span className="text-blue-400 font-semibold">{accusedPlayer?.name}</span> avait joué une{" "}
                          <span className={`font-bold ${wasLie ? "text-[var(--lie-card)]" : "text-[var(--truth-card)]"}`}>
                            {wasLie ? "Mensonge" : "Vérité"}
                          </span> !
                        </p>
                        <p>
                          <span className="text-red-400 font-semibold">
                            {wasLie ? accusedPlayer?.name : accusingPlayer?.name}
                          </span>{" "}
                          pioche 3 cartes de pénalité.
                        </p>
                      </>
                    );
                  })()}
                </div>
                
                <Button 
                  onClick={handleContinueGame}
                  disabled={continueGameMutation.isPending}
                  className="bg-[var(--game-accent)] hover:bg-amber-600 text-black font-bold"
                >
                  Continuer le jeu
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Game End Modal */}
      <Dialog open={showGameEnd} onOpenChange={() => {}}>
        <DialogContent className="bg-gradient-to-br from-yellow-900/90 to-amber-900/90 border-yellow-600 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center text-yellow-300 flex items-center justify-center">
              <Star className="mr-3 text-yellow-400" size={32} />
              Partie terminée !
              <Star className="ml-3 text-yellow-400" size={32} />
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-center space-y-6">
            <div className="bg-yellow-400/20 rounded-xl p-6 border border-yellow-600/50">
              <div className="text-6xl mb-4">🏆</div>
              <p className="text-xl text-yellow-200 mb-2">Félicitations !</p>
              <p className="text-2xl font-bold text-yellow-300">
                {winner} a gagné !
              </p>
              <p className="text-sm text-yellow-200 mt-3">
                {winner === playerName ? "Vous avez" : `${winner} a`} réussi à se débarrasser de toutes {winner === playerName ? "vos" : "ses"} cartes !
              </p>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => navigate("/")}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold text-lg py-3"
              >
                Retourner au lobby
              </Button>
              <Button 
                onClick={() => setShowGameEnd(false)}
                variant="ghost"
                className="w-full text-yellow-300 hover:text-yellow-200 hover:bg-yellow-800/30"
              >
                Voir les résultats
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
