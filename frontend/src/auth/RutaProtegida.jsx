import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RutaProtegida({ children }) {
  const { estaAutenticado } = useAuth();
  return estaAutenticado ? children : <Navigate to="/login" replace />;
}
