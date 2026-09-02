import { describe, it, expect } from "bun:test";

// Test the pure game logic functions by importing the module
// We test the grid logic independently of React

// ---- Inline logic mirrors (extracted from Game2042.tsx for testability) ----
const SIZE = 4;

type Grid = number[][];

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0) as number[]);
}

function slide(row: number[]): { row: number[]; score: number; moved: boolean } {
  const filtered = row.filter((v) => v !== 0);
  let score = 0;
  const merged: number[] = [];
  let moved = false;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const val = filtered[i]! * 2;
      merged.push(val);
      score += val;
      i++;
    } else {
      merged.push(filtered[i]!);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  for (let i = 0; i < SIZE; i++) {
    if (merged[i] !== row[i]) moved = true;
  }
  return { row: merged, score, moved };
}

function moveGrid(g: Grid, dir: "up" | "down" | "left" | "right"): { grid: Grid; score: number; moved: boolean } {
  let totalScore = 0;
  let anyMoved = false;
  const ng = g.map((r) => [...r]);

  const getRow = (i: number): number[] => {
    if (dir === "left") return [...ng[i]!];
    if (dir === "right") return [...ng[i]!].reverse();
    if (dir === "up") return Array.from({ length: SIZE }, (_, k) => ng[k]![i]!);
    return Array.from({ length: SIZE }, (_, k) => ng[SIZE - 1 - k]![i]!);
  };

  const setRow = (i: number, row: number[]) => {
    if (dir === "left") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[k]!; }
    else if (dir === "right") { for (let k = 0; k < SIZE; k++) ng[i]![k] = row[SIZE - 1 - k]!; }
    else if (dir === "up") { for (let k = 0; k < SIZE; k++) ng[k]![i] = row[k]!; }
    else { for (let k = 0; k < SIZE; k++) ng[SIZE - 1 - k]![i] = row[k]!; }
  };

  for (let i = 0; i < SIZE; i++) {
    const { row: result, score, moved } = slide(getRow(i));
    setRow(i, result);
    totalScore += score;
    if (moved) anyMoved = true;
  }

  return { grid: ng, score: totalScore, moved: anyMoved };
}

function canMove(g: Grid): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (g[r]![c] === 0) return true;
      if (c + 1 < SIZE && g[r]![c] === g[r]![c + 1]) return true;
      if (r + 1 < SIZE && g[r]![c] === g[r + 1]![c]) return true;
    }
  return false;
}

// ---- Tests ----

describe("game-2042: slide logic", () => {
  it("merges two equal tiles", () => {
    const { row, score } = slide([2, 2, 0, 0]);
    expect(row).toEqual([4, 0, 0, 0]);
    expect(score).toBe(4);
  });

  it("slides tiles left without merge", () => {
    const { row, moved } = slide([0, 2, 0, 4]);
    expect(row).toEqual([2, 4, 0, 0]);
    expect(moved).toBe(true);
  });

  it("does not chain-merge (2048 rules)", () => {
    const { row } = slide([2, 2, 4, 0]);
    expect(row).toEqual([4, 4, 0, 0]);
  });

  it("merges multiple pairs", () => {
    const { row, score } = slide([4, 4, 4, 4]);
    expect(row).toEqual([8, 8, 0, 0]);
    expect(score).toBe(16);
  });

  it("no movement returns moved=false", () => {
    const { moved } = slide([2, 4, 8, 16]);
    expect(moved).toBe(false);
  });

  it("handles all zeros", () => {
    const { row, score, moved } = slide([0, 0, 0, 0]);
    expect(row).toEqual([0, 0, 0, 0]);
    expect(score).toBe(0);
    expect(moved).toBe(false);
  });
});

describe("game-2042: moveGrid", () => {
  it("left move merges row 0", () => {
    const g: Grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const { grid, score, moved } = moveGrid(g, "left");
    expect(grid[0]).toEqual([4, 0, 0, 0]);
    expect(score).toBe(4);
    expect(moved).toBe(true);
  });

  it("right move pushes to end", () => {
    const g: Grid = [
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const { grid } = moveGrid(g, "right");
    expect(grid[0]).toEqual([0, 0, 0, 2]);
  });

  it("up move merges column", () => {
    const g: Grid = [
      [4, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const { grid, score } = moveGrid(g, "up");
    expect(grid[0]![0]).toBe(8);
    expect(grid[1]![0]).toBe(0);
    expect(score).toBe(8);
  });

  it("down move merges column to bottom", () => {
    const g: Grid = [
      [8, 0, 0, 0],
      [8, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const { grid } = moveGrid(g, "down");
    expect(grid[3]![0]).toBe(16);
  });

  it("no-op move returns moved=false", () => {
    const g: Grid = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const { moved } = moveGrid(g, "left");
    expect(moved).toBe(false);
  });
});

describe("game-2042: canMove", () => {
  it("empty cell means can move", () => {
    expect(canMove([[2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]])).toBe(true);
  });

  it("adjacent equal means can move", () => {
    expect(canMove([[2, 2, 8, 16], [4, 8, 16, 32], [64, 128, 256, 512], [1024, 2048, 2, 4]])).toBe(true);
  });

  it("full board no merges = game over", () => {
    expect(canMove([
      [2, 4, 8, 16],
      [32, 64, 128, 256],
      [512, 1024, 2, 4],
      [8, 16, 32, 64],
    ])).toBe(false);
  });
});
