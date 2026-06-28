"""Modelos del módulo de Inventario de Procesos (árbol jerárquico, niveles 0..4)."""
from django.db import models


class InventarioProceso(models.Model):
    """Árbol de procesos. Auto-referencia vía Padre_Id. Tabla central del sistema."""
    identificador = models.IntegerField(primary_key=True, db_column="Identificador")
    padre = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        db_column="Padre_Id",
        related_name="hijos",
    )
    nivel = models.IntegerField(default=0, db_column="Nivel")
    tipo_proceso = models.CharField(max_length=50, null=True, blank=True, db_column="Tipo_Proceso")
    nombre_proceso = models.CharField(max_length=500, null=True, blank=True, db_column="Nombre_Proceso")
    orden_consecutivo = models.IntegerField(default=0, null=True, blank=True, db_column="Orden_Consecutivo")
    objetivo_estrategico = models.TextField(null=True, blank=True)
    accion_estrategica = models.TextField(null=True, blank=True)
    id_usuario = models.IntegerField(null=True, blank=True, db_column="id_usuario")

    class Meta:
        db_table = "inventario_proceso"
        managed = False
