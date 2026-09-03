import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ReturnPopup } from "./components/ReturnPopup";

// perf 14:11 — 9 heavy pages lazy (Gallery 441KB + Recaps 277KB etc) → main 1037→509KB
// perf 15:06 — ещё 5 eager pages → lazy: About42/Track/LastFit/Game/GamesHub (~68KB) → main 528→~460KB
// perf 2026-09-02 — HomePage → lazy (eager HomePage держал ~35KB в main) → main 497→~462KB
const HomePage = lazy(() => import("./pages/HomePage").then(m => ({ default: m.HomePage })));
const DiscographyPage = lazy(() => import("./pages/DiscographyPage").then(m => ({ default: m.DiscographyPage })));
const ArtistsPage = lazy(() => import("./pages/ArtistsPage").then(m => ({ default: m.ArtistsPage })));
const ShopPage = lazy(() => import("./pages/ShopPage").then(m => ({ default: m.ShopPage })));
const EcoPage = lazy(() => import("./pages/EcoPage").then(m => ({ default: m.EcoPage })));
const GalleryPage = lazy(() => import("./pages/GalleryPage").then(m => ({ default: m.GalleryPage })));
const MiningPage = lazy(() => import("./pages/MiningPage").then(m => ({ default: m.MiningPage })));
const PresaveRatingPage = lazy(() => import("./pages/PresaveRatingPage").then(m => ({ default: m.PresaveRatingPage })));
const IdeasPage = lazy(() => import("./pages/IdeasPage").then(m => ({ default: m.IdeasPage })));
const RecapsPage = lazy(() => import("./pages/RecapsPage").then(m => ({ default: m.RecapsPage })));
const SquadPage = lazy(() => import("./pages/SquadPage").then(m => ({ default: m.SquadPage })));
const ConveyorPage = lazy(() => import("./pages/ConveyorPage").then(m => ({ default: m.ConveyorPage })));
const ZavriGachaPage = lazy(() => import("./pages/ZavriGachaPage").then(m => ({ default: m.ZavriGachaPage })));
const Map42Page = lazy(() => import("./pages/Map42Page").then(m => ({ default: m.Map42Page })));
// Map42Page kept for legacy deep-links, but /magnum/map now renders Завры 42
const ArenaPage = lazy(() => import("./pages/ArenaPage").then(m => ({ default: m.ArenaPage })));
const Board42Page = lazy(() => import("./pages/Board42Page").then(m => ({ default: m.Board42Page })));
const GachaPage = lazy(() => import("./pages/GachaPage").then(m => ({ default: m.GachaPage })));
const Tour42Page = lazy(() => import("./pages/Tour42Page").then(m => ({ default: m.Tour42Page })));
const Flow42Page = lazy(() => import("./pages/Flow42Page").then(m => ({ default: m.Flow42Page})));
const Chain42Page = lazy(() => import("./pages/Chain42Page").then(m => ({ default: m.Chain42Page})));
// opt 15:06 — 5 оставшихся eager страниц → lazy (тяжёлые чанки >50KB каждый не нужен на /)
const Pass42Page = lazy(() => import("./pages/Pass42Page").then(m => ({ default: m.Pass42Page })));
const Chronicle42Page = lazy(() => import("./pages/Chronicle42Page").then(m => ({ default: m.Chronicle42Page })));
const Crash42Page = lazy(() => import("./pages/Crash42Page").then(m => ({ default: m.Crash42Page })));
const About42Page = lazy(() => import("./pages/About42Page").then(m => ({ default: m.About42Page })));
const TrackPage = lazy(() => import("./pages/TrackPage").then(m => ({ default: m.TrackPage })));
const LastFitPage = lazy(() => import("./pages/LastFitPage").then(m => ({ default: m.LastFitPage })));
const GamePage = lazy(() => import("./pages/GamePage").then(m => ({ default: m.GamePage })));
const GamesHub = lazy(() => import("./pages/GamesHub").then(m => ({ default: m.GamesHub })));
const Studio42Page = lazy(() => import("./pages/Studio42Page").then(m => ({ default: m.Studio42Page })));
const Radio42Page = lazy(() => import("./pages/Radio42Page").then(m => ({ default: m.Radio42Page })));
const ClipBattlePage = lazy(() => import("./pages/ClipBattlePage").then(m => ({ default: m.ClipBattlePage })));
const WorkshopPage = lazy(() => import("./pages/WorkshopPage").then(m => ({ default: m.WorkshopPage })));
const WorkshopProjectPage = lazy(() => import("./pages/WorkshopProjectPage").then(m => ({ default: m.WorkshopProjectPage })));
const WorkshopGalleryPage = lazy(() => import("./pages/WorkshopGalleryPage").then(m => ({ default: m.WorkshopGalleryPage })));
const ShareCardPage = lazy(() => import("./components/ShareCard").then(m => ({ default: m.ShareCardPage })));

function PageFallback() {
  return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#ff2d55" }}>Загрузка…</div>;
}

// — code-split: 16 games lazy + 14 pages lazy → main ~1.06MB → ~460KB expected
const MemoryGame = lazy(() => import("./pages/games/MemoryGame").then(m => ({ default: m.MemoryGame })));
const ClickerGame = lazy(() => import("./pages/games/ClickerGame").then(m => ({ default: m.ClickerGame })));
const Match3Game = lazy(() => import("./pages/games/Match3Game").then(m => ({ default: m.Match3Game })));
const KnifeHitGame = lazy(() => import("./pages/games/KnifeHitGame").then(m => ({ default: m.KnifeHitGame })));
const RunnerGame = lazy(() => import("./pages/games/RunnerGame").then(m => ({ default: m.RunnerGame })));
const RhythmGame = lazy(() => import("./pages/games/RhythmGame").then(m => ({ default: m.RhythmGame })));
const Stack42Game = lazy(() => import("./pages/games/Stack42Game").then(m => ({ default: m.Stack42Game })));
const BlackjackGame = lazy(() => import("./pages/games/BlackjackGame").then(m => ({ default: m.BlackjackGame })));
const RouletteGame = lazy(() => import("./pages/games/RouletteGame").then(m => ({ default: m.RouletteGame })));
const Game2042 = lazy(() => import("./pages/games/Game2042").then(m => ({ default: m.Game2042 })));
const Flappy42Game = lazy(() => import("./pages/games/Flappy42Game").then(m => ({ default: m.Flappy42Game })));
const TypingGame = lazy(() => import("./pages/games/TypingGame").then(m => ({ default: m.TypingGame })));
const Snake42Game = lazy(() => import("./pages/games/Snake42Game").then(m => ({ default: m.Snake42Game })));
const Dodge42Game = lazy(() => import("./pages/games/Dodge42Game").then(m => ({ default: m.Dodge42Game })));
const QuizGame = lazy(() => import("./pages/games/QuizGame").then(m => ({ default: m.QuizGame })));
const Timeline2026Game = lazy(() => import("./pages/games/Timeline2026Game").then(m => ({ default: m.Timeline2026Game })));

function GameFallback() {
  return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#ff2d55" }}>Загрузка игры… 🎮</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ReturnPopup />
      <Routes>
        <Route path="/magnum" element={<Layout />}>
          <Route index element={<Suspense fallback={<PageFallback />}><HomePage /></Suspense>} />
          <Route path="last-fit" element={<Suspense fallback={<PageFallback />}><LastFitPage /></Suspense>} />
          <Route path="track/:slug" element={<Suspense fallback={<PageFallback />}><TrackPage /></Suspense>} />
          <Route path="discography" element={<Suspense fallback={<PageFallback />}><DiscographyPage /></Suspense>} />
          <Route path="42" element={<Suspense fallback={<PageFallback />}><About42Page /></Suspense>} />
          <Route path="about" element={<Navigate to="/magnum/42" replace />} />  {/* P2-1: AboutPage vs About42Page dedupe, redirect /about -> /42 */}
          <Route path="artists" element={<Suspense fallback={<PageFallback />}><ArtistsPage /></Suspense>} />
          <Route path="game" element={<Suspense fallback={<PageFallback />}><GamePage /></Suspense>} />
          <Route path="games" element={<Suspense fallback={<PageFallback />}><GamesHub /></Suspense>} />
          <Route path="games/runner" element={<Suspense fallback={<GameFallback />}><RunnerGame /></Suspense>} />
          <Route path="games/match3" element={<Suspense fallback={<GameFallback />}><Match3Game /></Suspense>} />
          <Route path="games/knife" element={<Suspense fallback={<GameFallback />}><KnifeHitGame /></Suspense>} />
          <Route path="games/memory" element={<Suspense fallback={<GameFallback />}><MemoryGame /></Suspense>} />
          <Route path="games/clicker" element={<Suspense fallback={<GameFallback />}><ClickerGame /></Suspense>} />
          <Route path="games/rhythm" element={<Suspense fallback={<GameFallback />}><RhythmGame /></Suspense>} />
          <Route path="games/stack" element={<Suspense fallback={<GameFallback />}><Stack42Game /></Suspense>} />
          <Route path="games/blackjack" element={<Suspense fallback={<GameFallback />}><BlackjackGame /></Suspense>} />
          <Route path="games/roulette" element={<Suspense fallback={<GameFallback />}><RouletteGame /></Suspense>} />
          <Route path="games/2042" element={<Suspense fallback={<GameFallback />}><Game2042 /></Suspense>} />
          <Route path="games/flappy" element={<Suspense fallback={<GameFallback />}><Flappy42Game /></Suspense>} />
          <Route path="games/typing" element={<Suspense fallback={<GameFallback />}><TypingGame /></Suspense>} />
          <Route path="games/snake" element={<Suspense fallback={<GameFallback />}><Snake42Game /></Suspense>} />
          <Route path="games/dodge" element={<Suspense fallback={<GameFallback />}><Dodge42Game /></Suspense>} />
          <Route path="games/quiz" element={<Suspense fallback={<GameFallback />}><QuizGame /></Suspense>} />
          <Route path="games/timeline" element={<Suspense fallback={<GameFallback />}><Timeline2026Game /></Suspense>} />
          <Route path="shop" element={<Suspense fallback={<PageFallback />}><ShopPage /></Suspense>} />
          <Route path="eco" element={<Suspense fallback={<PageFallback />}><EcoPage /></Suspense>} />
          <Route path="gallery" element={<Suspense fallback={<PageFallback />}><GalleryPage /></Suspense>} />
          <Route path="mining" element={<Suspense fallback={<PageFallback />}><MiningPage /></Suspense>} />
          <Route path="presave-rating" element={<Suspense fallback={<PageFallback />}><PresaveRatingPage /></Suspense>} />
          <Route path="ideas" element={<Suspense fallback={<PageFallback />}><IdeasPage /></Suspense>} />
          <Route path="recaps" element={<Suspense fallback={<PageFallback />}><RecapsPage /></Suspense>} />
          <Route path="squad" element={<Suspense fallback={<PageFallback />}><SquadPage /></Suspense>} />
          <Route path="conveyor" element={<Suspense fallback={<PageFallback />}><ConveyorPage /></Suspense>} />
          <Route path="map" element={<Suspense fallback={<PageFallback />}><ZavriGachaPage /></Suspense>} />
          <Route path="zavri" element={<Suspense fallback={<PageFallback />}><ZavriGachaPage /></Suspense>} />
          <Route path="map-legacy" element={<Suspense fallback={<PageFallback />}><Map42Page /></Suspense>} />
          <Route path="arena" element={<Suspense fallback={<PageFallback />}><ArenaPage /></Suspense>} />
          <Route path="studio" element={<Suspense fallback={<PageFallback />}><Studio42Page /></Suspense>} />
          <Route path="share-card" element={<Suspense fallback={<PageFallback />}><ShareCardPage /></Suspense>} />
          <Route path="board" element={<Suspense fallback={<PageFallback />}><Board42Page /></Suspense>} />
          <Route path="gacha" element={<Suspense fallback={<PageFallback />}><GachaPage /></Suspense>} />
          <Route path="tour" element={<Suspense fallback={<PageFallback />}><Tour42Page /></Suspense>} />
          <Route path="flow" element={<Suspense fallback={<PageFallback />}><Flow42Page /></Suspense>} />
          <Route path="chain" element={<Suspense fallback={<PageFallback />}><Chain42Page /></Suspense>} />
          <Route path="chain/join/:code" element={<Suspense fallback={<PageFallback />}><Chain42Page /></Suspense>} />
          <Route path="pass" element={<Suspense fallback={<PageFallback />}><Pass42Page /></Suspense>} />
          <Route path="chronicle" element={<Suspense fallback={<PageFallback />}><Chronicle42Page /></Suspense>} />
          <Route path="radio" element={<Suspense fallback={<PageFallback />}><Radio42Page /></Suspense>} />
          <Route path="crash" element={<Suspense fallback={<PageFallback />}><Crash42Page /></Suspense>} />
          <Route path="clip-battle" element={<Suspense fallback={<PageFallback />}><ClipBattlePage /></Suspense>} />
          <Route path="workshop" element={<Suspense fallback={<PageFallback />}><WorkshopPage /></Suspense>} />
          <Route path="workshop/:id" element={<Suspense fallback={<PageFallback />}><WorkshopProjectPage /></Suspense>} />
          <Route path="workshop-gallery" element={<Suspense fallback={<PageFallback />}><WorkshopGalleryPage /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
