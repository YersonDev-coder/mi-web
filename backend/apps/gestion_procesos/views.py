"""Controladores REST del módulo de Identificación de Procesos."""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from apps.autenticacion.auth import requiere_auth
from . import services


def _cuerpo(request):
    return json.loads(request.body or "{}")


@csrf_exempt
@requiere_auth
def procesos(request):
    """Colección: GET lista todos, POST crea uno nuevo."""
    if request.method == "GET":
        return JsonResponse(services.listar(), safe=False)
    if request.method == "POST":
        return JsonResponse(services.insertar(_cuerpo(request)), status=201)
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@requiere_auth
def proceso_detalle(request, identificador):
    """Recurso: PUT actualiza, DELETE elimina."""
    if request.method == "PUT":
        resultado = services.actualizar(identificador, _cuerpo(request))
        return JsonResponse(resultado, status=200) if resultado else JsonResponse({"error": "No encontrado"}, status=404)
    if request.method == "DELETE":
        ok = services.eliminar(identificador)
        return JsonResponse({"eliminado": True}) if ok else JsonResponse({"error": "No encontrado"}, status=404)
    return JsonResponse({"error": "Método no permitido"}, status=405)
