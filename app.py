"""
Editor visual de Diagramas de Actividades (UML)
================================================
Dibuja nodos con el mouse y conéctalos para construir un diagrama
de actividades. No requiere instalar librerías: usa Tkinter (incluido
en Python).

USO RÁPIDO
----------
1. Elige un tipo de nodo en la barra de herramientas (izquierda).
2. Haz clic en el lienzo para colocarlo.
3. Para conectar: pulsa "Conectar", haz clic en el nodo origen y
   luego en el nodo destino.
4. Para mover un nodo: pulsa "Seleccionar" y arrástralo.
5. Doble clic sobre un nodo para renombrarlo.
6. Botón derecho sobre un nodo o flecha para eliminarlo.

TIPOS DE NODO
-------------
- Inicio  (círculo negro)
- Acción  (rectángulo redondeado)
- Decisión (rombo)
- Fork/Join (barra)
- Fin     (círculo con borde)
"""

import tkinter as tk
from tkinter import simpledialog, messagebox, filedialog
import math
import os


class Nodo:
    def __init__(self, canvas, tipo, x, y, texto=""):
        self.canvas = canvas
        self.tipo = tipo
        self.x = x
        self.y = y
        self.texto = texto or self._texto_por_defecto()
        self.ids = []          # ids de canvas que forman el nodo
        self.text_id = None
        self.dibujar()

    def _texto_por_defecto(self):
        return {
            "inicio": "",
            "fin": "",
            "accion": "Acción",
            "decision": "¿Condición?",
            "fork": "",
        }.get(self.tipo, "Nodo")

    # ---------- dibujo ----------
    def dibujar(self):
        self.borrar_dibujo()
        c = self.canvas
        x, y = self.x, self.y

        if self.tipo == "inicio":
            r = 16
            self.ids.append(c.create_oval(x-r, y-r, x+r, y+r,
                                          fill="#222", outline="#222",
                                          tags=("nodo", self.tag())))

        elif self.tipo == "fin":
            r = 16
            self.ids.append(c.create_oval(x-r, y-r, x+r, y+r,
                                          fill="white", outline="#222",
                                          width=2, tags=("nodo", self.tag())))
            self.ids.append(c.create_oval(x-9, y-9, x+9, y+9,
                                          fill="#222", outline="#222",
                                          tags=("nodo", self.tag())))

        elif self.tipo == "accion":
            w, h = 110, 50
            self.ids.append(self._rounded_rect(x-w/2, y-h/2, x+w/2, y+h/2,
                                               r=14, fill="#cfe8ff",
                                               outline="#2b7bbd", width=2))
            self.text_id = c.create_text(x, y, text=self.texto,
                                         width=w-12, tags=("nodo", self.tag()))

        elif self.tipo == "decision":
            s = 38
            pts = [x, y-s, x+s, y, x, y+s, x-s, y]
            self.ids.append(c.create_polygon(pts, fill="#fff3cd",
                                             outline="#c79a17", width=2,
                                             tags=("nodo", self.tag())))
            self.text_id = c.create_text(x, y, text=self.texto,
                                         width=2*s-10, tags=("nodo", self.tag()))

        elif self.tipo == "fork":
            w, h = 90, 10
            self.ids.append(c.create_rectangle(x-w/2, y-h/2, x+w/2, y+h/2,
                                               fill="#222", outline="#222",
                                               tags=("nodo", self.tag())))

        # ids de texto también deben tener el tag para arrastrarse juntos
        if self.text_id:
            self.ids.append(self.text_id)

    def _rounded_rect(self, x1, y1, x2, y2, r=12, **kw):
        c = self.canvas
        pts = [x1+r, y1, x2-r, y1, x2, y1, x2, y1+r, x2, y2-r, x2, y2,
               x2-r, y2, x1+r, y2, x1, y2, x1, y2-r, x1, y1+r, x1, y1]
        return c.create_polygon(pts, smooth=True,
                                tags=("nodo", self.tag()), **kw)

    def borrar_dibujo(self):
        for i in self.ids:
            self.canvas.delete(i)
        self.ids = []
        self.text_id = None

    def tag(self):
        return f"nodo_{id(self)}"

    def mover(self, dx, dy):
        self.x += dx
        self.y += dy
        self.canvas.move(self.tag(), dx, dy)

    def renombrar(self, nuevo):
        self.texto = nuevo
        if self.text_id:
            self.canvas.itemconfig(self.text_id, text=nuevo)

    # punto del borde más cercano hacia otro nodo (para flechas)
    def punto_borde(self, hacia_x, hacia_y):
        ang = math.atan2(hacia_y - self.y, hacia_x - self.x)
        if self.tipo in ("inicio", "fin"):
            r = 16
            return self.x + r*math.cos(ang), self.y + r*math.sin(ang)
        if self.tipo == "decision":
            s = 38
            return self.x + s*math.cos(ang), self.y + s*math.sin(ang)
        if self.tipo == "fork":
            return self.x, self.y + (5 if hacia_y > self.y else -5)
        # accion
        w, h = 55, 25
        cx = max(-w, min(w, w * math.cos(ang) /
                         (abs(math.sin(ang)) + 1e-9)))
        cy = max(-h, min(h, h * math.sin(ang) /
                         (abs(math.cos(ang)) + 1e-9)))
        return self.x + cx, self.y + cy


class Conexion:
    def __init__(self, canvas, origen, destino, etiqueta=""):
        self.canvas = canvas
        self.origen = origen
        self.destino = destino
        self.etiqueta = etiqueta
        self.line_id = None
        self.label_id = None
        self.tag = f"con_{id(self)}"
        self.redibujar()

    def redibujar(self):
        if self.line_id:
            self.canvas.delete(self.line_id)
        if self.label_id:
            self.canvas.delete(self.label_id)
        x1, y1 = self.origen.punto_borde(self.destino.x, self.destino.y)
        x2, y2 = self.destino.punto_borde(self.origen.x, self.origen.y)
        self.line_id = self.canvas.create_line(
            x1, y1, x2, y2, arrow=tk.LAST, width=2, fill="#444",
            tags=("conexion", self.tag))
        if self.etiqueta:
            mx, my = (x1+x2)/2, (y1+y2)/2
            self.label_id = self.canvas.create_text(
                mx, my-10, text=self.etiqueta, fill="#333",
                font=("Arial", 8), tags=("conexion", self.tag))


class App:
    def __init__(self, root):
        self.root = root
        root.title("Editor de Diagrama de Actividades")
        self.nodos = []
        self.conexiones = []
        self.modo = "seleccionar"
        self.tipo_actual = "accion"
        self.nodo_origen = None
        self.arrastrando = None
        self.last_xy = (0, 0)

        self._construir_ui()

    def _construir_ui(self):
        barra = tk.Frame(self.root, bg="#f0f0f0", width=160)
        barra.pack(side=tk.LEFT, fill=tk.Y)

        tk.Label(barra, text="Herramientas", bg="#f0f0f0",
                 font=("Arial", 10, "bold")).pack(pady=8)

        botones = [
            ("Seleccionar / Mover", lambda: self.set_modo("seleccionar")),
            ("Conectar", lambda: self.set_modo("conectar")),
            ("— Nodos —", None),
            ("● Inicio", lambda: self.set_nodo("inicio")),
            ("▭ Acción", lambda: self.set_nodo("accion")),
            ("◆ Decisión", lambda: self.set_nodo("decision")),
            ("▬ Fork/Join", lambda: self.set_nodo("fork")),
            ("◉ Fin", lambda: self.set_nodo("fin")),
        ]
        for texto, cmd in botones:
            if cmd is None:
                tk.Label(barra, text=texto, bg="#f0f0f0",
                         font=("Arial", 9, "italic")).pack(pady=(10, 2))
            else:
                tk.Button(barra, text=texto, width=18,
                          command=cmd).pack(pady=2)

        tk.Button(barra, text="💾 Guardar imagen", width=18, fg="#0a6",
                  command=self.guardar_imagen).pack(pady=(20, 2))

        tk.Button(barra, text="Limpiar todo", width=18, fg="red",
                  command=self.limpiar).pack(pady=2)

        self.estado = tk.Label(barra, text="", bg="#f0f0f0",
                               wraplength=150, fg="#0a6",
                               font=("Arial", 8))
        self.estado.pack(pady=10)

        self.canvas = tk.Canvas(self.root, bg="white", width=720, height=560)
        self.canvas.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True)

        self.canvas.bind("<Button-1>", self.click)
        self.canvas.bind("<B1-Motion>", self.arrastrar)
        self.canvas.bind("<ButtonRelease-1>", self.soltar)
        self.canvas.bind("<Double-Button-1>", self.doble_click)
        self.canvas.bind("<Button-3>", self.click_derecho)

        self.set_modo("seleccionar")

    # ---------- estado ----------
    def set_modo(self, modo):
        self.modo = modo
        self.nodo_origen = None
        msj = {"seleccionar": "Modo: Seleccionar/Mover. Arrastra nodos.",
               "conectar": "Modo: Conectar. Clic en origen y luego destino."}
        self.estado.config(text=msj.get(modo, ""))

    def set_nodo(self, tipo):
        self.modo = "colocar"
        self.tipo_actual = tipo
        self.estado.config(text=f"Clic en el lienzo para colocar: {tipo}")

    # ---------- eventos ----------
    def click(self, e):
        if self.modo == "colocar":
            n = Nodo(self.canvas, self.tipo_actual, e.x, e.y)
            self.nodos.append(n)
            if self.tipo_actual in ("accion", "decision"):
                self.set_modo("seleccionar")

        elif self.modo == "conectar":
            n = self.nodo_en(e.x, e.y)
            if n:
                if self.nodo_origen is None:
                    self.nodo_origen = n
                    self.estado.config(text="Ahora clic en el nodo destino.")
                elif n is not self.nodo_origen:
                    etq = ""
                    if self.nodo_origen.tipo == "decision":
                        etq = simpledialog.askstring(
                            "Etiqueta",
                            "Condición de la rama (sí/no, etc.):") or ""
                    self.conexiones.append(
                        Conexion(self.canvas, self.nodo_origen, n, etq))
                    self.nodo_origen = None
                    self.estado.config(text="Conexión creada.")

        elif self.modo == "seleccionar":
            self.arrastrando = self.nodo_en(e.x, e.y)
            self.last_xy = (e.x, e.y)

    def arrastrar(self, e):
        if self.modo == "seleccionar" and self.arrastrando:
            dx = e.x - self.last_xy[0]
            dy = e.y - self.last_xy[1]
            self.arrastrando.mover(dx, dy)
            self.last_xy = (e.x, e.y)
            self.redibujar_conexiones(self.arrastrando)

    def soltar(self, e):
        self.arrastrando = None

    def doble_click(self, e):
        n = self.nodo_en(e.x, e.y)
        if n and n.tipo in ("accion", "decision"):
            nuevo = simpledialog.askstring("Renombrar", "Texto del nodo:",
                                           initialvalue=n.texto)
            if nuevo is not None:
                n.renombrar(nuevo)

    def click_derecho(self, e):
        n = self.nodo_en(e.x, e.y)
        if n and messagebox.askyesno("Eliminar", "¿Eliminar este nodo?"):
            self.eliminar_nodo(n)
            return
        # ¿flecha?
        item = self.canvas.find_closest(e.x, e.y)
        tags = self.canvas.gettags(item)
        for t in tags:
            if t.startswith("con_"):
                con = next((c for c in self.conexiones if c.tag == t), None)
                if con and messagebox.askyesno("Eliminar", "¿Eliminar flecha?"):
                    self.canvas.delete(con.tag)
                    self.conexiones.remove(con)
                return

    # ---------- utilidades ----------
    def nodo_en(self, x, y):
        for n in reversed(self.nodos):
            if abs(n.x - x) < 55 and abs(n.y - y) < 30:
                return n
        return None

    def redibujar_conexiones(self, nodo):
        for c in self.conexiones:
            if c.origen is nodo or c.destino is nodo:
                c.redibujar()

    def eliminar_nodo(self, nodo):
        for c in [c for c in self.conexiones
                  if c.origen is nodo or c.destino is nodo]:
            self.canvas.delete(c.tag)
            self.conexiones.remove(c)
        self.canvas.delete(nodo.tag())
        self.nodos.remove(nodo)

    def guardar_imagen(self):
        if not self.nodos:
            messagebox.showinfo("Guardar", "El diagrama está vacío.")
            return

        # Intentar PNG directo con Pillow
        try:
            from PIL import Image  # noqa
            ruta = filedialog.asksaveasfilename(
                defaultextension=".png",
                filetypes=[("Imagen PNG", "*.png"),
                           ("PostScript", "*.ps")],
                title="Guardar diagrama como imagen")
            if not ruta:
                return
            self._guardar_png(ruta)
            return
        except ImportError:
            pass

        # Sin Pillow: exportar a PostScript (Tkinter puro)
        ruta = filedialog.asksaveasfilename(
            defaultextension=".ps",
            filetypes=[("PostScript", "*.ps")],
            title="Guardar diagrama (PostScript)")
        if not ruta:
            return
        self._guardar_ps(ruta)
        messagebox.showinfo(
            "Guardado",
            "Se guardó en formato PostScript (.ps).\n\n"
            "Para obtener PNG directamente, instala Pillow:\n"
            "    pip install pillow\n\n"
            "También puedes abrir el .ps y exportarlo a imagen "
            "desde un visor (p. ej. GIMP o IrfanView).")

    def _bbox_diagrama(self):
        """Calcula el recuadro que contiene todo el dibujo."""
        bbox = self.canvas.bbox("all")
        if not bbox:
            return None
        m = 20  # margen
        x1, y1, x2, y2 = bbox
        return (max(0, x1 - m), max(0, y1 - m), x2 + m, y2 + m)

    def _guardar_ps(self, ruta):
        bb = self._bbox_diagrama()
        x1, y1, x2, y2 = bb
        self.canvas.postscript(file=ruta, colormode="color",
                               x=x1, y=y1,
                               width=x2 - x1, height=y2 - y1)

    def _guardar_png(self, ruta):
        from PIL import Image
        import io

        bb = self._bbox_diagrama()
        x1, y1, x2, y2 = bb
        ps = self.canvas.postscript(colormode="color",
                                    x=x1, y=y1,
                                    width=x2 - x1, height=y2 - y1)
        try:
            img = Image.open(io.BytesIO(ps.encode("utf-8")))
            img.load(scale=3)  # mayor resolución
        except Exception:
            # Pillow necesita Ghostscript para leer PostScript.
            # Fallback: guardar como .ps avisando al usuario.
            ps_path = os.path.splitext(ruta)[0] + ".ps"
            self._guardar_ps(ps_path)
            messagebox.showwarning(
                "Aviso",
                "Pillow está instalado pero falta Ghostscript para "
                "convertir a PNG.\n\n"
                f"Se guardó como PostScript:\n{ps_path}\n\n"
                "Instala Ghostscript (https://ghostscript.com) para "
                "exportar a PNG directamente.")
            return

        if ruta.lower().endswith(".ps"):
            self._guardar_ps(ruta)
        else:
            img.save(ruta, "PNG")
        messagebox.showinfo("Guardado",
                            f"Diagrama guardado en:\n{ruta}")

    def limpiar(self):
        if messagebox.askyesno("Limpiar", "¿Borrar todo el diagrama?"):
            self.canvas.delete("all")
            self.nodos.clear()
            self.conexiones.clear()


if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()