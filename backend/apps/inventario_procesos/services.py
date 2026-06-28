"""Capa de datos del Inventario: jerarquía de procesos por niveles (0 a 4).

Persistencia en PostgreSQL (tabla inventario_proceso). Conserva las firmas
públicas y las formas de JSON originales. La lógica de cálculo de códigos
jerárquicos se mantiene intacta, solo cambia el origen de los datos.
"""
from .models import InventarioProceso
from apps.gestion_procesos.models import BaseProceso

# Padre_Id None/0 = raíz (nivel 0). Nivel máximo permitido = 4.
COLUMNAS = ["Identificador", "Padre_Id", "Nivel", "Tipo_Proceso", "Nombre_Proceso", "Orden_Consecutivo",
            "objetivo_estrategico", "accion_estrategica"]
NIVEL_MAXIMO = 4
INICIAL_TIPO = {"Misional": "M", "Estratégico": "E", "Apoyo": "A"}


def _padre_id(obj):
    """Padre_Id normalizado: None si es raíz."""
    return obj.padre_id if obj.padre_id not in (None, 0) else None


def _registro(obj, codigo=None):
    """Convierte un InventarioProceso al dict con tipos JSON limpios."""
    d = {
        "Identificador": int(obj.identificador),
        "Padre_Id": _padre_id(obj),
        "Nivel": int(obj.nivel),
        "Tipo_Proceso": obj.tipo_proceso,
        "Nombre_Proceso": obj.nombre_proceso,
        "Orden_Consecutivo": int(obj.orden_consecutivo) if obj.orden_consecutivo is not None else 0,
        "objetivo_estrategico": None if obj.objetivo_estrategico is None else str(obj.objetivo_estrategico),
        "accion_estrategica": None if obj.accion_estrategica is None else str(obj.accion_estrategica),
    }
    if codigo is not None:
        d["codigo"] = codigo
    return d


def sincronizar_raices(user_id):
    """Copia los procesos de base_proceso como nivel 0 para este usuario si aún no existen."""
    nombres_raiz = set(
        InventarioProceso.objects.filter(nivel=0, id_usuario=user_id)
        .values_list("nombre_proceso", flat=True)
    )
    ultimo = InventarioProceso.objects.order_by("-identificador").first()
    siguiente = (ultimo.identificador + 1) if ultimo else 1

    nuevos = []
    for b in BaseProceso.objects.all():
        if b.nombre_proceso not in nombres_raiz:
            nuevos.append(InventarioProceso(
                identificador=siguiente, padre=None, nivel=0,
                tipo_proceso=b.tipo_proceso, nombre_proceso=b.nombre_proceso,
                orden_consecutivo=b.orden_consecutivo,
                id_usuario=user_id,
            ))
            siguiente += 1
    if nuevos:
        InventarioProceso.objects.bulk_create(nuevos)


def listar_hijos(padre_id, user_id):
    """Lista los procesos del usuario cuyo Padre_Id coincide."""
    if padre_id in (None, 0, "0", ""):
        sincronizar_raices(user_id)
        hijos = InventarioProceso.objects.filter(padre__isnull=True, id_usuario=user_id)
    else:
        hijos = InventarioProceso.objects.filter(padre_id=int(padre_id), id_usuario=user_id)
    return [_registro(o) for o in hijos.order_by("orden_consecutivo")]


def ruta_navegacion(identificador, user_id):
    """Devuelve la cadena de ancestros (breadcrumb) desde la raíz hasta el proceso."""
    indexado = {o.identificador: o for o in InventarioProceso.objects.filter(id_usuario=user_id)}
    cadena, actual = [], int(identificador)
    while actual in indexado:
        o = indexado[actual]
        cadena.insert(0, {"Identificador": actual, "Nombre_Proceso": o.nombre_proceso, "Nivel": int(o.nivel)})
        padre = _padre_id(o)
        if padre is None:
            break
        actual = int(padre)
    return cadena


def insertar(datos, user_id):
    """Inserta un subproceso bajo un padre, calculando su nivel automáticamente."""
    padre_id = datos.get("Padre_Id")
    padre_id = None if padre_id in (None, 0, "0", "") else int(padre_id)

    if padre_id is None:
        nivel = 0
    else:
        padre = InventarioProceso.objects.filter(identificador=padre_id, id_usuario=user_id).first()
        if padre is None:
            return {"error": "Padre no encontrado"}
        nivel = int(padre.nivel) + 1
        if nivel > NIVEL_MAXIMO:
            return {"error": f"Nivel máximo permitido es {NIVEL_MAXIMO}"}

    ultimo = InventarioProceso.objects.order_by("-identificador").first()
    nuevo_id = (ultimo.identificador + 1) if ultimo else 1
    hermanos_qs = InventarioProceso.objects.filter(padre_id=padre_id, id_usuario=user_id)
    ultimo_orden = hermanos_qs.order_by("-orden_consecutivo").first()
    nuevo_orden = (ultimo_orden.orden_consecutivo + 1) if ultimo_orden and ultimo_orden.orden_consecutivo else 1
    obj = InventarioProceso.objects.create(
        identificador=nuevo_id, padre_id=padre_id, nivel=nivel,
        tipo_proceso=datos.get("Tipo_Proceso"), nombre_proceso=datos.get("Nombre_Proceso"),
        orden_consecutivo=nuevo_orden,
        objetivo_estrategico=datos.get("objetivo_estrategico") if nivel == 0 else None,
        accion_estrategica=datos.get("accion_estrategica") if nivel == 0 else None,
        id_usuario=user_id,
    )
    return _registro(obj)


def actualizar(identificador, datos, user_id):
    """Actualiza nombre y orden de un proceso (no se mueve de padre/nivel)."""
    obj = InventarioProceso.objects.filter(identificador=int(identificador), id_usuario=user_id).first()
    if obj is None:
        return None
    mapa = {"Tipo_Proceso": "tipo_proceso", "Nombre_Proceso": "nombre_proceso",
            "Orden_Consecutivo": "orden_consecutivo"}
    for col, attr in mapa.items():
        if col in datos:
            setattr(obj, attr, datos[col])
    if int(obj.nivel) == 0:
        for col, attr in (("objetivo_estrategico", "objetivo_estrategico"),
                          ("accion_estrategica", "accion_estrategica")):
            if col in datos:
                setattr(obj, attr, datos[col] if datos[col] else None)
    obj.save()
    return _registro(obj)


def _calcular_codigos(objetos):
    """Retorna dict {id: código} para todos los nodos del inventario.

    Lógica idéntica a la versión Excel: posición entre hermanos del mismo
    tipo, ordenados por (orden_consecutivo, identificador), recorriendo de la
    raíz hacia abajo.
    """
    indexado = {int(o.identificador): o for o in objetos}

    def p_id(o):
        return o.padre_id if o.padre_id not in (None, 0) else None

    pos_cache = {}
    for id_proc, o in indexado.items():
        p = p_id(o)
        tipo = o.tipo_proceso
        hermanos = [x for x in indexado.values() if p_id(x) == p and x.tipo_proceso == tipo]
        hermanos.sort(key=lambda x: (
            x.orden_consecutivo if x.orden_consecutivo is not None else 0,
            int(x.identificador)
        ))
        for i, h in enumerate(hermanos, 1):
            if int(h.identificador) == id_proc:
                pos_cache[id_proc] = i
                break
        else:
            pos_cache[id_proc] = 1

    codigos = {}
    for id_proc, o in indexado.items():
        inicial = INICIAL_TIPO.get(o.tipo_proceso, "X")
        cadena, actual = [], id_proc
        while actual in indexado:
            cadena.insert(0, pos_cache.get(actual, 1))
            p = p_id(indexado[actual])
            if p is None:
                break
            actual = p
        if cadena:
            codigos[id_proc] = f"{inicial}-{cadena[0]:02d}" + "".join(f".{n}" for n in cadena[1:])
        else:
            codigos[id_proc] = ""
    return codigos


def todos_con_codigo(user_id):
    """Retorna todos los procesos del usuario con su código jerárquico calculado."""
    objetos = list(InventarioProceso.objects.filter(id_usuario=user_id))
    codigos = _calcular_codigos(objetos)
    return [_registro(o, codigo=codigos.get(int(o.identificador), "")) for o in objetos]


def eliminar(identificador, user_id):
    """Elimina un proceso del usuario y, en cascada, todos sus descendientes."""
    todos = {o.identificador: o for o in InventarioProceso.objects.filter(id_usuario=user_id)}
    hijos_de = {}
    for o in todos.values():
        hijos_de.setdefault(o.padre_id, []).append(o.identificador)

    a_borrar, pila = set(), [int(identificador)]
    while pila:
        actual = pila.pop()
        if actual not in todos:
            continue
        a_borrar.add(actual)
        pila.extend(hijos_de.get(actual, []))

    if not a_borrar:
        return False
    borrados, _ = InventarioProceso.objects.filter(identificador__in=a_borrar).delete()
    return borrados > 0
