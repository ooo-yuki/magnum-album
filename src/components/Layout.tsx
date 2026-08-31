import { Outlet, Link, useLocation } from "react-router-dom";
import { Particles } from "./Particles";
import { Footer } from "./Footer";
import styles from "./Layout.module.css";

export function Layout() {
  const location = useLocation();

  return (
    <>
      <Particles />
      <nav className={styles.nav}>
        <Link to="/magnum" className={styles.logo}>
          MAGNUM
        </Link>
        <div className={styles.links}>
          <Link
            to="/magnum"
            className={location.pathname === "/magnum" ? styles.active : ""}
          >
            Главная
          </Link>
          <Link
            to="/magnum/last-fit"
            className={
              location.pathname === "/magnum/last-fit" ? styles.active : ""
            }
          >
            Последний фит
          </Link>
        </div>
      </nav>
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
