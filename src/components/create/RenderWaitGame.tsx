"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };
const GAME_SPEED = 150;

type Position = { x: number; y: number };

interface RenderWaitGameProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
}

export function RenderWaitGame({ 
  open, 
  onClose,
  title = "Your video is rendering...",
  description = "Play a quick game while you wait!"
}: RenderWaitGameProps) {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Position>(INITIAL_DIRECTION);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const directionRef = useRef<Position>(INITIAL_DIRECTION);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);

  // Generate random food position
  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  }, []);

  // Check collision
  const checkCollision = useCallback((head: Position, body: Position[]): boolean => {
    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true;
    }
    // Self collision
    return body.some((segment, index) => {
      if (index === 0) return false;
      return segment.x === head.x && segment.y === head.y;
    });
  }, []);

  // Game loop
  useEffect(() => {
    if (!open || gameOver || isPaused) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    gameLoopRef.current = setInterval(() => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };
        const newDirection = directionRef.current;
        
        head.x += newDirection.x;
        head.y += newDirection.y;

        // Check collision
        if (checkCollision(head, prevSnake)) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check if food eaten
        if (head.x === food.x && head.y === food.y) {
          setScore((prev) => prev + 10);
          setFood(generateFood());
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, GAME_SPEED);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [open, gameOver, isPaused, food, checkCollision, generateFood]);

  // Handle keyboard input
  useEffect(() => {
    if (!open || gameOver) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (isPaused && e.key !== " ") return;

      const key = e.key.toLowerCase();
      const currentDir = directionRef.current;

      switch (key) {
        case "arrowup":
        case "w":
          if (currentDir.y === 0) {
            directionRef.current = { x: 0, y: -1 };
            setDirection({ x: 0, y: -1 });
          }
          break;
        case "arrowdown":
        case "s":
          if (currentDir.y === 0) {
            directionRef.current = { x: 0, y: 1 };
            setDirection({ x: 0, y: 1 });
          }
          break;
        case "arrowleft":
        case "a":
          if (currentDir.x === 0) {
            directionRef.current = { x: -1, y: 0 };
            setDirection({ x: -1, y: 0 });
          }
          break;
        case "arrowright":
        case "d":
          if (currentDir.x === 0) {
            directionRef.current = { x: 1, y: 0 };
            setDirection({ x: 1, y: 0 });
          }
          break;
        case " ":
          e.preventDefault();
          setIsPaused((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [open, gameOver, isPaused]);

  // Reset game
  const resetGame = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(generateFood());
    setDirection(INITIAL_DIRECTION);
    directionRef.current = INITIAL_DIRECTION;
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
  }, [generateFood]);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      resetGame();
    }
  }, [open, resetGame]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Score and Controls */}
          <div className="flex items-center justify-between w-full px-2">
            <div className="text-lg font-semibold">Score: {score}</div>
            {gameOver && (
              <Button onClick={resetGame} size="sm" variant="outline">
                Play Again
              </Button>
            )}
            {!gameOver && (
              <Button 
                onClick={() => setIsPaused(!isPaused)} 
                size="sm" 
                variant="outline"
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
            )}
          </div>

          {/* Game Board */}
          <div 
            className="relative border-2 border-gray-300 rounded-lg bg-gray-50"
            style={{
              width: GRID_SIZE * CELL_SIZE,
              height: GRID_SIZE * CELL_SIZE,
            }}
          >
            {/* Food */}
            <div
              className="absolute rounded-full bg-red-500"
              style={{
                left: food.x * CELL_SIZE,
                top: food.y * CELL_SIZE,
                width: CELL_SIZE - 2,
                height: CELL_SIZE - 2,
              }}
            />

            {/* Snake */}
            {snake.map((segment, index) => (
              <div
                key={index}
                className={`absolute rounded ${
                  index === 0 ? "bg-green-600" : "bg-green-400"
                }`}
                style={{
                  left: segment.x * CELL_SIZE,
                  top: segment.y * CELL_SIZE,
                  width: CELL_SIZE - 2,
                  height: CELL_SIZE - 2,
                }}
              />
            ))}

            {/* Game Over Overlay */}
            {gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-center text-white">
                  <div className="text-2xl font-bold mb-2">Game Over!</div>
                  <div className="text-lg">Final Score: {score}</div>
                </div>
              </div>
            )}

            {/* Pause Overlay */}
            {isPaused && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                <div className="text-center text-white text-xl font-bold">
                  Paused
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 text-center space-y-1">
            <div>Use Arrow Keys or WASD to move</div>
            <div>Press Space to pause</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

