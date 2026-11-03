# Documentación — Justificantes UTXJ

| Documento | Contenido |
| --- | --- |
| [Arquitectura](arquitectura.md) | Capas, flujo de peticiones, estructura, decisiones técnicas y despliegue. |
| [Diseño de base de datos](diseno_base_datos.md) | Modelo, entidades, integridad, índices, procedimientos y triggers. |
| [Diccionario de datos](diccionario_datos.md) | Detalle generado de las 25 tablas y 235 columnas. |
| [Reglas de negocio](reglas_negocio.md) | Actores, estados, validaciones, permisos y errores. |
| [Seguridad](seguridad.md) | Autenticación, CSRF, RBAC, archivos, auditoría y checklist. |
| [API](api.md) | Endpoints, parámetros, cuerpos y códigos de respuesta. |
| [Manual de uso](manual_uso.md) | Flujo por rol, usuarios demo y preguntas frecuentes. |
| [Supuestos de impresión](supuestos_impresion.md) | Reconstrucción del formato oficial y pendientes de confirmación. |

## Diagramas

- [ERD Mermaid](../diagrams/entity_relationship.md)
- [ERD interactivo](../diagrams/erd.html)

## Regeneración

```bash
node scripts/generate_erd.js
node scripts/generate_data_dictionary.js
```

Ambos scripts leen `backend/.env` y la base de datos viva.
