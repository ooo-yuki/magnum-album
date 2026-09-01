import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./DiscographyPage.module.css";

gsap.registerPlugin(ScrollTrigger);

interface TrackItem {
  title: string;
  duration?: string;
  note?: string;
  plays?: string;
}

interface Album {
  name: string;
  year: string;
  yearNum: number;
  artists: string;
  tracks: number;
  duration: string;
  durationMin: number;
  rzScore: string;
  rzNumeric: number | null;
  rzStatus: string;
  rzScoreKind: "gold" | "silver" | "hot" | "soon";
  cover: string;
  rzUrl: string;
  spotifyUrl?: string;
  yandexUrl?: string;
  bandlinkUrl?: string;
  tracklist: TrackItem[];
  description: string;
  reviewCount?: string;
  label?: string;
  genre: string;
  genreTag: string;
  genreColor: "pop" | "hiphop" | "multi" | "ep";
}

const ALBUMS: Album[] = [
  {
    name: "MAGNUM",
    year: "2026",
    yearNum: 2026,
    artists: "5opka (feat. MellSher \u2192 MlSh)",
    tracks: 5,
    duration: "~\u200912 \u043C\u0438\u043D",
    durationMin: 12,
    rzScore: "\u0421\u043A\u043E\u0440\u043E",
    rzNumeric: null,
    rzStatus: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u043B\u044C\u0431\u043E\u043C",
    rzScoreKind: "soon",
    cover: "/magnum/images/tusa-meduza.jpg",
    rzUrl: "https://risazatvorchestvo.com/artist/5opka",
    bandlinkUrl: "https://music.thefence.me/psmagnum",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    genre: "\u041C\u0443\u043B\u044C\u0442\u0438\u0436\u0430\u043D\u0440\u043E\u0432\u044B\u0439 \u2022 The Fence / Drumedy",
    genreTag: "\u041C\u0443\u043B\u044C\u0442\u0438\u0436\u0430\u043D\u0440",
    genreColor: "multi",
    tracklist: [
      { title: "\u0422\u0423\u0421\u0410 \u041C\u0415\u0414\u0423\u0417\u0410", duration: "2:07", note: "feat. MellSher, \u0412\u043E\u0432\u0430 \u0421\u043E\u043B\u043E\u0434\u043A\u043E\u0432 \u2014 \u0441\u0438\u043D\u0433\u043B 14.08.2026", plays: "\u0441\u0438\u043D\u0433\u043B" },
      { title: "VPN", duration: "2:23", note: "feat. MellSher", plays: "2.3\u041C" },
      { title: "\u0422\u0440\u0435\u043A 3", duration: "\u2014:\u2014", note: "\u0430\u043D\u043E\u043D\u0441" },
      { title: "\u0422\u0440\u0435\u043A 4", duration: "\u2014:\u2014", note: "\u0430\u043D\u043E\u043D\u0441" },
      { title: "\u0422\u0440\u0435\u043A 5", duration: "\u2014:\u2014", note: "\u0430\u043D\u043E\u043D\u0441" },
    ],
    description:
      "\u041C\u0443\u043B\u044C\u0442\u0438\u0436\u0430\u043D\u0440\u043E\u0432\u044B\u0439 \u043C\u0430\u043D\u0438\u0444\u0435\u0441\u0442: \u043E\u0442 \u0434\u0435\u0442\u0441\u043A\u043E\u0433\u043E \u0441\u0430\u0434\u0430 \u0434\u043E \u0444\u0430\u043D\u0430\u0442\u043E\u043A \u0410\u043D\u043D\u044B \u0410\u0441\u0442\u0438 50+. \u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u043E\u0442\u0441\u044B\u043B\u043A\u0430 \u043A \u043F\u0438\u0441\u0442\u043E\u043B\u0435\u0442\u0443 Magnum \u0441 3D-\u043F\u0440\u0438\u043D\u0442\u0435\u0440\u0430: 5 \u043E\u0433\u0440\u043E\u043C\u043D\u044B\u0445 \u043F\u0443\u043B\u044C = 5 \u0442\u0440\u0435\u043A\u043E\u0432. \u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u044B\u0439 \u0440\u0435\u043B\u0438\u0437 \u043F\u0435\u0440\u0435\u0434 \u0441\u043E\u043B\u044C\u043D\u044B\u043C\u0438 \u043F\u0443\u0442\u044F\u043C\u0438.",
    label: "The Fence",
  },
  {
    name: "CLAY",
    year: "03.04.2026",
    yearNum: 2026,
    artists: "5opka (\u0441\u043E\u043B\u043E)",
    tracks: 5,
    duration: "~\u200914 \u043C\u0438\u043D",
    durationMin: 14,
    rzScore: "73",
    rzNumeric: 73,
    rzStatus: "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A \u0441\u0435\u0437\u043E\u043D\u0430 \u0412\u0435\u0441\u043D\u0430 26",
    rzScoreKind: "hot",
    cover: "/magnum/images/covers/clay.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/clay",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    bandlinkUrl: "https://music.thefence.me/5opkaclay",
    spotifyUrl: "https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN",
    genre: "\u0425\u0438\u043F-\u0445\u043E\u043F \u2022 Drumedy / The Fence",
    genreTag: "\u0425\u0438\u043F-\u0445\u043E\u043F",
    genreColor: "hiphop",
    reviewCount: "81 \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u044F",
    label: "The Fence",
    tracklist: [
      { title: "\u0421\u041B\u0410\u0412\u0410 \u0411\u041E\u0421\u0421\u0423", duration: "2:44", note: "\u043C\u0430\u0440\u0448 42 \u0431\u0440\u0430\u0442\u0443\u0445" },
      { title: "\u0414\u0430\u0439 \u043C\u043D\u0435 \u0432\u0441\u0451", duration: "2:51" },
      { title: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u0441\u0442\u0430\u0432\u043E\u043A", duration: "3:02" },
      { title: "\u041F\u043E\u0436\u0430\u0440\u043D\u0438\u043A\u0438", duration: "2:38", note: "feat. \u0438\u043B\u044E\u0445\u0430 \u0440\u0435\u043F / \u041C\u0430\u0437\u0435\u043B\u043B\u043E\u0432" },
      { title: "\u0415\u0431\u0430\u043D\u0443\u0442\u044B\u0439", duration: "2:47", note: "\u043C\u0430\u043D\u0438\u0444\u0435\u0441\u0442" },
    ],
    description:
      "CLAY = Clowns Laugh At You \u2014 \u00AB\u041A\u043B\u043E\u0443\u043D\u044B \u0421\u043C\u0435\u044E\u0442\u0441\u044F \u041D\u0430\u0434 \u0422\u043E\u0431\u043E\u0439\u00BB. \u041F\u0430\u0441\u0445\u0430\u043B\u043A\u0430, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u041A\u0438\u0440\u0438\u043B\u043B \u043F\u0440\u044F\u0442\u0430\u043B \u0432 \u043A\u043E\u043D\u0446\u0435 \u0432\u0438\u0434\u0435\u043E 10 \u043B\u0435\u0442. CLAY \u043E\u0442\u043B\u0438\u0447\u0430\u0435\u0442\u0441\u044F \u043E\u0442 SLAY \u043D\u0430 \u043E\u0434\u043D\u0443 \u0431\u0443\u043A\u0432\u0443 \u0438 \u043F\u0440\u043E\u043F\u0438\u0442\u0430\u043D \u0438\u0441\u0442\u043E\u0440\u0438\u0435\u0439 \u043F\u0440\u0435\u043C\u0438\u0438 SLAY. \u041F\u0440\u043E\u0434\u044E\u0441\u0435\u0440 \u2014 Drumedy.",
  },
  {
    name: "SUPER PUPER NOVA",
    year: "25.07.2025",
    yearNum: 2025,
    artists: "5opka & MellSher",
    tracks: 5,
    duration: "12:23",
    durationMin: 12.4,
    rzScore: "80",
    rzNumeric: 80,
    rzStatus: "\u0410\u043B\u044C\u0431\u043E\u043C \u043C\u0435\u0441\u044F\u0446\u0430 \u2022 \u0438\u044E\u043B\u044C 2025",
    rzScoreKind: "gold",
    cover: "/magnum/images/covers/repit.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/super-puper-nova",
    spotifyUrl: "https://open.spotify.com/album/4dTPMq2ac765VCUlGYuXsF",
    yandexUrl: "https://music.yandex.ru/artist/7544304",
    genre: "\u041F\u043E\u043F \u2022 The Fence",
    genreTag: "\u041F\u043E\u043F",
    genreColor: "pop",
    reviewCount: "\u0410\u043B\u044C\u0431\u043E\u043C \u043C\u0435\u0441\u044F\u0446\u0430 \u0420\u0417\u0422",
    label: "The Fence",
    tracklist: [
      { title: "\u0422\u0430\u043D\u0446\u0443\u0439", duration: "2:18" },
      { title: "\u0422\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0436\u0438\u0433\u0443\u043B\u044C", duration: "2:31", note: "\u0441\u0438\u043D\u0433\u043B" },
      { title: "\u041A\u0438\u0441-\u043A\u0438\u0441", duration: "2:14", note: "\u0441\u0438\u043D\u0433\u043B" },
      { title: "XXL", duration: "2:42", note: "86 \u0431\u0430\u043B\u043B\u043E\u0432 \u043D\u0430 \u0420\u0417\u0422 \u2014 \u0422\u0440\u0435\u043A \u0433\u043E\u0434\u0430 SLAY 2025 (03.12.2025) feat MellSher \u2014 \u0445\u0438\u0442 \u0438\u044E\u043B\u044F" },
      { title: "\u0420\u0435\u043F\u0438\u0442", duration: "2:38" },
    ],
    description:
      "\u0422\u0440\u0435\u043A XXL \u2014 86 \u0431\u0430\u043B\u043B\u043E\u0432 \u043D\u0430 \u0420\u0417\u0422, \u0422\u0440\u0435\u043A \u0433\u043E\u0434\u0430 SLAY 2025 (03.12.2025) feat MellSher, \u0445\u0438\u0442 \u0438\u044E\u043B\u044F. \u0421\u0438\u043D\u0433\u043B\u044B \u00AB\u0422\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0436\u0438\u0433\u0443\u043B\u044C\u00BB, \u00AB\u041A\u0438\u0441-\u043A\u0438\u0441\u00BB, \u00ABXXL\u00BB \u0432\u044B\u0445\u043E\u0434\u0438\u043B\u0438 \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043F\u0435\u0440\u0435\u0434 \u0440\u0435\u043B\u0438\u0437\u043E\u043C. \u0412\u0437\u043B\u0451\u0442 \u0434\u0443\u044D\u0442\u0430 \u043A\u0430\u043A \u043F\u043E\u043F-\u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442\u0430 \u043F\u043E\u0441\u043B\u0435 SUPERNOVA.",
  },
  {
    name: "SUPERNOVA",
    year: "20.09.2024",
    yearNum: 2024,
    artists: "MellSher & 5opka",
    tracks: 5,
    duration: "~\u200914 \u043C\u0438\u043D",
    durationMin: 13.5,
    rzScore: "6.53",
    rzNumeric: 6.53,
    rzStatus: "\u0417\u043E\u043B\u043E\u0442\u043E\u0439 \u0430\u043B\u044C\u0431\u043E\u043C",
    rzScoreKind: "silver",
    cover: "/magnum/images/covers/vpn.jpg",
    rzUrl: "https://risazatvorchestvo.com/album/supernova",
    spotifyUrl: "https://open.spotify.com/album/4dTPMq2ac765VCUlGYuXsF",
    genre: "\u041F\u043E\u043F \u2022 The Fence",
    genreTag: "\u041F\u043E\u043F",
    genreColor: "pop",
    reviewCount: "9+ \u0441\u0442\u0440\u0430\u043D\u0438\u0446 \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0439",
    tracklist: [
      { title: "\u041C\u0435\u0440\u0441\u0438", duration: "2:26", note: "\u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u0445\u0438\u0442" },
      { title: "\u041B\u043E\u043D\u0433 \u0410\u0439\u043B\u0435\u043D\u0434", duration: "3:09", note: "\u0434\u043B\u044F \u043C\u0430\u0448\u0438\u043D\u044B" },
      { title: "\u041A\u043B\u0435\u043E\u043F\u0430\u0442\u0440\u0430", duration: "2:37" },
      { title: "\u041F\u044F\u0442\u043D\u0438\u0441\u0442\u044B\u0439 \u044F\u0433\u0443\u0430\u0440", duration: "2:16" },
      { title: "\u0413\u043B\u0430\u0437\u0430 \u043B\u044C\u0432\u0438\u0446\u044B", duration: "3:04" },
    ],
    description:
      "\u041F\u0435\u0440\u0432\u044B\u0439 \u043F\u043E\u043F-\u044D\u043A\u0441\u043F\u0435\u0440\u0438\u043C\u0435\u043D\u0442 \u0434\u0443\u044D\u0442\u0430. \u0421\u043C\u0435\u0448\u0430\u043D\u043D\u044B\u0435 \u043E\u0442\u0437\u044B\u0432\u044B: \u0445\u0432\u0430\u043B\u044F\u0442 \u0437\u0430 \u043F\u043E\u043F\u044B\u0442\u043A\u0443 \u043D\u043E\u0432\u043E\u0433\u043E \u0436\u0430\u043D\u0440\u0430, \u043A\u0440\u0438\u0442\u0438\u043A\u0443\u044E\u0442 \u0437\u0430 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0435 \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u0438. \u00AB\u041C\u0435\u0440\u0441\u0438\u00BB \u2014 \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u0445\u0438\u0442, \u00AB\u041B\u043E\u043D\u0433 \u0410\u0439\u043B\u0435\u043D\u0434\u00BB \u2014 \u0434\u043B\u044F \u043C\u0430\u0448\u0438\u043D\u044B.",
  },
];

const OTHER_RELEASES = [
  { name: "1000 \u0436\u0438\u0437\u043D\u0435\u0439", year: "\u0424\u0435\u0432 2024", detail: "\u0414\u0435\u0431\u044E\u0442\u043D\u044B\u0439 \u0430\u043B\u044C\u0431\u043E\u043C \u2022 14 \u0442\u0440\u0435\u043A\u043E\u0432", genre: "\u0425\u0438\u043F-\u0445\u043E\u043F" },
  { name: "\u0413\u043E\u043B\u043E\u0432\u043E\u043B\u043E\u043C\u043A\u0430", year: "\u041E\u043A\u0442 2024", detail: "EP \u2022 5 \u0442\u0440\u0435\u043A\u043E\u0432", genre: "\u0425\u0438\u043F-\u0445\u043E\u043F" },
  { name: "+1up", year: "14.03.2025", detail: "EP", genre: "\u041F\u043E\u043F" },
  { name: "\u0412\u0440\u0435\u0434\u043D\u044B\u0435 \u0441\u043E\u0432\u0435\u0442\u044B", year: "\u2014", detail: "\u0410\u043B\u044C\u0431\u043E\u043C", genre: "\u041F\u043E\u043F" },
];

type SortKey = "default" | "scoreDesc" | "scoreAsc" | "yearDesc" | "yearAsc";

const YEAR_OPTIONS = ["\u0412\u0441\u0435", "2024", "2025", "2026"] as const;
const ALBUM_OPTIONS = ["\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B", ...ALBUMS.map((a) => a.name)] as const;
const GENRE_OPTIONS = ["\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B", "\u041F\u043E\u043F", "\u0425\u0438\u043F-\u0445\u043E\u043F", "\u041C\u0443\u043B\u044C\u0442\u0438\u0436\u0430\u043D\u0440"] as const;

function parseYear(y: string): number {
  const m = y.match(/(20\\d{2})/);
  return m ? parseInt(m[1], 10) : 2024;
}

export function DiscographyPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const albumsRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const counterDurationRef = useRef<HTMLSpanElement>(null);
  const counterScoreRef = useRef<HTMLSpanElement>(null);

  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("\u0412\u0441\u0435");
  const [albumFilter, setAlbumFilter] = useState<string>("\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B");
  const [genreFilter, setGenreFilter] = useState<string>("\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const filteredAndSorted = useMemo(() => {
    let list = ALBUMS.filter((a) => {
      if (yearFilter !== "\u0412\u0441\u0435" && String(parseYear(a.year)) !== yearFilter) return false;
      if (albumFilter !== "\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B" && a.name !== albumFilter) return false;
      if (genreFilter !== "\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B" && a.genreTag !== genreFilter) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const inAlbum = a.name.toLowerCase().includes(needle) || a.artists.toLowerCase().includes(needle);
        const inTracks = a.tracklist.some(
          (t) => t.title.toLowerCase().includes(needle) || (t.note && t.note.toLowerCase().includes(needle))
        );
        if (!inAlbum && !inTracks) return false;
      }
      return true;
    });

    if (sortKey === "scoreDesc") {
      list = [...list].sort((a, b) => (b.rzNumeric ?? -1) - (a.rzNumeric ?? -1));
    } else if (sortKey === "scoreAsc") {
      list = [...list].sort((a, b) => (a.rzNumeric ?? 999) - (b.rzNumeric ?? 999));
    } else if (sortKey === "yearDesc") {
      list = [...list].sort((a, b) => b.yearNum - a.yearNum || parseYear(b.year) - parseYear(a.year));
    } else if (sortKey === "yearAsc") {
      list = [...list].sort((a, b) => a.yearNum - b.yearNum || parseYear(a.year) - parseYear(b.year));
    }
    return list;
  }, [q, yearFilter, albumFilter, genreFilter, sortKey]);

  const stats = useMemo(() => {
    const totalTracks = filteredAndSorted.reduce((s, a) => s + a.tracks, 0);
    const totalMin = filteredAndSorted.reduce((s, a) => s + a.durationMin, 0);
    const scored = filteredAndSorted.filter((a) => a.rzNumeric !== null);
    const avg = scored.length ? scored.reduce((s, a) => s + (a.rzNumeric ?? 0), 0) / scored.length : 0;
    const visibleTracksFlat = filteredAndSorted.flatMap((a) =>
      q.trim()
        ? a.tracklist.filter(
            (t) =>
              t.title.toLowerCase().includes(q.trim().toLowerCase()) ||
              (t.note && t.note.toLowerCase().includes(q.trim().toLowerCase()))
          )
        : a.tracklist
    );
    return { totalTracks, totalMin: Math.round(totalMin), avg: avg.toFixed(1), visibleTracksFlatCount: visibleTracksFlat.length };
  }, [filteredAndSorted, q]);

  useEffect(() => {
    if (!counterRef.current || !counterDurationRef.current || !counterScoreRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (counterRef.current) counterRef.current.textContent = String(stats.totalTracks);
      if (counterDurationRef.current) counterDurationRef.current.textContent = String(stats.totalMin);
      if (counterScoreRef.current) counterScoreRef.current.textContent = stats.avg;
      return;
    }
    const obj = { n: 0, d: 0, s: 0 };
    const targetN = stats.totalTracks;
    const targetD = stats.totalMin;
    const targetS = parseFloat(stats.avg) || 0;
    const tw = gsap.to(obj, {
      n: targetN,
      d: targetD,
      s: targetS,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        if (counterRef.current) counterRef.current.textContent = String(Math.round(obj.n));
        if (counterDurationRef.current) counterDurationRef.current.textContent = String(Math.round(obj.d));
        if (counterScoreRef.current) counterScoreRef.current.textContent = obj.s.toFixed(1);
      },
    });
    return () => { tw.kill(); };
  }, [stats.totalTracks, stats.totalMin, stats.avg]);

  // ── GSAP entrance: y24 stagger 0.12 • reduced-motion • context cleanup
  useEffect(() => {
    if (!containerRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(`.${styles.header} > *`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.albumCard}`, { y: 0, opacity: 1, clearProps: "transform" });
        gsap.set(`.${styles.otherCard}`, { y: 0, opacity: 1, clearProps: "transform" });
        return;
      }
      gsap.set(`.${styles.header} > *`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.header} > *`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.05 });

      gsap.set(`.${styles.albumCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.albumCard}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.55, ease: "power2.out", delay: 0.28 });

      gsap.set(`.${styles.otherCard}`, { y: 24, opacity: 0 });
      gsap.to(`.${styles.otherCard}`, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay: 0.4 });

      // ambient glow gold/hot — gated by reducedMotion
      gsap.to(`.${styles.gold}`, {
        boxShadow: "0 0 22px rgba(255,204,0,0.55), 0 0 44px rgba(255,204,0,0.2)",
        duration: 1.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.5,
        scrollTrigger: { trigger: `.${styles.albums}`, start: "top 80%", toggleActions: "play pause resume pause" },
      });
      gsap.to(`.${styles.hot}`, {
        boxShadow: "0 0 22px rgba(255,45,85,0.55), 0 0 44px rgba(255,45,85,0.2)",
        duration: 1.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 0.8,
        scrollTrigger: { trigger: `.${styles.albums}`, start: "top 80%", toggleActions: "play pause resume pause" },
      });
      const container = containerRef.current;
      if (container) {
        const shines = container.querySelectorAll(`.${styles.coverShine}`);
        shines.forEach((shine) => {
          const tl = gsap.timeline({
            repeat: -1, delay: 2 + Math.random() * 2,
            scrollTrigger: { trigger: shine as Element, start: "top 85%", toggleActions: "play pause resume pause" },
          });
          tl.fromTo(shine as Element, { backgroundPosition: "-200% 0" }, { backgroundPosition: "200% 0", duration: 1.4, ease: "power2.inOut" });
          tl.to({}, { duration: 4 + Math.random() * 2 });
        });
      }
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // re-stagger on filter/sort change — y24 stagger 0.12
  useEffect(() => {
    if (!albumsRef.current) return;
    const cards = albumsRef.current.querySelectorAll<HTMLElement>(`.${styles.albumCard}`);
    if (!cards.length) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      gsap.set(cards, { y: 0, opacity: 1, clearProps: "transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(cards, { y: 24, opacity: 0 });
      gsap.to(cards, { y: 0, opacity: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", overwrite: true });
    }, albumsRef);
    return () => ctx.revert();
  }, [filteredAndSorted]);

  // hover RGB — chromatic lift
  const onCardEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: -4,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,45,85,0.20), 0 0 22px rgba(255,45,85,0.20), 0 0 22px rgba(0,255,136,0.12), 0 0 28px rgba(255,204,0,0.10)",
      borderColor: "rgba(255,45,85,0.35)",
      duration: 0.28,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);
  const onCardLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(e.currentTarget, {
      y: 0,
      boxShadow: "0 0 0 transparent",
      borderColor: "rgba(255,255,255,0.06)",
      duration: 0.35,
      ease: "power2.out",
      overwrite: true,
    });
  }, []);

  const hasActiveFilter = yearFilter !== "\u0412\u0441\u0435" || albumFilter !== "\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B" || genreFilter !== "\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B" || q.trim() !== "" || sortKey !== "default";

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.badge}>\u0414\u0438\u0441\u043A\u043E\u0433\u0440\u0430\u0444\u0438\u044F \u2022 4 \u0440\u0435\u043B\u0438\u0437\u0430 + MAGNUM</div>
        <h1>\u0410\u043B\u044C\u0431\u043E\u043C\u044B 5opka</h1>
        <p className={styles.subtitle}>
          \u041E\u0442 \u0434\u0435\u0431\u044E\u0442\u043D\u043E\u0433\u043E \u00AB1000 \u0436\u0438\u0437\u043D\u0435\u0439\u00BB \u0434\u043E MAGNUM \u2014 \u043F\u0443\u0442\u044C \u0447\u0435\u0440\u0435\u0437 \u0420\u0417\u0422, SLAY \u0438 42. \u0412\u0441\u0435 \u043E\u0446\u0435\u043D\u043A\u0438 \u2014 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0431\u0430\u043B\u043B\u044B \u0420\u0417\u0422 (risazatvorchestvo.com).
        </p>
        <div className={styles.rztLegend}>
          <span className={styles.legendItem}><i className={styles.dotGold} /> 80 = \u0410\u043B\u044C\u0431\u043E\u043C \u043C\u0435\u0441\u044F\u0446\u0430</span>
          <span className={styles.legendItem}><i className={styles.dotHot} /> 73 = \u0412\u0435\u0441\u043D\u0430 26</span>
          <span className={styles.legendItem}><i className={styles.dotSilver} /> 6.53 = \u0417\u043E\u043B\u043E\u0442\u043E\u0439</span>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statNum} ref={counterRef}>{stats.totalTracks}</span>
          <span className={styles.statLabel}>\u0442\u0440\u0435\u043A\u043E\u0432</span>
          {q.trim() && <span className={styles.statHint}>\u043D\u0430\u0439\u0434\u0435\u043D\u043E {stats.visibleTracksFlatCount}</span>}
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum}><span ref={counterDurationRef}>{stats.totalMin}</span> \u043C\u0438\u043D</span>
          <span className={styles.statLabel}>\u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum} ref={counterScoreRef}>{stats.avg}</span>
          <span className={styles.statLabel}>\u0441\u0440\u0435\u0434\u043D\u0438\u0439 \u0420\u0417\u0422</span>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.stat}>
          <span className={styles.statNum}>{filteredAndSorted.length}</span>
          <span className={styles.statLabel}>\u0430\u043B\u044C\u0431\u043E\u043C\u043E\u0432</span>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>\u2315</span>
          <input
            className={styles.searchInput}
            placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0442\u0440\u0435\u043A\u0430\u043C, \u0430\u043B\u044C\u0431\u043E\u043C\u0430\u043C, \u0430\u0440\u0442\u0438\u0441\u0442\u0430\u043C\u2026"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0442\u0440\u0435\u043A\u0430\u043C"
          />
          {q && (
            <button className={styles.searchClear} onClick={() => setQ("")} aria-label="\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u043F\u043E\u0438\u0441\u043A">\u00D7</button>
          )}
        </div>

        <div className={styles.filtersRow}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>\u0413\u043E\u0434</span>
            <div className={styles.pills}>
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  className={`${styles.pill} ${yearFilter === y ? styles.pillActive : ""}`}
                  onClick={() => setYearFilter(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>\u0410\u043B\u044C\u0431\u043E\u043C</span>
            <div className={styles.pills}>
              {ALBUM_OPTIONS.map((a) => (
                <button
                  key={a}
                  className={`${styles.pill} ${albumFilter === a ? styles.pillActive : ""}`}
                  onClick={() => setAlbumFilter(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>\u0416\u0430\u043D\u0440</span>
            <div className={styles.pills}>
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g}
                  className={`${styles.pill} ${genreFilter === g ? styles.pillActive : ""}`}
                  onClick={() => setGenreFilter(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.sortRow}>
          <label className={styles.sortLabel}>
            \u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430 \u043F\u043E \u0420\u0417\u0422
            <select className={styles.sortSelect} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
              <option value="default">\u041F\u043E \u0443\u043C\u043E\u043B\u0447\u0430\u043D\u0438\u044E</option>
              <option value="scoreDesc">\u0420\u0417\u0422 \u2193 \u0432\u044B\u0441\u043E\u043A\u0438\u0439 \u2192 \u043D\u0438\u0437\u043A\u0438\u0439</option>
              <option value="scoreAsc">\u0420\u0417\u0422 \u2191 \u043D\u0438\u0437\u043A\u0438\u0439 \u2192 \u0432\u044B\u0441\u043E\u043A\u0438\u0439</option>
              <option value="yearDesc">\u0413\u043E\u0434 \u2193 \u043D\u043E\u0432\u044B\u0435 \u0441\u043D\u0430\u0447\u0430\u043B\u0430</option>
              <option value="yearAsc">\u0413\u043E\u0434 \u2191 \u0441\u0442\u0430\u0440\u044B\u0435 \u0441\u043D\u0430\u0447\u0430\u043B\u0430</option>
            </select>
          </label>
          {hasActiveFilter && (
            <button
              className={styles.resetBtn}
              onClick={() => { setQ(""); setYearFilter("\u0412\u0441\u0435"); setAlbumFilter("\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B"); setGenreFilter("\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B"); setSortKey("default"); }}
            >
              \u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0444\u0438\u043B\u044C\u0442\u0440\u044B
            </button>
          )}
          <span className={styles.resultCount}>{filteredAndSorted.length} / {ALBUMS.length} \u0430\u043B\u044C\u0431\u043E\u043C\u043E\u0432</span>
        </div>
      </div>

      <div className={styles.albums} ref={albumsRef}>
        {filteredAndSorted.length === 0 ? (
          <div className={styles.empty}>
            <p>\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 \u00AB{q}\u00BB \u0441 \u0442\u0435\u043A\u0443\u0449\u0438\u043C\u0438 \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u043C\u0438.</p>
            <button className={styles.resetBtn} onClick={() => { setQ(""); setYearFilter("\u0412\u0441\u0435"); setAlbumFilter("\u0412\u0441\u0435 \u0430\u043B\u044C\u0431\u043E\u043C\u044B"); setGenreFilter("\u0412\u0441\u0435 \u0436\u0430\u043D\u0440\u044B"); }}>\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C</button>
          </div>
        ) : (
          filteredAndSorted.map((album) => {
            const qLower = q.trim().toLowerCase();
            const matchesQuery = (t: TrackItem) =>
              !!qLower && (t.title.toLowerCase().includes(qLower) || (t.note && t.note.toLowerCase().includes(qLower)));
            return (
              <div key={album.name} className={styles.albumCard} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
                <div className={styles.albumCover}>
                  <img src={album.cover} alt={album.name} loading="lazy" decoding="async" width={400} height={400} />
                  <div className={`${styles.scoreBadge} ${styles[album.rzScoreKind]}`}>
                    <span className={styles.scoreNumber}>{album.rzScore}</span>
                    <span className={styles.scoreLabel}>\u0420\u0417\u0422</span>
                  </div>
                  <div className={styles.coverShine} />
                  <span className={`${styles.genreBadge} ${styles["genre_" + album.genreColor]}`}>{album.genreTag}</span>
                </div>

                <div className={styles.albumInfo}>
                  <div className={styles.albumYear}>{album.year} \u2022 {album.genre}</div>
                  <h2>{album.name}</h2>
                  <p className={styles.albumArtists}>{album.artists} \u2022 {album.label ?? "The Fence"}</p>
                  <p className={styles.albumMeta}>
                    {album.tracks} \u0442\u0440\u0435\u043A\u043E\u0432 \u2022 {album.duration} {album.reviewCount ? `\u2022 ${album.reviewCount}` : ""}
                  </p>
                  <p className={styles.albumStatus}>{album.rzStatus}</p>
                  <p className={styles.albumDesc}>{album.description}</p>

                  <div className={styles.tracklist}>
                    <h3>\u0422\u0440\u0435\u043A\u043B\u0438\u0441\u0442 \u2014 {album.tracks} \u0442\u0440\u0435\u043A\u043E\u0432 {qLower ? `\u2022 \u043F\u043E\u0438\u0441\u043A: ${q}` : ""}</h3>
                    <ol>
                      {album.tracklist.map((t, idx) => {
                        const isMatch = matchesQuery(t);
                        const isAnnounce = t.note === "\u0430\u043D\u043E\u043D\u0441";
                        return (
                          <li
                            key={t.title + idx}
                            className={`${styles.trackRow} ${isMatch ? styles.trackMatch : ""} ${isAnnounce ? styles.trackSoon : ""}`}
                          >
                            <span className={styles.trackNum}>{String(idx + 1).padStart(2, "0")}</span>
                            <span className={styles.trackTitle}>{t.title}</span>
                            <span className={styles.trackMeta}>
                              {t.duration && <em className={styles.duration}>{t.duration}</em>}
                              {t.note && <span className={`${styles.note} ${isAnnounce ? styles.noteSoon : ""}`}>{t.note}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {album.spotifyUrl && (
                    <div className={styles.player}>
                      <iframe
                        src={`https://open.spotify.com/embed/album/${album.spotifyUrl.split("/").pop()?.split("?")[0]}?utm_source=generator`}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={`${album.name} player`}
                      />
                    </div>
                  )}

                  <div className={styles.albumLinks}>
                    <a href={album.rzUrl} target="_blank" rel="noreferrer" className={styles.linkBtn}>
                      \u0420\u0417\u0422 \u2192 {album.rzScore} \u0431\u0430\u043B\u043B\u043E\u0432
                    </a>
                    {album.spotifyUrl && (
                      <a href={album.spotifyUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>Spotify \u2192</a>
                    )}
                    {album.yandexUrl && (
                      <a href={album.yandexUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>\u042F\u043D\u0434\u0435\u043A\u0441 \u041C\u0443\u0437\u044B\u043A\u0430 \u2192</a>
                    )}
                    {album.bandlinkUrl && (
                      <a href={album.bandlinkUrl} target="_blank" rel="noreferrer" className={styles.linkBtnGhost}>\u0421\u043B\u0443\u0448\u0430\u0442\u044C \u0432\u0435\u0437\u0434\u0435 \u2192</a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.other}>
        <h2>\u0414\u0440\u0443\u0433\u0438\u0435 \u0440\u0435\u043B\u0438\u0437\u044B</h2>
        <p className={styles.otherSub}>\u0418\u0437 research.md \u2014 \u0431\u0435\u0437 \u0432\u044B\u0434\u0443\u043C\u043E\u043A, \u0443\u043A\u0430\u0437\u0430\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0440\u0435\u043B\u0438\u0437\u044B</p>
        <div className={styles.otherGrid}>
          {OTHER_RELEASES.map((r) => (
            <div key={r.name} className={styles.otherCard} onMouseEnter={onCardEnter} onMouseLeave={onCardLeave}>
              <strong>{r.name}</strong>
              <span>{r.year} \u2022 {r.genre}</span>
              <p>{r.detail}</p>
            </div>
          ))}
        </div>
        <div className={styles.otherLinks}>
          <a href="https://risazatvorchestvo.com/artist/5opka/reviews" target="_blank" rel="noreferrer">\u0412\u0441\u0435 \u0440\u0435\u0446\u0435\u043D\u0437\u0438\u0438 \u0420\u0417\u0422 \u2192</a>
          <a href="https://www.albumoftheyear.org/album/1756160-5opka-clay.php" target="_blank" rel="noreferrer">Album of the Year (CLAY) \u2192</a>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer">\u042F\u043D\u0434\u0435\u043A\u0441 \u041C\u0443\u0437\u044B\u043A\u0430 \u2192</a>
          <a href="https://open.spotify.com/artist/6hSwHa5Se498WfUj6zf4WN" target="_blank" rel="noreferrer">Spotify \u2192</a>
        </div>
      </div>

      <div className={styles.presave}>
        <h2>\u041F\u0440\u0435\u0441\u0435\u0439\u0432 MAGNUM</h2>
        <p>\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0441\u043E\u0432\u043C\u0435\u0441\u0442\u043D\u044B\u0439 \u0430\u043B\u044C\u0431\u043E\u043C \u2014 \u0443\u0436\u0435 \u043D\u0430 \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430\u0445. 5 \u0442\u0440\u0435\u043A\u043E\u0432 = 5 \u043F\u0443\u043B\u044C.</p>
        <div className={styles.presaveBtns}>
          <a href="https://music.thefence.me/psmagnum" target="_blank" rel="noreferrer" className={styles.presaveBtn}>\u041F\u0440\u0435\u0441\u0435\u0439\u0432 \u043D\u0430 \u0432\u0441\u0435\u0445 \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0430\u0445 \u2192</a>
          <a href="https://music.yandex.ru/artist/7544304" target="_blank" rel="noreferrer" className={styles.presaveBtnGhost}>\u042F\u043D\u0434\u0435\u043A\u0441 \u041C\u0443\u0437\u044B\u043A\u0430</a>
        </div>
      </div>
    </div>
  );
}
