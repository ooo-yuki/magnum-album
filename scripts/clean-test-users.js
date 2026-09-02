const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL_UNPOOLED);

// tagged template работает, unsafe возвращает не-массив. Делаем per-user функцию с tagged шаблонами.
async function purgeUser(uid, username) {
  const del = async (t) => { try { await sql`DELETE FROM ${sql(t)} WHERE user_id = ${uid}`; } catch (e) {} };
  // neon-хак: имя таблицы нельзя параметризовать — но sql(...) ошибку даёт. Используем switch по белому списку.
  for (const t of LIST) {
    if (t === "presave_clicks") try { await sql`DELETE FROM magnum_presave_clicks WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "user_achievements") try { await sql`DELETE FROM magnum_user_achievements WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "user_notifications") try { await sql`DELETE FROM magnum_user_notifications WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "eco_results") try { await sql`DELETE FROM magnum_eco_results WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "frames") try { await sql`DELETE FROM magnum_frames WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "shop_inventory") try { await sql`DELETE FROM magnum_shop_inventory WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "sessions") try { await sql`DELETE FROM magnum_sessions WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "mining") try { await sql`DELETE FROM magnum_mining WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "transactions") try { await sql`DELETE FROM magnum_transactions WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "idea_votes") try { await sql`DELETE FROM magnum_idea_votes WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "mining_vault") try { await sql`DELETE FROM magnum_mining_vault WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "notifications") try { await sql`DELETE FROM magnum_notifications WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "promo_redemptions") try { await sql`DELETE FROM magnum_promo_redemptions WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "idea_bookmarks") try { await sql`DELETE FROM magnum_idea_bookmarks WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "subscriptions") try { await sql`DELETE FROM magnum_subscriptions WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "game_scores") try { await sql`DELETE FROM magnum_game_scores WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "referrals") try { await sql`DELETE FROM magnum_referrals WHERE inviter_id = ${uid} OR invited_id = ${uid}`; } catch (e) {}
    else if (t === "chat_messages") try { await sql`DELETE FROM magnum_chat_messages WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "eco_ratings") try { await sql`DELETE FROM magnum_eco_ratings WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "follows") try { await sql`DELETE FROM magnum_follows WHERE follower_id = ${uid} OR following_id = ${uid}`; } catch (e) {}
    else if (t === "ai_usage") try { await sql`DELETE FROM magnum_ai_usage WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "mining_exchanges") try { await sql`DELETE FROM magnum_mining_exchanges WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "reports") try { await sql`DELETE FROM magnum_reports WHERE reporter_id = ${uid}`; } catch (e) {}
    else if (t === "moderation_log") try { await sql`DELETE FROM magnum_moderation_log WHERE actor_id = ${uid}`; } catch (e) {}
    else if (t === "idea_comments") try { await sql`DELETE FROM magnum_idea_comments WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "conveyor_state") try { await sql`DELETE FROM magnum_conveyor_state WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "duel_invites") try { await sql`DELETE FROM magnum_duel_invites WHERE from_user_id = ${uid} OR to_user_id = ${uid}`; } catch (e) {}
    else if (t === "duel_wagers") try { await sql`DELETE FROM magnum_duel_wagers WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "dust") try { await sql`DELETE FROM magnum_dust WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "mining_boosts") try { await sql`DELETE FROM magnum_mining_boosts WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "squad_battles") try { await sql`DELETE FROM magnum_squad_battles WHERE winner_id = ${uid}`; } catch (e) {}
    else if (t === "squad_members") try { await sql`DELETE FROM magnum_squad_members WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "squads") try { await sql`DELETE FROM magnum_squads WHERE leader_id = ${uid}`; } catch (e) {}
    else if (t === "eco_challenges") try { await sql`DELETE FROM magnum_eco_challenges WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "eco_shares") try { await sql`DELETE FROM magnum_eco_shares WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "map_progress") try { await sql`DELETE FROM magnum_map_progress WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "map_events") try { await sql`DELETE FROM magnum_map_events WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "map_shares") try { await sql`DELETE FROM magnum_map_shares WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "ideas") try { await sql`DELETE FROM magnum_ideas WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "cosmetics") try { await sql`DELETE FROM magnum_cosmetics WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "daily_claims") try { await sql`DELETE FROM magnum_daily_claims WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "coins") try { await sql`DELETE FROM magnum_coins WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "gacha_history") try { await sql`DELETE FROM magnum_gacha_history WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "pity") try { await sql`DELETE FROM magnum_pity WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "gacha_quests") try { await sql`DELETE FROM magnum_gacha_quests WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "pass_progress") try { await sql`DELETE FROM magnum_pass_progress WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "pets") try { await sql`DELETE FROM magnum_pets WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_collection") try { await sql`DELETE FROM magnum_zavri_collection WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_pity") try { await sql`DELETE FROM magnum_zavri_pity WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_history") try { await sql`DELETE FROM magnum_zavri_history WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_shards") try { await sql`DELETE FROM magnum_zavri_shards WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_begs") try { await sql`DELETE FROM magnum_zavri_begs WHERE user_id = ${uid}`; } catch (e) {}
    else if (t === "zavri_breeds") try { await sql`DELETE FROM magnum_zavri_breeds WHERE user_id = ${uid}`; } catch (e) {}
  }
  try { await sql`DELETE FROM magnum_leaderboard WHERE player = ${username}`; } catch (e) {}
  await sql`DELETE FROM magnum_users WHERE id = ${uid}`;
}

const LIST = [
  "presave_clicks","user_achievements","user_notifications","eco_results","frames","shop_inventory",
  "sessions","mining","transactions","idea_votes","mining_vault","notifications","promo_redemptions",
  "idea_bookmarks","subscriptions","game_scores","referrals","chat_messages","eco_ratings","follows",
  "ai_usage","mining_exchanges","reports","moderation_log","idea_comments","conveyor_state",
  "duel_invites","duel_wagers","dust","mining_boosts","squad_battles","squad_members","squads",
  "eco_challenges","eco_shares","map_progress","map_events","map_shares","ideas","cosmetics",
  "daily_claims","coins","gacha_history","pity","gacha_quests","pass_progress","pets","zavri_collection","zavri_pity","zavri_history","zavri_shards","zavri_begs","zavri_breeds",
];

(async () => {
  const junk = await sql`SELECT id, username FROM magnum_users WHERE username ~ '^(test_|dbg|dbg2|achtest_|notif_|promo_|ag_test_|hypebot42_test|testguardian2|__probe_|e2e_|brat-[a-z0-9]{6}$|123123$|hypebot42$|rukbyqte$)'`;
  console.log("к чистке:", junk.length, junk.map(j => j.username).join(","));
  for (const u of junk) {
    await purgeUser(u.id, u.username);
    console.log("удалён:", u.username);
  }
  const left = await sql`SELECT id, username FROM magnum_users ORDER BY id`;
  console.log("ФИНАЛ юзеры:", JSON.stringify(left));
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
