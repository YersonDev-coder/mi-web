"""Controladores REST del módulo Ficha de Proceso."""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from apps.autenticacion.auth import requiere_auth, procesos_de_usuario
from . import services, diagrama as diag_svc
from .models import DiagramaDrawio

HOJAS_VALIDAS = {"actividades", "flujo_sipoc", "riesgos", "registros"}


def _cuerpo(request):
    return json.loads(request.body or "{}")


def _proceso_del_usuario(id_proceso, user_id):
    return int(id_proceso) in procesos_de_usuario(user_id)


@requiere_auth
def arbol(request):
    tipo = request.GET.get("tipo", "Estratégico")
    return JsonResponse(services.arbol(tipo, request.user_id), safe=False)


@csrf_exempt
@requiere_auth
def ficha(request, id_proceso):
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if request.method == "GET":
        return JsonResponse(services.obtener_ficha(id_proceso))
    if request.method == "PUT":
        return JsonResponse(services.guardar_maestro(id_proceso, _cuerpo(request)))
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def diagrama(request, id_proceso):
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    try:
        ficha_data = services.obtener_ficha(id_proceso)
    except Exception as e:
        return JsonResponse({"error": f"No se pudo cargar la ficha del proceso: {str(e)}"}, status=500)

    actividades = [
        {"orden": a.get("orden_secuencia", ""), "descripcion": a.get("descripcion_actividad", "")}
        for a in (ficha_data.get("actividades") or [])
        if a.get("descripcion_actividad")
    ]

    if request.method == "GET":
        if not actividades:
            return JsonResponse({"sin_actividades": True})
        try:
            img    = diag_svc.cargar_guardado(id_proceso)
            codigo = diag_svc.cargar_codigo(id_proceso)
        except Exception:
            img = None
            codigo = None
        return JsonResponse({"sin_actividades": False, "tiene_guardado": img is not None,
                             "imagen_b64": img, "codigo": codigo})

    if request.method == "POST":
        if not actividades:
            return JsonResponse({"error": "Este proceso no tiene actividades registradas."}, status=400)
        nombre = ficha_data.get("proceso", {}).get("nombre_proceso", f"Proceso {id_proceso}")
        try:
            return JsonResponse(diag_svc.generar(id_proceso, nombre, actividades))
        except ValueError as e:
            return JsonResponse({"error": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"error": f"Error al generar: {str(e)}"}, status=500)

    if request.method == "PUT":
        codigo = _cuerpo(request).get("codigo", "").strip()
        if not codigo:
            return JsonResponse({"error": "El código PlantUML no puede estar vacío."}, status=400)
        try:
            return JsonResponse(diag_svc.guardar_manual(id_proceso, codigo))
        except Exception as e:
            return JsonResponse({"error": f"Error al renderizar: {str(e)}"}, status=500)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@requiere_auth
def diagrama_prompt(request, id_proceso):
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    try:
        ficha_data = services.obtener_ficha(id_proceso)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    actividades = [
        {"orden": a.get("orden_secuencia", ""), "descripcion": a.get("descripcion_actividad", "")}
        for a in (ficha_data.get("actividades") or [])
        if a.get("descripcion_actividad")
    ]
    nombre = ficha_data.get("proceso", {}).get("nombre_proceso", f"Proceso {id_proceso}")
    return JsonResponse({"prompt": diag_svc.construir_prompt(nombre, actividades)})


@csrf_exempt
@requiere_auth
def diagrama_imagen(request, id_proceso):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    archivo = request.FILES.get("imagen")
    if not archivo:
        return JsonResponse({"error": "No se recibió ningún archivo."}, status=400)
    if not archivo.content_type.startswith("image/"):
        return JsonResponse({"error": "El archivo debe ser una imagen."}, status=400)
    try:
        return JsonResponse(diag_svc.guardar_imagen(id_proceso, archivo.read()))
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@requiere_auth
def diagrama_preview(request, id_proceso):
    codigo = _cuerpo(request).get("codigo", "").strip()
    if not codigo:
        return JsonResponse({"error": "Código vacío."}, status=400)
    try:
        return JsonResponse({"imagen_b64": diag_svc.previsualizar(codigo)})
    except Exception as e:
        return JsonResponse({"error": f"Error al renderizar: {str(e)}"}, status=500)


@csrf_exempt
@requiere_auth
def diagrama_drawio_generar(request, id_proceso):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    try:
        ficha_data = services.obtener_ficha(id_proceso)
    except Exception as e:
        return JsonResponse({"error": f"No se pudo cargar la ficha: {str(e)}"}, status=500)

    actividades = [
        {"orden": a.get("orden_secuencia", i + 1), "descripcion": a.get("descripcion_actividad", "")}
        for i, a in enumerate(ficha_data.get("actividades") or [])
        if a.get("descripcion_actividad")
    ]
    if not actividades:
        return JsonResponse({"error": "Este proceso no tiene actividades registradas."}, status=400)

    nombre = ficha_data.get("proceso", {}).get("nombre_proceso", f"Proceso {id_proceso}")
    try:
        return JsonResponse(diag_svc.generar_drawio(nombre, actividades))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Error al generar con IA: {str(e)}"}, status=500)


@csrf_exempt
@requiere_auth
def diagrama_drawio(request, id_proceso):
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if request.method == "GET":
        obj = DiagramaDrawio.objects.filter(id_proceso=id_proceso).first()
        return JsonResponse({"xml": obj.xml if obj else "", "svg": obj.svg if obj else ""})
    if request.method == "POST":
        datos = json.loads(request.body or "{}")
        obj, _ = DiagramaDrawio.objects.get_or_create(id_proceso=id_proceso)
        obj.xml = datos.get("xml", "")
        obj.svg = datos.get("svg", "")
        obj.save()
        return JsonResponse({"ok": True})
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def ficha_completar_ia(request, id_proceso):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _proceso_del_usuario(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    try:
        from apps.inventario_procesos.models import InventarioProceso
        ficha_data = services.obtener_ficha(id_proceso)
        proceso    = ficha_data["proceso"]
        todos = list(InventarioProceso.objects.filter(id_usuario=request.user_id))
        nodos = {int(n.identificador): n for n in todos}
        actual, pila = int(id_proceso), []
        while actual in nodos:
            nodo = nodos[actual]
            pila.insert(0, nodo.nombre_proceso or "")
            padre = nodo.padre_id
            if padre in (None, 0) or int(padre) not in nodos:
                break
            actual = int(padre)
        nodo_actual = nodos.get(int(id_proceso))
        hermanos = []
        if nodo_actual:
            padre_id = nodo_actual.padre_id
            hermanos = [n.nombre_proceso for n in todos
                        if n.padre_id == padre_id and int(n.identificador) != int(id_proceso) and n.nombre_proceso]
        resultado = diag_svc.completar_ficha_con_ia(proceso, pila, hermanos)
        nueva_ficha = services.guardar_ficha_completa(id_proceso, resultado)
        return JsonResponse({"ok": True, "ficha": nueva_ficha})
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Error interno: {str(e)}"}, status=500)


@csrf_exempt
@requiere_auth
def detalle(request, hoja):
    if hoja not in HOJAS_VALIDAS:
        return JsonResponse({"error": "Tabla inválida"}, status=400)
    if request.method == "POST":
        return JsonResponse(services.agregar_detalle(hoja, _cuerpo(request)), status=201)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def detalle_item(request, hoja, id_fila):
    if hoja not in HOJAS_VALIDAS:
        return JsonResponse({"error": "Tabla inválida"}, status=400)
    if request.method == "PUT":
        resultado = services.editar_detalle(hoja, id_fila, _cuerpo(request))
        return JsonResponse(resultado) if resultado else JsonResponse({"error": "No encontrado"}, status=404)
    if request.method == "DELETE":
        ok = services.borrar_detalle(hoja, id_fila)
        return JsonResponse({"eliminado": True}) if ok else JsonResponse({"error": "No encontrado"}, status=404)
    return JsonResponse({"error": "Método no permitido"}, status=405)
