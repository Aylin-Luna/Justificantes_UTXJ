# Frontend — Justificantes UTXJ

Interfaz institucional en HTML5, CSS propio y JavaScript ES Modules. No requiere bundler ni dependencias de CDN.

## Ejecución

El frontend lo sirve el backend:

```bash
npm start
```

Abra `http://localhost:3000`.

## Estructura

```text
frontend/
├── public/
│   ├── index.html        Login
│   ├── app.html          Shell de la aplicación
│   ├── imprimir.html     Vista imprimible A4
│   └── 404.html
└── src/
    ├── assets/
    │   ├── css/styles.css    Sistema de diseño institucional
    │   └── img/              logo-utxj.svg, favicon.svg
    ├── components/           Componentes compartidos
    ├── views/                Vistas por rol
    ├── api.js                Cliente HTTP, CSRF y manejo de errores
    ├── auth.js               Sesión, roles y utilidades de usuario
    ├── icons.js              Iconografía SVG
    ├── login.js              Pantalla de acceso
    ├── main.js               Router hash y shell
    ├── print.js              Render de la hoja imprimible
    └── ui.js                 Modales, toasts, badges y helpers DOM
```

## Rutas

| Ruta | Vista | Roles |
| --- | --- | --- |
| `#/inicio` | Dashboard | Todos |
| `#/justificantes` | Listado y filtros | Todos |
| `#/justificantes/nuevo` | Alta | Alumno |
| `#/justificantes/:id` | Detalle y flujo | Según alcance |
| `#/justificantes/:id/editar` | Edición | Alumno / admin |
| `#/usuarios` | Administración de usuarios | Admin |
| `#/configuracion` | Parámetros y catálogos | Admin |
| `#/auditoria` | Bitácora | Admin |
| `#/perfil` | Cuenta y contraseña | Todos |

La ruta pública `/imprimir?id=<id>` carga `imprimir.html` y `print.js`.

## Características de UI

- Barra lateral adaptada a los roles del usuario.
- Dashboards con indicadores y colas de trabajo.
- Tablas con filtros, búsqueda, paginación y estado en la URL.
- Formularios con validación en cliente y mensajes del servidor.
- Modales reutilizables, toasts y estados vacíos.
- Diseño responsive, accesible y con soporte de movimiento reducido.
- Marca de agua **VISTA PREVIA** en impresión no aprobada.

## Seguridad en el cliente

- No se almacena el JWT en `localStorage`; la sesión viaja en cookie `HttpOnly`.
- El token CSRF se lee de la cookie `utxj_csrf` y se envía en `X-CSRF-Token`.
- Las respuestas se escapan antes de insertarse en el DOM.
- La CSP del servidor permite solo recursos propios y `data:` para imágenes.

## Notas

- El CSS es la única fuente de estilos; no se usa Bootstrap ni Tailwind.
- Los SVG de firmas y sellos se insertan como `data:image/svg+xml` en la vista imprimible.
- Para cambios de diseño, edite `src/assets/css/styles.css`.
