// MAGNUM App — perf: 14 games code-split via React.lazy + Suspense
// Fallback: GameFallback; vendor chunk split in build.ts
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LastFitPage } from "./pages/LastFitPage";
import { TrackPage } from "./pages/TrackPage";
import { DiscographyPage } from "./pages/DiscographyPage";
import { About42Page } from "./pages/About42Page";
import { ArtistsPage } from "./pages/ArtistsPage";
import { GamePage } from "./pages/GamePage";
import { GamesHub } from "./pages/GamesHub";
import { ShopPage } from "./pages/ShopPage";
import { EcoPage } from "./pages/EcoPage";
import { GalleryPage } from "./pages/GalleryPage";
import { MiningPage } from "./pages/MiningPage";
import { PresaveRatingPage } from "./pages/PresaveRatingPage";
import { IdeasPage } from "./pages/IdeasPage";
import { RecapsPage } from "./pages/RecapsPage";

// — code-split: all 12 games are lazy — main bundle ~827KB → ~400KB expected
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
          <Route path="discography" element={<DiscographyPage />} />
          <Route path="42" element={<About42Page />} />
          <Route path="artists" element={<ArtistsPage />} />
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
          <Route path="shop" element={<ShopPage />} />
          <Route path="eco" element={<EcoPage />} />
          <Route path="gallery" element={<GalleryPage />} />
          <Route path="mining" element={<MiningPage />} />
          <Route path="presave-rating" element={<PresaveRatingPage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="recaps" element={<RecapsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
