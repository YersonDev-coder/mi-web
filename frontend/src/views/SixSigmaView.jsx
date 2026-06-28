import { useState, useEffect, useCallback } from "react";
import "./SixSigmaView.css";
import * as api from "../services/api";

// ── Constantes ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "D", label: "Definir",   fase: "puede_definir"   },
  { id: "M", label: "Medir",     fase: "puede_medir"     },
  { id: "A", label: "Analizar",  fase: "puede_analizar"  },
  { id: "I", label: "Mejorar",   fase: "puede_mejorar"   },
  { id: "C", label: "Controlar", fase: "puede_controlar" },
  { id: "H", label: "Historial", fase: null              },
];
const CATEGORIAS_6M = ["Método","Máquina/Tecnología","Personal","Información","Medición","Entorno"];
const TIPOS_IND = ["Eficacia","Eficiencia","Efectividad","Calidad","Cumplimiento"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const sigmaCls = (s) => {
  const v = parseFloat(s);
  if (isNaN(v)) return "sin";
  if (v < 3) return "bajo";
  if (v < 4) return "medio";
  return "alto";
};
const fmtS = (v) => { const n = parseFloat(v); return isNaN(n) ? "—" : n.toFixed(2) + "σ"; };
const fmtN = (v, d = 2) => { const n = parseFloat(v); return isNaN(n) ? "—" : n.toFixed(d); };

// ── SVG Pareto ────────────────────────────────────────────────────────────────
function ParetoChart({ datos }) {
  if (!datos || datos.length === 0)
    return <p style={{ color: "#475569", fontSize: "0.8rem" }}>Sin datos suficientes.</p>;
  const W=600,H=260,ML=50,MB=70,MT=20,MR=60,CW=W-ML-MR,CH=H-MT-MB;
  const maxD = Math.max(...datos.map(d => d.defectos), 1);
  const bw   = CW / datos.length;
  const pts  = datos.map((d,i) => `${ML+i*bw+bw/2},${MT+CH-(d.acumulado/100)*CH}`).join(" ");
  return (
    <div className="ss-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {[0,25,50,75,100].map(p => (
          <line key={p} x1={ML} y1={MT+CH*(1-p/100)} x2={ML+CW} y2={MT+CH*(1-p/100)}
                stroke="rgba(99,102,241,0.1)" strokeWidth="1"/>
        ))}
        <line x1={ML} y1={MT+CH*0.2} x2={ML+CW} y2={MT+CH*0.2}
              stroke="#f87171" strokeWidth="1.5" strokeDasharray="4,3"/>
        {datos.map((d,i) => {
          const bh=(d.defectos/maxD)*CH, x=ML+i*bw+bw*0.1, y=MT+CH-bh;
          return <rect key={i} x={x} y={y} width={bw*0.8} height={bh}
                       fill={d.critico?"rgba(99,102,241,0.7)":"rgba(99,102,241,0.3)"} rx="2"/>;
        })}
        {datos.length>0 && <polyline points={pts} fill="none" stroke="#fbbf24" strokeWidth="2"/>}
        {datos.map((d,i) => {
          const x=ML+i*bw+bw/2;
          return <text key={i} x={x} y={MT+CH+14} textAnchor="middle" fontSize="8" fill="#64748b"
                       transform={`rotate(-40,${x},${MT+CH+14})`}>{String(d.periodo).slice(0,12)}</text>;
        })}
        {[0,25,50,75,100].map(p => (
          <text key={p} x={ML-5} y={MT+CH*(1-p/100)+4} textAnchor="end" fontSize="8" fill="#64748b">{p}%</text>
        ))}
        <text x={ML+CW+4} y={MT+8} fontSize="8" fill="#94a3b8">Acumulado</text>
        <text x={ML+CW+4} y={MT+20} fontSize="8" fill="#f87171">80% línea</text>
      </svg>
    </div>
  );
}

// ── SVG Temporal ──────────────────────────────────────────────────────────────
function GraficaTemporal({ datos }) {
  if (!datos || datos.length < 2)
    return <p style={{ color: "#475569", fontSize: "0.8rem" }}>Se necesitan al menos 2 mediciones.</p>;
  const W=600,H=200,ML=45,MB=55,MT=20,MR=20,CW=W-ML-MR,CH=H-MT-MB;
  const sigmas = datos.map(d => parseFloat(d.nivel_sigma)||0);
  const maxS   = Math.max(...sigmas, 1);
  const toX    = i => ML+(i/Math.max(datos.length-1,1))*CW;
  const toY    = v => MT+CH-(v/maxS)*CH;
  const pts    = datos.map((d,i) => `${toX(i)},${toY(parseFloat(d.nivel_sigma)||0)}`).join(" ");
  return (
    <div className="ss-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        {[0,0.25,0.5,0.75,1].map(p => (
          <line key={p} x1={ML} y1={MT+CH*p} x2={ML+CW} y2={MT+CH*p}
                stroke="rgba(99,102,241,0.08)" strokeWidth="1"/>
        ))}
        <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="2"/>
        {datos.map((d,i) => (
          <circle key={i} cx={toX(i)} cy={toY(parseFloat(d.nivel_sigma)||0)} r="3.5" fill="#818cf8"/>
        ))}
        {datos.map((d,i) => {
          const x=toX(i);
          return <text key={i} x={x} y={H-MB+16} textAnchor="middle" fontSize="8" fill="#64748b"
                       transform={`rotate(-35,${x},${H-MB+16})`}>{String(d.periodo).slice(0,10)}</text>;
        })}
        {[0,0.5,1].map(p => (
          <text key={p} x={ML-5} y={MT+CH*(1-p)+4} textAnchor="end" fontSize="8" fill="#64748b">
            {(maxS*p).toFixed(1)}σ
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── SVG Carta control ─────────────────────────────────────────────────────────
function CartaControl({ carta }) {
  if (!carta || carta.puntos.length === 0)
    return <p style={{ color: "#475569", fontSize: "0.8rem" }}>Sin mediciones para la carta.</p>;
  const W=600,H=220,ML=50,MB=55,MT=20,MR=20,CW=W-ML-MR,CH=H-MT-MB;
  const {puntos,ucl,cl,lcl} = carta;
  const maxY = Math.max(ucl*1.1, ...puntos.map(p=>p.valor), 1);
  const minY = Math.max(0, lcl*0.9);
  const rng  = maxY-minY||1;
  const toY  = v => MT+CH-((v-minY)/rng)*CH;
  const toX  = i => ML+(i/Math.max(puntos.length-1,1))*CW;
  const pts  = puntos.map((p,i) => `${toX(i)},${toY(p.valor)}`).join(" ");
  return (
    <div className="ss-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <line x1={ML} y1={toY(ucl)} x2={ML+CW} y2={toY(ucl)} stroke="#f87171" strokeWidth="1.5" strokeDasharray="5,3"/>
        {lcl>0 && <line x1={ML} y1={toY(lcl)} x2={ML+CW} y2={toY(lcl)} stroke="#f87171" strokeWidth="1.5" strokeDasharray="5,3"/>}
        <line x1={ML} y1={toY(cl)} x2={ML+CW} y2={toY(cl)} stroke="#34d399" strokeWidth="1.5"/>
        <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.5"/>
        {puntos.map((p,i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.valor)} r="4"
                  fill={p.fuera?"#f87171":"#818cf8"}
                  stroke={p.fuera?"#fca5a5":"none"} strokeWidth="2"/>
        ))}
        {puntos.map((p,i) => {
          const x=toX(i);
          return <text key={i} x={x} y={H-MB+16} textAnchor="middle" fontSize="8" fill="#64748b"
                       transform={`rotate(-35,${x},${H-MB+16})`}>{String(p.periodo).slice(0,10)}</text>;
        })}
        <text x={ML-5} y={toY(ucl)+4} textAnchor="end" fontSize="8" fill="#f87171">UCL {ucl.toFixed(2)}</text>
        <text x={ML-5} y={toY(cl)+4}  textAnchor="end" fontSize="8" fill="#34d399">CL {cl.toFixed(2)}</text>
        {lcl>0 && <text x={ML-5} y={toY(lcl)+4} textAnchor="end" fontSize="8" fill="#f87171">LCL {lcl.toFixed(2)}</text>}
      </svg>
    </div>
  );
}

// ── Tab Definir ───────────────────────────────────────────────────────────────
function TabDefinir({ def, onActualizar }) {
  const [form, setForm]   = useState({});
  const [editando, setEd] = useState(false);
  useEffect(() => { setForm(def||{}); setEd(false); }, [def]);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const guardar = async () => {
    try { const r = await api.ssActualizarDef(def.id_def, form); onActualizar(r); setEd(false); }
    catch { alert("Error al guardar"); }
  };
  if (!def) return null;
  const row = (label, key, type="text", opts=null) => (
    <div className="ss-campo" key={key}>
      <label>{label}</label>
      {editando
        ? opts
          ? <select value={form[key]||""} onChange={e=>set(key,e.target.value)}>
              {opts.map(o=><option key={o}>{o}</option>)}
            </select>
          : type==="textarea"
            ? <textarea value={form[key]||""} onChange={e=>set(key,e.target.value)}/>
            : <input type={type} value={form[key]||""} onChange={e=>set(key,e.target.value)}/>
        : <span style={{fontSize:"0.85rem",color:"#e2e8f0"}}>{def[key]||"—"}</span>
      }
    </div>
  );
  return (
    <div>
      <div className="ss-card">
        <div className="ss-card-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          Definición del proceso
          {!editando
            ? <button className="ss-btn secundario sm" onClick={()=>setEd(true)}>Editar</button>
            : <div style={{display:"flex",gap:"0.4rem"}}>
                <button className="ss-btn primario sm" onClick={guardar}>Guardar</button>
                <button className="ss-btn secundario sm" onClick={()=>{setForm(def);setEd(false);}}>Cancelar</button>
              </div>}
        </div>
        <div className="ss-form">
          {row("Nombre del proceso","nombre_proceso")}
          {row("Indicador relacionado","indicador")}
          <div className="ss-campo ss-form-full">
            <label>Descripción</label>
            {editando
              ? <textarea value={form.descripcion||""} onChange={e=>set("descripcion",e.target.value)}/>
              : <span style={{fontSize:"0.82rem",color:"#94a3b8"}}>{def.descripcion||"—"}</span>}
          </div>
          <div className="ss-campo ss-form-full">
            <label>Definición de defecto</label>
            {editando
              ? <textarea value={form.definicion_defecto||""} onChange={e=>set("definicion_defecto",e.target.value)}/>
              : <span style={{fontSize:"0.82rem",color:"#cbd5e1"}}>{def.definicion_defecto||"—"}</span>}
          </div>
          {row("Oportunidades por unidad","oportunidades_defecto","number")}
          {row("Meta (%)","meta","number")}
          {row("Unidad de medida","unidad_medida")}
          {row("Tipo de indicador","tipo_indicador","text",TIPOS_IND)}
        </div>
      </div>
    </div>
  );
}

// ── Tab Medir ─────────────────────────────────────────────────────────────────
function TabMedir({ defId, canMedir, defIndicador }) {
  const esSistema  = defIndicador && !isNaN(parseInt(defIndicador));
  const [mediciones,  setMed]      = useState([]);
  const [editId,      setEditId]   = useState(null);
  const [editDef,     setEditDef]  = useState(0);
  const [reimportando,setReimp]    = useState(false);
  const cargar = useCallback(async () => { if (defId) setMed(await api.ssMediciones(defId)); }, [defId]);
  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async id => { if (!confirm("¿Eliminar?")) return; await api.ssEliminarMed(id); cargar(); };
  const guardarDefectos = async (id) => {
    await api.ssActualizarMed(id, { defectos: editDef });
    setEditId(null);
    cargar();
  };
  const reimportar = async () => {
    setReimp(true);
    try {
      const r = await api.ssSistemaReimportar(defId);
      await cargar();
      alert(`Reimportadas ${r.reimportadas} mediciones con yield acumulado correcto.`);
    } catch(e) { alert("Error: " + (e?.error || e)); }
    finally { setReimp(false); }
  };


  if (!canMedir) return (
    <div className="ss-bloqueado-msg">⚠ Completa la definición (nombre, definición de defecto y oportunidades) para poder medir.</div>
  );
  return (
    <div>
      {esSistema && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"1rem",
          padding:"0.6rem 1rem",marginBottom:"0.75rem",background:"rgba(34,211,238,0.07)",
          border:"1px solid rgba(34,211,238,0.2)",borderRadius:"8px",color:"#94a3b8",fontSize:"0.8rem"}}>
          <span>Los avances se cargan automáticamente desde el sistema de indicadores. Puedes editar los defectos de cada período con ✎.</span>
          <button onClick={reimportar} disabled={reimportando}
            style={{flexShrink:0,padding:"0.3rem 0.75rem",border:"1px solid rgba(34,211,238,0.4)",
              borderRadius:"6px",background:"rgba(34,211,238,0.08)",color:"#22d3ee",
              cursor:"pointer",fontSize:"0.75rem",whiteSpace:"nowrap"}}>
            {reimportando ? "Recalculando..." : "↺ Reimportar datos"}
          </button>
        </div>
      )}

      <div className="ss-card">
        <div className="ss-card-title">Mediciones registradas ({mediciones.length})</div>
        {mediciones.length===0
          ? <p style={{color:"#475569",fontSize:"0.8rem"}}>No hay mediciones aún.</p>
          : <div className="ss-tabla-wrap">
              <table className="ss-tabla">
                <thead><tr><th>Período</th><th>Unidades</th><th>Defectos</th><th>YIELD %</th><th>DPMO</th><th>Nivel σ</th><th>Cumplim.</th><th>Observación</th><th></th></tr></thead>
                <tbody>{mediciones.map(m=>{
                  const esImportado = m.fuente === "inventario_indicadores/avance";
                  const editando    = editId === m.id_med;
                  return (
                    <tr key={m.id_med}>
                      <td style={{fontSize:"0.75rem"}}>{m.periodo}</td>
                      <td>{fmtN(m.unidades_evaluadas,0)}</td>
                      <td>
                        {editando
                          ? <input type="number" min="0" value={editDef}
                              onChange={e=>setEditDef(Number(e.target.value))}
                              style={{width:"50px",padding:"2px 4px",background:"rgba(255,255,255,0.07)",
                                border:"1px solid #818cf8",borderRadius:"4px",color:"#e2e8f0",textAlign:"center"}}/>
                          : fmtN(m.defectos,0)
                        }
                      </td>
                      <td>{fmtN(m.yield_pct)}%</td>
                      <td>{fmtN(m.dpmo,0)}</td>
                      <td><span className={`ss-sigma-badge ${sigmaCls(m.nivel_sigma)}`}>{fmtS(m.nivel_sigma)}</span></td>
                      <td>{fmtN(m.cumplimiento)}%</td>
                      <td style={{fontSize:"0.65rem",color:"#64748b",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}
                          title={m.observacion}>{m.observacion || m.fuente}</td>
                      <td style={{whiteSpace:"nowrap"}}>
                        {esImportado ? (
                          editando
                            ? <>
                                <button className="ss-btn primario sm" onClick={()=>guardarDefectos(m.id_med)}>✓</button>
                                <button className="ss-btn secundario sm" style={{marginLeft:"3px"}} onClick={()=>setEditId(null)}>✕</button>
                              </>
                            : <button className="ss-btn secundario sm" title="Editar defectos"
                                onClick={()=>{setEditId(m.id_med);setEditDef(Number(m.defectos)||0);}}>✎</button>
                        ) : (
                          <button className="ss-btn peligro sm" onClick={()=>eliminar(m.id_med)}>✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}

// ── Tab Analizar ──────────────────────────────────────────────────────────────
function TabAnalizar({ defId, canAnalizar }) {
  const [pareto,  setPar]  = useState([]);
  const [temp,    setTemp] = useState([]);
  const [causas,  setCaus] = useState([]);
  const [porques, setPorq] = useState([]);
  const [newC,    setNewC] = useState({});
  const [newP,    setNewP] = useState({problema:"",por1:"",resp1:"",por2:"",resp2:"",por3:"",resp3:"",por4:"",resp4:"",por5:"",resp5:"",causa_raiz:""});
  const [showPF,  setSPF]  = useState(false);

  const cargar = useCallback(async () => {
    if (!defId) return;
    const [p,t,c,po] = await Promise.all([api.ssPareto(defId),api.ssTemporal(defId),api.ssIshikawa(defId),api.ssPorques(defId)]);
    setPar(p); setTemp(t); setCaus(c); setPorq(po);
  }, [defId]);
  useEffect(() => { cargar(); }, [cargar]);

  const addCausa = async cat => {
    const txt = newC[cat]; if (!txt) return;
    await api.ssAgregarCausa(defId,{categoria:cat,causa:txt});
    setNewC(n=>({...n,[cat]:""})); cargar();
  };
  const delCausa = async id => { if (!confirm("¿Eliminar causa?")) return; await api.ssEliminarCausa(id); cargar(); };

  const addPorq = async () => {
    if (!newP.problema) { alert("El problema es requerido"); return; }
    await api.ssAgregarPorques(defId,newP);
    setNewP({problema:"",por1:"",resp1:"",por2:"",resp2:"",por3:"",resp3:"",por4:"",resp4:"",por5:"",resp5:"",causa_raiz:""});
    setSPF(false); cargar();
  };
  const delPorq = async id => { if (!confirm("¿Eliminar análisis?")) return; await api.ssEliminarPorques(id); cargar(); };

  if (!canAnalizar) return <div className="ss-bloqueado-msg">⚠ Agrega al menos una medición antes de analizar.</div>;

  return (
    <div>
      <div className="ss-card">
        <div className="ss-card-title">Análisis de Pareto (80/20)</div>
        <ParetoChart datos={pareto}/>
        {pareto.length>0 && (
          <div className="ss-tabla-wrap" style={{marginTop:"0.5rem"}}>
            <table className="ss-tabla">
              <thead><tr><th>Período</th><th>Defectos</th><th>%</th><th>Acumulado</th><th>Prioridad</th></tr></thead>
              <tbody>{pareto.map((p,i)=>(
                <tr key={i}>
                  <td>{p.periodo}</td><td>{p.defectos}</td><td>{p.pct}%</td><td>{p.acumulado}%</td>
                  <td>{p.critico?<span style={{color:"#f87171",fontWeight:700}}>CRÍTICO</span>:<span style={{color:"#64748b"}}>Normal</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ss-card">
        <div className="ss-card-title">Tendencia temporal del Nivel σ</div>
        <GraficaTemporal datos={temp}/>
      </div>

      <div className="ss-card">
        <div className="ss-card-title">Diagrama de Ishikawa — 6M</div>
        <div className="ss-6m-grid">
          {CATEGORIAS_6M.map(cat => {
            const cc = causas.filter(c=>c.categoria===cat);
            return (
              <div key={cat} className="ss-6m-cat">
                <div className="ss-6m-cat-title">
                  {cat} <span style={{color:"#475569",fontWeight:400}}>{cc.length}</span>
                </div>
                {cc.map(c=>(
                  <div key={c.id_causa} className="ss-6m-causa-item">
                    <span className="ss-6m-causa-texto">{c.causa}</span>
                    <button className="ss-btn peligro sm" onClick={()=>delCausa(c.id_causa)}>✕</button>
                  </div>
                ))}
                <div className="ss-6m-add-form">
                  <input placeholder="+ Agregar causa..."
                         value={newC[cat]||""}
                         onChange={e=>setNewC(n=>({...n,[cat]:e.target.value}))}
                         onKeyDown={e=>e.key==="Enter"&&addCausa(cat)}/>
                  <button className="ss-btn primario sm" onClick={()=>addCausa(cat)}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ss-card">
        <div className="ss-card-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          Análisis 5 Porqués
          <button className="ss-btn primario sm" onClick={()=>setSPF(v=>!v)}>{showPF?"Cancelar":"+ Nuevo"}</button>
        </div>
        {showPF && (
          <div style={{marginBottom:"1rem"}}>
            <div className="ss-campo" style={{marginBottom:"0.5rem"}}>
              <label>Problema identificado *</label>
              <input value={newP.problema} onChange={e=>setNewP(p=>({...p,problema:e.target.value}))}
                     style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:"6px",color:"#e2e8f0",padding:"0.45rem 0.65rem",fontSize:"0.82rem",width:"100%"}}/>
            </div>
            {[1,2,3,4,5].map(n=>(
              <div key={n} className="ss-porq-paso" style={{marginBottom:"0.5rem"}}>
                <span className="ss-porq-num">{n}</span>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:"0.2rem"}}>
                  <input placeholder={`¿Por qué? (${n})`} value={newP[`por${n}`]}
                         onChange={e=>setNewP(p=>({...p,[`por${n}`]:e.target.value}))}
                         style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:"5px",color:"#e2e8f0",padding:"0.35rem 0.5rem",fontSize:"0.78rem"}}/>
                  <input placeholder={`Respuesta ${n}`} value={newP[`resp${n}`]}
                         onChange={e=>setNewP(p=>({...p,[`resp${n}`]:e.target.value}))}
                         style={{background:"rgba(15,23,42,0.5)",border:"1px solid rgba(99,102,241,0.12)",borderRadius:"5px",color:"#94a3b8",padding:"0.35rem 0.5rem",fontSize:"0.78rem"}}/>
                </div>
              </div>
            ))}
            <div className="ss-campo" style={{marginBottom:"0.5rem"}}>
              <label>Causa raíz identificada</label>
              <input value={newP.causa_raiz} onChange={e=>setNewP(p=>({...p,causa_raiz:e.target.value}))}
                     style={{background:"rgba(15,23,42,0.8)",border:"1px solid rgba(52,211,153,0.3)",borderRadius:"6px",color:"#34d399",padding:"0.45rem 0.65rem",fontSize:"0.82rem",width:"100%"}}/>
            </div>
            <button className="ss-btn primario" onClick={addPorq}>Guardar análisis</button>
          </div>
        )}
        {porques.length===0
          ? <p style={{color:"#475569",fontSize:"0.8rem"}}>No hay análisis registrados.</p>
          : porques.map(p=>(
              <div key={p.id_porq} className="ss-porq-item">
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.4rem"}}>
                  <strong style={{fontSize:"0.82rem",color:"#e2e8f0"}}>{p.problema}</strong>
                  <button className="ss-btn peligro sm" onClick={()=>delPorq(p.id_porq)}>✕</button>
                </div>
                {[1,2,3,4,5].map(n=>p[`por${n}`]&&(
                  <div key={n} style={{fontSize:"0.73rem",marginBottom:"0.2rem",paddingLeft:"0.5rem",borderLeft:"2px solid rgba(99,102,241,0.2)"}}>
                    <span style={{color:"#818cf8",fontWeight:600}}>P{n}: </span>
                    <span style={{color:"#94a3b8"}}>{p[`por${n}`]}</span>
                    {p[`resp${n}`]&&<span style={{color:"#cbd5e1"}}> → {p[`resp${n}`]}</span>}
                  </div>
                ))}
                {p.causa_raiz&&(
                  <div style={{marginTop:"0.4rem",padding:"0.3rem 0.5rem",background:"rgba(52,211,153,0.08)",borderRadius:"4px",fontSize:"0.73rem"}}>
                    <span style={{color:"#34d399",fontWeight:700}}>Causa raíz: </span>
                    <span style={{color:"#e2e8f0"}}>{p.causa_raiz}</span>
                  </div>
                )}
              </div>
            ))
        }
      </div>
    </div>
  );
}

// ── Tab Mejorar ───────────────────────────────────────────────────────────────
function TabMejorar({ defId, canMejorar }) {
  const [mejoras, setMej] = useState([]);
  const [form, setForm]   = useState({problema_encontrado:"",accion_propuesta:"",responsable:"",fecha_inicio:"",fecha_fin:"",estado:"Pendiente"});
  const [showF, setSF]    = useState(false);
  const cargar = useCallback(async () => { if (defId) setMej(await api.ssMejoras(defId)); }, [defId]);
  useEffect(() => { cargar(); }, [cargar]);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const agregar = async () => {
    if (!form.problema_encontrado||!form.accion_propuesta) { alert("Problema y acción son requeridos"); return; }
    await api.ssAgregarMejora(defId,form);
    setForm({problema_encontrado:"",accion_propuesta:"",responsable:"",fecha_inicio:"",fecha_fin:"",estado:"Pendiente"});
    setSF(false); cargar();
  };
  const cambiarEstado = async (m, nuevo) => {
    const datos = {estado:nuevo};
    if (nuevo==="Aplicada") {
      const sd = prompt("Nivel σ después de la mejora:");
      if (sd!==null) datos.sigma_despues = sd;
      const res = prompt("Resultado obtenido:");
      if (res!==null) datos.resultado = res;
    }
    await api.ssActualizarMejora(m.id_mej, datos); cargar();
  };
  const eliminar = async id => { if (!confirm("¿Eliminar?")) return; await api.ssEliminarMejora(id); cargar(); };
  const estCls = e => e==="Pendiente"?"pendiente":e==="Aplicada"?"aplicada":"ejecucion";

  if (!canMejorar) return <div className="ss-bloqueado-msg">⚠ Registra al menos una causa en Ishikawa antes de plantear mejoras.</div>;
  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"0.75rem"}}>
        <button className="ss-btn primario" onClick={()=>setSF(v=>!v)}>{showF?"Cancelar":"+ Nueva mejora"}</button>
      </div>
      {showF && (
        <div className="ss-card">
          <div className="ss-card-title">Registrar acción de mejora</div>
          <div className="ss-form">
            <div className="ss-campo ss-form-full"><label>Problema encontrado *</label><textarea value={form.problema_encontrado} onChange={e=>set("problema_encontrado",e.target.value)}/></div>
            <div className="ss-campo ss-form-full"><label>Acción propuesta *</label><textarea value={form.accion_propuesta} onChange={e=>set("accion_propuesta",e.target.value)}/></div>
            <div className="ss-campo"><label>Responsable</label><input value={form.responsable} onChange={e=>set("responsable",e.target.value)}/></div>
            <div className="ss-campo"><label>Estado</label>
              <select value={form.estado} onChange={e=>set("estado",e.target.value)}>
                <option>Pendiente</option><option>En ejecución</option>
              </select>
            </div>
            <div className="ss-campo"><label>Fecha inicio</label><input type="date" value={form.fecha_inicio} onChange={e=>set("fecha_inicio",e.target.value)}/></div>
            <div className="ss-campo"><label>Fecha fin</label><input type="date" value={form.fecha_fin} onChange={e=>set("fecha_fin",e.target.value)}/></div>
          </div>
          <div className="ss-btn-row"><button className="ss-btn primario" onClick={agregar}>Guardar</button></div>
        </div>
      )}
      {mejoras.length===0
        ? <p style={{color:"#475569",fontSize:"0.8rem"}}>No hay mejoras registradas.</p>
        : mejoras.map(m=>(
            <div key={m.id_mej} className="ss-card">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.5rem"}}>
                <span className={`ss-estado ${estCls(m.estado)}`}>{m.estado||"Pendiente"}</span>
                <button className="ss-btn peligro sm" onClick={()=>eliminar(m.id_mej)}>✕</button>
              </div>
              <p style={{fontSize:"0.82rem",fontWeight:600,color:"#e2e8f0",marginBottom:"0.2rem"}}>{m.problema_encontrado}</p>
              <p style={{fontSize:"0.78rem",color:"#94a3b8",marginBottom:"0.4rem"}}>
                <strong style={{color:"#818cf8"}}>Acción: </strong>{m.accion_propuesta}
              </p>
              {m.responsable&&<p style={{fontSize:"0.72rem",color:"#64748b"}}>Responsable: {m.responsable}</p>}
              {(m.sigma_antes||m.sigma_despues)&&(
                <div className="ss-antes-despues" style={{margin:"0.5rem 0"}}>
                  <span style={{fontSize:"0.72rem",color:"#64748b"}}>σ antes:</span>
                  <span className={`ss-sigma-badge ${sigmaCls(m.sigma_antes)}`}>{fmtS(m.sigma_antes)}</span>
                  {m.sigma_despues&&<>
                    <span style={{color:"#475569"}}>→</span>
                    <span className={`ss-sigma-badge ${sigmaCls(m.sigma_despues)}`}>{fmtS(m.sigma_despues)}</span>
                    {(()=>{const d=parseFloat(m.sigma_despues)-parseFloat(m.sigma_antes||0);return(
                      <span className={`ss-delta ${d>=0?"positivo":"negativo"}`}>{d>=0?"▲":"▼"} {Math.abs(d).toFixed(2)}σ</span>
                    );})()}
                  </>}
                </div>
              )}
              {m.resultado&&<p style={{fontSize:"0.75rem",color:"#34d399"}}>Resultado: {m.resultado}</p>}
              <div className="ss-btn-row">
                {m.estado!=="En ejecución"&&m.estado!=="Aplicada"&&
                  <button className="ss-btn secundario sm" onClick={()=>cambiarEstado(m,"En ejecución")}>En ejecución</button>}
                {m.estado!=="Aplicada"&&
                  <button className="ss-btn exito sm" onClick={()=>cambiarEstado(m,"Aplicada")}>Marcar Aplicada</button>}
              </div>
            </div>
          ))
      }
    </div>
  );
}

// ── Tab Controlar ─────────────────────────────────────────────────────────────
function TabControlar({ defId, canControlar }) {
  const [plan,  setPlan] = useState([]);
  const [carta, setCarta]= useState(null);
  const [form,  setForm] = useState({que_controlar:"",como_medir:"",limite_superior:"",limite_central:"",limite_inferior:"",frecuencia:"",responsable:"",registro:"",accion_correctiva:""});
  const [showF, setSF]   = useState(false);
  const cargar = useCallback(async () => {
    if (!defId) return;
    const [p,c] = await Promise.all([api.ssPlanControl(defId),api.ssCartaControl(defId)]);
    setPlan(p); setCarta(c);
  }, [defId]);
  useEffect(() => { cargar(); }, [cargar]);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const agregar = async () => {
    if (!form.que_controlar) { alert("¿Qué controlar? es requerido"); return; }
    await api.ssAgregarControl(defId,form);
    setForm({que_controlar:"",como_medir:"",limite_superior:"",limite_central:"",limite_inferior:"",frecuencia:"",responsable:"",registro:"",accion_correctiva:""});
    setSF(false); cargar();
  };
  const eliminar = async id => { if (!confirm("¿Eliminar?")) return; await api.ssEliminarControl(id); cargar(); };

  if (!canControlar) return <div className="ss-bloqueado-msg">⚠ Aplica al menos una mejora antes de establecer el plan de control.</div>;
  return (
    <div>
      <div className="ss-card">
        <div className="ss-card-title">Carta de Control (Nivel σ por período)</div>
        {carta&&carta.puntos.length>0&&(
          <div className="ss-metricas" style={{marginBottom:"0.75rem"}}>
            <div className="ss-metrica"><span className="ss-metrica-val" style={{color:"#34d399"}}>{carta.cl.toFixed(2)}σ</span><span className="ss-metrica-label">Línea Central</span></div>
            <div className="ss-metrica"><span className="ss-metrica-val" style={{color:"#f87171"}}>{carta.ucl.toFixed(2)}σ</span><span className="ss-metrica-label">Lím. Superior</span></div>
            <div className="ss-metrica"><span className="ss-metrica-val" style={{color:"#f87171"}}>{carta.lcl.toFixed(2)}σ</span><span className="ss-metrica-label">Lím. Inferior</span></div>
            {carta.puntos.filter(p=>p.fuera).length>0&&(
              <div className="ss-metrica"><span className="ss-metrica-val" style={{color:"#f87171"}}>{carta.puntos.filter(p=>p.fuera).length}</span><span className="ss-metrica-label">Fuera ctrl.</span></div>
            )}
          </div>
        )}
        <CartaControl carta={carta}/>
      </div>
      <div className="ss-card">
        <div className="ss-card-title" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          Plan de Control
          <button className="ss-btn primario sm" onClick={()=>setSF(v=>!v)}>{showF?"Cancelar":"+ Agregar"}</button>
        </div>
        {showF&&(
          <div style={{marginBottom:"1rem"}}>
            <div className="ss-form">
              <div className="ss-campo"><label>¿Qué controlar? *</label><input value={form.que_controlar} onChange={e=>set("que_controlar",e.target.value)}/></div>
              <div className="ss-campo"><label>¿Cómo medir?</label><input value={form.como_medir} onChange={e=>set("como_medir",e.target.value)}/></div>
              <div className="ss-campo"><label>Límite superior</label><input value={form.limite_superior} onChange={e=>set("limite_superior",e.target.value)}/></div>
              <div className="ss-campo"><label>Límite central</label><input value={form.limite_central} onChange={e=>set("limite_central",e.target.value)}/></div>
              <div className="ss-campo"><label>Límite inferior</label><input value={form.limite_inferior} onChange={e=>set("limite_inferior",e.target.value)}/></div>
              <div className="ss-campo"><label>Frecuencia</label><input value={form.frecuencia} onChange={e=>set("frecuencia",e.target.value)} placeholder="Mensual"/></div>
              <div className="ss-campo"><label>Responsable</label><input value={form.responsable} onChange={e=>set("responsable",e.target.value)}/></div>
              <div className="ss-campo"><label>Registro</label><input value={form.registro} onChange={e=>set("registro",e.target.value)}/></div>
              <div className="ss-campo ss-form-full"><label>Acción correctiva</label><input value={form.accion_correctiva} onChange={e=>set("accion_correctiva",e.target.value)}/></div>
            </div>
            <div className="ss-btn-row"><button className="ss-btn primario" onClick={agregar}>Guardar</button></div>
          </div>
        )}
        {plan.length===0
          ? <p style={{color:"#475569",fontSize:"0.8rem"}}>Sin elementos en el plan.</p>
          : <div className="ss-tabla-wrap">
              <table className="ss-tabla">
                <thead><tr><th>¿Qué controlar?</th><th>¿Cómo medir?</th><th>LSC</th><th>LC</th><th>LIC</th><th>Frecuencia</th><th>Responsable</th><th></th></tr></thead>
                <tbody>{plan.map(p=>(
                  <tr key={p.id_ctrl}>
                    <td>{p.que_controlar}</td><td>{p.como_medir}</td>
                    <td>{p.limite_superior}</td><td>{p.limite_central}</td><td>{p.limite_inferior}</td>
                    <td>{p.frecuencia}</td><td>{p.responsable}</td>
                    <td><button className="ss-btn peligro sm" onClick={()=>eliminar(p.id_ctrl)}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}

// ── Tab Historial ─────────────────────────────────────────────────────────────
function TabHistorial({ defId }) {
  const [hist, setHist] = useState([]);
  useEffect(() => { api.ssHistorico(defId).then(setHist).catch(()=>{}); }, [defId]);
  return (
    <div className="ss-card">
      <div className="ss-card-title">Historial de acciones ({hist.length})</div>
      {hist.length===0
        ? <p style={{color:"#475569",fontSize:"0.8rem"}}>Sin registros.</p>
        : <div className="ss-tabla-wrap">
            <table className="ss-tabla">
              <thead><tr><th>Fecha/Hora</th><th>Proceso</th><th>Fase</th><th>Acción</th><th>Detalle</th></tr></thead>
              <tbody>{hist.map((h,i)=>(
                <tr key={i}>
                  <td style={{whiteSpace:"nowrap",fontSize:"0.7rem"}}>{h.fecha_hora}</td>
                  <td>{h.proceso}</td>
                  <td><span style={{fontSize:"0.65rem",padding:"0.15rem 0.35rem",background:"rgba(99,102,241,0.15)",borderRadius:"3px",color:"#818cf8"}}>{h.fase_dmaic}</span></td>
                  <td>{h.accion}</td>
                  <td style={{color:"#64748b",fontSize:"0.73rem"}}>{h.detalle}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ── Modal nuevo proceso ───────────────────────────────────────────────────────
function ModalNuevo({ onClose, onCreate }) {
  const [form, setForm] = useState({nombre_proceso:"",descripcion:"",indicador:"",meta:90,unidad_medida:"",tipo_indicador:"Eficacia",definicion_defecto:"",oportunidades_defecto:1});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const crear = async () => {
    if (!form.nombre_proceso||!form.definicion_defecto) { alert("Nombre y definición de defecto son requeridos"); return; }
    try { const r = await api.ssCrearDef(form); onCreate(r); onClose(); }
    catch { alert("Error al crear"); }
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}}>
      <div style={{background:"#1e293b",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"12px",padding:"1.5rem",width:"min(640px,95vw)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <h3 style={{margin:0,color:"#818cf8",fontSize:"1rem"}}>Nuevo proceso Six Sigma</h3>
          <button className="ss-btn secundario sm" onClick={onClose}>✕</button>
        </div>
        <div className="ss-form">
          <div className="ss-campo ss-form-full"><label>Nombre del proceso *</label><input value={form.nombre_proceso} onChange={e=>set("nombre_proceso",e.target.value)} autoFocus/></div>
          <div className="ss-campo ss-form-full"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>set("descripcion",e.target.value)}/></div>
          <div className="ss-campo ss-form-full">
            <label>Definición de defecto * — ¿Qué cuenta como defecto en este proceso?</label>
            <textarea value={form.definicion_defecto} onChange={e=>set("definicion_defecto",e.target.value)}/>
          </div>
          <div className="ss-campo"><label>Oportunidades de defecto por unidad *</label><input type="number" min="1" value={form.oportunidades_defecto} onChange={e=>set("oportunidades_defecto",e.target.value)}/></div>
          <div className="ss-campo"><label>Meta de rendimiento (%)</label><input type="number" value={form.meta} onChange={e=>set("meta",e.target.value)}/></div>
          <div className="ss-campo"><label>Unidad de medida</label><input value={form.unidad_medida} onChange={e=>set("unidad_medida",e.target.value)} placeholder="Requerimientos, Solicitudes..."/></div>
          <div className="ss-campo"><label>Tipo de indicador</label>
            <select value={form.tipo_indicador} onChange={e=>set("tipo_indicador",e.target.value)}>
              {TIPOS_IND.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="ss-campo ss-form-full"><label>Indicador relacionado (opcional)</label><input value={form.indicador} onChange={e=>set("indicador",e.target.value)}/></div>
        </div>
        <div className="ss-btn-row">
          <button className="ss-btn primario" onClick={crear}>Crear proceso</button>
          <button className="ss-btn secundario" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SixSigmaView() {
  const [defs,       setDefs]      = useState([]);
  const [defSel,     setDefSel]    = useState(null);
  const [tab,        setTab]       = useState("D");
  const [dash,       setDash]      = useState(null);
  const [val,        setVal]       = useState({});
  const [showNuevo,  setSN]        = useState(false);

  const cargarDefs = useCallback(async () => {
    const [d, dk] = await Promise.all([api.ssDefiniciones(), api.ssDashboard()]);
    setDefs(d); setDash(dk);
  }, []);
  useEffect(() => { cargarDefs(); }, [cargarDefs]);

  const selDef = useCallback(async d => {
    setDefSel(d); setTab("D");
    setVal(await api.ssValidar(d.id_def));
  }, []);

  const onActualizar = async updated => {
    setDefSel(updated);
    setDefs(prev=>prev.map(d=>d.id_def===updated.id_def?{...d,...updated}:d));
    setVal(await api.ssValidar(updated.id_def));
    cargarDefs();
  };

  const onCrear = d => { cargarDefs(); selDef(d); };

  const eliminarDef = async id => {
    if (!confirm("¿Eliminar este proceso y todos sus datos?")) return;
    await api.ssEliminarDef(id);
    if (defSel?.id_def===id) { setDefSel(null); setVal({}); }
    cargarDefs();
  };

  const irTab = (tid, fase) => {
    if (fase && val[fase]===false) return;
    setTab(tid);
    if (defSel) api.ssValidar(defSel.id_def).then(setVal).catch(()=>{});
  };

  return (
    <div className="ss-root">
      {dash&&(
        <div className="ss-dash">
          <div className="ss-dash-kpi"><span className="ss-dash-kpi-val">{dash.total_procesos}</span><span className="ss-dash-kpi-label">Procesos</span></div>
          <div className="ss-dash-kpi">
            <span className={`ss-dash-kpi-val ${dash.sigma_promedio<3?"critico":dash.sigma_promedio>=4?"ok":"advertencia"}`}>
              {dash.sigma_promedio?dash.sigma_promedio.toFixed(2):"—"}σ
            </span>
            <span className="ss-dash-kpi-label">σ Promedio</span>
          </div>
          <div className="ss-dash-kpi">
            <span className={`ss-dash-kpi-val ${dash.criticos>0?"critico":"ok"}`}>{dash.criticos}</span>
            <span className="ss-dash-kpi-label">Críticos &lt;3σ</span>
          </div>
          <div className="ss-dash-kpi"><span className="ss-dash-kpi-val advertencia">{dash.total_defectos?.toLocaleString()}</span><span className="ss-dash-kpi-label">Defectos</span></div>
          <div className="ss-dash-kpi"><span className={`ss-dash-kpi-val ${dash.mejoras_pendientes>0?"advertencia":""}`}>{dash.mejoras_pendientes}</span><span className="ss-dash-kpi-label">Mejoras pend.</span></div>
          <div className="ss-dash-kpi"><span className="ss-dash-kpi-val ok">{dash.mejoras_aplicadas}</span><span className="ss-dash-kpi-label">Mejoras aplic.</span></div>
        </div>
      )}
      <div className="ss-body">
        <div className="ss-panel-izq">
          <div className="ss-panel-izq-header">
            Procesos
            <button className="ss-btn primario sm" onClick={()=>setSN(true)} title="Nuevo">+</button>
          </div>
          <div className="ss-panel-izq-lista">
            {defs.length===0
              ? <div style={{padding:"1rem",color:"#475569",fontSize:"0.78rem",textAlign:"center"}}>Sin procesos.<br/>Presiona + para crear uno.</div>
              : defs.map(d=>(
                  <div key={d.id_def} className={`ss-def-item ${defSel?.id_def===d.id_def?"activo":""}`} onClick={()=>selDef(d)}>
                    <span className="ss-def-nombre">{d.nombre_proceso}</span>
                    <div className="ss-def-meta">
                      <span className={`ss-sigma-badge ${sigmaCls(d.sigma_actual)}`}>
                        {d.sigma_actual!=null?fmtS(d.sigma_actual):"Sin mediciones"}
                      </span>
                    </div>
                    {defSel?.id_def===d.id_def&&(
                      <button className="ss-btn peligro sm" style={{marginTop:"0.3rem",alignSelf:"flex-start"}}
                              onClick={e=>{e.stopPropagation();eliminarDef(d.id_def);}}>
                        Eliminar
                      </button>
                    )}
                  </div>
                ))
            }
          </div>
        </div>
        <div className="ss-panel-der">
          <div className="ss-tabs">
            {TABS.map(t=>{
              const bloq = defSel&&t.fase&&val[t.fase]===false;
              return (
                <div key={t.id} className={`ss-tab ${tab===t.id?"activo":""} ${bloq?"bloqueado":""}`}
                     onClick={()=>irTab(t.id,t.fase)} title={bloq?"Completa las fases anteriores":t.label}>
                  <span className="ss-tab-ico">{t.id}</span>{t.label}
                </div>
              );
            })}
          </div>
          <div className="ss-content">
            {!defSel
              ? <div className="ss-placeholder">
                  <span className="ss-placeholder-icon">σ</span>
                  <span className="ss-placeholder-text">Selecciona un proceso o crea uno nuevo</span>
                  <button className="ss-btn primario" onClick={()=>setSN(true)}>+ Nuevo proceso</button>
                </div>
              : <>
                  {tab==="D"&&<TabDefinir  def={defSel} onActualizar={onActualizar}/>}
                  {tab==="M"&&<TabMedir    defId={defSel.id_def} canMedir={val.puede_medir!==false} defIndicador={defSel.indicador}/>}
                  {tab==="A"&&<TabAnalizar defId={defSel.id_def} canAnalizar={val.puede_analizar!==false}/>}
                  {tab==="I"&&<TabMejorar  defId={defSel.id_def} canMejorar={val.puede_mejorar!==false}/>}
                  {tab==="C"&&<TabControlar defId={defSel.id_def} canControlar={val.puede_controlar!==false}/>}
                  {tab==="H"&&<TabHistorial defId={defSel.id_def}/>}
                </>
            }
          </div>
        </div>
      </div>
      {showNuevo&&<ModalNuevo onClose={()=>setSN(false)} onCreate={onCrear}/>}
    </div>
  );
}
