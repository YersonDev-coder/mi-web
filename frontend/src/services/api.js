// Cliente HTTP centralizado con autenticación JWT.
const BASE = "http://localhost:8000/api";

function getToken()   { return localStorage.getItem("sgp_token")   || ""; }
function getRefresh() { return localStorage.getItem("sgp_refresh") || ""; }

function _guardarTokens(data) {
  if (data.token)   localStorage.setItem("sgp_token",   data.token);
  if (data.refresh) localStorage.setItem("sgp_refresh", data.refresh);
}

async function _renovarToken() {
  const refresh = getRefresh();
  if (!refresh) throw new Error("sin_refresh");
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) throw new Error("refresh_fallido");
  const data = await res.json();
  _guardarTokens(data);
  return data.token;
}

function _redirigirLogin() {
  ["sgp_token", "sgp_refresh", "sgp_usuario"].forEach((k) => localStorage.removeItem(k));
  window.location.href = "/login";
}

async function peticion(ruta, opciones = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opciones.headers || {}),
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res = await fetch(`${BASE}${ruta}`, { ...opciones, headers });

  if (res.status === 401) {
    let body;
    try { body = await res.clone().json(); } catch { body = {}; }

    if (body.code === "expired") {
      try {
        const nuevoToken = await _renovarToken();
        headers["Authorization"] = `Bearer ${nuevoToken}`;
        res = await fetch(`${BASE}${ruta}`, { ...opciones, headers });
      } catch {
        _redirigirLogin();
        return;
      }
    } else {
      _redirigirLogin();
      return;
    }
  }

  return res.ok ? res.json() : Promise.reject(res);
}

// --- Módulo: Identificación de Procesos ---
export const obtenerProcesos = () => peticion("/procesos/");
export const crearProceso = (datos) => peticion("/procesos/", { method: "POST", body: JSON.stringify(datos) });
export const actualizarProceso = (id, datos) => peticion(`/procesos/${id}/`, { method: "PUT", body: JSON.stringify(datos) });
export const eliminarProceso = (id) => peticion(`/procesos/${id}/`, { method: "DELETE" });

// --- Módulo: Inventario de Procesos (jerárquico) ---
export const obtenerHijos = (padre) => peticion(`/inventario/${padre ? `?padre=${padre}` : ""}`);
export const crearNodo = (datos) => peticion("/inventario/", { method: "POST", body: JSON.stringify(datos) });
export const actualizarNodo = (id, datos) => peticion(`/inventario/${id}/`, { method: "PUT", body: JSON.stringify(datos) });
export const eliminarNodo = (id) => peticion(`/inventario/${id}/`, { method: "DELETE" });
export const obtenerRuta = (id) => peticion(`/inventario/${id}/ruta/`);
export const obtenerInventarioCompleto = () => peticion("/inventario/completo/");

// --- Módulo: Ficha de Proceso ---
export const obtenerArbol = (tipo) => peticion(`/fichas/arbol/?tipo=${encodeURIComponent(tipo)}`);
export const obtenerFicha = (idProceso) => peticion(`/fichas/proceso/${idProceso}/`);
export const guardarMaestro = (idProceso, datos) => peticion(`/fichas/proceso/${idProceso}/`, { method: "PUT", body: JSON.stringify(datos) });
export const agregarDetalle = (hoja, datos) => peticion(`/fichas/detalle/${hoja}/`, { method: "POST", body: JSON.stringify(datos) });
export const editarDetalle = (hoja, id, datos) => peticion(`/fichas/detalle/${hoja}/${id}/`, { method: "PUT", body: JSON.stringify(datos) });
export const borrarDetalle = (hoja, id) => peticion(`/fichas/detalle/${hoja}/${id}/`, { method: "DELETE" });
export const guardarDiagramaManual = (idProceso, codigo) => peticion(`/fichas/proceso/${idProceso}/diagrama/`, { method: "PUT", body: JSON.stringify({ codigo }) });
export const previsualizarDiagrama = (idProceso, codigo) => peticion(`/fichas/proceso/${idProceso}/diagrama/preview/`, { method: "POST", body: JSON.stringify({ codigo }) });

// --- Módulo: Ficha de Indicador ---
export const obtenerArbolInd = (tipo) => peticion(`/indicadores/arbol/?tipo=${encodeURIComponent(tipo)}`);
export const indicadoresDeProceso = (idProceso) => peticion(`/indicadores/proceso/${idProceso}/`);
export const crearIndicador = (idProceso, datos) => peticion(`/indicadores/proceso/${idProceso}/`, { method: "POST", body: JSON.stringify(datos) });
export const obtenerIndicador = (id) => peticion(`/indicadores/${id}/`);
export const actualizarIndicador = (id, datos) => peticion(`/indicadores/${id}/`, { method: "PUT", body: JSON.stringify(datos) });
export const eliminarIndicador = (id) => peticion(`/indicadores/${id}/`, { method: "DELETE" });
export const generarCronograma = (id, datos) => peticion(`/indicadores/${id}/cronograma/`, { method: "POST", body: JSON.stringify(datos) });
export const actualizarLineaBase = (id, anio, valor) => peticion(`/indicadores/${id}/linea-base/`, { method: "PUT", body: JSON.stringify({ anio, valor }) });
export const agregarDetalleInd = (hoja, datos) => peticion(`/indicadores/detalle/${hoja}/`, { method: "POST", body: JSON.stringify(datos) });
export const editarDetalleInd = (hoja, id, datos) => peticion(`/indicadores/detalle/${hoja}/${id}/`, { method: "PUT", body: JSON.stringify(datos) });
export const borrarDetalleInd = (hoja, id) => peticion(`/indicadores/detalle/${hoja}/${id}/`, { method: "DELETE" });

export const obtenerReporteAvance = (hasta = null) =>
  peticion(`/indicadores/reporte/${hasta ? `?hasta=${encodeURIComponent(hasta)}` : ""}`);
export const obtenerPeriodosReporte = () => peticion("/indicadores/reporte/periodos/");
export const migrarCodigosOesAes = () => peticion("/indicadores/migrar-codigos/");
export const obtenerReporteIdentificacion = (tipo = null) =>
  peticion(`/indicadores/reporte/identificacion/${tipo ? `?tipo=${encodeURIComponent(tipo)}` : ""}`);
export const guardarConfigInd = (clave, valor) =>
  peticion("/indicadores/config/", { method: "POST", body: JSON.stringify({ clave, valor }) });
export const obtenerEstadosProceso = () => peticion("/indicadores/estados-proceso/");
export const actualizarEstadoProceso = (id, estado) =>
  peticion(`/indicadores/estados-proceso/${id}/`, { method: "PATCH", body: JSON.stringify({ estado }) });

// --- Módulo: Ficha de Mejora de Proceso ---
export const obtenerArbolMej = (tipo) => peticion(`/mejoras/arbol/?tipo=${encodeURIComponent(tipo)}`);
export const obtenerCatalogos = () => peticion("/mejoras/catalogos/");
export const obtenerMejora = (idProceso) => peticion(`/mejoras/proceso/${idProceso}/`);
export const guardarMejora = (idProceso, datos) => peticion(`/mejoras/proceso/${idProceso}/`, { method: "PUT", body: JSON.stringify(datos) });
export const eliminarMejora = (idProceso) => peticion(`/mejoras/proceso/${idProceso}/`, { method: "DELETE" });
export const obtenerResultadosMejora = () => peticion("/mejoras/resultados/");

// --- Módulo: Six Sigma DMAIC ---
const _post = (ruta, datos) => peticion(ruta, { method: "POST", body: JSON.stringify(datos) });
const _put  = (ruta, datos) => peticion(ruta, { method: "PUT",  body: JSON.stringify(datos) });
const _del  = (ruta)        => peticion(ruta, { method: "DELETE" });

// Carga de datos desde Excel existente (solo lectura)
export const ssCargaArchivos      = ()         => peticion("/ss/carga/archivos/");
export const ssCargaHojas         = (arch)     => peticion(`/ss/carga/hojas/?archivo=${encodeURIComponent(arch)}`);
export const ssCargaPrevisualizar = (datos)    => _post("/ss/carga/previsualizar/", datos);
export const ssCargaImportar      = (datos)    => _post("/ss/carga/importar/", datos);

// DEFINE
export const ssDefiniciones    = ()         => peticion("/ss/definicion/");
export const ssCrearDef        = (datos)    => _post("/ss/definicion/", datos);
export const ssObtenerDef      = (id)       => peticion(`/ss/definicion/${id}/`);
export const ssActualizarDef   = (id, d)    => _put(`/ss/definicion/${id}/`, d);
export const ssEliminarDef     = (id)       => _del(`/ss/definicion/${id}/`);
export const ssValidar         = (id)       => peticion(`/ss/validar/${id}/`);

// MEASURE
export const ssMediciones      = (id)       => peticion(`/ss/mediciones/${id}/`);
export const ssAgregarMed      = (id, d)    => _post(`/ss/mediciones/${id}/`, d);
export const ssActualizarMed   = (idM, d)   => _put(`/ss/medicion/${idM}/`, d);
export const ssEliminarMed     = (idM)      => _del(`/ss/medicion/${idM}/`);

// ANALYZE
export const ssPareto          = (id)       => peticion(`/ss/analisis/${id}/pareto/`);
export const ssTemporal        = (id)       => peticion(`/ss/analisis/${id}/temporal/`);
export const ssIshikawa        = (id)       => peticion(`/ss/ishikawa/${id}/`);
export const ssAgregarCausa    = (id, d)    => _post(`/ss/ishikawa/${id}/`, d);
export const ssEliminarCausa   = (idC)      => _del(`/ss/ishikawa/causa/${idC}/`);
export const ssPorques         = (id)       => peticion(`/ss/porques/${id}/`);
export const ssAgregarPorques  = (id, d)    => _post(`/ss/porques/${id}/`, d);
export const ssActualizarPorques = (idP, d) => _put(`/ss/porques/detalle/${idP}/`, d);
export const ssEliminarPorques = (idP)      => _del(`/ss/porques/detalle/${idP}/`);

// IMPROVE
export const ssMejoras         = (id)       => peticion(`/ss/mejoras/${id}/`);
export const ssAgregarMejora   = (id, d)    => _post(`/ss/mejoras/${id}/`, d);
export const ssActualizarMejora = (idM, d)  => _put(`/ss/mejora/${idM}/`, d);
export const ssEliminarMejora  = (idM)      => _del(`/ss/mejora/${idM}/`);

// CONTROL
export const ssPlanControl     = (id)       => peticion(`/ss/control/${id}/plan/`);
export const ssAgregarControl  = (id, d)    => _post(`/ss/control/${id}/plan/`, d);
export const ssEliminarControl = (idC)      => _del(`/ss/ctrl/${idC}/`);
export const ssCartaControl    = (id)       => peticion(`/ss/control/${id}/carta/`);

// HISTÓRICO y DASHBOARD
export const ssHistorico       = (id)       => peticion(id ? `/ss/historico/?id_def=${id}` : "/ss/historico/");
export const ssDashboard       = ()         => peticion("/ss/dashboard/");

// IMPORTAR DESDE SISTEMA DE INDICADORES (solo lectura de indicadores existentes)
export const ssSistemaProcesos    = ()     => peticion("/ss/sistema/procesos/");
export const ssSistemaCrearDesde  = (d)   => _post("/ss/sistema/crear-desde/", d);
export const ssSistemaReimportar  = (id)  => _post(`/ss/sistema/reimportar/${id}/`, {});

// --- Autenticación y Perfil ---
export const authLogin          = (d) => fetch(`${BASE}/auth/login/`,    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
export const authRegistro       = (d) => fetch(`${BASE}/auth/registro/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(e)));
export const authYo             = ()  => peticion("/auth/yo/");
export const authLogout         = ()  => peticion("/auth/logout/",          { method: "POST" });
export const authActualizarPerfil = (d) => peticion("/auth/perfil/",        { method: "PUT",    body: JSON.stringify(d) });
export const authCambiarPassword  = (d) => peticion("/auth/cambiar-password/", { method: "PUT", body: JSON.stringify(d) });
export const authEliminarCuenta   = (d) => peticion("/auth/cuenta/",        { method: "DELETE", body: JSON.stringify(d) });
