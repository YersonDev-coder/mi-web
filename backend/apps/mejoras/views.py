"""Controladores REST del módulo Ficha de Mejora de Proceso."""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from apps.autenticacion.auth import requiere_auth, procesos_de_usuario
from . import services


def _cuerpo(request):
    return json.loads(request.body or "{}")


@requiere_auth
def arbol(request):
    return JsonResponse(services.arbol(request.GET.get("tipo", "Estratégico"), request.user_id), safe=False)


@requiere_auth
def catalogos(request):
    return JsonResponse(services.catalogos())


@csrf_exempt
@requiere_auth
def mejora(request, id_proceso):
    if int(id_proceso) not in procesos_de_usuario(request.user_id):
        return JsonResponse({"error": "No autorizado"}, status=403)
    if request.method == "GET":
        return JsonResponse(services.obtener_por_proceso(id_proceso))
    if request.method == "PUT":
        return JsonResponse(services.guardar(id_proceso, _cuerpo(request)))
    if request.method == "DELETE":
        ok = services.eliminar(id_proceso)
        return JsonResponse({"eliminado": True}) if ok else JsonResponse({"error": "No encontrado"}, status=404)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@requiere_auth
def resultados(request):
    try:
        return JsonResponse(services.resultados_mejora())
    except PermissionError as e:
        return JsonResponse({"error": str(e)}, status=503)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
