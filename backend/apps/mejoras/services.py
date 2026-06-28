"""Capa de datos del módulo Ficha de Mejora de Proceso (PostgreSQL).

Reemplaza inventario_mejoras.xlsx. Conserva firmas, formas de JSON, catálogos,
matrices de confianza y la lógica de factibilidad/avance automático. Las
lecturas cruzadas a indicadores ahora usan el ORM en vez de leer Excel.
"""
import json
from datetime import timedelta, datetime

from .models import Mejora, MejCronograma
from apps.inventario_procesos.models import InventarioProceso
from apps.indicadores.models import Indicador, IndLogro, IndAvance

INICIAL_TIPO = {"Misional": "M", "Estratégico": "E", "Apoyo": "A"}

# Catálogos (idénticos al original; el frontend los pinta)
CONSECUENCIAS = ["Personas", "Ambiente", "Economía", "Administración pública", "Entorno social", "Infraestructura"]
NIVELES_CONSECUENCIA = ["Muy favorable", "Favorable", "Moderado", "Menor", "Insignificante"]
NIVELES_PROBABILIDAD = [
    {"nivel": "Casi certero", "intervalo": "Mayor a 81%"},
    {"nivel": "Probable", "intervalo": "Entre 61% y 80%"},
    {"nivel": "Posible", "intervalo": "Entre 41% y 60%"},
    {"nivel": "Improbable", "intervalo": "Entre 21% y 40%"},
    {"nivel": "Raro", "intervalo": "Menor a 20%"},
]
MATRIZ = {
    "Casi certero": ["Medio", "Medio", "Alto", "Muy alto", "Muy alto"],
    "Probable":     ["Bajo", "Medio", "Alto", "Alto", "Muy alto"],
    "Posible":      ["Bajo", "Bajo", "Medio", "Alto", "Alto"],
    "Improbable":   ["Bajo", "Bajo", "Medio", "Medio", "Alto"],
    "Raro":         ["Bajo", "Bajo", "Bajo", "Medio", "Medio"],
}
ORDEN_MATRIZ = ["Insignificante", "Menor", "Moderado", "Favorable", "Muy favorable"]
CRITERIOS_CONFIANZA = ["Dato/información", "Conocimiento del equipo", "Consenso"]
NIVELES_CONFIANZA = ["Baja confianza", "Moderada confianza", "Alta confianza"]
MATRIZ_ALTA = {
    "Casi certero": ["Medio", "Medio", "Alto",  "Muy alto", "Muy alto"],
    "Probable":     ["Bajo",  "Medio", "Alto",  "Alto",     "Muy alto"],
    "Posible":      ["Bajo",  "Bajo",  "Medio", "Alto",     "Alto"],
    "Improbable":   ["Bajo",  "Bajo",  "Medio", "Medio",    "Alto"],
    "Raro":         ["Bajo",  "Bajo",  "Bajo",  "Medio",    "Medio"],
}
MATRIZ_MODERADA = {
    "Casi certero": ["Bajo",  "Bajo",  "Medio", "Alto",  "Alto"],
    "Probable":     ["Bajo",  "Bajo",  "Medio", "Medio", "Alto"],
    "Posible":      ["Bajo",  "Bajo",  "Bajo",  "Medio", "Medio"],
    "Improbable":   ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Medio"],
    "Raro":         ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Bajo"],
}
MATRIZ_BAJA = {
    "Casi certero": ["Bajo",  "Bajo",  "Bajo",  "Medio", "Medio"],
    "Probable":     ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Medio"],
    "Posible":      ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Bajo"],
    "Improbable":   ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Bajo"],
    "Raro":         ["Bajo",  "Bajo",  "Bajo",  "Bajo",  "Bajo"],
}
COSTOS = [
    {"nivel": "Alto",  "valor": 5, "desc": "Alto consumo (Gastos importantes en el presupuesto del proceso, más del 80%)"},
    {"nivel": "Medio", "valor": 2, "desc": "Medio consumo (Gastos moderados en el presupuesto del proceso, entre el 50% al 80%)"},
    {"nivel": "Bajo",  "valor": 1, "desc": "Bajo consumo (Gastos poco significativos en el presupuesto del proceso, menor al 50%)"},
]
IMPACTOS = [
    {"nivel": "Alto",  "valor": 7, "desc": "Alto (recuperación alta en el proceso de mejora, con impacto directo en resultados)"},
    {"nivel": "Medio", "valor": 5, "desc": "Medio (recuperación alta en su proceso, además de repercusión en otro proceso)"},
    {"nivel": "Bajo",  "valor": 3, "desc": "Bajo (recuperación media o baja en cualquier proceso)"},
]
FACTIBILIDAD = [
    {"nivel": "Bajo",  "accion": "Analizar la oportunidad de mejora",   "rango": "F > 14"},
    {"nivel": "Medio", "accion": "Ejecutar la acción a corto plazo",    "rango": "7 < F ≤ 14"},
    {"nivel": "Alto",  "accion": "Ejecutar la acción inmediatamente",   "rango": "1 ≤ F ≤ 7"},
]
ESTADOS = ["No iniciado", "En proceso", "Cerrado"]

# Campos de la ficha de mejora (sin la PK), para serializar/recorrer.
CAMPOS_MEJORA = [
    "id_proceso", "codigo_proceso", "proyecto", "codigo_proyecto",
    "proceso_asociado", "responsable_proceso", "responsable_proyecto",
    "fecha_solicitud", "fecha_requerida", "tipo_mejora", "importancia", "complejidad",
    "tipo_oportunidad", "oportunidades_identificadas", "consecuencias_marcadas",
    "evaluaciones_json", "confianza_json", "acciones_json",
    "costo_valor", "costo_nivel", "impacto_valor", "impacto_nivel",
    "factibilidad_valor", "factibilidad_nivel", "factibilidad_accion",
    "plazo_inicio", "plazo_fin", "estado",
    "desc_problema", "desc_objetivo", "desc_indicador_meta",
    "desc_alcance", "desc_accion_mejora", "desc_impacto",
    "cronograma_json", "cronograma_proceso_json",
]
# Campos JSON: el modelo ya guarda objetos Python (JSONField), no texto.
CAMPOS_JSON = (
    "consecuencias_marcadas", "evaluaciones_json", "confianza_json", "acciones_json",
    "cronograma_json", "cronograma_proceso_json",
)
_JSON_DICT = {"confianza_json"}  # estos son dict; el resto, listas


def catalogos():
    """Devuelve todos los catálogos para que el frontend arme las tablas."""
    return {
        "consecuencias": CONSECUENCIAS, "niveles_consecuencia": NIVELES_CONSECUENCIA,
        "niveles_probabilidad": NIVELES_PROBABILIDAD, "matriz": MATRIZ, "orden_matriz": ORDEN_MATRIZ,
        "criterios_confianza": CRITERIOS_CONFIANZA, "niveles_confianza": NIVELES_CONFIANZA,
        "matriz_alta": MATRIZ_ALTA, "matriz_moderada": MATRIZ_MODERADA, "matriz_baja": MATRIZ_BAJA,
        "costos": COSTOS, "impactos": IMPACTOS, "factibilidad": FACTIBILIDAD, "estados": ESTADOS,
    }


def _mejora_a_dict(obj):
    """Mejora → dict con todos los campos. Los JSONField salen ya deserializados."""
    d = {"id_mejora": obj.id_mejora}
    for c in CAMPOS_MEJORA:
        v = getattr(obj, c)
        if c in CAMPOS_JSON and v is None:
            v = {} if c in _JSON_DICT else []
        d[c] = v
    return d


# ---------- ÁRBOL (excluye hojas finales) ----------

def arbol(tipo, user_id):
    nodos = list(InventarioProceso.objects.filter(tipo_proceso=tipo, id_usuario=user_id))
    if not nodos:
        return []
    con_mejora = set(Mejora.objects.values_list("id_proceso", flat=True))

    def pid(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    def construir(padre_id):
        rama = []
        for n in nodos:
            if pid(n) == padre_id:
                idp = int(n.identificador)
                orden = int(n.orden_consecutivo) if n.orden_consecutivo is not None else 0
                rama.append({
                    "id": idp, "nombre": n.nombre_proceso, "nivel": int(n.nivel),
                    "orden": orden,
                    "tiene_mejora": idp in con_mejora, "hijos": construir(idp),
                })
        return sorted(rama, key=lambda x: x["orden"])

    return construir(None)


def _fmt_fecha(v):
    if v is None:
        return None
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    s = str(v)[:10]
    return s if len(s) == 10 else None


# ---------- LECTURAS CRUZADAS A INDICADORES (ahora vía ORM) ----------

def _indicadores_de(id_proceso):
    return list(Indicador.objects.filter(id_proceso=int(id_proceso)))


def _fechas_indicador(id_proceso):
    """fecha_inicio más temprana y fecha_fin más tardía entre los indicadores del proceso."""
    inds = _indicadores_de(id_proceso)
    if not inds:
        return {}
    starts = [_fmt_fecha(i.fecha_inicio) for i in inds if _fmt_fecha(i.fecha_inicio)]
    ends = [_fmt_fecha(i.fecha_fin) for i in inds if _fmt_fecha(i.fecha_fin)]
    return {
        "ind_fecha_inicio": min(starts) if starts else None,
        "ind_fecha_fin":    max(ends) if ends else None,
    }


def _rango_plan_activo(id_proceso):
    """Rango [inicio, fin] de periodos con valor_planificado > 0 (igual que la gráfica)."""
    ind_ids = [i.id_indicador for i in _indicadores_de(id_proceso)]
    if not ind_ids:
        return {}
    inicios, fines = [], []
    for log in IndLogro.objects.filter(id_indicador__in=ind_ids):
        plan = log.valor_planificado
        if plan is None or float(plan) <= 0:
            continue
        partes = str(log.periodo or "").split("→")
        if len(partes) == 2:
            ini, fin = partes[0].strip()[:10], partes[1].strip()[:10]
            if ini:
                inicios.append(ini)
            if fin:
                fines.append(fin)
    if not inicios or not fines:
        return {}
    return {"ind_fecha_primer_plan": min(inicios), "ind_fecha_ultimo_plan": max(fines)}


def _rango_mejora(id_proceso):
    """Rango válido para programar la mejora (desde que el plan llega a su máximo)."""
    inds = _indicadores_de(id_proceso)
    ind_ids = [i.id_indicador for i in inds]
    if not ind_ids:
        return {}
    fechas_fin = [str(i.fecha_fin)[:10] for i in inds if i.fecha_fin]
    mejora_fin = max(fechas_fin) if fechas_fin else None

    primeros_al_max = []
    for iid in ind_ids:
        entries = []
        for log in IndLogro.objects.filter(id_indicador=iid):
            plan = log.valor_planificado
            if plan is None:
                continue
            partes = str(log.periodo or "").split("→")
            if len(partes) == 2:
                entries.append({"inicio": partes[0].strip()[:10], "valor": float(plan)})
        if not entries:
            continue
        entries.sort(key=lambda x: x["inicio"])
        max_val = max(e["valor"] for e in entries)
        primera = next((e for e in entries if e["valor"] >= max_val), None)
        if primera:
            primeros_al_max.append(primera["inicio"])

    if not primeros_al_max:
        return {"mejora_fecha_fin_rango": mejora_fin}
    return {"mejora_fecha_inicio_rango": min(primeros_al_max), "mejora_fecha_fin_rango": mejora_fin}


def _ati_a_probabilidad(ati):
    if ati > 81:   return "Casi certero"
    if ati > 60:   return "Probable"
    if ati > 40:   return "Posible"
    if ati > 20:   return "Improbable"
    return "Raro"


def _avance_automatico(id_proceso):
    """ATI ponderado del proceso y probabilidad automática."""
    inds = _indicadores_de(id_proceso)
    if not inds:
        return {}
    vals = []
    for ind in inds:
        meta = float(ind.meta_final) if (ind.meta_final is not None and float(ind.meta_final) > 0) else 100.0
        avs = list(IndAvance.objects.filter(id_indicador=ind.id_indicador))
        if not avs:
            continue
        real = float(sum(a.valor_real for a in avs if a.valor_real is not None))
        pct = min(round(real / meta * 100, 2), 100.0)
        vals.append(pct)
    if not vals:
        return {}
    ati_promedio = round(sum(vals) / len(vals), 2)
    return {
        "avance_tipo_i_auto": ati_promedio,
        "probabilidad_automatica": _ati_a_probabilidad(ati_promedio),
    }


def _datos_proceso(id_proceso):
    """Autocompleta datos generales desde el inventario."""
    o = InventarioProceso.objects.filter(identificador=int(id_proceso)).first()
    if o is None:
        return {}
    return {"proceso_asociado": o.nombre_proceso, "codigo_proceso": _codigo_proceso(id_proceso)}


def _codigo_proceso(id_proceso):
    objetos = list(InventarioProceso.objects.all())
    indexado = {int(x.identificador): x for x in objetos}
    iid = int(id_proceso)
    if iid not in indexado:
        return ""
    tipo = indexado[iid].tipo_proceso
    inicial = INICIAL_TIPO.get(tipo, "X")

    def _padre(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    def _pos(o):
        padre = _padre(o)
        herm = [x for x in objetos if _padre(x) == padre and x.tipo_proceso == tipo]
        herm.sort(key=lambda x: (x.orden_consecutivo if x.orden_consecutivo is not None else 0, int(x.identificador)))
        for i, h in enumerate(herm, 1):
            if int(h.identificador) == int(o.identificador):
                return i
        return 1

    cadena, actual = [], iid
    while actual in indexado:
        o = indexado[actual]
        cadena.insert(0, _pos(o))
        padre = _padre(o)
        if padre is None:
            break
        actual = padre
    return f"{inicial}-{cadena[0]:02d}" + "".join(f".{n}" for n in cadena[1:])


# ---------- OBTENER / GUARDAR FICHA DE MEJORA ----------

def obtener_por_proceso(id_proceso):
    pid = int(id_proceso)
    extra = {**_fechas_indicador(pid), **_avance_automatico(pid),
             **_rango_plan_activo(pid), **_rango_mejora(pid)}

    obj = Mejora.objects.filter(id_proceso=pid).first()
    if obj is None:
        datos = _datos_proceso(pid)
        return {
            "id_mejora": None, "id_proceso": pid, "estado": "No iniciado",
            "consecuencias_marcadas": [], "evaluaciones_json": [], "confianza_json": {}, "acciones_json": [],
            **datos, **extra,
        }
    result = _mejora_a_dict(obj)
    result.update(extra)

    # Cronograma desde la tabla dedicada (prioridad sobre el JSON de la fila)
    crono = MejCronograma.objects.filter(id_proceso=pid)
    if crono.exists():
        result["cronograma_json"] = [
            {"semana": c.semana, "inicio": c.inicio, "fin": c.fin,
             "planificado": c.planificado, "logrado": c.logrado}
            for c in crono
        ]
    return result


def guardar(id_proceso, datos):
    """Crea o actualiza la ficha de mejora del proceso."""
    pid = int(id_proceso)

    # Factibilidad = costo * impacto (lógica idéntica al original)
    cv = datos.get("costo_valor")
    iv = datos.get("impacto_valor")
    if cv is not None and iv is not None:
        try:
            fval = float(cv) * float(iv)
            datos["factibilidad_valor"] = fval
            if fval <= 7:
                datos["factibilidad_nivel"] = "Alto"
                datos["factibilidad_accion"] = "Ejecutar la acción inmediatamente"
            elif fval <= 14:
                datos["factibilidad_nivel"] = "Medio"
                datos["factibilidad_accion"] = "Ejecutar la acción a corto plazo"
            else:
                datos["factibilidad_nivel"] = "Bajo"
                datos["factibilidad_accion"] = "Analizar la oportunidad de mejora"
        except (ValueError, TypeError):
            pass

    # Construir el conjunto de campos a guardar
    campos = {}
    for c in CAMPOS_MEJORA:
        if c == "id_proceso":
            continue
        if c in CAMPOS_JSON:
            # JSONField guarda objetos Python directamente
            campos[c] = datos.get(c, {} if c in _JSON_DICT else [])
        elif c in datos:
            campos[c] = datos[c]

    # Autocompletar datos del proceso si faltan
    for k, v in _datos_proceso(pid).items():
        campos.setdefault(k, v)

    obj = Mejora.objects.filter(id_proceso=pid).first()
    if obj is not None:
        for c, v in campos.items():
            setattr(obj, c, v)
        obj.save()
    else:
        ultimo = Mejora.objects.order_by("-id_mejora").first()
        nuevo_id = (ultimo.id_mejora + 1) if ultimo else 1
        Mejora.objects.create(id_mejora=nuevo_id, id_proceso=pid, **campos)

    # Cronograma semanal en tabla dedicada
    MejCronograma.objects.filter(id_proceso=pid).delete()
    crono_entries = datos.get("cronograma_json") or []
    if isinstance(crono_entries, str):
        try:
            crono_entries = json.loads(crono_entries)
        except Exception:
            crono_entries = []

    nuevas = []
    ultimo_c = MejCronograma.objects.order_by("-id_crono").first()
    sig = (ultimo_c.id_crono + 1) if ultimo_c else 1
    for entry in crono_entries:
        plan = entry.get("planificado")
        logr = entry.get("logrado")
        if plan is not None or logr is not None:
            nuevas.append(MejCronograma(
                id_crono=sig, id_proceso=pid,
                semana=entry.get("semana"), inicio=entry.get("inicio"), fin=entry.get("fin"),
                planificado=plan, logrado=logr,
            ))
            sig += 1
    if nuevas:
        MejCronograma.objects.bulk_create(nuevas)

    return obtener_por_proceso(pid)


def eliminar(id_proceso):
    pid = int(id_proceso)
    borrados, _ = Mejora.objects.filter(id_proceso=pid).delete()
    if borrados == 0:
        return False
    MejCronograma.objects.filter(id_proceso=pid).delete()
    return True


# ---------- RESULTADOS DE MEJORA ----------

def _siguiente_lunes(dt):
    dia = dt.weekday()  # 0=lunes
    if dia == 0:
        return dt
    return dt + timedelta(days=(7 - dia))


def _parse_fecha(s):
    """Parsea 'YYYY-MM-DD' a datetime (o None)."""
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def resultados_mejora():
    """Tabla de resultados de mejoras con semanas y ATI I/II."""
    from apps.indicadores import services as ind_svc

    # 1. Base jerárquica OEI → IND → AEI → IND
    rid = ind_svc.reporte_identificacion()
    rangos = rid["rangos"]

    # 2. Mapa id_indicador → id_proceso (vía ORM)
    ind_to_proc = {}
    for i in Indicador.objects.all():
        if i.id_indicador is not None and i.id_proceso is not None:
            ind_to_proc[int(i.id_indicador)] = int(i.id_proceso)

    # 3. Mapa id_proceso → mejora
    mejoras_map = {}
    for m in Mejora.objects.all():
        if m.id_proceso is not None:
            mejoras_map[int(m.id_proceso)] = _mejora_a_dict(m)

    # 4. Cronogramas de mejora por proceso
    crono_por_proc = {}
    for c in MejCronograma.objects.all():
        crono_por_proc.setdefault(int(c.id_proceso), []).append(c)

    def _parse_periodo_ini(p):
        return _parse_fecha(str(p).split("→")[0].strip())

    all_ini, all_fin = [], []
    for id_proc in mejoras_map.keys():
        for c in crono_por_proc.get(id_proc, []):
            di, dfn = _parse_fecha(c.inicio), _parse_fecha(c.fin)
            if di:
                all_ini.append(di)
            if dfn:
                all_fin.append(dfn)

    for fila in rid["filas"]:
        if fila.get("tipo") != "ind_detalle":
            continue
        for p in (fila.get("avances") or {}).keys():
            ini_p = _parse_periodo_ini(p)
            if ini_p is not None:
                all_ini.append(ini_p)
                all_fin.append(ini_p + timedelta(days=6))

    if not all_ini:
        for mej in mejoras_map.values():
            fi, ff = mej.get("fecha_solicitud"), mej.get("fecha_requerida")
            di, dfn = _parse_fecha(fi), _parse_fecha(ff)
            if di and dfn:
                all_ini.append(_siguiente_lunes(di))
                all_fin.append(dfn)

    if not all_ini:
        return {"semanas": [], "filas": rid["filas"], "rangos": rangos, "ult_semana": ""}

    ini_g, fin_g = min(all_ini), max(all_fin)

    all_semanas = []
    actual, n = ini_g, 1
    while actual.date() <= fin_g.date():
        fin_sem = actual + timedelta(days=6)
        if fin_sem.date() > fin_g.date():
            fin_sem = fin_g
        all_semanas.append({"n": n, "inicio": actual.strftime("%Y-%m-%d"),
                            "fin": fin_sem.strftime("%Y-%m-%d"), "label": f"S{n}"})
        actual += timedelta(days=7)
        n += 1

    # 5. Datos semanales por indicador: regular + mejora
    sem_data_by_ind = {}
    for fila in rid["filas"]:
        if fila.get("tipo") != "ind_detalle":
            continue
        id_ind = fila.get("id_indicador")
        if not id_ind:
            continue
        id_ind_i = int(id_ind)
        sem_ind = {}

        logros = fila.get("logros") or {}
        avances = fila.get("avances") or {}
        for p, logr_val in avances.items():
            if logr_val is None:
                continue
            ini_p = _parse_periodo_ini(p)
            if ini_p is None:
                continue
            sg = (ini_p.date() - ini_g.date()).days // 7 + 1
            if 1 <= sg <= len(all_semanas):
                plan_val = logros.get(p)
                sem_ind[sg] = {"planificado": float(plan_val) if plan_val is not None else None,
                               "logrado": float(logr_val), "tipo": "proceso"}

        id_proc_mej = ind_to_proc.get(id_ind_i)
        if id_proc_mej and id_proc_mej in mejoras_map:
            for entry in crono_por_proc.get(id_proc_mej, []):
                di = _parse_fecha(entry.inicio)
                if di is None:
                    continue
                sg = (di.date() - ini_g.date()).days // 7 + 1
                if 1 <= sg <= len(all_semanas):
                    plan = entry.planificado
                    logr = entry.logrado
                    plan = None if plan is None else float(plan)
                    logr = None if logr is None else float(logr)
                    if plan is not None or logr is not None:
                        sem_ind[sg] = {"planificado": plan, "logrado": logr, "tipo": "mejora"}

        sem_data_by_ind[id_ind_i] = sem_ind

    semanas_con_datos, semanas_con_mejora = set(), set()
    for sd in sem_data_by_ind.values():
        for sg_k, v in sd.items():
            semanas_con_datos.add(sg_k)
            if v.get("tipo") == "mejora":
                semanas_con_mejora.add(sg_k)
    semanas = [{**s, "tipo": "mejora" if s["n"] in semanas_con_mejora else "proceso"}
               for s in all_semanas if s["n"] in semanas_con_datos]

    def _color_v(v):
        if v is None:
            return None
        for r in sorted(rangos, key=lambda x: x.get("desde") or 0):
            if (r.get("desde") or 0) <= v <= (r.get("hasta") or 100):
                return r["color"]
        return (rangos[0]["color"] if rangos else "rojo")

    filas_out = []
    for fila in rid["filas"]:
        if fila.get("tipo") == "ind_detalle":
            id_ind = fila.get("id_indicador")
            id_ind_i = int(id_ind) if id_ind else None
            id_proc = ind_to_proc.get(id_ind_i) if id_ind_i else None
            sd = sem_data_by_ind.get(id_ind_i, {}) if id_ind_i else {}

            tipo1 = fila.get("avance_tipo_i")
            entradas_mej = [(k, v) for k, v in sd.items()
                            if v.get("tipo") == "mejora" and v.get("logrado") is not None]
            if entradas_mej:
                _, ult = max(entradas_mej, key=lambda x: x[0])
                logr_ult, plan_ult = ult.get("logrado"), ult.get("planificado")
                tipo2 = round(logr_ult / plan_ult * 100, 2) if (plan_ult and plan_ult > 0 and logr_ult is not None) else None
                if tipo2 is not None:
                    tipo2 = max(0.0, min(100.0, tipo2))
            else:
                tipo2 = None

            tiene_mejora = any(v.get("tipo") == "mejora" for v in sd.values())
            filas_out.append({
                **fila, "id_proceso": id_proc,
                "semanas_data": {str(k): v for k, v in sd.items()},
                "tiene_mejora": tiene_mejora, "tipo1": tipo1, "tipo2": tipo2,
                "color_tipo2": _color_v(tipo2),
            })
        else:
            filas_out.append({**fila, "tipo1": None, "tipo2": None, "color_tipo2": None})

    def _color_std(pct):
        if pct is None: return "rojo"
        if pct >= 56: return "verde"
        if pct >= 16: return "amarillo"
        return "rojo"

    procesos_chart = []
    for fo in filas_out:
        if fo.get("tipo") != "ind_detalle":
            continue
        t2, t1 = fo.get("tipo2"), fo.get("tipo1")
        pct = t2 if t2 is not None else (round(float(t1), 1) if t1 is not None else None)
        cod = fo.get("codigo") or ""
        grupo = cod.split(".")[0] if "." in cod else cod
        procesos_chart.append({
            "codigo": cod, "nombre": fo.get("nombre_proceso") or fo.get("descripcion") or cod,
            "pct": pct, "tiene_mejora": fo.get("tiene_mejora", False),
            "color": _color_std(pct), "grupo": grupo,
        })
    procesos_chart.sort(key=lambda x: str(x.get("codigo") or ""))

    return {
        "semanas": semanas, "filas": filas_out, "rangos": rangos,
        "ult_semana": str(len(semanas)) if semanas else "",
        "procesos_chart": procesos_chart,
    }
