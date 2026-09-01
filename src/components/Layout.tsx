import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { Particles } from "./Particles";
import { Footer } from "./Footer";
import { PageLoader } from "./PageLoader";
import { PageTransition } from "./PageTransition";
import { TopProgress } from "./TopProgress";
import { ScrollToTop } from "./ScrollToTop";
import { ErrorBoundary } from "./ErrorBoundary";
import { AiBot } from "./AiBot";
import styles from "./Layout.module.css";

const NAV_ITEMS = [
  { to: "/magnum", label: "Главная" },
  { to: "/magnum/shop", label: "Магазин" },
  { to: "/magnum/eco", label: "Эко-рейтинг" },
  { to: "/magnum/games/roulette", label: "Арена" },
  { to: "/magnum/shop", label: "Рамка" },
  { to: "/magnum/42", label: "Галерея 42" },
  { to: "/magnum/games/clicker", label: "Майнинг" },
  { to: "/magnum/artists", label: "Рейтинг пресейва" },
  { to: "/magnum/track/tusa-meduza", label: "Нарезки" },
  { to: "/magnum/track/vpn", label: "Пересказы" },
  { to: "/magnum/discography", label: "Дискография" },
  { to: "/magnum/42", label: "42 братухи" },
  { to: "/magnum/games", label: "Игры" },
];

export function Layout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const openAiBot = () => window.dispatchEvent(new CustomEvent("open-aibot"));

  // close on route change + nav-indicator-gsap pulse
  useEffect(() => {
    setMenuOpen(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const active = document.querySelector(`.${'active'}`) as HTMLElement | null;
    if (active) gsap.fromTo(active, { scale: 0.96 }, { scale: 1, duration: 0.4, ease: "back.out(1.6)", overwrite: "auto" });
  }, [location.pathname]);

  // lock scroll when open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // esc to close
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // drawer animation
  useEffect(() => {
    if (!drawerRef.current || !backdropRef.current) return;
    if (menuOpen) {
      gsap.set(drawerRef.current, { xPercent: 100 });
      gsap.set(backdropRef.current, { opacity: 0 });
      gsap.to(backdropRef.current, { opacity: 1, duration: 0.24, ease: "power2.out" });
      gsap.to(drawerRef.current, { xPercent: 0, duration: 0.42, ease: "power3.out" });
      gsap.fromTo(
        drawerRef.current.querySelectorAll(`.${styles.drawerLink}`),
        { x: 18, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.04, duration: 0.38, ease: "power2.out", delay: 0.12 }
      );
    }
  }, [menuOpen]);

  const closeWithAnimation = () => {
    if (!drawerRef.current || !backdropRef.current) { setMenuOpen(false); return; }
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(drawerRef.current, {
      xPercent: 100, duration: 0.3, ease: "power3.in",
      onComplete: () => setMenuOpen(false),
    });
  };

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>
        Перейти к содержимому
      </a>
      <TopProgress />
      <PageLoader />
      <Particles />
      <nav className={styles.nav} aria-label="Главная навигация">
        <Link to="/magnum" className={styles.logo} aria-label="MAGNUM на главную">MAGNUM</Link>

        <div className={styles.links} aria-hidden={menuOpen ? "true" : undefined}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={`${item.label}-${item.to}`}
              to={item.to}
              className={location.pathname === item.to ? styles.active : ""}
              aria-current={location.pathname === item.to ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={openAiBot}
            className={styles.botBtn}
            aria-label="Открыть БРАТ-БОТА"
          >
            БРАТ-БОТ
          </button>
        </div>

        <button
          className={`${styles.burger} ${menuOpen ? styles.burgerOpen : ""}`}
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          aria-controls="mobile-drawer"
          onClick={() => (menuOpen ? closeWithAnimation() : setMenuOpen(true))}
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      {/* mobile drawer */}
      {menuOpen && (
        <div className={styles.drawerRoot}>
          <div ref={backdropRef} className={styles.backdrop} onClick={closeWithAnimation} aria-hidden />
          <div
            id="mobile-drawer"
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
          >
            <div className={styles.drawerHead}>
              <span className={styles.drawerLogo}>MAGNUM</span>
              <button className={styles.drawerClose} onClick={closeWithAnimation} aria-label="Закрыть">×</button>
            </div>
            <div className={styles.drawerLinks}>
              {NAV_ITEMS.map((item) => (
                <Link
                  key={`m-${item.label}-${item.to}`}
                  to={item.to}
                  className={`${styles.drawerLink} ${location.pathname === item.to ? styles.drawerActive : ""}`}
                  onClick={closeWithAnimation}
                >
                  {item.label}
                </Link>
              ))}
              <button
                type="button"
                className={`${styles.drawerLink} ${styles.drawerBotBtn}`}
                onClick={() => { closeWithAnimation(); setTimeout(openAiBot, 320); }}
              >
                🤖 БРАТ-БОТ
              </button>
            </div>
            <a
              href="https://music.yandex.ru/artist/7544304"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.drawerCta}
            >
              Пресейв →
            </a>
          </div>
        </div>
      )}

      <main className={styles.main} id="main-content" tabIndex={-1}>
        <PageTransition key={location.pathname}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </PageTransition>
      </main>
      <ScrollToTop />
      <Footer />
      <AiBot />
    </>
  );
}
