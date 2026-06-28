"""Endpoints del módulo Ficha de Mejora de Proceso."""
from django.urls import path
from . import views

urlpatterns = [
    path("mejoras/arbol/", views.arbol),
    path("mejoras/catalogos/", views.catalogos),
    path("mejoras/proceso/<int:id_proceso>/", views.mejora),
    path("mejoras/resultados/", views.resultados),
]
