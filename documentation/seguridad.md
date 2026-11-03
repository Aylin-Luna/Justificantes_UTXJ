# Seguridad — Sistema de Justificantes Académicos UTXJ

## 1. Autenticación

| Medida | Implementación | Notas |
| --- | --- | --- |
| Contraseñas | `bcryptjs` (hash) | Nunca se almacena texto plano. `password_hash` en `tb_users`. |
| Sesión | JWT en cookie `HttpOnly` | `utxj_sesion`. Configurable en `config/cookie`. |
| Expiración | `JWT_EXPIRES_IN` (8h por defecto) | Renovación implícita al reautenticar. |
| Bloqueo por intentos | `failed_attempts` + `locked_until` | Límite configurable (`LOGIN_MAX_ATTEMPTS`). |
| Cierre de sesión | `/api/auth/logout` | Limpia cookie de sesión y token CSRF. |
| Contraseña mínima | `password_min_length` | Validado en restablecimiento desde admin. |

## 2. Autorización (RBAC)

- Roles: `alumno`, `tutor`, `directora`, `admin`. Relación N:M vía `tbd_user_roles`.
- Middlewares: `authenticate`, `requireRole(...roles)`, `requireStudent`.
- Alcance por carrera: `tb_academic_staff` vincula usuario a carrera/tutoría/dirección.
- Alcance institucional: `admin` o personal sin `id_career` asignado.
- Verificación a nivel de servicio: propiedad (`created_by` / `id_student`) y estado antes de cada mutación.

## 3. Protección CSRF

| Medida | Implementación | Notas |
| --- | --- | --- |
| Cookie doble envío | `utxj_csrf` | `HttpOnly: false`, `SameSite: Strict`, `Secure` en producción. |
| Cabecera obligatoria | `X-CSRF-Token` | Requerida en métodos `POST`, `PUT`, `PATCH`, `DELETE`. |
| Métodos seguros | `GET`, `HEAD`, `OPTIONS` | Exentos. |
| Comparación segura | `crypto.timingSafeEqual` | Previene timing attacks. |

## 4. Cabeceras HTTP

Configurado con `helmet`:
- `Content-Security-Policy`: `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `font-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: same-origin`
- `X-Powered-By` deshabilitado
- `HSTS` habilitado solo en producción
- `Cross-Origin-Embedder-Policy: false` (necesario para servir imágenes SVG/data)

## 5. Rate limiting

| Endpoint | Límite | Aplicación |
| --- | --- | --- |
| `/api/auth/login` | `loginLimiter` | Por IP, configurable. |
| `/api/*` (escritura) | `writeLimiter` / `apiLimiter` | `express-rate-limit` con ventana deslizante. |

## 6. Carga de archivos

| Medida | Valor | Notas |
| --- | --- | --- |
| Formatos | `.pdf`, `.jpg`, `.jpeg`, `.png` | Validación por extensión y tipo MIME. |
| Tamaño máximo | 5 MB (`MAX_FILE_SIZE_MB`) | Validado por `multer`. |
| Almacenamiento | `uploads/comprobantes/`, `uploads/firmas/`, `uploads/sellos/` | Fuera de `public/`. Acceso controlado por ruta protegida. |
| Nombre aleatorio | `uuid`/aleatorio | Impide adivinación de rutas. |
| Integridad | `SHA-256` | Almacenado en `tb_supporting_documents`, `tb_justification_signatures`, `tb_institutional_stamps`. |
| Privacidad | `is_private = 1` | Metadatos marcan documentos privados. |

## 7. Protección de rutas privadas

- Los archivos de comprobantes se sirven mediante endpoint protegido con autenticación/autorización (no estáticos públicos).
- Las firmas SVG y sellos se leen desde almacenamiento privado para la vista imprimible.
- `app.use(express.static('public'))` solo sirve `index.html`, `app.html`, `imprimir.html`, 404 y assets estáticos (`/assets`).

## 8. Validación y sanitización

- Validación en backend (`src/utils/validators.js`): tipos, rangos, fechas, longitudes, booleanos.
- Las respuestas usan códigos HTTP semánticos.
- Errores centralizados (`src/middlewares/error.js`).
- Los campos no controlados son ignorados.
- Las consultas usan parámetros preparados (`mysql2`).

## 9. Auditoría

- Triggers `AFTER INSERT/UPDATE/DELETE` registran en `tb_audit_logs`.
- `BEFORE UPDATE/DELETE` en `tb_audit_logs` impiden su modificación o eliminación.
- Campos registrados: tabla, operación, `record_id`, `user_id`, `db_user`, `client_ip`, `source`, `old_values`, `new_values`, `change_description`.
- Solo rol `admin` accede a `/api/auditoria` y `/api/auditoria/resumen`.
- La aplicación establece variables de sesión MySQL cuando es posible para enriquecer la traza.

## 10. Sesión y cookies

| Atributo | Valor | Notas |
| --- | --- | --- |
| `HttpOnly` | `true` (sesión) / `false` (CSRF) | Solo la cookie de sesión es inaccesible desde JS. |
| `SameSite` | `Strict` | Previene envío en cross-site requests. |
| `Secure` | `true` solo en producción | Requiere HTTPS en producción. |
| `Path` | `/` | Disponible en todo el dominio. |
| `Max-Age` | 8 horas | Sincronizado con JWT. |

## 11. Recomendaciones operativas

- Cambiar `JWT_SECRET` en producción por una cadena aleatoria de 64+ caracteres.
- Habilitar HTTPS y `COOKIE_SECURE=true` en producción.
- Restringir IPs a la base de datos si es posible.
- Realizar copias de seguridad periódicas de `db_justificantes_utxj` y de `uploads/`.
- Revisar la bitácora de auditoría regularmente.
- Mantener `node_modules` actualizado y revisar dependencias.
- No exponer `uploads/` vía servidor web estático; siempre usar rutas protegidas.
- El archivo `.env` nunca debe subirse al repositorio (`.gitignore` lo bloquea).
