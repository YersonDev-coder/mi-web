"""Controladores REST del módulo Ficha de Indicador."""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from apps.autenticacion.auth import requiere_auth, procesos_de_usuario
from . import services

HOJAS_VALIDAS = {"rangos", "logros", "avance", "objetivos", "acciones"}


def _handle(fn):
    try:
        return fn()
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=503)


def _cuerpo(request):
    return json.loads(request.body or "{}")


def _ok_proceso(id_proceso, user_id):
    return int(id_proceso) in procesos_de_usuario(user_id)


def _ok_indicador(id_indicador, user_id):
    """Verifica que el indicador pertenece a un proceso del usuario."""
    from .models import Indicador
    ind = Indicador.objects.filter(id_indicador=id_indicador).first()
    if ind is None:
        return False
    return int(ind.id_proceso) in procesos_de_usuario(user_id)


@requiere_auth
def arbol(request):
    return JsonResponse(services.arbol(request.GET.get("tipo", "Estratégico"), request.user_id), safe=False)


@csrf_exempt
@requiere_auth
def indicadores_de_proceso(request, id_proceso):
    if not _ok_proceso(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if request.method == "GET":
        return JsonResponse(services.listar_por_proceso(id_proceso), safe=False)
    if request.method == "POST":
        return _handle(lambda: JsonResponse(services.crear_indicador(id_proceso, _cuerpo(request)), status=201))
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def indicador(request, id_indicador):
    if not _ok_indicador(id_indicador, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if request.method == "GET":
        return JsonResponse(services.obtener(id_indicador))
    if request.method == "PUT":
        return _handle(lambda: JsonResponse(services.actualizar_indicador(id_indicador, _cuerpo(request)) or {"error": "No encontrado"}))
    if request.method == "DELETE":
        return _handle(lambda: JsonResponse({"eliminado": True}) if services.eliminar_indicador(id_indicador) else JsonResponse({"error": "No encontrado"}, status=404))
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def generar_cronograma(request, id_indicador):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _ok_indicador(id_indicador, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    d = _cuerpo(request)
    def _exec():
        r = services.generar_cronograma(id_indicador, d.get("frecuencia", "mensual"), d.get("inicio"), d.get("fin"))
        estado = 400 if isinstance(r, dict) and r.get("error") == "bloqueado" else 200
        return JsonResponse(r, status=estado)
    return _handle(_exec)


@csrf_exempt
@requiere_auth
def detalle(request, hoja):
    if hoja not in HOJAS_VALIDAS:
        return JsonResponse({"error": "Tabla inválida"}, status=400)
    if request.method == "POST":
        return _handle(lambda: JsonResponse(services.agregar(hoja, _cuerpo(request)), status=201))
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def linea_base(request, id_indicador):
    if request.method != "PUT":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _ok_indicador(id_indicador, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    d = _cuerpo(request)
    return _handle(lambda: JsonResponse(
        services.actualizar_linea_base(id_indicador, d.get("anio"), d.get("valor"))
    ))


@csrf_exempt
@requiere_auth
def cronograma_global(request):
    if request.method == "GET":
        return JsonResponse(services.obtener_cronograma_global())
    if request.method == "POST":
        d = _cuerpo(request)
        r = services.generar_cronograma_global(
            d.get("fecha_inicio", ""), d.get("fecha_fin", ""),
            d.get("frecuencia", "mensual"), float(d.get("meta_final", 100)),
            tipo_proceso=d.get("tipo_proceso") or None,
            user_id=request.user_id,
        )
        return JsonResponse(r, status=400 if isinstance(r, dict) and r.get("error") else 200)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def propagar_cronograma(request, id_indicador):
    if request.method != "POST":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _ok_indicador(id_indicador, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    r = services.propagar_cronograma(id_indicador)
    return JsonResponse(r, status=400 if isinstance(r, dict) and r.get("error") else 200)


@requiere_auth
def reporte(request):
    hasta = request.GET.get("hasta", None)
    return JsonResponse(services.reporte_avance(hasta=hasta, user_id=request.user_id), safe=False)


@requiere_auth
def periodos_reporte(request):
    return JsonResponse(services.periodos_disponibles(user_id=request.user_id), safe=False)


@requiere_auth
def migrar_codigos(request):
    return _handle(lambda: (services.migrar_codigos(), JsonResponse({"ok": True}))[1])


@requiere_auth
def asegurar_rangos(request):
    return _handle(lambda: (services._asegurar_rangos_todos(), JsonResponse({"ok": True}))[1])


@requiere_auth
def estados_proceso(request):
    return JsonResponse(services.obtener_estados_proceso())


@csrf_exempt
@requiere_auth
def estado_proceso_item(request, id_proceso):
    if request.method != "PATCH":
        return JsonResponse({"error": "Método no permitido"}, status=405)
    if not _ok_proceso(id_proceso, request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    d = _cuerpo(request)
    try:
        return JsonResponse(services.actualizar_estado_proceso(id_proceso, d.get("estado", "en_ejecucion")))
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)


@requiere_auth
def reporte_identificacion(request):
    tipo       = request.GET.get("tipo")       or None
    id_proceso = request.GET.get("id_proceso") or None
    return _handle(lambda: JsonResponse(
        services.reporte_identificacion(tipo_proceso=tipo, id_proceso=id_proceso, user_id=request.user_id)
    ))


@csrf_exempt
@requiere_auth
def config(request):
    if request.method == "GET":
        clave = request.GET.get("clave", "")
        return JsonResponse({"clave": clave, "valor": services.obtener_config(clave)})
    if request.method == "POST":
        d = _cuerpo(request)
        return _handle(lambda: (services.guardar_config(d.get("clave", ""), d.get("valor", "")),
                                JsonResponse({"ok": True}))[1])
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def detalle_item(request, hoja, id_fila):
    if hoja not in HOJAS_VALIDAS:
        return JsonResponse({"error": "Tabla inválida"}, status=400)
    if request.method == "PUT":
        return _handle(lambda: JsonResponse(services.editar(hoja, id_fila, _cuerpo(request)) or {"error": "No encontrado"}))
    if request.method == "DELETE":
        return _handle(lambda: JsonResponse({"eliminado": True}) if services.borrar(hoja, id_fila) else JsonResponse({"error": "No encontrado"}, status=404))
    return JsonResponse({"error": "Método no permitido"}, status=405)
