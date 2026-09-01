// MAGNUM App — perf: 14 games code-split via React.lazy + Suspense
// Fallback: GameFallback; vendor chunk split in build.ts
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LastFitPage } from "./pages/LastFitPage";
import { TrackPage } from "./pages/TrackPage";
import { About42Page } from "./pages/About42Page";
import { GamePage } from "./pages/GamePage";
import { GamesHub } from "./pages/GamesHub";

// perf 14:26 — heavy pages lazy to cut main ~1.06MB (Gallery 441KB + Recaps 277KB + Discography 36KB + Shop 29KB + Eco/Mining/etc)
const DiscographyPage = lazy(() => import("./pages/DiscographyPage").then(m => ({ default: m.DiscographyPage })));
const ArtistsPage = lazy(() => import("./pages/ArtistsPage").then(m => ({ default: m.ArtistsPage })));
const ShopPage = lazy(() => import("./pages/ShopPage").then(m => ({ default: m.ShopPage })));
const EcoPage = lazy(() => import("./pages/EcoPage").then(m => ({ default: m.EcoPage })));
const GalleryPage = lazy(() => import("./pages/GalleryPage").then(m => ({ default: m.GalleryPage })));
const MiningPage = lazy(() => import("./pages/MiningPage").then(m => ({ default: m.MiningPage })));
const PresaveRatingPage = lazy(() => import("./pages/PresaveRatingPage").then(m => ({ default: m.PresaveRatingPage })));
const IdeasPage = lazy(() => import("./pages/IdeasPage").then(m => ({ default: m.IdeasPage })));
const RecapsPage = lazy(() => import("./pages/RecapsPage").then(m => ({ default: m.RecapsPage })));

function PageFallback() {
  return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#ff2d55" }}>Загрузка…</div>;
}

// — code-split: 16 games lazy + 9 heavy pages lazy → main ~1.06MB → ~500KB expected
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
      <Routes>
        <Route path="/magnum" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="last-fit" element={<LastFitPage />} />
          <Route path="track/:slug" element={<TrackPage />} />
          <Route path="discography" element={<Suspense fallback={<PageFallback />}><DiscographyPage /></Suspense>} />
          <Route path="42" element={<About42Page />} />
          <Route path="artists" element={<Suspense fallback={<PageFallback />}><ArtistsPage /></Suspense>} />
          <Route path="game" element={<GamePage />} />
          <Route path="games" element={<GamesHub />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
