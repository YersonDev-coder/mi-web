import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import "./DiagramaView.css";

const BASE = "http://localhost:8000/api";
const DRAWIO_SRC =
  "https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&lang=es" +
  "&saveAndExit=1&noExitBtn=0&noSaveBtn=0";

export default function DiagramaView() {
  const { id } = useParams();

  const [xml, setXml]             = useState("");
  const [svg, setSvg]             = useState("");
  const [editando, setEditando]   = useState(false);
  const [cargando, setCargando]   = useState(true);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");
  const [nombre, setNombre]       = useState("");

  const iframeRef      = useRef(null);
  const xmlRef         = useRef("");
  const xmlPendRef     = useRef("");
  const salirTrasGuardarRef = useRef(false);

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const [rDiag, rFicha] = await Promise.all([
        fetch(`${BASE}/fichas/proceso/${id}/diagrama/drawio/`),
        fetch(`${BASE}/fichas/proceso/${id}/`),
      ]);
      const dDiag  = await rDiag.json();
      const dFicha = await rFicha.json();
      xmlRef.current = dDiag.xml || "";
      setXml(dDiag.xml || "");
      setSvg(dDiag.svg || "");
      setNombre(dFicha?.proceso?.nombre_proceso || `Proceso ${id}`);
    } catch {
      setError("No se pudo cargar el diagrama.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { xmlRef.current = xml; }, [xml]);

  const onMessage = useCallback((e) => {
    if (e.origin !== "https://embed.diagrams.net") return;
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.event === "init") {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ action: "load", xml: xmlRef.current || "<mxGraphModel/>" }),
        "*"
      );
    }
    if (msg.event === "save") {
      xmlPendRef.current = msg.xml;
      salirTrasGuardarRef.current = !!msg.exit;
      // Pedir SVG para visualización; el export handler guarda y cierra si corresponde
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ action: "export", format: "svg", xml: msg.xml }),
        "*"
      );
    }
    if (msg.event === "export") {
      guardarEnBackend(xmlPendRef.current, msg.data || "");
      if (salirTrasGuardarRef.current) {
        salirTrasGuardarRef.current = false;
        setEditando(false);
      }
    }
    // "exit" = usuario hizo clic en "Salir" sin guardar
    // "close" = draw.io cerró el diálogo
    if (msg.event === "exit" || msg.event === "close") {
      setEditando(false);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  const guardarEnBackend = async (xmlData, svgData) => {
    setGuardando(true);
    try {
      await fetch(`${BASE}/fichas/proceso/${id}/diagrama/drawio/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: xmlData, svg: svgData }),
      });
      xmlRef.current = xmlData;
      setXml(xmlData);
      setSvg(svgData);
    } catch {
      setError("Error al guardar el diagrama.");
    } finally {
      setGuardando(false);
    }
  };

  const generarConIA = async () => {
    setGenerando(true);
    setError("");
    try {
      const r = await fetch(
        `${BASE}/fichas/proceso/${id}/diagrama/drawio/generar/`,
        { method: "POST" }
      );
      const d = await r.json();
      if (d.error) { setError(d.error); return; }

      xmlRef.current = d.xml;
      setXml(d.xml);

      if (editando && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ action: "load", xml: d.xml }), "*"
        );
      } else {
        setEditando(true);
      }
    } catch {
      setError("Error de conexión al generar el diagrama.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="dgm-pagina">

      {/* Cabecera solo en modo vista — cuando se edita, draw.io ocupa toda la pantalla */}
      {!editando && (
        <>
          <div className="dgm-header">
            <div className="dgm-header-info">
              <span className="dgm-badge">DIAGRAMA DE PROCESO</span>
              <h2 className="dgm-titulo">{nombre || `Proceso ${id}`}</h2>
            </div>
            <div className="dgm-header-acciones">
              {guardando && <span className="dgm-guardando">Guardando...</span>}
              <button
                className={`dgm-btn-ia${generando ? " dgm-btn-ia--spin" : ""}`}
                onClick={generarConIA}
                disabled={generando || cargando}
                title="La IA analiza las actividades del proceso y genera el diagrama automáticamente"
              >
                {generando
                  ? <><span className="dgm-spinner-sm" /> Generando...</>
                  : <><span className="dgm-ia-star">✦</span> Generar con IA</>}
              </button>
              <button className="dgm-btn dgm-btn-editar" onClick={() => setEditando(true)} disabled={cargando}>
                ✏ {svg ? "Editar diagrama" : "Crear desde cero"}
              </button>
            </div>
          </div>

          {error && (
            <div className="dgm-error-bar">
              <span>⚠ {error}</span>
              <button onClick={() => setError("")}>✕</button>
            </div>
          )}

          {generando && (
            <div className="dgm-ia-bar">
              <span className="dgm-spinner-sm" />
              La IA está analizando las actividades y construyendo el diagrama…
              <strong> Un momento.</strong>
            </div>
          )}
        </>
      )}

      {/* ── Cuerpo ── */}
      <div className="dgm-cuerpo">
        {editando ? (
          <div className="dgm-iframe-wrap">
            <iframe
              ref={iframeRef}
              src={DRAWIO_SRC}
              className="dgm-iframe"
              title="Editor draw.io"
            />
          </div>
        ) : cargando ? (
          <div className="dgm-centro">
            <div className="dgm-spinner dgm-spinner-grande" />
            <p className="dgm-msg">Cargando diagrama...</p>
          </div>
        ) : svg ? (
          <div className="dgm-imagen-wrap">
            <img src={svg} alt="Diagrama del proceso" className="dgm-imagen" />
          </div>
        ) : (
          <div className="dgm-centro">
            <div className="dgm-icono-estado">◈</div>
            <p className="dgm-msg-titulo">Sin diagrama</p>
            <p className="dgm-msg">
              Genera el diagrama automáticamente con <strong>IA</strong> a partir
              de las actividades registradas en la ficha, o créalo manualmente
              en el editor visual.
            </p>
            <div className="dgm-centro-btns">
              <button
                className={`dgm-btn-ia${generando ? " dgm-btn-ia--spin" : ""}`}
                onClick={generarConIA}
                disabled={generando}
              >
                {generando
                  ? <><span className="dgm-spinner-sm" /> Generando...</>
                  : <><span className="dgm-ia-star">✦</span> Generar con IA</>}
              </button>
              <button className="dgm-btn dgm-btn-editar" onClick={() => setEditando(true)}>
                ✏ Crear desde cero
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
