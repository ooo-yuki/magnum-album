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

export const magnumCosmetics = pgTable("magnum_cosmetics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  cosmeticId: text("cosmetic_id").notNull(),
  slot: text("slot").notNull(),
  equipped: boolean("equipped").default(false),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const magnumPresaveClicks = pgTable("magnum_presave_clicks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  url: text("url").default("/magnum"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const magnumDailyClaims = pgTable("magnum_daily_claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  streak: integer("streak").default(1).notNull(),
  reward: integer("reward").default(42).notNull(),
});

export const magnumTransactions = pgTable("magnum_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  meta: jsonb("meta").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumIdeaVotes = pgTable("magnum_idea_votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  ideaId: integer("idea_id").references(() => magnumIdeas.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumUserAchievements = pgTable("magnum_user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  achievementId: text("achievement_id").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

export const magnumMiningVault = pgTable("magnum_mining_vault", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  vaultId: text("vault_id").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

export const magnumNotifications = pgTable("magnum_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").default("info").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumIdeaBookmarks = pgTable("magnum_idea_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  ideaId: integer("idea_id").references(() => magnumIdeas.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumPromoCodes = pgTable("magnum_promo_codes", {
  code: text("code").primaryKey(),
  reward: integer("reward").notNull(),
  maxUses: integer("max_uses").default(1000),
  uses: integer("uses").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumPromoRedemptions = pgTable("magnum_promo_redemptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  code: text("code").references(() => magnumPromoCodes.code).notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});

export const magnumGameScores = pgTable("magnum_game_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  game: text("game").notNull(),
  score: integer("score").notNull(),
  coinsEarned: integer("coins_earned").default(0).notNull(),
  meta: jsonb("meta").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumReferrals = pgTable("magnum_referrals", {
  id: serial("id").primaryKey(),
  inviterId: integer("inviter_id").references(() => magnumUsers.id).notNull(),
  invitedId: integer("invited_id").references(() => magnumUsers.id).notNull(),
  code: text("code").notNull(),
  rewardClaimed: boolean("reward_claimed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumDuelHistory = pgTable("magnum_duel_history", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  winner: text("winner"),
  scores: jsonb("scores").default([]).notNull(),
  durationSec: integer("duration_sec").default(10).notNull(),
  playerCount: integer("player_count").default(2).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumEcoRatings = pgTable("magnum_eco_ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  player: text("player"),
  score: integer("score").notNull(),
  rating: integer("rating").notNull(),
  tier: text("tier").notNull(),
  answers: jsonb("answers").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumMiningExchanges = pgTable("magnum_mining_exchanges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  miningAmount: integer("mining_amount").notNull(),
  coinsAmount: integer("coins_amount").notNull(),
  rate: integer("rate").default(10).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumIdeaComments = pgTable("magnum_idea_comments", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").references(() => magnumIdeas.id).notNull(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumReports = pgTable("magnum_reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").references(() => magnumUsers.id).notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumModerationLog = pgTable("magnum_moderation_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => magnumUsers.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  meta: jsonb("meta").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumDuelSeasons = pgTable("magnum_duel_seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumDuelInvites = pgTable("magnum_duel_invites", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => magnumUsers.id).notNull(),
  toUserId: integer("to_user_id").references(() => magnumUsers.id).notNull(),
  roomId: text("room_id").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumDuelWagers = pgTable("magnum_duel_wagers", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumMiningBoosts = pgTable("magnum_mining_boosts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  until: timestamp("until").notNull(),
  price: integer("price").default(142).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumChatMessages = pgTable("magnum_chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id).notNull(),
  body: text("body").notNull(),
  replyTo: integer("reply_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumFollows = pgTable("magnum_follows", {
  id: serial("id").primaryKey(),
  followerId: integer("follower_id").references(() => magnumUsers.id).notNull(),
  followingId: integer("following_id").references(() => magnumUsers.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumAiUsage = pgTable("magnum_ai_usage", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => magnumUsers.id),
  ip: text("ip").notNull(),
  hasImage: boolean("has_image").default(false).notNull(),
  model: text("model").default("mimo-v2.5").notNull(),
  tokensRequested: integer("tokens_requested").default(400).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const magnumSubscriptions = pgTable("magnum_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => magnumUsers.id, { onDelete: "cascade" }),
  tier: text("tier").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const magnumDust = pgTable("magnum_dust", {
  userId: integer("user_id").primaryKey().references(() => magnumUsers.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const magnumSquads = pgTable("magnum_squads", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  leaderId: integer("leader_id").references(() => magnumUsers.id).notNull(),
  pot: integer("pot").default(0).notNull(),
  mult: integer("mult").default(10).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const magnumSquadMembers = pgTable("magnum_squad_members", {
  id: serial("id").primaryKey(),
  squadId: integer("squad_id").references(() => magnumSquads.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => magnumUsers.id, { onDelete: "cascade" }).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export const magnumSquadBattles = pgTable("magnum_squad_battles", {
  id: serial("id").primaryKey(),
  squadId: integer("squad_id").references(() => magnumSquads.id, { onDelete: "cascade" }).notNull(),
  winnerId: integer("winner_id").references(() => magnumUsers.id),
  score: jsonb("score").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const magnumConveyorState = pgTable("magnum_conveyor_state", {
  userId: integer("user_id").primaryKey().references(() => magnumUsers.id, { onDelete: "cascade" }),
  levels: integer("levels").array().default([0, 0, 0, 0, 0, 0]).notNull(),
  prestige: integer("prestige").default(0).notNull(),
  lastClaim: timestamp("last_claim").defaultNow().notNull(),
  dust: integer("dust").default(0).notNull(),
});
