"""Modelos del módulo Ficha de Proceso (5 tablas relacionadas)."""
from django.db import models


class FichaProceso(models.Model):
    """Datos maestros de la ficha. PK = id_proceso (1 ficha por proceso)."""
    id_proceso = models.IntegerField(primary_key=True)
    codigo = models.CharField(max_length=50, null=True, blank=True)
    nombre_proceso = models.CharField(max_length=500, null=True, blank=True)
    tipo_proceso = models.CharField(max_length=50, null=True, blank=True)
    dueno_proceso = models.CharField(max_length=300, null=True, blank=True)
    objetivo_general = models.TextField(null=True, blank=True)
    objetivo_estrategico = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ficha_proceso"
        managed = False


class FichaActividad(models.Model):
    """Hoja 'actividades'. IDs desde 100 (se generan en services)."""
    id_actividad = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    orden_secuencia = models.IntegerField(null=True, blank=True)
    descripcion_actividad = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ficha_actividad"
        managed = False


class FichaFlujoSipoc(models.Model):
    """Hoja 'flujo_sipoc'. IDs desde 500."""
    id_flujo = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    proveedor = models.TextField(null=True, blank=True)
    elemento_entrada = models.TextField(null=True, blank=True)
    producto = models.TextField(null=True, blank=True)
    receptor = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ficha_flujo_sipoc"
        managed = False


class FichaRiesgo(models.Model):
    """Hoja 'riesgos'. IDs desde 700."""
    id_riesgo = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    descripcion_riesgo = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ficha_riesgo"
        managed = False


class FichaRegistro(models.Model):
    """Hoja 'registros'. IDs desde 900."""
    id_registro = models.IntegerField(primary_key=True)
    id_proceso = models.IntegerField()
    nombre_titulo = models.CharField(max_length=500, null=True, blank=True)
    tipo = models.CharField(max_length=100, null=True, blank=True)
    caracteristicas = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "ficha_registro"
        managed = False


class DiagramaDrawio(models.Model):
    """Diagrama draw.io por proceso: guarda XML (editable) y SVG (visualización)."""
    id_proceso = models.IntegerField(primary_key=True)
    xml = models.TextField(null=True, blank=True)
    svg = models.TextField(null=True, blank=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "diagrama_drawio"
