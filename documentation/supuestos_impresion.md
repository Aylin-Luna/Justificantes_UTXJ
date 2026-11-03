# Supuestos de la vista imprimible

## Contexto

El archivo `JUSTIFICANTE.pdf` proporcionado como referencia llegó con **0 bytes**, por lo que no fue posible leer su contenido ni replicar con exactitud milimétrica el formato oficial. La vista imprimible se reconstruyó a partir de:

- Los campos existentes en el sistema (`estudiante`, `matrícula`, `carrera`, `grupo`, `fechas`, `motivo`, `observaciones`, `materias`, `estado`, `folio`).
- Las reglas institucionales descritas en los requerimientos.
- Un diseño editorial institucional coherente con la identidad de la UTXJ.

## Estructura de la hoja

La vista `frontend/public/imprimir.html` + `frontend/src/print.js` genera un documento A4 vertical con:

1. **Encabezado institucional**: logotipo, nombre de la universidad, dirección, teléfono y correo.
2. **Título**: “JUSTIFICANTE ACADÉMICO” y periodo escolar.
3. **Bloque de control**: folio, estado, fecha de emisión, vigencia y vencimiento.
4. **Datos del estudiante**: nombre completo, matrícula, carrera, grupo, grado, turno, correo.
5. **Datos del justificante**: motivo, tipo, periodo, crítico, días, estado.
6. **Motivo y observaciones**: texto del alumno y comentarios de rechazo si existen.
7. **Faltas registradas y materias afectadas**: tabla con fecha, materia y docente.
8. **Firmas y responsabilidades**:
   - Padre / madre / tutor (opcional).
   - Tutor educativo.
   - Dirección de carrera.
   - Sello institucional (cuando existe).
9. **Pie legal**: leyenda de verificación, folio y código de documento.

## Decisiones de diseño

| Elemento | Decisión | Motivo |
| --- | --- | --- |
| Tamaño | A4 vertical (`@page size: A4 portrait`) | Formato institucional estándar. |
| Márgenes | `14mm 15mm 12mm` en impresión | Área segura sin recortes. |
| Marca de agua | “VISTA PREVIA” cuando el estado no es `aprobado` | Evita reutilizar documentos no autorizados. |
| Firmas | 3 columnas; 4 con sello | Se adapta a la presencia/ausencia de sello. |
| Sello | Tarjeta cuadrada en la cuadrícula de firmas | Mantiene alineación y evita solapamientos. |
| Documentos | Resumen en la fila de datos del justificante | Evita una segunda página y expone el conteo. |
| Observaciones | Se combinan con el motivo en un solo bloque | Ahorra espacio vertical. |
| Logo | `/assets/img/logo-utxj.svg` con respaldo | Ruta normalizada y disponible en el servidor. |
| Impresión | Oculta barra de herramientas, navegación y toasts | Solo se imprime la hoja. |

## Comportamiento verificado

- Justificante aprobado: muestra firmas de tutor y dirección, sello institucional y **sin** marca de agua.
- Justificante pendiente: muestra únicamente las firmas existentes y marca de agua “VISTA PREVIA”.
- La hoja mide ~1080 px en pantalla y cabe en una página A4 al imprimir.
- El pie de página se posiciona dentro de la hoja; no se desborda.
- Los SVG de firmas y sellos se incorporan como `data:image/svg+xml` para no depender de rutas privadas en el navegador.

## Pendiente de confirmación

Si el formato oficial del `JUSTIFICANTE.pdf` debe reproducirse de forma exacta (medidas, campos obligatorios, leyendas legales, orden de bloques, firmas requeridas), es necesario **volver a cargar el PDF con contenido**. Con ese archivo se pueden ajustar:

- Posición y tamaño de cada bloque.
- Textos legales y de verificación.
- Número y disposición de firmas.
- Campos obligatorios adicionales.
- Logo y datos institucionales exactos.

Mientras tanto, la vista actual cumple con los datos y el flujo del sistema y puede imprimirse sin romper la operación.
