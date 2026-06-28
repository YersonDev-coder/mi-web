"""Modelos del módulo de Identificación de Procesos (base_procesos)."""
from django.db import models


class BaseProceso(models.Model):
    """Equivale a base_procesos.xlsx. Sembrado inicial de procesos raíz."""
    identificador = models.IntegerField(primary_key=True, db_column="Identificador")
    tipo_proceso = models.CharField(max_length=50, null=True, blank=True, db_column="Tipo_Proceso")
    nombre_proceso = models.CharField(max_length=500, null=True, blank=True, db_column="Nombre_Proceso")
    orden_consecutivo = models.IntegerField(default=0, null=True, blank=True, db_column="Orden_Consecutivo")

    class Meta:
        db_table = "base_proceso"
        managed = False
