import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import RutaProtegida from "./auth/RutaProtegida";
import LoginView from "./auth/LoginView";
import RegisterView from "./auth/RegisterView";
import ContenedorGeneral from "./components/ContenedorGeneral";
import PresentacionView from "./presentacion/PresentacionView";
import DiagramaView from "./views/DiagramaView";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Pública — presentación */}
          <Route path="/" element={<PresentacionView />} />

          {/* Autenticación */}
          <Route path="/login"    element={<LoginView />} />
          <Route path="/registro" element={<RegisterView />} />

          {/* Diagrama (protegido) */}
          <Route
            path="/diagrama/:id"
            element={
              <RutaProtegida>
                <DiagramaView />
              </RutaProtegida>
            }
          />

          {/* App principal (protegida) */}
          <Route
            path="/*"
            element={
              <RutaProtegida>
                <ContenedorGeneral />
              </RutaProtegida>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
