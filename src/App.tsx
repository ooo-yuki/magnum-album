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
import { MemoryGame } from "./pages/games/MemoryGame";
import { ClickerGame } from "./pages/games/ClickerGame";
import { Match3Game } from "./pages/games/Match3Game";
import { KnifeHitGame } from "./pages/games/KnifeHitGame";
import { RunnerGame } from "./pages/games/RunnerGame";
import { RhythmGame } from "./pages/games/RhythmGame";
import { Stack42Game } from "./pages/games/Stack42Game";
import { BlackjackGame } from "./pages/games/BlackjackGame";
import { RouletteGame } from "./pages/games/RouletteGame";
import { Game2042 } from "./pages/games/Game2042";
import { Flappy42Game } from "./pages/games/Flappy42Game";
import { TypingGame } from "./pages/games/TypingGame";
import { ShopPage } from "./pages/ShopPage";
import { EcoPage } from "./pages/EcoPage";
import { GalleryPage } from "./pages/GalleryPage";
import { MiningPage } from "./pages/MiningPage";
import { PresaveRatingPage } from "./pages/PresaveRatingPage";
import { IdeasPage } from "./pages/IdeasPage";
import { RecapsPage } from "./pages/RecapsPage";

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
          <Route path="games/runner" element={<RunnerGame />} />
          <Route path="games/match3" element={<Match3Game />} />
          <Route path="games/knife" element={<KnifeHitGame />} />
          <Route path="games/memory" element={<MemoryGame />} />
          <Route path="games/clicker" element={<ClickerGame />} />
          <Route path="games/rhythm" element={<RhythmGame />} />
          <Route path="games/stack" element={<Stack42Game />} />
          <Route path="games/blackjack" element={<BlackjackGame />} />
          <Route path="games/roulette" element={<RouletteGame />} />
          <Route path="games/2042" element={<Game2042 />} />
          <Route path="games/flappy" element={<Flappy42Game />} />
          <Route path="games/typing" element={<TypingGame />} />
          <Route path="games/quiz" element={<GamePage />} />
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
