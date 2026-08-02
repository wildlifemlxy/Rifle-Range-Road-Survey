import { NavLink } from "react-router-dom";
import { useSocketStatus } from "../../hooks/useSocketStatus";
import "../../css/Header.css";

function Header() {
  const isLive = useSocketStatus();

  return (
    <header className="app-header">
      <h1>🗺️ Rifle Range Road Survey</h1>
      <nav className="header-tabs">
        <NavLink to="/" end className={({ isActive }) => `header-tab${isActive ? " header-tab-active" : ""}`}>
          Map
        </NavLink>
        <NavLink
          to="/road-bridge"
          className={({ isActive }) => `header-tab${isActive ? " header-tab-active" : ""}`}
        >
          Road Bridge
        </NavLink>
        <NavLink
          to="/observations"
          className={({ isActive }) => `header-tab${isActive ? " header-tab-active" : ""}`}
        >
          Observations
        </NavLink>
      </nav>
      <span className={`live-indicator${isLive ? "" : " live-indicator-offline"}`}>
        <span className={`live-dot${isLive ? "" : " live-dot-offline"}`} />
        {isLive ? "Real-time Updates" : "Connecting..."}
      </span>
    </header>
  );
}

export default Header;
