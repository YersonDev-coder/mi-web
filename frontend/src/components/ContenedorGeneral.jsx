import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MenuLateral from "./MenuLateral";
import GestionProcesosView from "../views/GestionProcesosView";
import FichaProcesoView from "../views/FichaProcesoView";
import IndicadoresView from "../views/IndicadoresView";
import MejorasView from "../views/MejorasView";
import ReporteView from "../views/ReporteView";
import SixSigmaView from "../views/SixSigmaView";
import PerfilView from "../auth/PerfilView";
import logo from "../assets/logo.png";
import s from "./ContenedorGeneral.module.css";

export default function ContenedorGeneral() {
  const [colapsado, setColapsado] = useState(false);
  const toggle = () => setColapsado(v => !v);

  return (
    <div className={s.contenedor}>

      {/* Barra superior fija — solo visible en móvil ≤640px */}
      <header className={s.topBar}>
        <button className={s.topHamb} onClick={toggle} aria-label="Menú">
          <span /><span /><span />
        </button>
        <div className={s.topMarca}>
          <img src={logo} alt="Logo" className={s.topLogo} />
          <div className={s.topTextos}>
            <span className={s.topNombre}>Automatización</span>
            <span className={s.topSub}>Ingeniería de Procesos</span>
          </div>
        </div>
      </header>

      {/* Overlay para cerrar el drawer al tocar fuera */}
      {colapsado && <div className={s.overlay} onClick={toggle} />}

      <MenuLateral colapsado={colapsado} onToggle={toggle} />

      <main className={s.lienzo}>
        <Routes>
          <Route path="/" element={<Navigate to="/procesos" replace />} />
          <Route path="/procesos" element={<GestionProcesosView />} />
          <Route path="/ficha" element={<FichaProcesoView />} />
          <Route path="/indicadores" element={<IndicadoresView />} />
          <Route path="/sixsigma" element={<SixSigmaView />} />
          <Route path="/mejoras" element={<MejorasView />} />
          <Route path="/reporte" element={<ReporteView />} />
          <Route path="/perfil" element={<PerfilView />} />
        </Routes>
      </main>
    </div>
  );
}
