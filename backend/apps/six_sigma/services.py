"""Capa de datos del módulo Six Sigma (DMAIC) en PostgreSQL.

La persistencia DMAIC (definicion, mediciones, ishikawa, 5 porqués, mejoras,
control, histórico) pasa al ORM. Se conserva Pandas SOLO para leer archivos
.xlsx que el usuario sube manualmente en la pantalla de "Carga de datos"
(funciones obtener_hojas / previsualizar_datos / importar_datos), ya que ese
flujo lee Excel externo, no la persistencia del sistema.
"""
import math
from datetime import datetime

try:
    from scipy.stats import norm as _norm
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False

from .models import (SSDefinicion, SSMedicion, SSCausaIshikawa, SSCincoPorques,
                     SSMejora, SSControl, SSHistorico)
from apps.indicadores.models import Indicador, IndAvance
from apps.fichas_procesos.models import FichaProceso
from apps.inventario_procesos.models import InventarioProceso

# Mapa entidad → (Modelo, columna_pk). Se conservan los nombres de columna.
_MODELOS = {
    "definicion": (SSDefinicion, "id_def"),
    "mediciones": (SSMedicion, "id_med"),
    "causas_ishikawa": (SSCausaIshikawa, "id_causa"),
    "cinco_porques": (SSCincoPorques, "id_porq"),
    "mejoras": (SSMejora, "id_mej"),
    "control": (SSControl, "id_ctrl"),
    "historico": (SSHistorico, "id_hist"),
}
# Campos por entidad (orden y nombres idénticos a las hojas originales).
_CAMPOS = {
    "definicion": ["id_def", "nombre_proceso", "descripcion", "indicador", "meta",
                   "unidad_medida", "tipo_indicador", "definicion_defecto",
                   "oportunidades_defecto", "fecha_creacion", "estado"],
    "mediciones": ["id_med", "id_def", "periodo", "unidades_evaluadas", "defectos",
                   "yield_pct", "dpmo", "nivel_sigma", "cumplimiento",
                   "fecha_registro", "observacion", "fuente"],
    "causas_ishikawa": ["id_causa", "id_def", "categoria", "causa", "subcausa",
                        "descripcion", "proceso_relacionado", "fecha_registro"],
    "cinco_porques": ["id_porq", "id_def", "problema",
                      "por1", "resp1", "por2", "resp2", "por3", "resp3",
                      "por4", "resp4", "por5", "resp5", "causa_raiz", "fecha_registro"],
    "mejoras": ["id_mej", "id_def", "id_causa", "problema_encontrado", "accion_propuesta",
                "responsable", "fecha_inicio", "fecha_fin", "estado",
                "sigma_antes", "sigma_despues", "resultado"],
    "control": ["id_ctrl", "id_def", "que_controlar", "como_medir", "limite_superior",
                "limite_central", "limite_inferior", "frecuencia", "responsable",
                "registro", "accion_correctiva"],
    "historico": ["id_hist", "fecha_hora", "proceso", "fase_dmaic", "accion", "detalle"],
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _dict(obj, entidad):
    """Modelo → dict con los nombres de campo originales y None limpio."""
    out = {}
    for c in _CAMPOS[entidad]:
        v = getattr(obj, c)
        if isinstance(v, float) and math.isnan(v):
            v = None
        out[c] = v
    return out


def _lista(qs, entidad):
    return [_dict(o, entidad) for o in qs]


def _nuevo_id(entidad):
    Modelo, llave = _MODELOS[entidad]
    ultimo = Modelo.objects.exclude(**{llave + "__isnull": True}).order_by("-" + llave).first()
    return (getattr(ultimo, llave) + 1) if ultimo else 1


def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _sigma_desde_yield(yield_pct):
    if yield_pct >= 99.9997:
        return 6.0
    if yield_pct <= 0.003:
        return 0.0
    try:
        p = max(0.000001, min(0.999999, yield_pct / 100.0))
        if _HAS_SCIPY:
            z = float(_norm.ppf(p))
        else:
            a = [2.515517, 0.802853, 0.010328]
            b = [1.432788, 0.189269, 0.001308]
            if p <= 0.5:
                t = math.sqrt(-2 * math.log(p))
                z = -(t - (a[0]+a[1]*t+a[2]*t*t) / (1+b[0]*t+b[1]*t*t+b[2]*t*t*t))
            else:
                t = math.sqrt(-2 * math.log(1 - p))
                z = t - (a[0]+a[1]*t+a[2]*t*t) / (1+b[0]*t+b[1]*t*t+b[2]*t*t*t)
        return round(z + 1.5, 4)
    except Exception:
        return 0.0


def _metricas(unidades, defectos, oportunidades, meta, yield_directo=None):
    o = float(oportunidades or 1)
    m = float(meta or 0)
    if yield_directo is not None:
        y = float(yield_directo)
        dpmo = (1 - y/100) / o * 1_000_000 if o > 0 else 0.0
        sigma = _sigma_desde_yield(y)
        cum = round(y / m * 100, 2) if m > 0 else 0.0
        return {"yield_pct": round(y, 4), "dpmo": round(dpmo, 2), "nivel_sigma": sigma, "cumplimiento": cum}
    u = float(unidades or 0)
    d = float(defectos or 0)
    if u <= 0:
        return {"yield_pct": 0.0, "dpmo": 0.0, "nivel_sigma": 0.0, "cumplimiento": 0.0}
    d = min(d, u)
    y = (u - d) / u * 100
    dpmo = (d / (u * o)) * 1_000_000 if o > 0 else 0.0
    sigma = _sigma_desde_yield(y)
    cum = round(y / m * 100, 2) if m > 0 else 0.0
    return {"yield_pct": round(y, 4), "dpmo": round(dpmo, 2), "nivel_sigma": sigma, "cumplimiento": cum}


def _registrar_historico(proceso, fase, accion, detalle):
    try:
        SSHistorico.objects.create(
            id_hist=_nuevo_id("historico"), fecha_hora=_now(),
            proceso=proceso, fase_dmaic=fase, accion=accion, detalle=detalle)
    except Exception:
        pass


def _nombre_def(id_def):
    o = SSDefinicion.objects.filter(id_def=str(id_def)).first() or \
        SSDefinicion.objects.filter(id_def=_to_int(id_def)).first()
    return str(o.nombre_proceso) if o else str(id_def)


def _to_int(v):
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def _def_qs(id_def):
    """Localiza una definición tolerando id como str o int."""
    iv = _to_int(id_def)
    return SSDefinicion.objects.filter(id_def=iv).first() if iv is not None else None


# ── DEFINE ─────────────────────────────────────────────────────────────────────

def listar_definiciones(user_id=None):
    qs = SSDefinicion.objects.filter(id_usuario=user_id) if user_id else SSDefinicion.objects.all()
    defs = _lista(qs, "definicion")
    for d in defs:
        meds = list(SSMedicion.objects.filter(id_def=d["id_def"]).order_by("id_med"))
        sigmas = [m.nivel_sigma for m in meds if m.nivel_sigma is not None]
        d["sigma_actual"] = round(float(sigmas[-1]), 2) if sigmas else None
    return defs


def crear_definicion(datos):
    nuevo = {
        "id_def": _nuevo_id("definicion"),
        "nombre_proceso": datos.get("nombre_proceso", ""),
        "descripcion": datos.get("descripcion", ""),
        "indicador": datos.get("indicador", ""),
        "meta": datos.get("meta", 0),
        "unidad_medida": datos.get("unidad_medida", ""),
        "tipo_indicador": datos.get("tipo_indicador", ""),
        "definicion_defecto": datos.get("definicion_defecto", ""),
        "oportunidades_defecto": datos.get("oportunidades_defecto", 1),
        "fecha_creacion": _now(),
        "estado": "activo",
        "id_usuario": datos.get("id_usuario"),
    }
    SSDefinicion.objects.create(**nuevo)
    _registrar_historico(nuevo["nombre_proceso"], "DEFINIR", "CREAR", f"Proceso: {nuevo['nombre_proceso']}")
    return nuevo


def obtener_definicion(id_def):
    o = _def_qs(id_def)
    return _dict(o, "definicion") if o else None


def actualizar_definicion(id_def, datos):
    o = _def_qs(id_def)
    if o is None:
        return None
    for c in ["nombre_proceso", "descripcion", "indicador", "meta", "unidad_medida",
              "tipo_indicador", "definicion_defecto", "oportunidades_defecto", "estado"]:
        if c in datos:
            setattr(o, c, datos[c])
    o.save()
    _registrar_historico(str(o.nombre_proceso), "DEFINIR", "ACTUALIZAR", f"Campos: {list(datos.keys())}")
    return _dict(o, "definicion")


def eliminar_definicion(id_def):
    nombre = _nombre_def(id_def)
    iv = _to_int(id_def)
    SSDefinicion.objects.filter(id_def=iv).delete()
    _registrar_historico(nombre, "DEFINIR", "ELIMINAR", f"id={id_def}")


# ── CARGA DE DATOS (Excel subido por el usuario · Pandas se mantiene) ──────────

def listar_excels_disponibles():
    archivos = []
    if os.path.isdir(EXCEL_DIR):
        for f in sorted(os.listdir(EXCEL_DIR)):
            if f.endswith(".xlsx"):
                archivos.append({"archivo": f, "nombre": f.replace("_", " ").replace(".xlsx", "").title()})
    return archivos




# ── MEASURE ────────────────────────────────────────────────────────────────────

def listar_mediciones(id_def):
    return _lista(SSMedicion.objects.filter(id_def=_to_int(id_def)).order_by("id_med"), "mediciones")


def agregar_medicion(id_def, datos):
    defn = _def_qs(id_def)
    if defn is None:
        raise ValueError("Definición no encontrada")
    o = float(defn.oportunidades_defecto or 1)
    m = float(defn.meta or 0)
    nombre = str(defn.nombre_proceso or "")
    met = _metricas(datos.get("unidades_evaluadas", 0), datos.get("defectos", 0), o, m)
    nueva = SSMedicion.objects.create(
        id_med=_nuevo_id("mediciones"), id_def=_to_int(id_def),
        periodo=datos.get("periodo", ""),
        unidades_evaluadas=float(datos.get("unidades_evaluadas", 0)),
        defectos=float(datos.get("defectos", 0)),
        yield_pct=met["yield_pct"], dpmo=met["dpmo"],
        nivel_sigma=met["nivel_sigma"], cumplimiento=met["cumplimiento"],
        fecha_registro=_now(), observacion=datos.get("observacion", ""), fuente="manual")
    _registrar_historico(nombre, "MEDIR", "AGREGAR", f"periodo={nueva.periodo}, sigma={met['nivel_sigma']}")
    return _dict(nueva, "mediciones")


def eliminar_medicion(id_med):
    SSMedicion.objects.filter(id_med=_to_int(id_med)).delete()


def actualizar_medicion(id_med, datos):
    o = SSMedicion.objects.filter(id_med=_to_int(id_med)).first()
    if o is None:
        return None
    if "defectos" in datos:
        o.defectos = datos["defectos"]
    if "observacion" in datos:
        o.observacion = datos["observacion"]
    o.save()
    return _dict(o, "mediciones")


# ── ANALYZE ────────────────────────────────────────────────────────────────────

def calcular_pareto(id_def):
    meds = list(SSMedicion.objects.filter(id_def=_to_int(id_def)))
    if not meds:
        return []
    por_periodo = {}
    for m in meds:
        d = m.defectos if m.defectos is not None else 0
        por_periodo[m.periodo] = por_periodo.get(m.periodo, 0) + d
    items = sorted(por_periodo.items(), key=lambda x: x[1], reverse=True)
    total = sum(v for _, v in items)
    if total == 0:
        return [{"periodo": p, "defectos": d, "pct": 0.0, "acumulado": 0.0, "critico": False}
                for p, d in items]
    out, acum = [], 0.0
    for p, d in items:
        pct = round(d / total * 100, 2)
        acum = round(acum + pct, 2)
        out.append({"periodo": p, "defectos": d, "pct": pct, "acumulado": acum, "critico": acum <= 80})
    return out


def calcular_temporal(id_def):
    meds = list(SSMedicion.objects.filter(id_def=_to_int(id_def)).order_by("fecha_registro"))
    cols = ["periodo", "nivel_sigma", "yield_pct", "dpmo", "defectos", "cumplimiento", "fecha_registro"]
    out = []
    for m in meds:
        row = {}
        for c in cols:
            v = getattr(m, c)
            if c in ("nivel_sigma", "yield_pct", "dpmo", "defectos", "cumplimiento"):
                v = float(v) if v is not None else 0.0
            row[c] = v
        out.append(row)
    return out


# ── ISHIKAWA ───────────────────────────────────────────────────────────────────

CATEGORIAS_6M = ["Método", "Máquina/Tecnología", "Personal", "Información", "Medición", "Entorno"]


def listar_causas(id_def):
    return _lista(SSCausaIshikawa.objects.filter(id_def=_to_int(id_def)), "causas_ishikawa")


def agregar_causa(id_def, datos):
    nueva = SSCausaIshikawa.objects.create(
        id_causa=_nuevo_id("causas_ishikawa"), id_def=_to_int(id_def),
        categoria=datos.get("categoria", ""), causa=datos.get("causa", ""),
        subcausa=datos.get("subcausa", ""), descripcion=datos.get("descripcion", ""),
        proceso_relacionado=datos.get("proceso_relacionado", ""), fecha_registro=_now())
    _registrar_historico(_nombre_def(id_def), "ANALIZAR", "AGREGAR CAUSA", f"{nueva.categoria}: {nueva.causa}")
    return _dict(nueva, "causas_ishikawa")


def eliminar_causa(id_causa):
    SSCausaIshikawa.objects.filter(id_causa=_to_int(id_causa)).delete()


# ── 5 PORQUÉS ─────────────────────────────────────────────────────────────────

def listar_porques(id_def):
    return _lista(SSCincoPorques.objects.filter(id_def=_to_int(id_def)), "cinco_porques")


def crear_porques(id_def, datos):
    campos = {c: datos.get(c, "") for c in _CAMPOS["cinco_porques"] if c not in ("id_porq", "id_def", "fecha_registro")}
    nuevo = SSCincoPorques.objects.create(
        id_porq=_nuevo_id("cinco_porques"), id_def=_to_int(id_def),
        fecha_registro=_now(), **campos)
    _registrar_historico(_nombre_def(id_def), "ANALIZAR", "5 PORQUÉS", f"Causa raíz: {nuevo.causa_raiz}")
    return _dict(nuevo, "cinco_porques")


def actualizar_porques(id_porq, datos):
    o = SSCincoPorques.objects.filter(id_porq=_to_int(id_porq)).first()
    if o is None:
        return None
    for c in ["problema", "por1", "resp1", "por2", "resp2", "por3", "resp3",
              "por4", "resp4", "por5", "resp5", "causa_raiz"]:
        if c in datos:
            setattr(o, c, datos[c])
    o.save()
    return _dict(o, "cinco_porques")


def eliminar_porques(id_porq):
    SSCincoPorques.objects.filter(id_porq=_to_int(id_porq)).delete()


# ── IMPROVE ────────────────────────────────────────────────────────────────────

def listar_mejoras(id_def):
    return _lista(SSMejora.objects.filter(id_def=_to_int(id_def)), "mejoras")


def crear_mejora(id_def, datos):
    meds = list(SSMedicion.objects.filter(id_def=_to_int(id_def)).order_by("id_med"))
    sigmas = [m.nivel_sigma for m in meds if m.nivel_sigma is not None]
    sigma_actual = round(float(sigmas[-1]), 4) if sigmas else 0.0
    nueva = SSMejora.objects.create(
        id_mej=_nuevo_id("mejoras"), id_def=_to_int(id_def),
        id_causa=_to_int(datos.get("id_causa")) if datos.get("id_causa") not in (None, "") else None,
        problema_encontrado=datos.get("problema_encontrado", ""),
        accion_propuesta=datos.get("accion_propuesta", ""),
        responsable=datos.get("responsable", ""),
        fecha_inicio=datos.get("fecha_inicio", ""), fecha_fin=datos.get("fecha_fin", ""),
        estado=datos.get("estado", "Pendiente"),
        sigma_antes=sigma_actual, sigma_despues=None, resultado="")
    _registrar_historico(_nombre_def(id_def), "MEJORAR", "CREAR", nueva.problema_encontrado)
    return _dict(nueva, "mejoras")


def actualizar_mejora(id_mej, datos):
    o = SSMejora.objects.filter(id_mej=_to_int(id_mej)).first()
    if o is None:
        return None
    for c in ["problema_encontrado", "accion_propuesta", "responsable",
              "fecha_inicio", "fecha_fin", "estado", "sigma_despues", "resultado", "id_causa"]:
        if c in datos:
            setattr(o, c, datos[c])
    o.save()
    _registrar_historico(_nombre_def(o.id_def), "MEJORAR", "ACTUALIZAR", f"Estado: {o.estado}")
    return _dict(o, "mejoras")


def eliminar_mejora(id_mej):
    SSMejora.objects.filter(id_mej=_to_int(id_mej)).delete()


# ── CONTROL ────────────────────────────────────────────────────────────────────

def listar_plan_control(id_def):
    return _lista(SSControl.objects.filter(id_def=_to_int(id_def)), "control")


def agregar_plan_control(id_def, datos):
    campos = {c: datos.get(c, "") for c in _CAMPOS["control"] if c not in ("id_ctrl", "id_def")}
    nuevo = SSControl.objects.create(id_ctrl=_nuevo_id("control"), id_def=_to_int(id_def), **campos)
    _registrar_historico(_nombre_def(id_def), "CONTROLAR", "AGREGAR", nuevo.que_controlar)
    return _dict(nuevo, "control")


def eliminar_plan_control(id_ctrl):
    SSControl.objects.filter(id_ctrl=_to_int(id_ctrl)).delete()


def calcular_carta_control(id_def):
    meds = list(SSMedicion.objects.filter(id_def=_to_int(id_def)))
    if not meds:
        return {"puntos": [], "ucl": 0.0, "cl": 0.0, "lcl": 0.0}
    vals = [float(m.nivel_sigma) if m.nivel_sigma is not None else 0.0 for m in meds]
    cl = sum(vals) / len(vals)
    if len(vals) > 1:
        var = sum((v - cl) ** 2 for v in vals) / (len(vals) - 1)
        std = math.sqrt(var)
    else:
        std = 0.0
    ucl = round(cl + 3 * std, 4)
    lcl = round(max(0.0, cl - 3 * std), 4)
    cl = round(cl, 4)
    puntos = []
    for m in meds:
        v = float(m.nivel_sigma) if m.nivel_sigma is not None else 0.0
        puntos.append({"periodo": str(m.periodo or ""), "valor": round(v, 4),
                       "fuera": bool(v > ucl or v < lcl)})
    return {"puntos": puntos, "ucl": ucl, "cl": cl, "lcl": lcl}


# ── HISTÓRICO ──────────────────────────────────────────────────────────────────

def listar_historico(id_def=None):
    qs = SSHistorico.objects.all()
    if id_def is not None:
        qs = qs.filter(proceso=_nombre_def(id_def))
    return _lista(qs.order_by("-fecha_hora"), "historico")


# ── DASHBOARD ─────────────────────────────────────────────────────────────────

def dashboard_resumen():
    defs = list(SSDefinicion.objects.all())
    total = len(defs)
    activos = sum(1 for d in defs if str(d.estado) == "activo")

    meds = list(SSMedicion.objects.all())
    sigma_prom, criticos, total_def = 0.0, 0, 0
    if meds:
        ultimo_por_def = {}
        for m in sorted(meds, key=lambda x: x.id_med):
            if m.nivel_sigma is not None:
                ultimo_por_def[m.id_def] = m.nivel_sigma
        latest = list(ultimo_por_def.values())
        if latest:
            sigma_prom = round(sum(latest) / len(latest), 2)
            criticos = sum(1 for v in latest if v < 3)
        total_def = int(sum(m.defectos for m in meds if m.defectos is not None))

    mejs = list(SSMejora.objects.all())
    pendientes = sum(1 for m in mejs if str(m.estado) in ("Pendiente", "En ejecución"))
    aplicadas = sum(1 for m in mejs if str(m.estado) == "Aplicada")

    return {
        "total_procesos": total, "activos": activos, "sigma_promedio": sigma_prom,
        "criticos": criticos, "total_defectos": total_def,
        "mejoras_pendientes": pendientes, "mejoras_aplicadas": aplicadas,
    }


# ── VALIDACIONES ──────────────────────────────────────────────────────────────

def validar_fase(id_def):
    o = _def_qs(id_def)
    base = {"puede_definir": True, "puede_medir": False,
            "puede_analizar": False, "puede_mejorar": False, "puede_controlar": False}
    if o is None:
        return base
    base["puede_medir"] = bool(
        o.nombre_proceso and o.definicion_defecto and float(o.oportunidades_defecto or 0) > 0)
    iv = _to_int(id_def)
    base["puede_analizar"] = SSMedicion.objects.filter(id_def=iv).count() >= 1
    base["puede_mejorar"] = SSCausaIshikawa.objects.filter(id_def=iv).count() >= 1
    base["puede_controlar"] = SSMejora.objects.filter(id_def=iv, estado="Aplicada").count() >= 1
    return base


# ── IMPORTAR DESDE SISTEMA DE INDICADORES (ahora vía ORM) ──────────────────────

def _nombres_procesos():
    """Mapa id_proceso(str) → nombre. Prioriza ficha_proceso, luego inventario."""
    nombres = {}
    for fp in FichaProceso.objects.all():
        if fp.nombre_proceso:
            nombres[str(fp.id_proceso)] = str(fp.nombre_proceso)
    if not nombres:
        for o in InventarioProceso.objects.all():
            nombres[str(o.identificador)] = str(o.nombre_proceso or "")
    return nombres


def procesos_sistema():
    """Lista de indicadores del sistema disponibles para importar a Six Sigma."""
    inds = list(Indicador.objects.all())
    if not inds:
        return []
    nombres = _nombres_procesos()
    inds_en_ss = set(str(v) for v in SSDefinicion.objects.exclude(indicador__isnull=True)
                     .values_list("indicador", flat=True) if v)
    # conteo de avances por indicador
    avances_count = {}
    for a in IndAvance.objects.all():
        avances_count[str(a.id_indicador)] = avances_count.get(str(a.id_indicador), 0) + 1

    result = []
    for r in inds:
        id_ind = str(r.id_indicador or "")
        id_proc = str(r.id_proceso or "")
        nombre_ind = str(r.nombre_indicador or "")
        if not id_ind or not nombre_ind:
            continue
        result.append({
            "id_indicador": id_ind, "id_proceso": id_proc,
            "codigo": str(r.codigo or ""), "nombre_proceso": nombres.get(id_proc, ""),
            "nombre_indicador": nombre_ind, "meta": str(r.meta_final if r.meta_final is not None else "100"),
            "tipo": str(r.tipo or ""), "unidad_medida": str(r.unidad_medida or ""),
            "responsable": str(r.responsable or ""), "sentido": str(r.sentido_esperado or ""),
            "n_periodos": avances_count.get(id_ind, 0), "ya_en_ss": id_ind in inds_en_ss,
        })
    return result


def crear_desde_indicador(id_indicador, oportunidades=1, nombre_proceso_ext=None, nombre_indicador_ext=None, user_id=None):
    """Crea una definición SS desde un indicador del sistema e importa su histórico."""
    ind = Indicador.objects.filter(id_indicador=_to_int(id_indicador)).first()
    if ind is None:
        raise ValueError(f"Indicador {id_indicador} no encontrado")

    id_proc = str(ind.id_proceso or "")
    nombre_ind = str(ind.nombre_indicador or "")
    unidad = str(ind.unidad_medida or "")
    responsable = str(ind.responsable or "")
    metodo = str(ind.metodo_calculo or "")
    sentido = str(ind.sentido_esperado or "Ascendente")

    tipo_raw = str(ind.tipo or "")
    tipo_ss = tipo_raw if tipo_raw in ("Eficacia", "Eficiencia", "Efectividad", "Calidad", "Cumplimiento") else "Cumplimiento"

    try:
        meta = float(ind.meta_final) if ind.meta_final is not None else 100.0
    except (ValueError, TypeError):
        meta = 100.0

    if nombre_proceso_ext:
        nombre_ss = nombre_proceso_ext
    else:
        nombres = _nombres_procesos()
        nombre_proc = nombres.get(id_proc, "")
        nombre_ss = nombre_proc if nombre_proc else (nombre_ind or f"Indicador {id_indicador}")
    if nombre_indicador_ext:
        nombre_ind = nombre_indicador_ext

    id_def = _nuevo_id("definicion")
    SSDefinicion.objects.create(
        id_def=id_def, nombre_proceso=nombre_ss, descripcion=nombre_ind,
        indicador=str(id_indicador), meta=meta, unidad_medida=unidad or "% cumplimiento",
        tipo_indicador=tipo_ss,
        definicion_defecto=metodo or f"Incumplimiento del indicador: {nombre_ind}",
        oportunidades_defecto=oportunidades, fecha_creacion=_now(), estado="activo",
        id_usuario=user_id)
    _registrar_historico(nombre_ss, "DEFINIR", "IMPORTAR DEL SISTEMA",
                         f"Indicador id={id_indicador}: {nombre_ind}")

    nuevas = _calcular_mediciones_indicador(id_indicador, id_def, ind, meta, unidad, sentido, oportunidades)
    if nuevas:
        next_id = _nuevo_id("mediciones")
        objs = []
        for n in nuevas:
            n["id_med"] = next_id
            next_id += 1
            objs.append(SSMedicion(**n))
        SSMedicion.objects.bulk_create(objs)
    _registrar_historico(nombre_ss, "MEDIR", "IMPORTAR HISTÓRICO",
                         f"{len(nuevas)} períodos desde indicadores")

    return {"definicion": {"id_def": id_def, "nombre_proceso": nombre_ss,
                           "sigma_actual": nuevas[-1]["nivel_sigma"] if nuevas else None},
            "mediciones_importadas": len(nuevas)}


def _calcular_mediciones_indicador(id_indicador, id_def, ind, meta, unidad, sentido, oportunidades):
    """Genera mediciones con yield ACUMULADO según tipo_agregacion del indicador."""
    avances = list(IndAvance.objects.filter(id_indicador=_to_int(id_indicador)).order_by("periodo"))
    tipo_agr = str(ind.tipo_agregacion or "")
    es_acum = "acumul" in tipo_agr.lower() and "no acumul" not in tipo_agr.lower()
    es_desc = "desc" in str(sentido).lower()
    o = float(oportunidades or 1)
    acumulado = 0.0
    nuevas = []

    for av in avances:
        periodo = str(av.periodo or "").strip()
        if not periodo or av.valor_real is None:
            continue
        try:
            vr = float(av.valor_real)
        except (ValueError, TypeError):
            continue
        if es_acum:
            acumulado = vr
        else:
            acumulado += vr
        if meta > 0:
            y = min(100.0, (meta / max(acumulado, 0.001)) * 100) if es_desc else min(100.0, (acumulado / meta) * 100)
        else:
            y = min(100.0, acumulado)
        defectos_val = 0 if y >= 99.99 else 1
        met = _metricas(1, defectos_val, o, 100, yield_directo=y)
        nuevas.append({
            "id_med": 0, "id_def": id_def, "periodo": periodo,
            "unidades_evaluadas": 1, "defectos": defectos_val,
            "yield_pct": met["yield_pct"], "dpmo": met["dpmo"],
            "nivel_sigma": met["nivel_sigma"], "cumplimiento": met["cumplimiento"],
            "fecha_registro": _now(),
            "observacion": f"Avance: {vr} {unidad} | Acum: {round(acumulado,2)} / {meta} {unidad}",
            "fuente": "indicadores/avance",
        })
    return nuevas


def reimportar_mediciones(id_def):
    """Recalcula las mediciones importadas del sistema para id_def."""
    d = _def_qs(id_def)
    if d is None:
        raise ValueError("Definición no encontrada")
    id_indicador = str(d.indicador or "")
    if not id_indicador or not id_indicador.isdigit():
        raise ValueError("Solo se puede reimportar un proceso importado del sistema")

    ind = Indicador.objects.filter(id_indicador=_to_int(id_indicador)).first()
    if ind is None:
        raise ValueError(f"Indicador {id_indicador} no encontrado en el sistema")

    meta = float(d.meta) if d.meta is not None else 100.0
    unidad = str(d.unidad_medida or "")
    sentido = str(ind.sentido_esperado or "Ascendente")
    opor = float(d.oportunidades_defecto or 1)

    # Borrar solo las importadas (fuente = indicadores/avance)
    SSMedicion.objects.filter(id_def=_to_int(id_def), fuente="indicadores/avance").delete()

    nuevas = _calcular_mediciones_indicador(id_indicador, _to_int(id_def), ind, meta, unidad, sentido, opor)
    if nuevas:
        next_id = _nuevo_id("mediciones")
        objs = []
        for n in nuevas:
            n["id_med"] = next_id
            next_id += 1
            objs.append(SSMedicion(**n))
        SSMedicion.objects.bulk_create(objs)

    _registrar_historico(str(d.nombre_proceso or ""), "MEDIR", "REIMPORTAR",
                         f"{len(nuevas)} períodos recalculados con yield acumulado")
    return {"reimportadas": len(nuevas)}
