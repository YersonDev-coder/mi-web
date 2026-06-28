"""Endpoints del módulo Ficha de Proceso."""
from django.urls import path
from . import views

urlpatterns = [
    path("fichas/arbol/", views.arbol),
    path("fichas/proceso/<int:id_proceso>/", views.ficha),
    path("fichas/proceso/<int:id_proceso>/diagrama/", views.diagrama),
    path("fichas/proceso/<int:id_proceso>/diagrama/drawio/", views.diagrama_drawio),
    path("fichas/proceso/<int:id_proceso>/diagrama/drawio/generar/", views.diagrama_drawio_generar),
    path("fichas/proceso/<int:id_proceso>/diagrama/preview/", views.diagrama_preview),
    path("fichas/proceso/<int:id_proceso>/diagrama/prompt/",  views.diagrama_prompt),
    path("fichas/proceso/<int:id_proceso>/diagrama/imagen/",  views.diagrama_imagen),
    path("fichas/proceso/<int:id_proceso>/completar-ia/", views.ficha_completar_ia),
    path("fichas/detalle/<str:hoja>/", views.detalle),
    path("fichas/detalle/<str:hoja>/<int:id_fila>/", views.detalle_item),
]
