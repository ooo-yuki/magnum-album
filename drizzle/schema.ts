import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const magnumIdeas = pgTable("magnum_ideas", {
  id: serial("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  votes: integer("votes").default(0),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumLeaderboard = pgTable("magnum_leaderboard", {
  id: serial("id").primaryKey(),
  player: text("player"),
  score: integer("score"),
  game: text("game"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumEcoResults = pgTable("magnum_eco_results", {
  id: serial("id").primaryKey(),
  player: text("player"),
  score: integer("score"),
  rank: text("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumShopInventory = pgTable("magnum_shop_inventory", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  skinId: text("skin_id"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const magnumFrames = pgTable("magnum_frames", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  verified: boolean("verified"),
  createdAt: timestamp("created_at").defaultNow(),
});
