// Módulo Ficha de Indicador: al entrar a un proceso abre/crea su indicador automáticamente.
import React, { useState, useEffect, useRef } from "react";
import {
  obtenerArbolInd, indicadoresDeProceso, crearIndicador, actualizarIndicador, eliminarIndicador,
  obtenerIndicador, agregarDetalleInd, editarDetalleInd, borrarDetalleInd, generarCronograma,
  actualizarLineaBase,
} from "../services/api";
import "./IndicadoresView.css";

const TIPOS = ["Estratégico", "Misional", "Apoyo"];
const MAESTRO_VACIO = {
  codigo: "", nombre_indicador: "", tipo: "Cuantitativo", justificacion: "", responsable: "",
  metodo_calculo: "", sentido_esperado: "Ascendente", unidad_medida: "Porcentaje (%)",
  frecuencia: "Semanal", fuente_datos: "", fecha_inicio: "", fecha_fin: "", frecuencia_crono: "semanal",
  meta_final: 100, tipo_agregacion: "Acumulado", relevancia: "",
};

export default function IndicadoresView() {
  const [tipo, setTipo] = useState("Misional");
  const [arbol, setArbol] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [procesoSel, setProcesoSel] = useState(null);
  const [indicadores, setIndicadores] = useState([]);
  const [indSel, setIndSel] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [maestro, setMaestro] = useState(MAESTRO_VACIO);
  const [subTab, setSubTab]           = useState("ficha");
  const [verFichaTec, setVerFichaTec] = useState(false);
  const [procesoNombre, setProcesoNombre] = useState("");
  const [procesoNivel, setProcesoNivel]   = useState(0);
  const [lbAnio,  setLbAnio]  = useState("");
  const [lbValor, setLbValor] = useState("");

  useEffect(() => { cargarArbol(); /* eslint-disable-next-line */ }, [tipo]);
  const cargarArbol = () => obtenerArbolInd(tipo).then(setArbol);
  const alternar = (id) => setExpandidos((e) => ({ ...e, [id]: !e[id] }));

  // Al entrar a un proceso: usa su único indicador; si no hay, lo crea; si hay duplicados, los limpia.
  const elegirProceso = async (id) => {
    setProcesoSel(id);
    let lista = await indicadoresDeProceso(id);
    if (lista.length === 0) {
      let f;
      try {
        f = await crearIndicador(id, { nombre_indicador: "Indicador principal" });
      } catch (resp) {
        try {
          const e = await resp.json();
          alert(e.error || "No se pudo crear el indicador.");
        } catch { alert("No se pudo crear el indicador. Verifica que el archivo Excel no esté abierto en otro programa."); }
        return;
      }
      lista = await indicadoresDeProceso(id);
      setIndicadores(lista);
      abrir(f.indicador.id_indicador);
      cargarArbol();
    } else {
      // Conservar solo el primero; eliminar cualquier duplicado sobrante
      const [principal, ...sobrantes] = lista;
      if (sobrantes.length > 0) {
        await Promise.all(sobrantes.map((s) => eliminarIndicador(s.id_indicador)));
        lista = await indicadoresDeProceso(id);
        cargarArbol();
      }
      setIndicadores(lista);
      abrir(principal.id_indicador);
    }
  };

  const abrir = (iid) => {
    setIndSel(iid);
    obtenerIndicador(iid).then((f) => {
      setFicha(f);
      // Filtrar nulos del Excel para no pisar los defaults del formulario
      const limpio = Object.fromEntries(
        Object.entries(f.indicador || {}).filter(([, v]) => v != null && v !== "")
      );
      setMaestro({ ...MAESTRO_VACIO, ...limpio });
      const lb = f.linea_base || {};
      setLbAnio(lb.anio != null ? String(lb.anio) : "");
      setLbValor(lb.valor != null ? String(lb.valor) : "");
    });
  };

  const recargar = () => obtenerIndicador(indSel).then(setFicha);
  const recargarTodo = () => { recargar(); indicadoresDeProceso(procesoSel).then(setIndicadores); cargarArbol(); };

  const guardarMaestros = async () => {
    // Sincronizar frecuencia_crono → frecuencia para que se guarde en Excel
    const datos = { ...maestro, frecuencia: maestro.frecuencia_crono || maestro.frecuencia };
    await actualizarIndicador(indSel, datos);
    if (lbAnio || lbValor !== "") {
      await actualizarLineaBase(indSel, lbAnio, lbValor !== "" ? Number(lbValor) : 0);
    }
    recargarTodo();
  };

  const aplicarCronograma = async () => {
    if (!maestro.fecha_inicio || !maestro.fecha_fin) {
      alert("Define la fecha de inicio y fin primero.");
      return;
    }
    await actualizarIndicador(indSel, maestro);
    try {
      await generarCronograma(indSel, { frecuencia: maestro.frecuencia_crono || "mensual", inicio: maestro.fecha_inicio, fin: maestro.fecha_fin });
      recargarTodo();
      setSubTab("cronograma");
    } catch (resp) {
      // El backend devuelve 400 con mensaje si ya hay avances registrados
      try { const e = await resp.json(); alert(e.mensaje || "No se pudo generar el cronograma."); }
      catch { alert("No se pudo generar el cronograma porque ya hay avances registrados."); }
    }
  };

  const eliminar = async () => {
    if (!window.confirm("¿Eliminar este indicador y todos sus datos?")) return;
    await eliminarIndicador(indSel);
    setIndSel(null); setFicha(null);
    setIndicadores(await indicadoresDeProceso(procesoSel));
    cargarArbol();
  };
  const cambiar = (e) => setMaestro({ ...maestro, [e.target.name]: e.target.value });

  const Nodo = ({ nodo }) => {
    const tieneHijos = nodo.hijos && nodo.hijos.length > 0;
    const abiertoN = expandidos[nodo.id];
    return (
      <div>
        <div className={`ind-nodo-fila ${procesoSel === nodo.id ? "sel" : ""}`}>
          <span className="ind-toggle" onClick={() => tieneHijos && alternar(nodo.id)}>{tieneHijos ? (abiertoN ? "▼" : "▶") : ""}</span>
          <span className={`ind-punto ${nodo.tiene_indicadores ? "activo" : ""}`} title={nodo.tiene_indicadores ? "Tiene indicadores" : "Sin indicadores"} />
          <span className="ind-nodo-nombre" onClick={() => { elegirProceso(nodo.id); setProcesoNombre(nodo.nombre); setProcesoNivel(nodo.nivel ?? 0); }}>{nodo.nombre}</span>
        </div>
        {tieneHijos && abiertoN && <div className="ind-hijos">{nodo.hijos.map((h) => <Nodo key={h.id} nodo={h} />)}</div>}
      </div>
    );
  };

  return (
    <div className="ind-vista">
      <div className="ind-cabecera">
        <h2>Ficha de Indicador</h2>
        <div className="ind-tabs">
          {TIPOS.map((t) => (
            <button key={t} className={`ind-tab ${tipo === t ? "activo" : ""}`}
              onClick={() => { setTipo(t); setProcesoSel(null); setIndicadores([]); setIndSel(null); setFicha(null); }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="ind-layout">
        <aside className="ind-arbol">
          <div className="ind-arbol-titulo">Procesos {tipo}s</div>
          {arbol.length === 0 ? <p className="ind-vacia">No hay procesos.</p> : arbol.map((n) => <Nodo key={n.id} nodo={n} />)}
        </aside>

        <div className="ind-panel">
          {!procesoSel ? (
            <div className="ind-vacio">Selecciona un proceso del árbol para administrar su indicador y cronograma.</div>
          ) : !ficha ? (
            <div className="ind-vacio">Cargando…</div>
          ) : (
            <>
              {verFichaTec && ficha && (
                <FichaTecnicaInd ficha={ficha} maestro={maestro} procesoNombre={procesoNombre} onCerrar={() => setVerFichaTec(false)} />
              )}
              {/* Sub-pestañas: Ficha, Cronograma y Gráfica */}
              <div className="ind-subtabs">
                <button className={`ind-subtab ${subTab === "ficha" ? "activo" : ""}`} onClick={() => setSubTab("ficha")}>Ficha del Indicador</button>
                <button className={`ind-subtab ${subTab === "cronograma" ? "activo" : ""}`} onClick={() => setSubTab("cronograma")}>Cronograma y Avance</button>
                <button className={`ind-subtab ${subTab === "grafica" ? "activo" : ""}`} onClick={() => setSubTab("grafica")}>Gráfica</button>
                <button className="ind-subtab ind-subtab-ficha" onClick={() => setVerFichaTec(true)}>📋 Ver Ficha Técnica</button>
              </div>

              {subTab === "ficha" ? (
                <SeccionMaestro maestro={maestro} onCambio={cambiar} onGuardar={guardarMaestros} onEliminar={eliminar}
                  onAplicarCronograma={aplicarCronograma} ficha={ficha} indSel={indSel} onRecargar={recargar}
                  lbAnio={lbAnio} lbValor={lbValor} onLbAnio={setLbAnio} onLbValor={setLbValor} />
              ) : subTab === "cronograma" ? (
                <>
                  <SeccionResumen ficha={ficha} />
                  <SeccionSemaforo ficha={ficha} onCambio={recargar} />
                  <SeccionCronograma ficha={ficha} indSel={indSel} onCambio={recargar} procesoNivel={procesoNivel} />
                </>
              ) : (
                <SeccionGrafica ficha={ficha} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Botón de reserva: genera cronograma solo para este indicador ----------
function BtnCronoReserva({ indSel, ficha, onRecargar }) {
  const logrosReales = ficha?.logros || [];
  const tieneCrono = logrosReales.some(
    l => (l.valor_planificado ?? 0) !== 0 || (l.valor_real ?? 0) !== 0
  );
  const [generando, setGenerando] = useState(false);
  const [msg, setMsg]             = useState(null); // { tipo: "ok"|"err", texto }

  if (tieneCrono) return null;

  const ejecutar = async () => {
    if (generando) return;
    setGenerando(true); setMsg(null);
    try {
      const tkn = localStorage.getItem("sgp_token") || "";
      const authHdr = { Authorization: `Bearer ${tkn}` };
      const cfg = await fetch("http://localhost:8000/api/indicadores/cronograma-global/", { headers: authHdr }).then(r => r.json());
      const { fecha_inicio, fecha_fin, frecuencia } = cfg.config || {};
      if (!fecha_inicio || !fecha_fin) {
        setMsg({ tipo: "err", texto: "Sin fechas globales. Genera el cronograma en Gestión de Procesos primero." });
        setGenerando(false);
        return;
      }
      const r = await fetch(`http://localhost:8000/api/indicadores/${indSel}/cronograma/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHdr },
        body: JSON.stringify({ frecuencia: frecuencia || "mensual", inicio: fecha_inicio, fin: fecha_fin }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg({ tipo: "err", texto: d.mensaje || "Error al generar el cronograma." });
      } else {
        onRecargar();
      }
    } catch {
      setMsg({ tipo: "err", texto: "Error de conexión con el servidor." });
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {msg && (
        <p style={{
          fontSize: 12, margin: 0, fontWeight: 600,
          color: msg.tipo === "ok" ? "#15803d" : "#B91C1C",
        }}>
          {msg.texto}
        </p>
      )}
      <button className="ind-btn ind-btn-crono" onClick={ejecutar} disabled={generando}>
        {generando ? "⏳ Generando..." : "↺ Generar cronograma"}
      </button>
    </div>
  );
}

// ---------- Datos maestros + definición del cronograma ----------
function SeccionMaestro({ maestro, onCambio, onGuardar, onEliminar, onAplicarCronograma,
                          ficha, indSel, onRecargar, lbAnio, lbValor, onLbAnio, onLbValor }) {
  // Calcular periodo real desde el cronograma: primer y último periodo con planificado > 0
  const logrosActivos = (ficha?.logros || [])
    .filter(l => (l.valor_planificado ?? 0) > 0)
    .sort((a, b) => (a.periodo || "").localeCompare(b.periodo || ""));
  const fechaInicioCrono = logrosActivos.length > 0
    ? (logrosActivos[0].periodo || "").split("→")[0].trim()
    : "";
  const fechaFinCrono = logrosActivos.length > 0
    ? (logrosActivos[logrosActivos.length - 1].periodo || "").split("→").pop().trim()
    : "";

  return (
    <section className="ind-seccion">
      <div className="ind-seccion-cab"><h3>Datos del Indicador</h3></div>
      <div className="ind-grid">
        <label className="ind-campo"><span>Código</span><input name="codigo" value={maestro.codigo || ""} readOnly style={{ background: "#F8FAFC", cursor: "default", color: "#475569" }} /></label>
        <label className="ind-campo"><span>Tipo</span>
          <select name="tipo" value={maestro.tipo || ""} onChange={onCambio}><option>Cuantitativo</option><option>Cualitativo</option></select>
        </label>
        <label className="ind-campo full"><span>Nombre del indicador</span><input name="nombre_indicador" value={maestro.nombre_indicador || ""} onChange={onCambio} /></label>
        <label className="ind-campo full"><span>Justificación</span><textarea name="justificacion" rows="2" value={maestro.justificacion || ""} onChange={onCambio} /></label>
        <label className="ind-campo"><span>Responsable</span><input name="responsable" value={maestro.responsable || ""} onChange={onCambio} /></label>
        <label className="ind-campo"><span>Método de cálculo</span><input name="metodo_calculo" value={maestro.metodo_calculo || ""} onChange={onCambio} /></label>
        <label className="ind-campo"><span>Sentido esperado</span>
          <select name="sentido_esperado" value={maestro.sentido_esperado || ""} onChange={onCambio}><option>Ascendente</option><option>Descendente</option></select>
        </label>
        <label className="ind-campo"><span>Unidad de medida</span><input name="unidad_medida" value={maestro.unidad_medida || ""} onChange={onCambio} /></label>
        <label className="ind-campo full"><span>Tipo de agregación</span>
          <select name="tipo_agregacion" value={maestro.tipo_agregacion || "Acumulado"} onChange={onCambio}>
            <option value="Acumulado">Acumulado — los valores de cada periodo se suman progresivamente</option>
            <option value="No acumulado">No acumulado — cada periodo se mide de forma independiente</option>
            <option value="Promedio">Promedio — se calcula la media de los periodos registrados</option>
            <option value="Último dato">Último dato — solo cuenta el valor del periodo más reciente</option>
          </select>
        </label>
        <label className="ind-campo full"><span>Fuente de datos</span>
          <input name="fuente_datos" value={maestro.fuente_datos || ""} onChange={onCambio} placeholder="Ej. Repositorio Git, historial de commits" />
        </label>
      </div>

      {/* Línea base */}
      <div className="ind-cronodef" style={{ borderTop: "1px dashed #c7d2fe", marginTop: 8 }}>
        <h4>Línea base del indicador</h4>
        <div className="ind-grid">
          <label className="ind-campo">
            <span>Año de línea base</span>
            <input value={lbAnio} onChange={e => onLbAnio(e.target.value)}
              placeholder="Ej. 2025" />
          </label>
          <label className="ind-campo">
            <span>Valor base (%)</span>
            <input type="number" min="0" max="100" value={lbValor}
              onChange={e => onLbValor(e.target.value)} placeholder="Ej. 20" />
          </label>
        </div>
        <p className="ind-sub">El valor de línea base es el punto de partida del indicador antes de iniciar el periodo de medición.</p>
      </div>

      {/* Bloque de Objetivos y Acciones */}
      <SeccionObjetivos ficha={ficha} indSel={indSel} onCambio={onRecargar} />

      {/* Periodo del proceso — calculado desde el cronograma (primer y último periodo con planificado > 0) */}
      <div className="ind-cronodef">
        <h4>Periodo del proceso</h4>
        <div className="ind-grid">
          <label className="ind-campo"><span>Fecha de inicio</span>
            <input type="date" value={fechaInicioCrono} disabled />
          </label>
          <label className="ind-campo"><span>Fecha de fin</span>
            <input type="date" value={fechaFinCrono} disabled />
          </label>
        </div>
        <p className="ind-sub">El cronograma se define globalmente en <strong>Gestión de Procesos</strong>.</p>
        <div className="ind-fila-acciones">
          <BtnCronoReserva indSel={indSel} ficha={ficha} onRecargar={onRecargar} />
          <button className="ind-btn ind-btn-guardar" onClick={onGuardar}>
            💾 Guardar datos
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------- Objetivos y Acciones con criterios SMART ----------
const CRITERIOS     = ["especifico", "relevante", "medible", "realizable", "temporal"];
const CRITERIOS_LBL = ["Específico", "Relevante", "Medible", "Realizable", "Temporal"];

function SeccionObjetivos({ ficha, indSel, onCambio }) {
  const objetivos = ficha?.objetivos || [];
  const acciones  = ficha?.acciones  || [];

  const [editObj,         setEditObj]         = useState(null);
  const [editAcc,         setEditAcc]         = useState(null);
  const [addingObj,       setAddingObj]       = useState(false);
  const [addingAccForObj, setAddingAccForObj] = useState(null);
  const [formObj, setFormObj] = useState({ descripcion: "", indicador_texto: "" });
  const [formAcc, setFormAcc] = useState({ descripcion: "", indicador_texto: "" });

  const togCriterio = async (hoja, id, campo, actual) => {
    await editarDetalleInd(hoja, id, { [campo]: !actual });
    onCambio();
  };

  const guardarObj = async (id) => {
    await editarDetalleInd("objetivos", id, formObj);
    setEditObj(null); onCambio();
  };
  const crearObj = async () => {
    if (!formObj.descripcion.trim()) return;
    await agregarDetalleInd("objetivos", { id_indicador: indSel, ...formObj });
    setAddingObj(false); setFormObj({ descripcion: "", indicador_texto: "" }); onCambio();
  };
  const eliminarObj = async (id) => {
    if (!window.confirm("¿Eliminar este objetivo y sus acciones?")) return;
    await borrarDetalleInd("objetivos", id); onCambio();
  };

  const guardarAcc = async (id) => {
    await editarDetalleInd("acciones", id, formAcc);
    setEditAcc(null); onCambio();
  };
  const crearAcc = async (idObjetivo) => {
    if (!formAcc.descripcion.trim()) return;
    await agregarDetalleInd("acciones", { id_objetivo: idObjetivo, id_indicador: indSel, ...formAcc });
    setAddingAccForObj(null); setFormAcc({ descripcion: "", indicador_texto: "" }); onCambio();
  };
  const eliminarAcc = async (id) => {
    if (!window.confirm("¿Eliminar esta acción?")) return;
    await borrarDetalleInd("acciones", id); onCambio();
  };

  return (
    <div className="ind-obj-bloque">
      <div className="ind-obj-cab">
        <h4>Objetivos y Acciones</h4>
        <button className="ind-btn ind-btn-nuevo"
          onClick={() => { setAddingObj(true); setFormObj({ descripcion: "", indicador_texto: "" }); }}>
          + Nuevo objetivo
        </button>
      </div>
      <table className="ind-tabla ind-tabla-obj">
          <colgroup>
            <col /><col /><col /><col />
          </colgroup>
          <thead>
            <tr>
              <th>Objetivo / Acción / Servicio</th>
              <th>Indicador</th>
              <th>Características SMART</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {objetivos.length === 0 && !addingObj && (
              <tr>
                <td colSpan={4} className="ind-vacia" style={{ textAlign: "center" }}>
                  Sin objetivos registrados. Pulsa "+ Nuevo objetivo" para agregar.
                </td>
              </tr>
            )}

            {objetivos.map((obj, oi) => {
              const accsDeObj = acciones.filter((a) => a.id_objetivo === obj.id_objetivo);
              return (
                <React.Fragment key={`obj-${obj.id_objetivo}`}>
                  {/* Fila del objetivo */}
                  <tr className="ind-obj-fila-obj">
                    <td>
                      {editObj === obj.id_objetivo
                        ? <input autoFocus value={formObj.descripcion}
                            onChange={(e) => setFormObj({ ...formObj, descripcion: e.target.value })} />
                        : <strong>{obj.codigo || `OES ${oi + 1}`}{obj.descripcion ? ` · ${obj.descripcion}` : ""}</strong>}
                    </td>
                    <td>
                      {editObj === obj.id_objetivo
                        ? <input value={formObj.indicador_texto}
                            onChange={(e) => setFormObj({ ...formObj, indicador_texto: e.target.value })} />
                        : obj.indicador_texto || "—"}
                    </td>
                    <td>
                      <div className="ind-smart-list">
                        {CRITERIOS.map((c, ci) => (
                          <label key={c} className="ind-smart-item">
                            <input type="checkbox" className="ind-check" checked={!!obj[c]}
                              onChange={() => togCriterio("objetivos", obj.id_objetivo, c, obj[c])} />
                            <span>{CRITERIOS_LBL[ci]}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="ind-acc">
                      {editObj === obj.id_objetivo
                        ? <button className="ind-btn ind-btn-mini"
                            onClick={() => guardarObj(obj.id_objetivo)}>OK</button>
                        : <div className="ind-acc-stack">
                            <button className="ind-acc-btn ind-acc-btn-edit" title="Editar"
                              onClick={() => { setEditObj(obj.id_objetivo); setFormObj({ descripcion: obj.descripcion || "", indicador_texto: obj.indicador_texto || "" }); }}>✎</button>
                            <button className="ind-acc-btn ind-acc-btn-del" title="Eliminar"
                              onClick={() => eliminarObj(obj.id_objetivo)}>✕</button>
                          </div>}
                    </td>
                  </tr>

                  {/* Filas de acciones */}
                  {accsDeObj.map((acc, ai) => (
                    <tr key={`acc-${acc.id_accion}`} className="ind-obj-fila-acc">
                      <td style={{ paddingLeft: 32 }}>
                        {editAcc === acc.id_accion
                          ? <input autoFocus value={formAcc.descripcion}
                              onChange={(e) => setFormAcc({ ...formAcc, descripcion: e.target.value })} />
                          : <span>↳ {acc.codigo || `AES ${oi + 1}.${ai + 1}`}{acc.descripcion ? ` · ${acc.descripcion}` : ""}</span>}
                      </td>
                      <td>
                        {editAcc === acc.id_accion
                          ? <input value={formAcc.indicador_texto}
                              onChange={(e) => setFormAcc({ ...formAcc, indicador_texto: e.target.value })} />
                          : acc.indicador_texto || "—"}
                      </td>
                      <td>
                        <div className="ind-smart-list">
                          {CRITERIOS.map((c, ci) => (
                            <label key={c} className="ind-smart-item">
                              <input type="checkbox" className="ind-check" checked={!!acc[c]}
                                onChange={() => togCriterio("acciones", acc.id_accion, c, acc[c])} />
                              <span>{CRITERIOS_LBL[ci]}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="ind-acc">
                        {editAcc === acc.id_accion
                          ? <button className="ind-btn ind-btn-mini"
                              onClick={() => guardarAcc(acc.id_accion)}>OK</button>
                          : <div className="ind-acc-stack">
                              <button className="ind-acc-btn ind-acc-btn-edit" title="Editar"
                                onClick={() => { setEditAcc(acc.id_accion); setFormAcc({ descripcion: acc.descripcion || "", indicador_texto: acc.indicador_texto || "" }); }}>✎</button>
                              <button className="ind-acc-btn ind-acc-btn-del" title="Eliminar"
                                onClick={() => eliminarAcc(acc.id_accion)}>✕</button>
                            </div>}
                      </td>
                    </tr>
                  ))}

                  {/* Fila para agregar acción al objetivo */}
                  {addingAccForObj === obj.id_objetivo
                    ? <tr className="ind-obj-fila-nueva">
                        <td style={{ paddingLeft: 32 }}>
                          <input autoFocus value={formAcc.descripcion} placeholder="Nueva acción…"
                            onChange={(e) => setFormAcc({ ...formAcc, descripcion: e.target.value })} />
                        </td>
                        <td>
                          <input value={formAcc.indicador_texto} placeholder="Indicador asociado"
                            onChange={(e) => setFormAcc({ ...formAcc, indicador_texto: e.target.value })} />
                        </td>
                        <td>
                          <div className="ind-smart-list">
                            {CRITERIOS.map((c, ci) => (
                              <label key={c} className="ind-smart-item">
                                <input type="checkbox" className="ind-check" checked={!!formAcc[c]}
                                  onChange={(e) => setFormAcc({ ...formAcc, [c]: e.target.checked })} />
                                <span>{CRITERIOS_LBL[ci]}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                        <td className="ind-acc">
                          <button className="ind-btn ind-btn-mini"
                            onClick={() => crearAcc(obj.id_objetivo)}>OK</button>
                          <button className="ind-btn-icono"
                            onClick={() => setAddingAccForObj(null)}>✕</button>
                        </td>
                      </tr>
                    : <tr className="ind-obj-fila-addacc">
                        <td colSpan={4}>
                          <button className="ind-btn-link"
                            onClick={() => { setAddingAccForObj(obj.id_objetivo); setFormAcc({ descripcion: "", indicador_texto: "" }); }}>
                            + Agregar acción
                          </button>
                        </td>
                      </tr>}
                </React.Fragment>
              );
            })}

            {/* Fila para agregar nuevo objetivo */}
            {addingObj && (
              <tr className="ind-obj-fila-nueva">
                <td>
                  <input autoFocus value={formObj.descripcion} placeholder="Descripción del objetivo…"
                    onChange={(e) => setFormObj({ ...formObj, descripcion: e.target.value })} />
                </td>
                <td>
                  <input value={formObj.indicador_texto} placeholder="Indicador asociado"
                    onChange={(e) => setFormObj({ ...formObj, indicador_texto: e.target.value })} />
                </td>
                <td>
                  <div className="ind-smart-list">
                    {CRITERIOS.map((c, ci) => (
                      <label key={c} className="ind-smart-item">
                        <input type="checkbox" className="ind-check" checked={!!formObj[c]}
                          onChange={(e) => setFormObj({ ...formObj, [c]: e.target.checked })} />
                        <span>{CRITERIOS_LBL[ci]}</span>
                      </label>
                    ))}
                  </div>
                </td>
                <td className="ind-acc">
                  <button className="ind-btn ind-btn-mini" onClick={crearObj}>OK</button>
                  <button className="ind-btn-icono" onClick={() => setAddingObj(false)}>✕</button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
    </div>
  );
}

function SeccionResumen({ ficha }) {
  const tieneCronograma = (ficha?.logros || []).some(l => !l.es_linea_base);
  if (!tieneCronograma) return null;

  const r = ficha.resumen;
  const colorNombre = r.estado?.color || "rojo";
  const HEX   = { verde: "#16a34a", amarillo: "#ca8a04", rojo: "#dc2626" };
  const BG    = { verde: "#f0fdf4", amarillo: "#fefce8", rojo: "#fef2f2" };
  const BRD   = { verde: "#86efac", amarillo: "#fde047", rojo: "#fca5a5" };
  const colorHex = HEX[colorNombre] || HEX.rojo;
  const colorBg  = BG[colorNombre]  || BG.rojo;
  const colorBrd = BRD[colorNombre] || BRD.rojo;
  const etiqueta = r.estado?.etiqueta || "Sin datos";
  const cumpl  = r.cumplimiento_pct ?? 0;
  const avance = r.valor_actual ?? 0;
  const meta   = r.meta_final ?? 100;

  return (
    <section className="ind-seccion">
      <div className="ind-seccion-cab">
        <h3>Avance del Proyecto</h3>
        <span className="ind-sub">Real vs. planificado</span>
      </div>
      <div className="ind-resumen-v2">
        {/* KPI — Avance real */}
        <div className="ind-kpi-v2">
          <div className="ind-kpi-ico" style={{ background: "#EFF6FF", color: "#2563EB" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
          <div className="ind-kpi-info">
            <div className="ind-kpi-val">{avance}<span className="ind-kpi-unit">%</span></div>
            <div className="ind-kpi-lbl">Avance real acumulado</div>
            <div className="ind-kpi-tag" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>
              {avance >= meta ? "Meta alcanzada" : `Faltan ${Math.max(0, meta - avance)}%`}
            </div>
          </div>
        </div>

        {/* KPI — Meta final */}
        <div className="ind-kpi-v2">
          <div className="ind-kpi-ico" style={{ background: "#F5F3FF", color: "#7C3AED" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div className="ind-kpi-info">
            <div className="ind-kpi-val">{meta}<span className="ind-kpi-unit">%</span></div>
            <div className="ind-kpi-lbl">Meta final del proyecto</div>
            <div className="ind-kpi-tag" style={{ background: "#EDE9FE", color: "#6D28D9" }}>
              {cumpl >= 100 ? "✓ Al 100% del plan" : `${cumpl}% del plan`}
            </div>
          </div>
        </div>

        {/* KPI — Cumplimiento */}
        <div className="ind-kpi-v2" style={{ background: colorBg, border: `1.5px solid ${colorBrd}` }}>
          <div className="ind-kpi-ico" style={{ background: colorBg, color: colorHex, border: `1.5px solid ${colorBrd}` }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>
          <div className="ind-kpi-info">
            <div className="ind-kpi-val" style={{ color: colorHex }}>{cumpl}<span className="ind-kpi-unit">%</span></div>
            <div className="ind-kpi-lbl">Cumplimiento</div>
            <div className="ind-kpi-tag" style={{ background: colorHex, color: "#fff" }}>{etiqueta}</div>
          </div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="ind-barra-v2">
        <div className="ind-barra-track">
          <div
            className="ind-barra-fill"
            style={{ width: `${Math.min(cumpl, 100)}%`, background: `linear-gradient(90deg, ${colorHex}88, ${colorHex})` }}
          />
          {meta < 100 && (
            <div className="ind-barra-meta-line" style={{ left: `${Math.min(meta, 100)}%` }}>
              <span className="ind-barra-meta-tip">{meta}%</span>
            </div>
          )}
        </div>
        <div className="ind-barra-footer">
          <span style={{ color: "#94a3b8" }}>0%</span>
          <span style={{ color: colorHex, fontWeight: 700, fontSize: 13 }}>{cumpl}% completado</span>
          <span style={{ color: "#94a3b8" }}>Meta: {meta}%</span>
        </div>
      </div>
    </section>
  );
}

function SeccionSemaforo({ ficha, onCambio }) {
  const [editId, setEditId] = useState(null);
  const [val, setVal]       = useState({});
  const guardar = async (id) => { await editarDetalleInd("rangos", id, val); setEditId(null); onCambio(); };

  const C_HEX = { rojo: "#dc2626", amarillo: "#ca8a04", verde: "#16a34a" };
  const C_BG  = { rojo: "#fef2f2", amarillo: "#fefce8", verde: "#f0fdf4" };
  const C_BRD = { rojo: "#fca5a5", amarillo: "#fde047", verde: "#86efac" };
  const C_SEG = { rojo: "#ef4444", amarillo: "#eab308", verde: "#22c55e" };

  return (
    <section className="ind-seccion">
      <div className="ind-seccion-cab">
        <h3>Rango de valores (Semáforo)</h3>
        <span className="ind-sub" style={{ cursor: "default" }}>
          {editId ? "✎ Editando rango…" : "Clic en ✎ para editar"}
        </span>
      </div>

      {/* Barra visual con rangos */}
      <div className="ind-sem-barra">
        {ficha.rangos.map((r) => (
          <div key={r.id_rango} className="ind-sem-seg" style={{ background: C_SEG[r.color] || "#64748b" }}>
            <div className="ind-sem-seg-lbl">{r.etiqueta}</div>
          </div>
        ))}
      </div>

      {/* Tarjetas editables */}
      <div className="ind-sem-cards">
        {ficha.rangos.map((r) => (
          <div
            key={r.id_rango}
            className="ind-sem-card"
            style={{ background: C_BG[r.color] || "#f8fafc", borderColor: C_BRD[r.color] || "#e2e8f0" }}
          >
            {editId === r.id_rango ? (
              <div className="ind-sem-edit-row">
                <input
                  className="ind-sem-inp ind-sem-inp-lbl"
                  defaultValue={r.etiqueta}
                  placeholder="Etiqueta"
                  onChange={(e) => setVal((v) => ({ ...v, etiqueta: e.target.value }))}
                />
                <div className="ind-sem-rng-fila">
                  <input type="number" className="ind-sem-inp ind-sem-inp-num" defaultValue={r.desde}
                    onChange={(e) => setVal((v) => ({ ...v, desde: Number(e.target.value) }))} />
                  <span style={{ color: "#94a3b8", fontWeight: 700 }}>–</span>
                  <input type="number" className="ind-sem-inp ind-sem-inp-num" defaultValue={r.hasta}
                    onChange={(e) => setVal((v) => ({ ...v, hasta: Number(e.target.value) }))} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="ind-btn ind-btn-mini" onClick={() => guardar(r.id_rango)}>✓ Guardar</button>
                  <button className="ind-btn-icono" style={{ color: "#64748b" }} onClick={() => setEditId(null)}>✕</button>
                </div>
              </div>
            ) : (
              <div className="ind-sem-card-view">
                <span className="ind-sem-dot" style={{ color: C_HEX[r.color] || "#64748b" }}>●</span>
                <div className="ind-sem-card-data">
                  <div className="ind-sem-card-lbl" style={{ color: C_HEX[r.color] || "#334155" }}>{r.etiqueta}</div>
                  <div className="ind-sem-card-rng">{r.desde} – {r.hasta}</div>
                </div>
                <button className="ind-btn-icono ind-btn-editar"
                  onClick={() => { setEditId(r.id_rango); setVal({}); }}>✎</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}


const MESES_ES = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
                  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];

function extraerMes(periodo) {
  const fecha = String(periodo || "").split("→")[0].trim();
  const partes = fecha.split("-");
  if (partes.length < 2) return "";
  return MESES_ES[parseInt(partes[1], 10) - 1] || "";
}

function extraerAnio(periodo) {
  const fecha = String(periodo || "").split("→")[0].trim();
  return fecha.split("-")[0] || "";
}

// ---------- Cronograma + Avance UNIFICADOS en una sola tabla ----------
function SeccionCronograma({ ficha, indSel, onCambio, procesoNivel = 0 }) {
  const [propagando, setPropagando] = useState(false);
  const [msgProp, setMsgProp]       = useState(null);

  const tieneDatos = (ficha?.logros || [])
    .filter(l => !l.es_linea_base)
    .some(l => (l.valor_planificado ?? 0) !== 0 || (l.valor_real ?? 0) !== 0);

  const propagar = async () => {
    if (propagando) return;
    setPropagando(true); setMsgProp(null);
    try {
      const r = await fetch(`http://localhost:8000/api/indicadores/${indSel}/propagar/`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setMsgProp({ tipo: "err", texto: d.mensaje || "Error al propagar." });
      } else {
        setMsgProp({ tipo: "ok", texto: `✓ Datos propagados a ${d.propagados} subproceso(s).` });
        setTimeout(() => setMsgProp(null), 3000);
        onCambio();
      }
    } catch {
      setMsgProp({ tipo: "err", texto: "Error de conexión." });
    } finally {
      setPropagando(false);
    }
  };
  const avancePorPeriodo = {};
  ficha.avance.forEach((a) => { avancePorPeriodo[a.periodo] = a; });

  const [editId, setEditId] = useState(null);
  const [valReal, setValReal] = useState("");
  const [valPlan, setValPlan] = useState(""); // vacío = conservar valor actual

  const finDelPeriodo = (p) => {
    if (!p) return "";
    const partes = String(p).split("→");
    return (partes[1] || partes[0]).trim();
  };

  const abrirEdicion = (logro) => {
    const av = avancePorPeriodo[logro.periodo];
    setEditId(logro.id_logro);
    setValReal(av ? String(av.valor_real) : "");
    setValPlan(""); // siempre empieza vacío; el placeholder muestra el valor actual
  };

  const guardar = async (logro) => {
    // Planificado: solo actualizar si el usuario escribió algo
    if (valPlan.trim() !== "") {
      await editarDetalleInd("logros", logro.id_logro, { valor_planificado: Number(valPlan) });
    }

    // Logrado: crear o actualizar avance
    const av = avancePorPeriodo[logro.periodo];
    const valor = Number(valReal) || 0;
    if (av) {
      await editarDetalleInd("avance", av.id_avance, { valor_real: valor });
    } else {
      await agregarDetalleInd("avance", {
        id_indicador: indSel, periodo: logro.periodo,
        valor_real: valor, fecha_registro: finDelPeriodo(logro.periodo),
      });
    }

    setEditId(null); setValReal(""); setValPlan(""); onCambio();
  };

  return (
    <section className="ind-seccion">
      <div className="ind-seccion-cab">
        <h3>Cronograma y Avance</h3>
        {tieneDatos && procesoNivel === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {msgProp && (
              <span style={{ fontSize: 12, fontWeight: 600, color: msgProp.tipo === "ok" ? "#15803d" : "#B91C1C" }}>
                {msgProp.texto}
              </span>
            )}
            <button
              className="ind-btn ind-btn-propagar"
              onClick={propagar}
              disabled={propagando}
              title="Propagar cronograma a subprocesos"
            >
              {propagando ? "⏳" : "⬇️"} {propagando ? "Propagando…" : "Propagar a subprocesos"}
            </button>
          </div>
        )}
      </div>
      {ficha.logros.length === 0 ? (
        <p className="ind-vacia">Aún no hay cronograma. Ve a <strong>Gestión de Procesos</strong> y genera el cronograma global desde allí.</p>
      ) : (
        <table className="ind-tabla">
          <thead>
            <tr>
              <th style={{ minWidth: 220 }}>Periodo</th>
              <th style={{ width: 120 }}>Mes</th>
              <th style={{ width: 60 }}>Año</th>
              <th style={{ width: 130 }}>% planificado</th>
              <th style={{ width: 130 }}>% logrado</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {ficha.logros.map((l) => {
              const av = avancePorPeriodo[l.periodo];
              return (
                <tr key={l.id_logro}>
                  <td>{l.periodo}</td>
                  <td style={{ fontWeight: 600 }}>{extraerMes(l.periodo)}</td>
                  <td style={{ fontWeight: 600 }}>{extraerAnio(l.periodo)}</td>
                  <td>
                    {editId === l.id_logro
                      ? <input type="number" value={valPlan} placeholder={`${l.valor_planificado ?? 0} (actual)`}
                          onChange={(e) => setValPlan(e.target.value)} />
                      : <span>{l.valor_planificado ?? 0}%</span>}
                  </td>
                  <td>
                    {editId === l.id_logro
                      ? <input type="number" autoFocus value={valReal} placeholder="% logrado"
                          onChange={(e) => setValReal(e.target.value)} />
                      : <span>{av ? `${av.valor_real}%` : "—"}</span>}
                  </td>
                  <td className="ind-acc" style={{ display: "flex", gap: 4 }}>
                    {editId === l.id_logro
                      ? <button className="ind-btn ind-btn-mini" onClick={() => guardar(l)}>OK</button>
                      : <button className="ind-btn-icono ind-btn-editar" onClick={() => abrirEdicion(l)}>✎</button>}
                    <button
                      className="ind-btn-icono"
                      style={{ color: "#dc2626" }}
                      title="Eliminar este periodo"
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar el periodo "${l.periodo}"?`)) return;
                        await borrarDetalleInd("logros", l.id_logro);
                        onCambio();
                      }}
                    >🗑</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Paleta semáforo para la gráfica (los hex NUNCA cambian) ──────────────────
const SEM_COLOR = { verde: "#16a34a", amarillo: "#eab308", rojo: "#dc2626" };
const SEM_CLARO = { verde: "#bbf7d0", amarillo: "#fef9c3", rojo: "#fecaca" };
const SEM_TEXTO = { verde: "#15803d", amarillo: "#a16207", rojo: "#b91c1c" };

function colorDeRangos(valor, rangos) {
  if (valor === null || valor === undefined || !rangos?.length) return null;
  for (const r of rangos) {
    if (valor >= (r.desde ?? 0) && valor <= (r.hasta ?? 100)) return r.color;
  }
  return "rojo";
}

// ---------- helpers de fecha para la gráfica ----------
function fmtDiaMes(periodo) {
  const iso = String(periodo || "").split("→")[0].trim();
  const p   = iso.split("-");
  if (p.length < 3) return iso;
  return `${p[2].padStart(2,"0")}/${p[1].padStart(2,"0")}`;
}
function fmtAnioGraf(periodo) {
  return String(periodo || "").split("-")[0] || "";
}

// ---------- Gráfica de línea SVG ----------
function SeccionGrafica({ ficha }) {
  const wrapRef     = useRef(null);
  const [anchoDisp, setAnchoDisp] = useState(860);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setAnchoDisp(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const avancePorPeriodo = {};
  ficha.avance.forEach((a) => { avancePorPeriodo[a.periodo] = a; });

  const logros = ficha.logros;
  if (!logros.length)
    return (
      <section className="ind-seccion">
        <div className="ind-seccion-cab"><h3>Gráfica de Avance</h3></div>
        <p className="ind-vacia">Sin cronograma. Ve a <strong>Gestión de Procesos</strong> y genera el cronograma global.</p>
      </section>
    );

  // valor_planificado ya es acumulado en el Excel; acumular solo el real (incremental)
  let cumReal = 0;
  const todosLosDatos = logros
    .filter((l) => !l.es_linea_base)
    .map((l) => {
      const planAcum = l.valor_planificado ?? 0; // cumulative, use directly
      const av = avancePorPeriodo[l.periodo];
      const realInc = av != null ? (av.valor_real ?? 0) : 0;
      let realAcum = null;
      if (realInc > 0) {
        cumReal = Math.round((cumReal + realInc) * 10) / 10;
        realAcum = cumReal;
      }
      const colorNombre = colorDeRangos(realAcum, ficha.rangos);
      return { ...l, planAcum, realAcum, colorNombre };
    });

  // Solo periodos con datos (planificado > 0 O tiene avance real)
  const datos = todosLosDatos.filter((d) => d.planAcum > 0 || d.realAcum !== null);
  if (!datos.length)
    return (
      <section className="ind-seccion">
        <div className="ind-seccion-cab"><h3>Gráfica de Avance</h3></div>
        <p className="ind-vacia">No hay datos para graficar aún.</p>
      </section>
    );

  // Dimensiones responsivas — se adapta al ancho del contenedor
  const padL = 54, padR = 24, padT = 30, padB = 64;
  const n = datos.length;
  const disponible = Math.max(360, anchoDisp - 2); // -2 para evitar scroll fantasma
  const pxPorPunto = Math.max(44, (disponible - padL - padR) / n);
  const H = 360;
  const chartW = Math.max(disponible, padL + n * pxPorPunto + padR);
  const chartH = H - padT - padB;
  const xPunto = (i) => padL + i * pxPorPunto + pxPorPunto / 2;
  const yPx    = (v) => padT + chartH - (Math.min(Math.max(v, 0), 100) / 100) * chartH;
  const ticks  = [0,10,20,30,40,50,60,70,80,90,100];

  // Polilíneas
  const ptsPlan = datos.map((d, i) => `${xPunto(i)},${yPx(d.planAcum)}`).join(" ");
  const ptsReal = datos
    .filter((d) => d.realAcum !== null)
    .map((d) => `${xPunto(datos.indexOf(d))},${yPx(d.realAcum)}`)
    .join(" ");

  const showLbl = (i) => n <= 18 || i % 2 === 0;

  return (
    <section className="ind-seccion">
      <div className="ind-seccion-cab">
        <h3>Gráfica de Avance</h3>
        <span className="ind-sub">Planificado vs. Real acumulado — {datos.length} semana{datos.length !== 1 ? "s" : ""} con datos</span>
      </div>
      <div ref={wrapRef} style={{ overflowX: "auto", paddingBottom: 8 }}>
        <svg width={chartW} height={H} style={{ display: "block", fontFamily: "inherit", minWidth: 360 }}>

          {/* Guías horizontales */}
          {ticks.map((t) => {
            const y = yPx(t);
            return (
              <g key={t}>
                <line x1={padL} x2={chartW - padR} y1={y} y2={y}
                  stroke={t === 0 ? "#94A3B8" : "#E2E8F0"} strokeWidth={t === 0 ? 1.5 : 1} />
                <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#94A3B8">{t}%</text>
              </g>
            );
          })}

          {/* Eje Y */}
          <line x1={padL} x2={padL} y1={padT} y2={padT + chartH + 1} stroke="#CBD5E1" strokeWidth={1.5} />

          {/* Línea planificado — guionada gris */}
          {ptsPlan && (
            <polyline points={ptsPlan} fill="none"
              stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 3" strokeLinejoin="round" />
          )}

          {/* Línea real — sólida azul */}
          {ptsReal && (
            <polyline points={ptsReal} fill="none"
              stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Puntos por periodo */}
          {datos.map((d, i) => {
            const x  = xPunto(i);
            const yP = yPx(d.planAcum);
            const yR = d.realAcum !== null ? yPx(d.realAcum) : null;
            const semHex = SEM_COLOR[d.colorNombre] ?? "#2563EB";

            return (
              <g key={d.id_logro}>
                {/* Punto planificado — diamante gris con etiqueta */}
                <g transform={`translate(${x},${yP}) rotate(45)`}>
                  <rect x={-5} y={-5} width={10} height={10} fill="#fff" stroke="#94A3B8" strokeWidth={1.5} rx={1}>
                    <title>Planificado: {d.planAcum}%</title>
                  </rect>
                </g>
                {showLbl(i) && (
                  <text x={x} y={yP - 10} textAnchor="middle" fontSize={9} fill="#64748B">
                    {d.planAcum}%
                  </text>
                )}

                {/* Punto real — solo círculo sólido coloreado */}
                {yR !== null && (
                  <g>
                    <circle cx={x} cy={yR} r={7} fill={semHex}>
                      <title>Real: {d.realAcum}% — {d.colorNombre ?? "sin rango"}</title>
                    </circle>
                    {showLbl(i) && (
                      <text x={x} y={yR - 12} textAnchor="middle" fontSize={10} fontWeight="700" fill={semHex}>
                        {d.realAcum}%
                      </text>
                    )}
                  </g>
                )}

                {/* Etiqueta X */}
                <text x={x} y={padT + chartH + 16} textAnchor="middle" fontSize={10} fontWeight="600" fill="#374151">
                  {fmtDiaMes(d.periodo)}
                </text>
                <text x={x} y={padT + chartH + 28} textAnchor="middle" fontSize={9} fill="#9CA3AF">
                  {fmtAnioGraf(d.periodo)}
                </text>
              </g>
            );
          })}

          {/* Leyenda */}
          <g transform={`translate(${padL}, ${H - 20})`}>
            <line x1={0} y1={7} x2={18} y2={7} stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 3" />
            <g transform="translate(9,7) rotate(45)">
              <rect x={-4} y={-4} width={8} height={8} fill="#fff" stroke="#94A3B8" strokeWidth={1.5} rx={1} />
            </g>
            <text x={24} y={11} fontSize={11} fill="#475569">Planificado</text>

            <line x1={110} y1={7} x2={128} y2={7} stroke="#2563EB" strokeWidth={2} />
            <circle cx={119} cy={7} r={5} fill="#2563EB" />
            <text x={134} y={11} fontSize={11} fill="#475569">Real acumulado</text>

            <circle cx={240} cy={7} r={5} fill="#DC2626" />
            <circle cx={252} cy={7} r={5} fill="#EAB308" />
            <circle cx={264} cy={7} r={5} fill="#16A34A" />
            <text x={274} y={11} fontSize={11} fill="#475569">Semáforo</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FICHA DE INDICADOR — Formato tabla oficial (tipo Excel)
// ─────────────────────────────────────────────────────────────────────────────

function FichaTecnicaInd({ ficha, maestro: raw, procesoNombre, onCerrar }) {
  // Aplicar fallbacks para campos con opciones por defecto en el formulario
  const ind = {
    tipo:             raw?.tipo             || "Cuantitativo",
    sentido_esperado: raw?.sentido_esperado || "Ascendente",
    unidad_medida:    raw?.unidad_medida    || "Porcentaje (%)",
    frecuencia:       raw?.frecuencia       || raw?.frecuencia_crono || "Semanal",
    tipo_agregacion:  raw?.tipo_agregacion  || "Acumulado",
    ...Object.fromEntries(Object.entries(raw || {}).filter(([, v]) => v != null && v !== "")),
  };

  const lineaBase = (ficha?.logros || []).filter(l => l.es_linea_base);
  const logros    = (ficha?.logros || []).filter(l => !l.es_linea_base && (l.valor_planificado ?? 0) > 0);
  const avances   = ficha?.avance  || [];

  const avPorPeriodo = {};
  avances.forEach(a => { avPorPeriodo[a.periodo] = a.valor_real; });

  const lb  = lineaBase[0] || null;
  const fmt = v => (v != null && v !== "" ? String(v) : "—");

  return (
    <div className="fi-overlay" onClick={onCerrar}>
      <div className="fi-modal" onClick={e => e.stopPropagation()}>

        {/* Barra de herramientas */}
        <div className="fi-toolbar">
          <span className="fi-toolbar-title">Ficha de Indicador</span>
          <div className="fi-toolbar-btns">
            <button className="fi-btn-cerrar" onClick={onCerrar}>✕ Cerrar</button>
          </div>
        </div>

        {/* Área del documento */}
        <div className="fi-doc-wrap">
          <div className="fi-doc">

            {/* ── TABLA PRINCIPAL ── */}
            <table className="fi-t">
              <colgroup>
                <col style={{ width: "160px" }} />
                <col />
                <col style={{ width: "130px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <tbody>
                <tr>
                  <td colSpan={6} className="fi-t-head">FICHA DE INDICADOR [PRODUCTO PROCESO]</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl">Proceso</td>
                  <td colSpan={5} className="fi-t-val fi-t-center">{fmt(procesoNombre)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl fi-t-bold">Nombre del indicador</td>
                  <td colSpan={5} className="fi-t-val fi-t-bold">{fmt(ind.nombre_indicador)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl fi-t-center">Código</td>
                  <td className="fi-t-val fi-t-center">{fmt(ind.codigo)}</td>
                  <td className="fi-t-lbl fi-t-center" colSpan={2}>Tipo</td>
                  <td className="fi-t-val fi-t-center" colSpan={2}>{fmt(ind.tipo)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl">Justificación</td>
                  <td colSpan={5} className="fi-t-val">{fmt(ind.justificacion)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl">Responsable</td>
                  <td colSpan={5} className="fi-t-val fi-t-center">{fmt(ind.responsable)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl">Método de cálculo</td>
                  <td colSpan={5} className="fi-t-val">{fmt(ind.metodo_calculo)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl fi-t-center">Sentido esperado</td>
                  <td className="fi-t-val fi-t-center">{fmt(ind.sentido_esperado)}</td>
                  <td className="fi-t-lbl fi-t-center">Unidad de medida</td>
                  <td className="fi-t-val fi-t-center">{fmt(ind.unidad_medida)}</td>
                  <td className="fi-t-lbl fi-t-center">Frecuencia</td>
                  <td className="fi-t-val fi-t-center">{fmt(ind.frecuencia || ind.frecuencia_crono)}</td>
                </tr>
                <tr>
                  <td className="fi-t-lbl">Fuente de datos</td>
                  <td colSpan={5} className="fi-t-val">{fmt(ind.fuente_datos)}</td>
                </tr>
              </tbody>
            </table>

            {/* ── TABLA LÍNEA BASE + LOGROS ── */}
            {(lb || logros.length > 0) && (
              <table className="fi-t fi-t-logros">
                <colgroup>
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "100px" }} />
                  {logros.map(l => <col key={l.id_logro} />)}
                </colgroup>
                <tbody>
                  <tr>
                    <td colSpan={2} className="fi-t-section fi-t-center">Línea base</td>
                    <td colSpan={logros.length || 1} className="fi-t-section fi-t-center">Logros esperados</td>
                  </tr>
                  <tr>
                    <td className="fi-t-lbl fi-t-center">Año</td>
                    <td className="fi-t-val fi-t-center">{lb ? fmt(lb.periodo) : "—"}</td>
                    {logros.map((l, i) => (
                      <td key={l.id_logro} className="fi-t-col-hdr fi-t-center">S{i + 1}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="fi-t-lbl fi-t-center">Valor</td>
                    <td className="fi-t-val fi-t-center fi-t-bold">
                      {lb != null ? `${lb.valor_planificado ?? "—"}%` : "—"}
                    </td>
                    {logros.map(l => (
                      <td key={l.id_logro} className="fi-t-val fi-t-center fi-t-plan">
                        {l.valor_planificado != null ? `${l.valor_planificado}%` : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            )}

            {/* ── PIE DE FIRMAS ── */}
            <table className="fi-t fi-t-pie">
              <tbody>
                <tr>
                  <td className="fi-t-lbl fi-t-center">Elaborado por:</td>
                  <td className="fi-t-lbl fi-t-center">Revisado por:</td>
                  <td className="fi-t-lbl fi-t-center">Aprobado por:</td>
                </tr>
                <tr>
                  <td className="fi-t-val fi-t-center fi-t-firma">{fmt(ind.responsable)}</td>
                  <td className="fi-t-val fi-t-center fi-t-firma">{fmt(ind.responsable)}</td>
                  <td className="fi-t-val fi-t-center fi-t-firma">{fmt(ind.responsable)}</td>
                </tr>
              </tbody>
            </table>

          </div>
        </div>
      </div>
    </div>
  );
}