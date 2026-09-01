import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const magnumUsers = pgTable("magnum_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumSessions = pgTable("magnum_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  expiresAt: timestamp("expires_at"),
});

export const magnumCoins = pgTable("magnum_coins", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => magnumUsers.id),
  balance: integer("balance").default(1000),
});

export const magnumMining = pgTable("magnum_mining", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => magnumUsers.id),
  balance: integer("balance").default(0).notNull(),
  upgrades: jsonb("upgrades").default([]).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const magnumIdeas = pgTable("magnum_ideas", {
  id: serial("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  votes: integer("votes").default(0),
  status: text("status").default("pending"),
  userId: integer("user_id").references(() => magnumUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumLeaderboard = pgTable("magnum_leaderboard", {
  id: serial("id").primaryKey(),
  player: text("player"),
  score: integer("score"),
  game: text("game"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumShopInventory = pgTable("magnum_shop_inventory", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  skinId: text("skin_id"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  equipped: boolean("equipped").default(false),
});

export const magnumEcoResults = pgTable("magnum_eco_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  player: text("player"),
  score: integer("score"),
  rank: text("rank"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumFrames = pgTable("magnum_frames", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  verified: boolean("verified"),
  createdAt: timestamp("created_at").defaultNow(),
});
