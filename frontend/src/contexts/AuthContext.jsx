import { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const u = localStorage.getItem("sgp_usuario");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((datos) => {
    localStorage.setItem("sgp_token",   datos.token);
    localStorage.setItem("sgp_refresh", datos.refresh);
    localStorage.setItem("sgp_usuario", JSON.stringify(datos.usuario));
    setUsuario(datos.usuario);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sgp_token");
    localStorage.removeItem("sgp_refresh");
    localStorage.removeItem("sgp_usuario");
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, estaAutenticado: !!usuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
