import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import s from "./MenuLateral.module.css";
import logo from "../assets/logo.png";

const NAV_ITEMS = [
  { to: "/procesos",    icono: "⚙",  label: "Gestión de Procesos" },
  { to: "/ficha",       icono: "▤",  label: "Ficha de Proceso" },
  { to: "/indicadores", icono: "◈",  label: "Ficha de Indicador" },
  { to: "/reporte",     icono: "⬡",  label: "Analisis del proceso" },
  { to: "/sixsigma",    icono: "σ",  label: "Six Sigma" },
  { to: "/mejoras",     icono: "✦",  label: "Ficha de Mejora" },
];

export default function MenuLateral({ colapsado, onToggle }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const cerrarSesion = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className={`${s.sidebar} ${colapsado ? s.colapsado : ""}`}>

      {/* Hamburguesa */}
      <button
        className={s.hamburguesa}
        onClick={onToggle}
        title={colapsado ? "Expandir menú" : "Colapsar menú"}
      >
        <span /><span /><span />
      </button>

      {/* Logo / Marca */}
      <div className={`${s.marca} ${colapsado ? s.marcaOculta : ""}`}>
        <div className={s.logoBadge}>
          <img src={logo} alt="Logo" className={s.logoImg} />
        </div>
        <p className={s.logoTitulo}>Automatización</p>
        <p className={s.logoSub}>Ingeniería de Procesos</p>
      </div>

      <div className={s.separador} />

      {/* Navegación */}
      <nav className={s.nav}>
        {NAV_ITEMS.map(({ to, icono, label }) => (
          <NavLink
            key={to}
            to={to}
            title={colapsado ? label : undefined}
            className={({ isActive }) =>
              `${s.enlace} ${isActive ? s.activo : ""}`
            }
          >
            <span className={s.icono}>{icono}</span>
            <span className={s.etiqueta}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Usuario + Perfil + Cerrar sesión */}
      <div className={s.usuarioPanel}>
        <NavLink
          to="/perfil"
          title={colapsado ? "Mi perfil" : undefined}
          className={({ isActive }) => `${s.enlace} ${isActive ? s.activo : ""}`}
          style={{ marginBottom: ".2rem" }}
        >
          <span className={s.icono}>👤</span>
          <span className={s.etiqueta}>Mi perfil</span>
        </NavLink>
        <button
          className={s.btnLogout}
          onClick={cerrarSesion}
          title="Cerrar sesión"
        >
          <span className={s.icono}>⏻</span>
          <span className={s.etiqueta}>Salir</span>
        </button>
      </div>

    </aside>
  );
}
