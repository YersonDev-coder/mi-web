"""
Comando: python manage.py inicializar_admin

Crea el primer usuario administrador y asigna TODOS los datos
existentes en la base de datos a ese usuario.

Uso:
    python manage.py inicializar_admin
    python manage.py inicializar_admin --username carlos --email correo@empresa.com
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import connection, transaction


class Command(BaseCommand):
    help = "Crea el usuario admin inicial y asigna todos los datos existentes a él"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin",  help="Nombre de usuario (default: admin)")
        parser.add_argument("--email",    default="",       help="Correo electrónico")
        parser.add_argument("--password", default="",       help="Contraseña (se pedirá si no se provee)")
        parser.add_argument("--nombre",   default="",       help="Nombre completo")
        parser.add_argument("--org",      default="",       help="Organización")

    def handle(self, *args, **options):
        username = options["username"]
        email    = options["email"]
        password = options["password"]
        nombre   = options["nombre"]
        org      = options["org"]

        if not password:
            import getpass
            self.stdout.write(f"\nCreando usuario: {username}")
            password  = getpass.getpass("Contraseña: ")
            password2 = getpass.getpass("Confirmar contraseña: ")
            if password != password2:
                self.stderr.write(self.style.ERROR("Las contraseñas no coinciden."))
                return

        with transaction.atomic():
            # ── 1. Crear o recuperar el usuario ──────────────────────────────
            usuario, creado = User.objects.get_or_create(
                username=username,
                defaults={"email": email, "is_staff": True, "is_superuser": False},
            )
            if creado:
                usuario.set_password(password)
                usuario.save()
                self.stdout.write(self.style.SUCCESS(f"✔ Usuario '{username}' creado (id={usuario.id})"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠ Usuario '{username}' ya existe (id={usuario.id}). Usando su id."))

            # ── 2. Crear o actualizar perfil ──────────────────────────────────
            try:
                from apps.autenticacion.models import Perfil
                perfil, _ = Perfil.objects.get_or_create(usuario=usuario)
                perfil.rol = "admin"
                if nombre: perfil.nombre_completo = nombre
                if org:    perfil.organizacion     = org
                perfil.save()
                self.stdout.write(self.style.SUCCESS("✔ Perfil creado/actualizado"))
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"⚠ No se pudo crear perfil: {e}"))

            uid = usuario.id

            # ── 3. Asignar datos existentes al usuario ────────────────────────
            with connection.cursor() as cur:
                # inventario_proceso: todos los registros sin dueño
                cur.execute(
                    "UPDATE inventario_proceso SET id_usuario = %s WHERE id_usuario IS NULL",
                    [uid],
                )
                n_inv = cur.rowcount
                self.stdout.write(self.style.SUCCESS(f"✔ inventario_proceso: {n_inv} registros asignados"))

                # ss_definicion: todos los proyectos DMAIC sin dueño
                try:
                    cur.execute(
                        "UPDATE ss_definicion SET id_usuario = %s WHERE id_usuario IS NULL",
                        [uid],
                    )
                    n_ss = cur.rowcount
                    self.stdout.write(self.style.SUCCESS(f"✔ ss_definicion: {n_ss} registros asignados"))
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"⚠ ss_definicion: {e} (ejecuta el SQL ALTER TABLE primero)"))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(self.style.SUCCESS(f"  LISTO — Usuario: {username}  |  ID: {uid}"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write("")
        self.stdout.write("  Ahora ejecuta el SQL en pgAdmin si aún no lo has hecho,")
        self.stdout.write("  luego inicia sesión en /login con estas credenciales.")
        self.stdout.write("")
