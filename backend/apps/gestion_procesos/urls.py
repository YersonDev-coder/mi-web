"""Endpoints del módulo de Identificación de Procesos."""
from django.urls import path
from . import views

urlpatterns = [
    path("procesos/", views.procesos),
    path("procesos/<int:identificador>/", views.proceso_detalle),
]
