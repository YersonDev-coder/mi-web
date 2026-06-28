"""Endpoints del módulo de Inventario de Procesos."""
from django.urls import path
from . import views

urlpatterns = [
    path("inventario/", views.hijos),
    path("inventario/completo/", views.inventario_completo),
    path("inventario/<int:identificador>/", views.detalle),
    path("inventario/<int:identificador>/ruta/", views.ruta),
]
