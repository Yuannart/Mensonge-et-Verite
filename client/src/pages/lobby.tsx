import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { VenetianMask, Users, Play, Plus } from "lucide-react";
import type { CreateGameRequest, JoinGameRequest } from "@shared/schema";

export default function Lobby() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [playerName, setPlayerName] = useState("");
  const [gameId, setGameId] = useState("");

  const createGameMutation = useMutation({
    mutationFn: async (request: CreateGameRequest) => {
      const res = await apiRequest("POST", "/api/games", request);
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("playerName", playerName);
      navigate(`/game/${data.game.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const joinGameMutation = useMutation({
    mutationFn: async (request: JoinGameRequest) => {
      const res = await apiRequest("POST", "/api/games/join", request);
      return res.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("playerId", data.playerId);
      localStorage.setItem("playerName", playerName);
      navigate(`/game/${data.game.id}`);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateGame = () => {
    if (!playerName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre nom",
        variant: "destructive",
      });
      return;
    }
    createGameMutation.mutate({ playerName: playerName.trim() });
  };

  const handleJoinGame = () => {
    if (!playerName.trim() || !gameId.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre nom et l'ID de la partie",
        variant: "destructive",
      });
      return;
    }
    joinGameMutation.mutate({ 
      gameId: gameId.trim().toUpperCase(), 
      playerName: playerName.trim() 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-[var(--game-accent)] rounded-lg flex items-center justify-center">
              <VenetianMask className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold">Menteur</h1>
          </div>
          <p className="text-gray-300">Jeu de cartes multijoueur de bluff</p>
        </div>

        {/* Player Name Input */}
        <Card className="bg-[var(--game-secondary)]/60 backdrop-blur-sm border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Nom du joueur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playerName" className="text-gray-300">
                Entrez votre nom
              </Label>
              <Input
                id="playerName"
                placeholder="Votre nom..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-[var(--game-secondary)] border-gray-600 text-white placeholder:text-gray-400"
                maxLength={20}
              />
            </div>
          </CardContent>
        </Card>

        {/* Create Game */}
        <Card className="bg-[var(--game-secondary)]/60 backdrop-blur-sm border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Créer une partie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleCreateGame}
              disabled={createGameMutation.isPending}
              className="w-full bg-[var(--game-accent)] hover:bg-amber-600 text-black font-bold"
            >
              {createGameMutation.isPending ? (
                "Création..."
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Créer une nouvelle partie
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center">
          <Separator className="flex-1 bg-gray-600" />
          <span className="px-4 text-gray-400 text-sm">ou</span>
          <Separator className="flex-1 bg-gray-600" />
        </div>

        {/* Join Game */}
        <Card className="bg-[var(--game-secondary)]/60 backdrop-blur-sm border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Rejoindre une partie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gameId" className="text-gray-300">
                ID de la partie
              </Label>
              <Input
                id="gameId"
                placeholder="Ex: AB12CD"
                value={gameId}
                onChange={(e) => setGameId(e.target.value.toUpperCase())}
                className="bg-[var(--game-secondary)] border-gray-600 text-white placeholder:text-gray-400 font-mono"
                maxLength={6}
              />
            </div>
            <Button
              onClick={handleJoinGame}
              disabled={joinGameMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {joinGameMutation.isPending ? (
                "Connexion..."
              ) : (
                <>
                  <Users className="h-4 w-4 mr-2" />
                  Rejoindre la partie
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card className="bg-[var(--game-secondary)]/40 backdrop-blur-sm border-gray-700">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm text-gray-300">
              <h3 className="font-semibold text-white">🎯 Règles rapides :</h3>
              <ul className="space-y-1 ml-4">
                <li>• Débarrassez-vous de toutes vos cartes</li>
                <li>• Jouez des cartes face cachée</li>
                <li>• Accusez les menteurs avec "MENTEUR!"</li>
                <li>• Pénalité : +3 cartes si vous vous trompez</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
