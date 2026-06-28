import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  obtenerReporteAvance, obtenerPeriodosReporte,
  obtenerReporteIdentificacion, actualizarIndicador, actualizarLineaBase,
  obtenerEstadosProceso, actualizarEstadoProceso,
  ssSistemaProcesos, ssSistemaCrearDesde,
} from "../services/api";
import "./ReporteView.css";

// ──────────────────────────────────────────────────────────────────────────────
// FECHA DE REFERENCIA PARA ALERTAS
// Para simular un momento específico, cambia la fecha aquí:
const FECHA_HOY   = "2026-06-09";  // <── cambia para simular
const ES_SIMULADO = true;           // <── pon false cuando uses tiempo real
//
// Cuando quieras tiempo real, reemplaza las dos líneas de arriba por:
//   const FECHA_HOY   = new Date().toISOString().slice(0, 10);
//   const ES_SIMULADO = false;
// ──────────────────────────────────────────────────────────────────────────────

const COLOR_MAP  = { verde: "#16a34a", amarillo: "#eab308", rojo: "#dc2626" };
const COLOR_BG   = { verde: "#dcfce7", amarillo: "#fef9c3", rojo: "#fee2e2" };
const SEMAFORO   = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
const ETIQUETA   = { verde: "Óptimo", amarillo: "En proceso", rojo: "Crítico" };

// Paleta de grupos de proceso — sin verde/amarillo/rojo (reservados para el semáforo)
// Colores con máxima separación visual en el espectro
const GRUPO_PALETA = [
  { bar: "#1D4ED8", bg: "#EFF6FF", txt: "#1E40AF", border: "#BFDBFE" }, // azul
  { bar: "#F97316", bg: "#FFF7ED", txt: "#C2410C", border: "#FED7AA" }, // naranja
  { bar: "#9333EA", bg: "#F5F3FF", txt: "#7E22CE", border: "#DDD6FE" }, // violeta
  { bar: "#06B6D4", bg: "#ECFEFF", txt: "#0E7490", border: "#A5F3FC" }, // cian brillante
  { bar: "#EC4899", bg: "#FDF2F8", txt: "#BE185D", border: "#FBCFE8" }, // rosa fuerte
  { bar: "#78716C", bg: "#F5F5F4", txt: "#57534E", border: "#D6D3D1" }, // piedra
];

function buildGrupoMap(filas) {
  const grupos = [...new Set(filas.map((d) => d.grupo).filter(Boolean))].sort();
  const map = {};
  grupos.forEach((g, i) => { map[g] = GRUPO_PALETA[i % GRUPO_PALETA.length]; });
  return map;
}

function ultimaFecha(periodo) {
  if (!periodo) return "—";
  const partes = String(periodo).split("→");
  return (partes[partes.length - 1] || "").trim() || "—";
}

// Alerta real: no llegó a su propia meta (cumplimiento < 100%) y no es verde
function esAlertaPendiente(d) {
  const pct   = d.cumplimiento_pct ?? 0;
  const color = d.estado?.color || "rojo";
  return pct < 100 && (color === "rojo" || color === "amarillo");
}

function colorDe(d) { return d.estado?.color || "rojo"; }

const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_C  = ["Ene","Feb","Mar","Abr","May","Jun",
                  "Jul","Ago","Sep","Oct","Nov","Dic"];

function formatPeriodo(p) {
  if (!p) return "—";
  // "YYYY-MM-DD → YYYY-MM-DD"
  const rango = String(p).match(
    /^(\d{4})-(\d{2})-(\d{2})\s*[→>-]+\s*(\d{4})-(\d{2})-(\d{2})$/
  );
  if (rango) {
    const [, y1, m1, d1, y2, m2, d2] = rango;
    const ms = new Date(+y1, +m1-1, +d1);
    const me = new Date(+y2, +m2-1, +d2);
    const dias = (me - ms) / 86400000;
    if (dias <= 13) {
      // Periodo semanal o quincenal: mostrar rango de días compacto
      if (m1 === m2 && y1 === y2)
        return `${d1}-${d2} ${MESES_C[+m1-1]} ${y1.slice(2)}`;
      return `${d1}${MESES_C[+m1-1]}-${d2}${MESES_C[+m2-1]} ${y1.slice(2)}`;
    }
    // Periodo mensual o mayor
    if (m1 === m2 && y1 === y2) return `${MESES_ES[+m1 - 1]} ${y1}`;
    return `${MESES_ES[+m1 - 1]} ${y1} → ${MESES_ES[+m2 - 1]} ${y2}`;
  }
  // "YYYY-MM-DD"
  const simple = String(p).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (simple) return `${simple[3]}/${simple[2]}/${simple[1]}`;
  return p;
}

// Elimina periodos cuya etiqueta formateada ya apareció (evita duplicados como "Junio 2026" × 2)
function periodosUnicos(lista) {
  const visto = new Set();
  const result = [];
  for (const p of lista) {
    const label = formatPeriodo(p);
    if (!visto.has(label)) { visto.add(label); result.push({ value: p, label }); }
  }
  return result;
}

export default function ReporteView() {
  const navigate = useNavigate();
  const [tabActivo, setTabActivo]       = useState("avance"); // avance | identificacion
  const [todos, setTodos]               = useState([]);
  const [cargando, setCargando]         = useState(true);
  const [nivelSel, setNivelSel]         = useState(null);
  const [periodoSel, setPeriodoSel]     = useState(null);
  const [periodosDisp, setPeriodosDisp] = useState([]);
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [estadosProceso, setEstadosProceso] = useState({});
  const alertasRef = useRef(null);

  useEffect(() => { obtenerPeriodosReporte().then(setPeriodosDisp); }, []);
  useEffect(() => { obtenerEstadosProceso().then(setEstadosProceso); }, []);

  const handleCambioEstado = async (idProceso, nuevoEstado) => {
    await actualizarEstadoProceso(idProceso, nuevoEstado);
    setEstadosProceso((prev) => ({ ...prev, [String(idProceso)]: nuevoEstado }));
    if (nuevoEstado === "mejorar") {
      navigate("/mejoras", { state: { idProceso } });
    }
  };

  useEffect(() => {
    setCargando(true);
    obtenerReporteAvance(periodoSel)
      .then((data) => {
        setTodos(data);
        setNivelSel((prev) => {
          if (prev !== null) return prev;
          const nv = [...new Set(data.map((d) => d.nivel))].sort((a, b) => a - b);
          return nv.length > 0 ? nv[nv.length - 1] : null;
        });
      })
      .finally(() => setCargando(false));
  }, [periodoSel]);

  useEffect(() => {
    function handleClick(e) {
      if (alertasRef.current && !alertasRef.current.contains(e.target)) {
        setAlertasAbiertas(false);
      }
    }
    if (alertasAbiertas) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [alertasAbiertas]);

  const niveles    = [...new Set(todos.map((d) => d.nivel))].sort((a, b) => a - b);
  const datos      = nivelSel !== null ? todos.filter((d) => d.nivel === nivelSel) : todos;
  const pendientes = datos.filter(esAlertaPendiente);

  return (
    <div className="rep-vista">
      {/* ── Cabecera ── */}
      <div className="rep-cabecera">
        <h2>Análisis</h2>
        <div className="rep-tabs">
          <button
            className={`rep-tab ${tabActivo === "avance" ? "activo" : ""}`}
            onClick={() => setTabActivo("avance")}
          >Avance de Procesos</button>
          <button
            className={`rep-tab ${tabActivo === "identificacion" ? "activo" : ""}`}
            onClick={() => setTabActivo("identificacion")}
          >Identificación de Alertas</button>
        </div>
      </div>

      {/* ── Barra de filtros + alertas ── */}
      <div className="rep-controles">
        {tabActivo === "avance" && !cargando && (
            <div className="rep-filtros-combo">
              {niveles.length > 0 && (
                <div className="rep-filtro-combo">
                  <span className="rep-filtro-label">Nivel:</span>
                  <select className="rep-select" value={nivelSel ?? ""}
                    onChange={(e) => setNivelSel(+e.target.value)}>
                    {niveles.map((n) => <option key={n} value={n}>Nivel {n}</option>)}
                  </select>
                </div>
              )}
              <div className="rep-filtro-combo">
                <span className="rep-filtro-label">Periodo:</span>
                <select className="rep-select" value={periodoSel ?? ""}
                  onChange={(e) => setPeriodoSel(e.target.value || null)}>
                  <option value="">Todos los periodos</option>
                  {periodosUnicos(periodosDisp).map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Botón alertas */}
          {tabActivo === "avance" && !cargando && (
            <div className="rep-alertas-wrap" ref={alertasRef}>
              <button
                className={`rep-alertas-btn ${pendientes.length > 0 ? "hay-alertas" : "sin-alertas"}`}
                onClick={() => setAlertasAbiertas((v) => !v)}
              >
                {pendientes.length > 0 ? "⚠️" : "✅"}
                {pendientes.length > 0 ? "Alertas" : "Sin alertas"}
                {pendientes.length > 0 && (
                  <span className="rep-badge-count">{pendientes.length}</span>
                )}
              </button>
              {alertasAbiertas && (
                <DropdownAlertas datos={datos} fecha={FECHA_HOY} simulado={ES_SIMULADO} />
              )}
            </div>
          )}
      </div>

      {/* ── Contenido ── */}
      <div className="rep-contenido">
        {tabActivo === "avance" ? (
          cargando ? (
            <div className="rep-vacio">Cargando datos…</div>
          ) : todos.length === 0 ? (
            <div className="rep-vacio">No hay indicadores registrados.</div>
          ) : datos.length === 0 ? (
            <div className="rep-vacio">No hay procesos en el nivel {nivelSel}.</div>
          ) : (
            <GraficaAvance datos={datos} periodoSel={periodoSel} todos={todos}
              estadosProceso={estadosProceso} onCambioEstado={handleCambioEstado} />
          )
        ) : (
          <IdentificacionTab />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PESTAÑA: IDENTIFICACIÓN DE ALERTAS
// ═══════════════════════════════════════════════════════════════════════════════

const RID_COLOR    = { verde: "#16a34a", amarillo: "#eab308", rojo: "#dc2626" };
const RID_COLOR_BG = { verde: "#dcfce7", amarillo: "#fef9c3", rojo: "#fee2e2" };

// Calcula resumen y alertas desde filas + periodoCorte (dinámico)
function computarResumenAlertas(filas, periodoCorte, rangos) {
  if (!filas?.length || !periodoCorte) return { resumenDinamico: {}, alertasDinamicas: [] };

  const resumen = {
    objetivos:     { verde: 0, amarillo: 0, rojo: 0 },
    ind_objetivos: { verde: 0, amarillo: 0, rojo: 0 },
    acciones:      { verde: 0, amarillo: 0, rojo: 0 },
    ind_acciones:  { verde: 0, amarillo: 0, rojo: 0 },
  };
  const alertas = [];

  // Indica si un indicador tiene al menos un logro planificado hasta el corte
  const planificadoHasta = (f) =>
    f.logros && Object.keys(f.logros).some((k) => k <= periodoCorte && (f.logros[k] ?? 0) > 0);

  // Paso 1: pre-computar suma ponderada por OEI y AEI (solo indicadores planificados)
  const pSumas = {};
  let curOEI = null, curAEI = null;
  for (const f of filas) {
    if (f.tipo === "objetivo")       { curOEI = f; curAEI = null; }
    else if (f.tipo === "accion")    { curAEI = f; }
    else if (f.tipo === "ind_detalle" && f.peso != null && planificadoHasta(f)) {
      const contrib = (Number(f.peso) || 0) * (calcularATILocal(f, periodoCorte) ?? 0);
      if (curOEI) pSumas[curOEI.codigo] = (pSumas[curOEI.codigo] || 0) + contrib;
      if (curAEI) pSumas[curAEI.codigo] = (pSumas[curAEI.codigo] || 0) + contrib;
    }
  }

  // Paso 2: clasificar filas y acumular (solo indicadores planificados hasta el corte)
  curOEI = null; curAEI = null;
  // Rastrear si cada OEI/AEI tiene al menos un indicador planificado hasta el corte
  const oeiConDatos = new Set();
  const aeiConDatos = new Set();
  for (const f of filas) {
    if (f.tipo === "objetivo")    { curOEI = f; curAEI = null; }
    else if (f.tipo === "accion") { curAEI = f; }
    else if (f.tipo === "ind_detalle" && planificadoHasta(f)) {
      if (curOEI) oeiConDatos.add(curOEI.codigo);
      if (curAEI) aeiConDatos.add(curAEI.codigo);
    }
  }

  curOEI = null; curAEI = null;
  for (const f of filas) {
    if (f.tipo === "objetivo") {
      curOEI = f; curAEI = null;
      if (!oeiConDatos.has(f.codigo)) continue;
      const ati   = pSumas[f.codigo] ?? 0;
      const color = colorDeATII(ati, rangos) || "rojo";
      resumen.objetivos[color]++;
      if (color !== "verde") alertas.push({ tipo: "oei", codigo: f.codigo, descripcion: f.descripcion, color, avance: +ati.toFixed(2), nivel: "OEI" });
    } else if (f.tipo === "accion") {
      curAEI = f;
      if (!aeiConDatos.has(f.codigo)) continue;
      const ati   = pSumas[f.codigo] ?? 0;
      const color = colorDeATII(ati, rangos) || "rojo";
      resumen.acciones[color]++;
      if (color !== "verde") alertas.push({ tipo: "aei", codigo: f.codigo, descripcion: f.descripcion, color, avance: +ati.toFixed(2), nivel: "AEI" });
    } else if (f.tipo === "ind_detalle" && planificadoHasta(f)) {
      const ati   = calcularATILocal(f, periodoCorte);
      const color = colorDeATII(ati, rangos) || "rojo";
      if (curAEI) {
        resumen.ind_acciones[color]++;
        if (color !== "verde") alertas.push({ tipo: "indicador", codigo: f.codigo, descripcion: f.descripcion, color, avance: ati != null ? +ati.toFixed(2) : null, nivel: "Ind. AEI" });
      } else if (curOEI) {
        resumen.ind_objetivos[color]++;
        if (color !== "verde") alertas.push({ tipo: "indicador", codigo: f.codigo, descripcion: f.descripcion, color, avance: ati != null ? +ati.toFixed(2) : null, nivel: "Ind. OEI" });
      }
    }
  }

  return {
    resumenDinamico: resumen,
    alertasDinamicas: alertas.length > 0
      ? alertas
      : [{ tipo: "info", descripcion: "Sin alertas pendientes en el periodo seleccionado.", color: "verde" }],
  };
}

// ── Componente padre de la pestaña ──────────────────────────────────────────
function filtrarFilasPorNivel(filas, nivelSel) {
  if (nivelSel === null) return filas;
  const resultado = [];
  let objIdx = -1, accIdx = -1;
  for (const fila of filas) {
    if (fila.tipo === "objetivo") {
      objIdx = resultado.length;
      resultado.push({ ...fila, _pendiente: true });
      accIdx = -1;
    } else if (fila.tipo === "accion") {
      accIdx = resultado.length;
      resultado.push({ ...fila, _pendiente: true });
    } else if (fila.tipo === "ind_detalle") {
      if ((fila.nivel_proceso ?? 0) !== nivelSel) continue;
      // Confirmar los padres pendientes
      if (objIdx >= 0 && resultado[objIdx]?._pendiente) {
        resultado[objIdx] = { ...resultado[objIdx], _pendiente: false };
      }
      if (accIdx >= 0 && resultado[accIdx]?._pendiente) {
        resultado[accIdx] = { ...resultado[accIdx], _pendiente: false };
      }
      resultado.push(fila);
    }
  }
  return resultado.filter((f) => !f._pendiente);
}

function IdentificacionTab() {
  const [datos, setDatos]           = useState(null);
  const [cargando, setCargando]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [periodoFiltro, setPeriodoFiltro] = useState(null);
  const [nivelSel, setNivelSel]     = useState(null);

  const recargar = () => {
    setCargando(true);
    obtenerReporteIdentificacion()
      .then((d) => {
        setDatos(d);
        if (d?.periodos?.length > 0) {
          setPeriodoFiltro((prev) => prev || d.periodos[d.periodos.length - 1]);
        }
      })
      .finally(() => setCargando(false));
  };

  useEffect(() => { recargar(); /* eslint-disable-next-line */ }, []);

  const onCambiarRelevancia = async (idIndicador, nuevaRelevancia) => {
    setGuardando(true);
    try {
      await actualizarIndicador(idIndicador, { relevancia: nuevaRelevancia });
      recargar();
    } finally {
      setGuardando(false);
    }
  };

  const opcionesPeriodo = datos?.periodos ? periodosUnicos(datos.periodos) : [];

  // Niveles disponibles derivados de las filas ind_detalle
  const nivelesDisp = datos?.filas
    ? [...new Set(
        datos.filas
          .filter((f) => f.tipo === "ind_detalle" && f.nivel_proceso != null)
          .map((f) => f.nivel_proceso)
      )].sort((a, b) => a - b)
    : [];

  const periodoCorte = periodoFiltro
    || datos?.ult_periodo
    || (datos?.periodos?.[datos.periodos.length - 1] ?? null);
  const { resumenDinamico, alertasDinamicas } = computarResumenAlertas(datos?.filas, periodoCorte, datos?.rangos);

  // Datos filtrados por nivel (sólo se pasan a TablaIdentificacion)
  const datosFiltrados = datos
    ? { ...datos, filas: filtrarFilasPorNivel(datos.filas, nivelSel) }
    : null;

  return (
    <div>
      {guardando && (
        <div style={{ padding: "4px 12px", fontSize: 12, color: "#2563eb", background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
          Recalculando pesos y Avance Tipo I…
        </div>
      )}

      {/* ── Barra de filtros: periodo + nivel ── */}
      {!cargando && datos && (
        <div className="rid-filtro-barra">
          {opcionesPeriodo.length > 0 && (
            <>
              <span className="rid-filtro-label">Periodo:</span>
              <select
                className="rid-filtro-sel"
                value={periodoFiltro || ""}
                onChange={(e) => setPeriodoFiltro(e.target.value || null)}
              >
                {opcionesPeriodo.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {periodoFiltro && (
                <span className="rid-filtro-badge">{labelPeriodo(periodoFiltro)}</span>
              )}
            </>
          )}

          {nivelesDisp.length > 1 && (
            <>
              <span className="rid-filtro-label" style={{ marginLeft: 16 }}>Nivel:</span>
              <select
                className="rid-filtro-sel"
                value={nivelSel ?? ""}
                onChange={(e) => setNivelSel(e.target.value === "" ? null : Number(e.target.value))}
              >
                <option value="">Todos los niveles</option>
                {nivelesDisp.map((n) => (
                  <option key={n} value={n}>Nivel {n}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {cargando ? (
        <div className="rep-vacio">Cargando datos…</div>
      ) : !datos ? null
      : datos.filas.length === 0 ? (
        <div className="rep-vacio" style={{ flexDirection: "column", gap: 8 }}>
          <span>No hay objetivos estratégicos registrados.</span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Ingresa el OEI y AEI en Gestión de Procesos → Jerarquía y Subprocesos (Nivel 0).
          </span>
        </div>
      ) : (
        <>
          <TablaIdentificacion
            datos={datosFiltrados}
            onCambiarRelevancia={onCambiarRelevancia}
            periodoFiltro={periodoFiltro}
          />
          <TablaSemaforoNivel
            rangos={datos.rangos || []}
            resumen={resumenDinamico}
            ultPeriodo={periodoCorte || datos.ult_periodo || ""}
          />
          <AlertasAuto alertas={alertasDinamicas} />
        </>
      )}
    </div>
  );
}

// ── Tabla detalle por indicador (formato Ceplan A11) ────────────────────────
const MESES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function labelPeriodo(p) {
  // Rango de fechas "YYYY-MM-DD → YYYY-MM-DD"
  const rango = String(p || "").match(
    /^(\d{4})-(\d{2})-(\d{2})\s*[→>-]+\s*(\d{4})-(\d{2})-(\d{2})$/
  );
  if (rango) {
    const [, y1, m1, d1, y2, m2, d2] = rango;
    const dias = (new Date(+y2, +m2-1, +d2) - new Date(+y1, +m1-1, +d1)) / 86400000;
    if (dias <= 13) {
      // Período semanal o quincenal: mostrar rango de días
      if (m1 === m2 && y1 === y2)
        return `${d1}-${d2} ${MESES_CORTO[+m1-1]}`;
      return `${d1} ${MESES_CORTO[+m1-1]}-${d2} ${MESES_CORTO[+m2-1]}`;
    }
    // Período mensual o mayor: solo mes
    return `${MESES_CORTO[+m1-1]} ${y1.slice(2)}`;
  }
  // Fallback: extraer mes del inicio
  const m = String(p || "").match(/^(\d{4})-(\d{2})/);
  if (!m) return String(p || "");
  return `${MESES_CORTO[+m[2] - 1]} ${m[1].slice(2)}`;
}

function colorPct(pct) {
  if (pct == null) return "transparent";
  if (pct >= 95)   return "#dcfce7";
  if (pct >= 75)   return "#fef9c3";
  return "#fee2e2";
}
function textPct(pct) {
  if (pct == null) return "transparent";
  if (pct >= 95)   return "#14532d";
  if (pct >= 75)   return "#78350f";
  return "#7f1d1d";
}

// Devuelve el último valor acumulado en `dict` cuya clave sea <= periodoActual.
// f.avances solo guarda periodos CON movimiento; el valor es acumulado hasta ese punto.
function ultimoCumul(dict, periodoActual) {
  if (!dict || !periodoActual) return null;
  const keys = Object.keys(dict).filter((k) => k <= periodoActual).sort();
  if (!keys.length) return null;
  const v = parseFloat(dict[keys[keys.length - 1]]);
  return isNaN(v) ? null : v;
}

// Obtiene VO: usa f.av_cumul (acumulado en todos los periodos del cronograma)
// para que el filtro de fecha funcione correctamente en cualquier periodo.
// Fallback a f.avances (solo periodos con incremento) y luego a f.vo (último total).
function obtenerVO(f, periodoActual) {
  const desdeCompleto = ultimoCumul(f.av_cumul, periodoActual);
  if (desdeCompleto != null) return desdeCompleto;
  const desdeAcum = ultimoCumul(f.avances, periodoActual);
  if (desdeAcum != null) return desdeAcum;
  const voFallback = parseFloat(f.vo);
  return isNaN(voFallback) ? 0 : voFallback;
}

// Obtiene LE: busca el último logro POSITIVO <= periodo.
// Los logros con valor 0 se ignoran (significan "semana sin meta planificada").
function obtenerLE(f, periodoActual) {
  if (!f.logros || !periodoActual) {
    const fb = parseFloat(f.le);
    return isNaN(fb) ? 0 : fb;
  }
  // Último periodo <= corte con logro > 0
  const keys = Object.keys(f.logros)
    .filter((k) => k <= periodoActual && (f.logros[k] ?? 0) > 0)
    .sort();
  if (keys.length) return f.logros[keys[keys.length - 1]];
  // Fallback al valor precomputado por el backend
  const fb = parseFloat(f.le);
  return isNaN(fb) ? 0 : fb;
}

function pesoAFraccion(peso) {
  if (peso == null) return "—";
  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
  for (let d = 1; d <= 50; d++) {
    const n = Math.round(peso * d);
    if (Math.abs(n / d - peso) < 0.0005) {
      const g = gcd(n, d);
      return `${n / g}/${d / g}`;
    }
  }
  return `${Math.round(peso * 100)}%`;
}

// ATI calculado localmente para que responda al filtro de periodo (2 decimales, sin redondear).
function calcularATILocal(f, periodoActual) {
  const VO = obtenerVO(f, periodoActual);
  const LE = obtenerLE(f, periodoActual);
  if (!LE) return f.avance_tipo_i ?? 0;
  const sentido = String(f.sentido || "").toLowerCase();
  const fmt = (n) => parseFloat(Math.min(100, n).toFixed(2));
  if (sentido.includes("desc")) {
    return VO === 0 ? 100 : fmt(LE / VO * 100);
  }
  return fmt(VO / LE * 100);
}

// ATII: fórmula Ceplan usando el acumulado hasta el periodo seleccionado.
// No agregable ascendente:  (VO - LB) / (LE - LB) × 100
// No agregable descendente: (LB - VO) / (LB - LE) × 100
// Agregable: VO_acum / LE_acum × 100
// Cuando LB = 0: ATII = ATI (matemáticamente idénticos).
// Cuando LB ≠ 0: ATII ≠ ATI.
function calcularATII(f, periodoActual, lbOverride) {
  const sentido   = String(f.sentido || "").toLowerCase();
  const esNoAgreg = String(f.tipo_agregacion || "").toLowerCase().startsWith("no");
  const LB = lbOverride !== undefined ? lbOverride : (parseFloat(f.lb_valor ?? 0) || 0);

  const VO = obtenerVO(f, periodoActual);
  const LE = obtenerLE(f, periodoActual);
  if (!LE) return null;

  const fmt = (n) => parseFloat(Math.min(100, n).toFixed(2));

  if (!esNoAgreg) {
    // Agregable: VO_acum / LE_acum × 100
    if (sentido.includes("desc")) {
      return VO === 0 ? 100 : fmt(LE / VO * 100);
    }
    return fmt(VO / LE * 100);
  }

  // No agregable
  if (sentido.includes("desc")) {
    const den = LB - LE;
    if (Math.abs(den) < 0.001) return null;
    return parseFloat(((LB - VO) / den * 100).toFixed(2));
  }
  // Ascendente: (VO - LB) / (LE - LB) × 100
  const den = LE - LB;
  if (Math.abs(den) < 0.001) return null;
  return parseFloat(((VO - LB) / den * 100).toFixed(2));
}

function colorDeATII(v, rangos) {
  if (v == null) return null;
  if (rangos?.length) {
    const sorted = [...rangos].sort((a, b) => (a.desde ?? 0) - (b.desde ?? 0));
    for (const r of sorted) {
      if (v >= (r.desde ?? 0) && v <= (r.hasta ?? 100)) return r.color;
    }
    return sorted[0]?.color || "rojo";
  }
  if (v >= 95) return "verde";
  if (v >= 75) return "amarillo";
  return "rojo";
}

const SEM_BG    = { verde: "#dcfce7", amarillo: "#fef9c3", rojo: "#fee2e2" };
const SEM_TEXT  = { verde: "#14532d", amarillo: "#78350f", rojo: "#7f1d1d" };

function CeldaATI({ ati, color }) {
  return (
    <td className="rid-cell rid-cell-c" style={{
      background: SEM_BG[color]  || "transparent",
      color:      SEM_TEXT[color]|| "#1e293b",
      fontWeight: 700, fontSize: 13, minWidth: 72,
    }}>
      {ati != null ? Number(ati).toFixed(2) : "—"}
    </td>
  );
}

function TablaIdentificacion({ datos, onCambiarRelevancia, periodoFiltro }) {
  const { filas = [], periodos = [], ult_periodo = "", rangos = [] } = datos;
  const hayDatos = filas.some((f) => f.tipo === "ind_detalle");

  // LB editable: {id_indicador: {anio, valor}} — se guarda en BD al hacer blur
  const [lbEdit, setLbEdit] = useState({});

  const getLBAnio  = (f) => lbEdit[f.id_indicador]?.anio  ?? (f.lb_anio  || "2026");
  const getLB      = (f) => {
    const ov = lbEdit[f.id_indicador]?.valor;
    return ov !== undefined ? ov : (parseFloat(f.lb_valor) || 0);
  };

  const cambiarLB = (f, campo, rawVal) => {
    const val = campo === "valor"
      ? Math.max(0, Math.min(100, parseFloat(rawVal) || 0))
      : rawVal;
    setLbEdit((prev) => ({
      ...prev,
      [f.id_indicador]: { ...prev[f.id_indicador], [campo]: val },
    }));
  };

  const guardarLB = (f) => {
    const anio  = getLBAnio(f);
    const valor = getLB(f);
    actualizarLineaBase(f.id_indicador, anio, valor).catch(() => {});
  };

  if (!hayDatos) {
    return (
      <div className="rep-vacio" style={{ flexDirection: "column", gap: 6 }}>
        <span>Los indicadores no tienen cronograma generado.</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          Genera el cronograma en "Ficha de Indicador" para que aparezcan aquí.
        </span>
      </div>
    );
  }

  // Corte "hasta": muestra todos los periodos <= el seleccionado
  const periodoCorte = periodoFiltro || ult_periodo || periodos[periodos.length - 1];
  const ultLabel     = periodoCorte ? labelPeriodo(periodoCorte) : "";

  // Periodos visibles: todos los que tienen logro planificado y son <= corte
  const periodosVis = periodos.filter((p) =>
    (!periodoCorte || p <= periodoCorte) &&
    filas.some((f) => f.tipo === "ind_detalle" && (f.logros?.[p] ?? 0) > 0)
  );

  // 9 cols fijas (incluye Ponderado) + 2 cols por periodo (logro + valor) + 1 avance (ATI)
  const TOTAL = 9 + periodosVis.length * 2 + 1;

  // Pre-computar avance ponderado (suma de peso×ATI y peso×ATII) para cada OEI y AEI
  const ponderadoSumas     = {}; // peso × Avance Tipo I
  const ponderadoSumasAtii = {}; // peso × Avance Tipo II
  let _curOEI = null, _curAEI = null;
  for (const f of filas) {
    if (f.tipo === "objetivo") { _curOEI = f.codigo; _curAEI = null; }
    else if (f.tipo === "accion") { _curAEI = f.codigo; }
    else if (f.tipo === "ind_detalle" && f.peso != null) {
      const peso    = Number(f.peso) || 0;
      const atiVal  = calcularATILocal(f, periodoCorte) ?? 0;
      const atiiVal = calcularATII(f, periodoCorte, getLB(f));
      const cAti    = peso * atiVal;
      const cAtii   = atiiVal != null ? peso * atiiVal : null;
      if (_curOEI) { ponderadoSumas[_curOEI] = (ponderadoSumas[_curOEI] || 0) + cAti; }
      if (_curAEI) { ponderadoSumas[_curAEI] = (ponderadoSumas[_curAEI] || 0) + cAti; }
      if (cAtii != null) {
        if (_curOEI) ponderadoSumasAtii[_curOEI] = (ponderadoSumasAtii[_curOEI] || 0) + cAtii;
        if (_curAEI) ponderadoSumasAtii[_curAEI] = (ponderadoSumasAtii[_curAEI] || 0) + cAtii;
      }
    }
  }

  return (
    <div className="rid-contenedor">
      <section className="rep-seccion">
        <div className="rep-seccion-cab">
          <h3>Tabla A11. Identificación de Alertas</h3>
          {ultLabel && <span className="rep-sub">Acumulado hasta {ultLabel} · Metodología Ceplan</span>}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="rid-tabla" style={{ minWidth: 800 + periodosVis.length * 110 }}>
            <thead>
              <tr>
                <th rowSpan={2} className="rid-th" style={{ minWidth: 80 }}>Código</th>
                <th rowSpan={2} className="rid-th" style={{ minWidth: 220 }}>Objetivos / Indicadores</th>
                <th rowSpan={2} className="rid-th" style={{ minWidth: 120 }}>Responsable</th>
                <th rowSpan={2} className="rid-th rid-th-c" style={{ minWidth: 55 }}>Prioridad</th>
                <th rowSpan={2} className="rid-th rid-th-c">Sentido</th>
                <th rowSpan={2} className="rid-th" style={{ minWidth: 90 }}>Tipo Agr.</th>
                <th colSpan={2} className="rid-th rid-th-grupo" style={{ textAlign: "center" }}>Línea base</th>
                {periodosVis.length > 0 && (
                  <th colSpan={periodosVis.length} className="rid-th rid-th-grupo rid-th-logros" style={{ textAlign: "center" }}>
                    Logros esperados
                  </th>
                )}
                {periodosVis.length > 0 && (
                  <th colSpan={periodosVis.length} className="rid-th rid-th-grupo rid-th-valores" style={{ textAlign: "center" }}>
                    Valores obtenidos
                  </th>
                )}
                <th rowSpan={2} className="rid-th rid-th-c" style={{ minWidth: 75, background: "#312e81", color: "#fff" }}>Ponderado</th>
                <th rowSpan={2} className="rid-th rid-th-avance" style={{ minWidth: 82, background: "#1e3a8a", color: "#fff" }}>
                  Avance Tipo I
                </th>
              </tr>
              <tr>
                <th className="rid-th rid-th-c">Año</th>
                <th className="rid-th rid-th-c">Valor</th>
                {periodosVis.map((p) => (
                  <th key={`lh-${p}`} className="rid-th rid-th-c rid-th-logros" style={{ fontSize: 10 }}>
                    {labelPeriodo(p)}
                  </th>
                ))}
                {periodosVis.map((p) => (
                  <th key={`vh-${p}`} className="rid-th rid-th-c rid-th-valores" style={{ fontSize: 10 }}>
                    {labelPeriodo(p)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, idx) => {
                // ATI y ATII calculados con acumulado hasta el corte seleccionado
                const atiInd    = calcularATILocal(f, periodoCorte);
                const lbVal     = getLB(f);
                const atii      = calcularATII(f, periodoCorte, lbVal);
                const colorATII = colorDeATII(atii, rangos);

                /* OEI: cabecera oscura */
                if (f.tipo === "objetivo") {
                  const pond     = ponderadoSumas[f.codigo];
                  const pondAtii = ponderadoSumasAtii[f.codigo];
                  return (
                    <tr key={idx} className="rid-fila-obj-header">
                      <td className="rid-cod">{f.codigo}</td>
                      <td colSpan={TOTAL - 3} className="rid-desc-bold">
                        {f.codigo}: {f.descripcion}
                      </td>
                      <td className="rid-cell rid-cell-c" style={{ color: "#94a3b8", fontSize: 11 }}>—</td>
                      <CeldaATI ati={pond} color={colorDeATII(pond, rangos)} />
                    </tr>
                  );
                }
                /* AEI: cabecera celeste */
                if (f.tipo === "accion") {
                  const pond = ponderadoSumas[f.codigo];
                  return (
                    <tr key={idx} className="rid-fila-acc-header">
                      <td className="rid-cod" style={{ color: "#0369a1" }}>{f.codigo}</td>
                      <td colSpan={TOTAL - 3} className="rid-cell" style={{ fontWeight: 700, color: "#0369a1" }}>
                        {f.codigo}: {f.descripcion}
                      </td>
                      <td className="rid-cell rid-cell-c" style={{ color: "#94a3b8", fontSize: 11 }}>—</td>
                      <CeldaATI ati={pond} color={colorDeATII(pond, rangos)} />
                    </tr>
                  );
                }
                /* Indicador: fila completa */
                if (f.tipo === "ind_detalle") {
                  return (
                    <tr key={idx} className="rid-fila-ind-acc">
                      <td className="rid-cod" style={{ color: "#475569" }}>{f.codigo || "—"}</td>
                      <td className="rid-cell">{f.descripcion || "—"}</td>
                      <td className="rid-cell" style={{ fontSize: 11 }}>{f.responsable || "—"}</td>
                      <td className="rid-cell rid-cell-c" style={{ padding: "2px 4px" }}>
                        <select
                          value={+(f.relevancia ?? 1)}
                          onChange={(e) => onCambiarRelevancia(f.id_indicador, +e.target.value)}
                          title="1 = Muy relevante · 2 = Relevante · 3 = Menos relevante"
                          style={{
                            fontSize: 11, fontWeight: 600, border: "1px solid #94a3b8",
                            borderRadius: 4, padding: "1px 3px", cursor: "pointer",
                            background: +(f.relevancia ?? 1) === 1 ? "#dbeafe"
                                       : +(f.relevancia ?? 1) === 2 ? "#fef9c3" : "#fee2e2",
                            color: +(f.relevancia ?? 1) === 1 ? "#1d4ed8"
                                 : +(f.relevancia ?? 1) === 2 ? "#92400e" : "#991b1b",
                            width: 38,
                          }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </td>
                      <td className="rid-cell rid-cell-c">{f.sentido || "—"}</td>
                      <td className="rid-cell" style={{ fontSize: 11 }}>{f.tipo_agregacion || "—"}</td>
                      <td className="rid-cell rid-cell-c" style={{ padding: "2px 4px" }}>
                        <input
                          type="number" min={2000} max={2100} step={1}
                          value={getLBAnio(f)}
                          onChange={(e) => cambiarLB(f, "anio", e.target.value)}
                          onBlur={() => guardarLB(f)}
                          title="Año de la línea base"
                          style={{
                            width: 52, textAlign: "center", fontSize: 12, fontWeight: 600,
                            border: lbEdit[f.id_indicador]?.anio !== undefined
                              ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                            borderRadius: 6, padding: "2px 3px", background: "#f8fafc",
                            color: "#1e293b", outline: "none",
                          }}
                        />
                      </td>
                      <td className="rid-cell rid-cell-c" style={{ padding: "2px 4px" }}>
                        <input
                          type="number" min={0} max={100} step={0.01}
                          value={getLB(f)}
                          onChange={(e) => cambiarLB(f, "valor", e.target.value)}
                          onBlur={() => guardarLB(f)}
                          title="Valor línea base (0–100). Al salir del campo se guarda en la BD"
                          style={{
                            width: 58, textAlign: "center", fontSize: 12, fontWeight: 600,
                            border: lbEdit[f.id_indicador]?.valor !== undefined
                              ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                            borderRadius: 6, padding: "2px 4px", background: "#f8fafc",
                            color: "#1e293b", outline: "none",
                          }}
                        />
                      </td>
                      {periodosVis.map((p) => (
                        <td key={`le-${p}`} className="rid-cell rid-cell-c">
                          {f.logros?.[p] ?? "—"}
                        </td>
                      ))}
                      {periodosVis.map((p) => (
                        <td key={`vo-${p}`} className="rid-cell rid-cell-c">
                          {f.avances?.[p] ?? "—"}
                        </td>
                      ))}
                      <td className="rid-cell rid-cell-c" style={{ fontWeight: 600, color: "#4338ca" }}>
                        {pesoAFraccion(f.peso)}
                      </td>
                      <CeldaATI ati={atiInd} color={colorDeATII(atiInd, rangos)} />
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TablaSemaforoNivel({ rangos, resumen, ultPeriodo }) {
  const FILAS = [
    { clave: "objetivos",     label: "Objetivos" },
    { clave: "ind_objetivos", label: "Indicadores de objetivos" },
    { clave: "acciones",      label: "Acciones" },
    { clave: "ind_acciones",  label: "Indicadores de acciones" },
  ];

  return (
    <div className="rid-sem-wrap">
      <div className="rid-sem-titulo">
        Tabla resumen: semaforización por nivel de avance
        {ultPeriodo && <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 8, color: "#94a3b8" }}>
          Referencia: {labelPeriodo(ultPeriodo)}
        </span>}
      </div>
      <table className="rid-sem-tabla">
        <thead>
          <tr>
            <th className="rid-sem-th"></th>
            {rangos.map((r) => (
              <th key={r.id_rango} className={`rid-sem-th rid-sem-th-c rid-sem-col-${r.color}`}>
                [{r.desde}–{r.hasta}{r.hasta >= 100 ? "]" : ">"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {FILAS.filter((f) => {
            const c = resumen[f.clave] || {};
            return Object.values(c).some((v) => v > 0);
          }).map((f, fi) => {
            const conteo = resumen[f.clave] || {};
            return (
              <tr key={f.clave} className={fi % 2 === 0 ? "rid-sem-par" : ""}>
                <td className="rid-sem-td-label">{f.label}</td>
                {rangos.map((r) => (
                  <td key={r.id_rango} className="rid-sem-td-c"
                    style={{ fontWeight: 700, color: RID_COLOR[r.color] || "#1e293b", fontSize: 15 }}>
                    {conteo[r.color] ?? 0}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertasAuto({ alertas = [] }) {
  const esInfo = alertas.length === 1 && alertas[0].tipo === "info";
  return (
    <div className="rid-alertas-auto" style={{ marginTop: 14 }}>
      <div className="rid-alertas-auto-cab">⚠️ Alertas identificadas</div>
      {esInfo ? (
        <div className="rid-alertas-auto-item" style={{
          borderLeftColor: "#16a34a", color: "#14532d", background: "#f0fdf4",
        }}>
          ✅ {alertas[0].descripcion}
        </div>
      ) : alertas.map((a, i) => {
        const esInd = a.tipo === "indicador";
        const esOei = a.tipo === "oei";
        const emoji = a.color === "rojo" ? "🔴" : a.color === "amarillo" ? "🟡" : "🟢";
        const pctBadge = a.avance != null ? (
          <span style={{
            display: "inline-block", fontWeight: 700, fontSize: 13,
            background: RID_COLOR_BG[a.color] || "#fef9c3",
            color: RID_COLOR[a.color] || "#92400e",
            borderRadius: 6, padding: "1px 8px", marginLeft: 6, marginRight: 6,
          }}>
            {a.avance}%
          </span>
        ) : null;

        return (
          <div key={i} className="rid-alertas-auto-item" style={{
            borderLeftColor: RID_COLOR[a.color] || "#f59e0b",
            borderLeftWidth: esOei ? 5 : esInd ? 3 : 4,
            color:      a.color === "rojo" ? "#7f1d1d" : a.color === "amarillo" ? "#78350f" : "#14532d",
            background: a.color === "rojo" ? "#fff1f2" : a.color === "amarillo" ? "#fffbeb" : "#f0fdf4",
            paddingLeft: esInd ? 24 : 12,
            fontSize:    esInd ? 12 : 13,
          }}>
            {emoji}
            {a.codigo && (
              <span style={{ fontWeight: 700, marginLeft: 6 }}>{a.codigo}</span>
            )}
            {pctBadge}
            <span style={{ color: "#64748b", fontSize: 11 }}>({a.nivel})</span>
            {" — "}
            {a.descripcion}
          </div>
        );
      })}
    </div>
  );
}

// ── Dropdown con filtros por color ────────────────────────────────────────────
function DropdownAlertas({ datos, fecha, simulado }) {
  const [filtro, setFiltro] = useState("rojo"); // abrir directo en críticos

  const conteos = {
    todos:    datos.length,
    rojo:     datos.filter((d) => colorDe(d) === "rojo").length,
    amarillo: datos.filter((d) => colorDe(d) === "amarillo").length,
    verde:    datos.filter((d) => colorDe(d) === "verde").length,
  };

  const lista = filtro === "todos" ? datos : datos.filter((d) => colorDe(d) === filtro);

  const FILTROS = [
    { key: "todos",    label: "Todos",      emoji: null },
    { key: "rojo",     label: "Crítico",    emoji: "🔴" },
    { key: "amarillo", label: "En proceso", emoji: "🟡" },
    { key: "verde",    label: "Óptimo",     emoji: "🟢" },
  ];

  return (
    <div className="rep-alertas-dropdown">
      {/* Cabecera */}
      <div className="rep-drop-header">
        <span className="rep-drop-titulo">Estado de procesos</span>
        <div className="rep-drop-fecha">
          📅 {fecha}
          {simulado && (
            <span className="rep-sim-badge" title="Fecha fija — ver ReporteView.jsx">SIM</span>
          )}
        </div>
      </div>

      {/* Filtros por color */}
      <div className="rep-drop-filtros">
        {FILTROS.map(({ key, label, emoji }) => (
          <button
            key={key}
            className={`rep-drop-filtro-btn ${key} ${filtro === key ? "activo" : ""}`}
            onClick={() => setFiltro(key)}
          >
            {emoji && <span>{emoji}</span>}
            <span>{label}</span>
            <span className="rep-drop-filtro-cnt">{conteos[key]}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="rep-drop-lista">
        {lista.length === 0 ? (
          <div className="rep-drop-ok">Sin procesos en esta categoría</div>
        ) : (
          lista.map((d) => <FilaDropdown key={d.id_indicador} d={d} />)
        )}
      </div>
    </div>
  );
}

// Fila individual del dropdown
function FilaDropdown({ d }) {
  const color = colorDe(d);
  const col   = COLOR_MAP[color];
  const colBg = COLOR_BG[color];
  const pct   = d.cumplimiento_pct ?? 0;
  // Muestra valor real vs meta propia del indicador
  const meta  = d.meta_final ?? 100;
  const real  = d.valor_actual ?? 0;
  const falta = color !== "verde" ? Math.max(0, +(meta - real).toFixed(1)) : 0;

  return (
    <div className="rep-drop-fila" style={{ borderLeftColor: col, background: falta === 0 ? colBg : undefined }}>
      <div className="rep-drop-fila-izq">
        <span className="rep-drop-sem">{SEMAFORO[color]}</span>
        <div className="rep-drop-fila-nombres">
          <span className="rep-drop-proc">{d.nombre_proceso}</span>
          {d.nombre_indicador && (
            <span className="rep-drop-ind">{d.nombre_indicador}</span>
          )}
          <span className="rep-drop-meta-txt">
            {real}% real · meta {meta}%
          </span>
        </div>
      </div>
      <div className="rep-drop-fila-der">
        <span className="rep-drop-pct" style={{ color: col }}>{pct}%</span>
        <span className="rep-drop-etiq" style={{ color: col }}>
          {ETIQUETA[color]}
        </span>
        {falta > 0 && (
          <span className="rep-drop-falta">faltan {falta}%</span>
        )}
      </div>
    </div>
  );
}

// ── Lollipop vertical ────────────────────────────────────────────────────────
const YTICKS = [0,10,20,30,40,50,60,70,80,90,100];

function GraficaAvance({ datos, periodoSel, todos = [], estadosProceso = {}, onCambioEstado }) {
  const [enSS,       setEnSS]       = useState(new Set());
  const [cargandoId, setCargandoId] = useState(null);

  useEffect(() => {
    ssSistemaProcesos()
      .then(lista => {
        if (!Array.isArray(lista)) return;
        setEnSS(new Set(lista.filter(p => p.ya_en_ss).map(p => String(p.id_indicador))));
      })
      .catch(() => {});
  }, []);

  const mejorar = async (d) => {
    const id = String(d.id_indicador);
    setCargandoId(id);
    try {
      await ssSistemaCrearDesde({
        id_indicador:    id,
        oportunidades:   1,
        nombre_proceso:  d.nombre_proceso  || "",
        nombre_indicador: d.nombre_indicador || "",
      });
      setEnSS(prev => new Set([...prev, id]));
    } catch { /* ya en SS u otro error — igualmente marcar */ }
    finally { setCargandoId(null); }
  };

  const filas = datos.map((d) => ({
    ...d,
    color: d.estado?.color || "rojo",
    pct: d.cumplimiento_pct ?? 0,
  }));
  const grupoMap = buildGrupoMap(filas);

  // Nombre del grupo padre: busca en todos los niveles el proceso cuyo código no tiene punto
  const grupoNombres = {};
  todos.forEach((d) => {
    const code = String(d.codigo || "");
    if (code && !code.includes(".")) {
      grupoNombres[code] = d.nombre_proceso || code;
    }
  });
  const n = filas.length || 1;

  return (
    <>
    <section className="rep-seccion">
      <div className="rep-seccion-cab">
        <h3>Avance por Proceso</h3>
      </div>

      {/* Leyenda moderna: dos bloques */}
      <div className="rep-leyenda-moderna">
        <div className="rep-ley-bloque">
          <span className="rep-ley-bloque-label">Estado</span>
          <div className="rep-ley-pills">
            <span className="rep-ley-pill" style={{ background: "#F0FDF4", color: "#15803D", borderColor: "#BBF7D0" }}>
              <span className="rep-ley-dot" style={{ background: "#16a34a" }} />Óptimo 95–100
            </span>
            <span className="rep-ley-pill" style={{ background: "#FEFCE8", color: "#854D0E", borderColor: "#FDE68A" }}>
              <span className="rep-ley-dot" style={{ background: "#eab308" }} />En Proceso 75–95
            </span>
            <span className="rep-ley-pill" style={{ background: "#FEF2F2", color: "#991B1B", borderColor: "#FECACA" }}>
              <span className="rep-ley-dot" style={{ background: "#dc2626" }} />Riesgo Crítico 0–75
            </span>
          </div>
        </div>

        <div className="rep-ley-divisor" />

        <div className="rep-ley-bloque">
          <span className="rep-ley-bloque-label">Grupos</span>
          <div className="rep-ley-pills">
            {Object.entries(grupoMap).map(([g, c]) => (
              <span key={g} className="rep-ley-pill"
                style={{ background: `${c.bar}14`, color: c.txt, borderColor: `${c.bar}55` }}>
                <span className="rep-ley-dot" style={{ background: c.bar }} />
                {grupoNombres[g] || g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Título de la gráfica */}
      <div className="rep-grafica-titulo">
        <h2 className="rep-grafica-titulo-h">Avance por Proceso</h2>
      </div>

      {/* Gráfica vertical */}
      <div className="rep-vc-outer">

        {/* Título Y rotado */}
        <div className="rep-vc-ytitle-col">
          <span className="rep-vc-ytitle">Cumplimiento</span>
        </div>

        {/* Eje Y: etiquetas de porcentaje */}
        <div className="rep-vc-yaxis">
          {YTICKS.map((t) => (
            <span key={t} className="rep-vc-ylabel" style={{ bottom: `${t}%` }}>{t}%</span>
          ))}
        </div>

        {/* Área de ploteo */}
        <div className="rep-vc-plot">
          {/* Zonas de color */}
          <div className="rep-vc-zone" style={{ bottom: 0,     height: "75%", background: "#fef2f2" }} />
          <div className="rep-vc-zone" style={{ bottom: "75%", height: "20%", background: "#fefce8" }} />
          <div className="rep-vc-zone" style={{ bottom: "95%", height: "5%",  background: "#f0fdf4" }} />

          {/* Líneas horizontales de cuadrícula */}
          {YTICKS.map((t) => (
            <div key={t} className="rep-vc-hline" style={{ bottom: `${t}%` }} />
          ))}

          {/* Línea punteada que conecta todos los puntos */}
          <svg className="rep-vc-connector" viewBox="0 0 100 100"
            preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <polyline
              points={filas.map((d, i) =>
                `${(i + 0.5) / n * 100},${100 - Math.min(d.pct, 100)}`
              ).join(" ")}
              fill="none" stroke="#64748b"
              strokeWidth="0.8" strokeDasharray="2.5 2.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Lollipops verticales */}
          {filas.map((d, i) => {
            const col  = COLOR_MAP[d.color] || COLOR_MAP.rojo;
            const gc   = grupoMap[d.grupo]  || { bar: "#94A3B8" };
            const pct  = Math.min(d.pct, 100);
            const left = `${(i + 0.5) / n * 100}%`;
            return (
              <div key={d.id_indicador ?? d.id_proceso}
                className="rep-vc-loli"
                style={{ left }}
              >
                {/* Palito desde la base hasta el punto */}
                <div className="rep-vc-stick"
                  style={{ height: `${pct}%`, background: col }} />
                {/* Punto */}
                <div className="rep-vc-dot"
                  style={{ bottom: `${pct}%`, background: col, borderColor: gc.bar }}>
                  <div className="rep-vc-tip">
                    <strong>{d.nombre_proceso}</strong>
                    <span>Real {d.valor_actual}% · Meta {d.meta_final}%</span>
                    <span>Cumplimiento: <b>{d.pct}%</b></span>
                  </div>
                </div>
                {/* Valor al costado derecho del punto */}
                <span className="rep-vc-val" style={{ bottom: `${pct}%`, color: col }}>
                  {d.pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Eje X: solo marcadores de color + etiqueta "Procesos" */}
      <div className="rep-vc-xaxis">
        <div className="rep-vc-yaxis-gap" />
        <div className="rep-vc-xnames">
          {filas.map((d, i) => {
            const gc = grupoMap[d.grupo] || { bar: "#94A3B8" };
            return (
              <div key={d.id_indicador ?? d.id_proceso}
                className="rep-vc-xtick"
                style={{ left: `${(i + 0.5) / n * 100}%` }}
              >
                <span className="rep-vc-xtick-dot" style={{ background: gc.bar }} />
              </div>
            );
          })}
        </div>
        <div className="rep-vc-xlabel-unico">Procesos</div>
      </div>
    </section>

    <section className="rep-seccion">
      <div className="rep-seccion-cab">
        <h3>Detalle de Avance por Proceso</h3>
      </div>

      <div className="rep-tabla-wrap">
        <table className="rep-tabla">
          <colgroup>
            <col className="rep-col-codigo" />
            <col className="rep-col-proceso" />
            <col className="rep-col-indicador" />
            <col className="rep-col-num" />
            <col className="rep-col-num" />
            <col className="rep-col-cumpl" />
            <col className="rep-col-estado" />
            <col className="rep-col-fecha" />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Código</th>
              <th>Proceso</th>
              <th>Indicador</th>
              <th>Avance real</th>
              <th>Meta</th>
              <th>Cumplimiento</th>
              <th>Estado</th>
              <th>Último registro</th>
              <th style={{ textAlign:"center", background:"#1e1b4b", color:"#818cf8", fontSize:"0.75rem" }}>Six Sigma</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((d) => {
              const col = COLOR_MAP[d.color] || COLOR_MAP.rojo;
              const gc  = grupoMap[d.grupo] || { bar: "#94A3B8", txt: "#475569" };
              return (
                <tr key={d.id_indicador ?? d.id_proceso}
                    style={{ borderLeft: `4px solid ${gc.bar}` }}>
                  <td className="rep-codigo">{d.codigo || "—"}</td>
                  <td style={{ color: gc.txt, fontWeight: 600 }}>{d.nombre_proceso}</td>
                  <td>{d.nombre_indicador || "—"}</td>
                  <td className="rep-num">{d.valor_actual}%</td>
                  <td className="rep-num">{d.meta_final}%</td>
                  <td>
                    <div className="rep-barra-mini">
                      <div className="rep-barra-mini-relleno"
                        style={{ width: `${Math.min(d.pct, 100)}%`, background: col }} />
                      <span>{d.pct}%</span>
                    </div>
                  </td>
                  <td>
                    <select
                      className={`rep-estado-sel rep-estado-sel--${estadosProceso[String(d.id_proceso)] || "en_ejecucion"}`}
                      value={estadosProceso[String(d.id_proceso)] || "en_ejecucion"}
                      onChange={(e) => onCambioEstado && onCambioEstado(d.id_proceso, e.target.value)}
                    >
                      <option value="en_ejecucion">▶ En Ejecución</option>
                      <option value="mejorar">⚡ Mejorar</option>
                      <option value="terminar">✓ Terminar</option>
                    </select>
                  </td>
                  <td className="rep-periodo">{ultimaFecha(d.ultimo_periodo)}</td>
                  <td style={{ textAlign:"center", padding:"4px 6px" }}>
                    {enSS.has(String(d.id_indicador))
                      ? <span style={{ fontSize:"0.68rem", color:"#818cf8", background:"rgba(99,102,241,0.15)",
                          padding:"2px 7px", borderRadius:"4px", whiteSpace:"nowrap" }}>En SS ✓</span>
                      : <button
                          onClick={() => mejorar(d)}
                          disabled={cargandoId===String(d.id_indicador)}
                          style={{ fontSize:"0.7rem", padding:"3px 8px", border:"1px solid #818cf8",
                            borderRadius:"5px", background:"transparent", color:"#818cf8",
                            cursor:"pointer", whiteSpace:"nowrap",
                            opacity: cargandoId ? 0.6 : 1 }}>
                          {cargandoId===String(d.id_indicador) ? "..." : "Mejorar"}
                        </button>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
    </>
  );
}

