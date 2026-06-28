# Automatización · Ingeniería de Procesos (Fase 1)

Software empresarial modular para la optimización de procesos. Arquitectura **totalmente desacoplada**: Backend API REST en Django + Frontend SPA en React. Esta primera fase implementa el módulo de **Identificación de Procesos**.

---

## 🏛️ Arquitectura

```
Automatizacion/
├── backend/                        # API REST (Django)
│   ├── manage.py
│   ├── requirements.txt
│   ├── db_excel/
│   │   └── base_procesos.xlsx      # BD simulada — SOLO Identificación de Procesos
│   ├── proyecto_api/
│   │   ├── settings.py             # CORS + app registrada
│   │   ├── urls.py                 # Enrutador global modular
│   │   └── wsgi.py
│   └── apps/
│       └── gestion_procesos/
│           ├── urls.py             # Endpoints del módulo
│           ├── views.py            # Controladores REST
│           └── services.py         # CRUD compacto con Pandas
└── frontend/                       # SPA (React + Vite)
    ├── package.json
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx                 # Enrutador principal
        ├── App.css                 # Estética empresarial premium
        ├── services/
        │   └── api.js              # Cliente HTTP
        └── views/
            └── IdentificacionProcesosView.jsx
```

### Filosofía de diseño
- **Persistencia en Excel aislada por módulo.** `base_procesos.xlsx` es exclusivo de la Identificación de Procesos. Cada métrica futura (Tiempos de ciclo, Cuellos de botella, Automatización local) tendrá **su propio archivo Excel** en `db_excel/`, con su propia capa `services.py` aislada.
- **Enrutamiento modular.** Tanto Django (`include` por módulo) como React (`<Routes>`) están preparados para sumar controladores de Web Scraping (BeautifulSoup), Bots (Selenium) y APIs externas sin tocar lo existente.
- **Código corto y eficiente.** El CRUD se resuelve con métodos nativos de Pandas. En React un único formulario genérico controla creación y edición.

---

## ⚙️ Requisitos previos
- Python 3.10+
- Node.js 18+

---

## 🚀 Puesta en marcha

### 1) Backend (puerto 8000)

```bash
cd Automatizacion/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

> El archivo `base_procesos.xlsx` se **crea automáticamente vacío** en el primer acceso si no existe.

### 2) Frontend (puerto 5173)

```bash
cd Automatizacion/frontend
npm install
npm run dev
```

Abrir el navegador en **http://localhost:5173**

---

## 🔌 Endpoints de la API

| Método | Ruta                          | Acción                  |
|--------|-------------------------------|-------------------------|
| GET    | `/api/procesos/`              | Listar todos            |
| POST   | `/api/procesos/`              | Crear proceso           |
| PUT    | `/api/procesos/<id>/`         | Actualizar proceso      |
| DELETE | `/api/procesos/<id>/`         | Eliminar proceso        |

**Cuerpo JSON (POST / PUT):**
```json
{
  "Tipo_Proceso": "Misional",
  "Nombre_Proceso": "Gestión Comercial",
  "Orden_Consecutivo": 1
}
```
El `Identificador` se genera automáticamente.

---

## 🧭 Uso de la interfaz

1. **Formulario de gestión** (izquierda): registra el Nombre, Tipo (Estratégico / Misional / Apoyo) y Orden Consecutivo. El botón **Guardar** crea; al seleccionar una tarjeta cambia a **Modificar** y habilita **Eliminar**.
2. **Mapa de procesos** (derecha): distribuye los datos en tres bandas ordenadas por `Orden_Consecutivo`:
   - **Superior:** Procesos Estratégicos
   - **Central:** Procesos Misionales (flujo horizontal *Proveedor → Cliente*)
   - **Inferior:** Procesos de Apoyo
3. **Edición rápida:** un clic en cualquier tarjeta del mapa puebla el formulario para editar.

---

## 🗺️ Roadmap (próximas fases)
- Módulo de Tiempos de ciclo (`db_excel/tiempos_ciclo.xlsx`)
- Módulo de Cuellos de botella
- Controlador de Web Scraping (BeautifulSoup)
- Bots de automatización (Selenium)
- Consumo de APIs externas

Cada módulo se añade como nueva app en `apps/`, su Excel propio en `db_excel/` y su vista en `frontend/src/views/`.
