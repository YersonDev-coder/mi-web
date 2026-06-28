from django.urls import path
from . import views as v

urlpatterns = [
    # Carga de datos desde Excel existente (read-only)
    path("ss/carga/archivos/",        v.carga_archivos),
    path("ss/carga/hojas/",           v.carga_hojas),
    path("ss/carga/previsualizar/",   v.carga_previsualizar),
    path("ss/carga/importar/",        v.carga_importar),

    # DEFINE
    path("ss/definicion/",                     v.definicion),
    path("ss/definicion/<str:id_def>/",        v.definicion_detalle),
    path("ss/validar/<str:id_def>/",           v.validar_fase),

    # MEASURE
    path("ss/mediciones/<str:id_def>/",        v.mediciones),
    path("ss/medicion/<str:id_med>/",          v.medicion_detalle),

    # ANALYZE - orden específico primero para evitar ambigüedad
    path("ss/ishikawa/causa/<str:id_causa>/",  v.ishikawa_detalle),
    path("ss/ishikawa/<str:id_def>/",          v.ishikawa),
    path("ss/porques/detalle/<str:id_porq>/",  v.porques_detalle),
    path("ss/porques/<str:id_def>/",           v.porques),
    path("ss/analisis/<str:id_def>/pareto/",   v.analisis_pareto),
    path("ss/analisis/<str:id_def>/temporal/", v.analisis_temporal),

    # IMPROVE
    path("ss/mejoras/<str:id_def>/",           v.mejoras),
    path("ss/mejora/<str:id_mej>/",            v.mejora_detalle),

    # CONTROL
    path("ss/control/<str:id_def>/plan/",      v.plan_control),
    path("ss/control/<str:id_def>/carta/",     v.carta_control),
    path("ss/ctrl/<str:id_ctrl>/",             v.control_detalle),

    # HISTÓRICO y DASHBOARD
    path("ss/historico/",                      v.historico),
    path("ss/dashboard/",                      v.dashboard),

    # IMPORTAR DESDE SISTEMA DE INDICADORES
    path("ss/sistema/procesos/",                      v.sistema_procesos),
    path("ss/sistema/crear-desde/",                   v.sistema_crear_desde),
    path("ss/sistema/reimportar/<str:id_def>/",       v.sistema_reimportar),
]
