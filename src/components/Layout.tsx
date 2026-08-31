import { Outlet, Link, useLocation } from "react-router-dom";
import { Particles } from "./Particles";
import { Footer } from "./Footer";
import styles from "./Layout.module.css";

const NAV_ITEMS = [
  { to: "/magnum", label: "Главная" },
  { to: "/magnum/artists", label: "Артисты" },
  { to: "/magnum/discography", label: "Дискография" },
  { to: "/magnum/42", label: "42 братухи" },
  { to: "/magnum/last-fit", label: "Последний фит" },
  { to: "/magnum/games", label: "Игры" },
];

export function Layout() {
  const location = useLocation();

  return (
    <>
      <Particles />
      <nav className={styles.nav}>
        <Link to="/magnum" className={styles.logo}>MAGNUM</Link>
        <div className={styles.links}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? styles.active : ""}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
