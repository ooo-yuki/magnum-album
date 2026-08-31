import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LastFitPage } from "./pages/LastFitPage";
import { TrackPage } from "./pages/TrackPage";
import { DiscographyPage } from "./pages/DiscographyPage";
import { About42Page } from "./pages/About42Page";
import { ArtistsPage } from "./pages/ArtistsPage";
import { GamePage } from "./pages/GamePage";

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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
