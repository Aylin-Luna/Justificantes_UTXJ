# Manual de uso — Sistema de Justificantes Académicos UTXJ

## 1. Acceso

1. Abra `http://localhost:3000`.
2. Capture usuario o correo y contraseña.
3. El sistema redirige al panel correspondiente según sus roles.

### Usuarios demo

| Perfil | Usuario | Contraseña |
| --- | --- | --- |
| Alumno | `alumno` | `Alumno123!` |
| Tutor educativo | `tutor` | `Tutor123!` |
| Directora de carrera | `directora` | `Directora123!` |
| Administrador | `admin` | `Admin123!` |

> Cambie estas contraseñas antes de usar el sistema en un entorno real.

## 2. Pantalla de inicio (dashboard)

Cada perfil ve indicadores y accesos distintos:

- **Alumno**: total de justificantes, pendientes, aprobados, rechazados, borrador de nuevo trámite y actividad reciente.
- **Tutor**: cola de revisión, documentos por validar, casos críticos y justificantes de sus carreras.
- **Directora**: expedientes por aprobar, aprobados, rechazados y actividad del periodo.
- **Admin**: visión institucional, usuarios activos, eventos de auditoría y configuración.

## 3. Flujo del alumno

### Crear un justificante

1. Entre a **Nuevo justificante**.
2. Seleccione el motivo.
3. Escriba una descripción (mínimo 10 caracteres) y observaciones opcionales.
4. Indique fecha inicial y final. No se permiten fechas futuras.
5. Marque **caso crítico** si aplica.
6. Seleccione las materias afectadas y, si se conoce, el docente.
7. Adjunte un comprobante PDF/JPG/PNG si el motivo lo exige o el caso es crítico.
8. Guarde. El sistema genera el folio `JUS-AAAAMMDD-####`.

### Editar o cancelar

- Solo los justificantes **pendientes** se pueden editar o cancelar.
- Desde el detalle puede editar, cancelar, descargar el comprobante o abrir la vista imprimible.

### Consultar

- **Justificantes** muestra el listado con filtros por estado, folio, matrícula, carrera, críticos y rango de fechas.
- La búsqueda y los filtros se conservan en la URL.
- El detalle muestra línea de tiempo, documentos, firmas, sello e historial.

## 4. Flujo del tutor

1. En **Revisión** aparecen los justificantes `pendiente` y `en_revision` de sus carreras.
2. Abra un expediente.
3. Revise datos, fechas y materias.
4. Valide el comprobante:
   - **Validado**: permite aprobar casos críticos.
   - **Rechazado**: exige observaciones.
5. Firme como tutor. El expediente pasa a **En revisión**.
6. Puede descargar el comprobante, pero no aprobar ni rechazar el justificante.

## 5. Flujo de la directora

1. En **Por aprobar** aparecen los expedientes `en_revision`.
2. Abra el detalle.
3. Verifique la firma del tutor y, si es crítico, el comprobante validado.
4. Firme dirección si desea hacerlo antes de aprobar.
5. **Aprobar**: el sistema genera la firma de dirección si falta, aplica el sello institucional y deja el expediente inmutable.
6. **Rechazar**: exige un comentario de al menos 5 caracteres.
7. Puede imprimir el justificante aprobado desde el detalle.

## 6. Flujo del administrador

### Usuarios

- Consulte, busque y filtre cuentas.
- Active o desactive usuarios (no puede desactivar su propia cuenta).
- Cambie roles (no puede retirar su propio rol `admin`).
- Restablezca contraseñas con mínimo 8 caracteres, letras y números.

### Configuración

- **Parámetros**: vigencia, prefijo de folio, tamaño máximo, extensiones, intentos de acceso, bloqueo y longitud mínima de contraseña.
- **Institución**: datos oficiales usados en el encabezado y sello.
- **Días inhábiles**: catálogo para el cálculo de vigencia.
- **Catálogos**: carreras, grupos, materias, motivos, tipos de documento y estados.
- Los cambios de institución y catálogos se administran desde la base de datos institucional; los parámetros se guardan desde el panel.

### Auditoría

- Filtre por tabla, operación, usuario, texto y rango de fechas.
- Consulte el resumen de eventos de las últimas 24 horas.
- Solo lectura: la bitácora es inmutable.

## 7. Vista imprimible

- Abra `/imprimir?id=<id>` o use **Imprimir** desde el detalle.
- La hoja es A4 vertical.
- Si el estado no es `aprobado`, aparece la marca de agua **VISTA PREVIA**.
- Un justificante aprobado muestra firmas de tutor y dirección, sello institucional y pie legal.
- Use el botón **Imprimir** del navegador; la barra de herramientas no se imprime.

## 8. Mi perfil

- Consulte nombre, usuario, correo y roles.
- Cambie la contraseña indicando la actual y la nueva.
- Cierre sesión desde el menú superior.

## 9. Preguntas frecuentes

**¿Por qué no puedo editar mi justificante?**
Porque ya está en revisión o resuelto. Solo el estado `pendiente` es editable.

**¿Por qué no puedo aprobar un caso crítico?**
Falta un comprobante validado por el tutor o la directora.

**¿Por qué no veo justificantes de otra carrera?**
Su cuenta de tutor/dirección está limitada a las carreras asignadas en `tb_academic_staff`.

**¿Qué pasa si mi comprobante es rechazado?**
Puede cargar uno nuevo mientras el expediente no esté finalizado. El rechazo del documento exige observaciones.

**¿El folio se puede cambiar?**
No. Se genera en el servidor y es único e inmutable.

**¿Dónde veo el historial?**
En el detalle del justificante, sección de historial y auditoría.
