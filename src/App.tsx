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
          <Route path="games/quiz" element={<GamePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
