import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LastFitPage } from "./pages/LastFitPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/magnum" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="last-fit" element={<LastFitPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
