erDiagram
  %% Diagrama generado automáticamente desde la base de datos viva.
  %% Regenerar con: node scripts/generate_erd.js

  tb_academic_staff {
    int id_staff "PK"
    int id_institution "FK"
    int id_user "FK"
    int id_career "FK"
    string full_name
    enum position
    string email
    string phone
    int active
    datetime created_at
    datetime updated_at
  }

  tb_audit_logs {
    int id_log "PK"
    string table_name
    enum operation
    string record_id
    int user_id "FK"
    string db_user
    string client_ip
    string source
    datetime changed_at
    string change_description
    json old_values
    json new_values
  }

  tb_careers {
    int id_career "PK"
    int id_institution "FK"
    string code
    string name
    enum level
    int active
    datetime created_at
    datetime updated_at
  }

  tb_document_types {
    int id_document_type "PK"
    string code
    string name
    string description
    string allowed_extensions
    int requires_validation
    int active
    datetime created_at
  }

  tb_folio_sequences {
    date sequence_date "PK"
    int last_number
    datetime updated_at
  }

  tb_groups {
    int id_group "PK"
    int id_career "FK"
    string name "Identificador visible del grupo / por ejemplo 7A"
    int grade "Grado o cuatrimestre"
    enum shift
    string school_period "Periodo escolar / por ejemplo 2026-2027"
    int capacity
    int active
    datetime created_at
    datetime updated_at
  }

  tb_guardians {
    int id_guardian "PK"
    int id_student "FK"
    string full_name
    enum relationship
    string phone
    string email
    string address
    int active
    datetime created_at
    datetime updated_at
  }

  tb_institutional_stamps {
    int id_stamp "PK"
    int id_justification "FK"
    int id_institution "FK"
    string stamp_file_ref "Ruta privada del sello institucional"
    string stamp_sha256
    datetime applied_at
    int applied_by "FK"
    string observations
    datetime created_at
  }

  tb_institutions {
    int id_institution "PK"
    string name
    string acronym
    string address
    string city
    string state_name
    string country
    string phone
    string email
    string logo_path "Ruta privada o relativa del logotipo institucional"
    int active
    datetime created_at
    datetime updated_at
  }

  tb_justification_absences {
    int id_absence "PK"
    int id_justification "FK"
    date absence_date
    string notes
    datetime created_at
  }

  tb_justification_signatures {
    int id_signature "PK"
    int id_justification "FK"
    enum signer_type
    int id_staff "FK"
    int id_guardian "FK"
    string signer_name
    enum status
    datetime signed_at
    string signature_file_ref "Ruta privada del archivo de firma"
    string signature_sha256
    string observations
    datetime created_at
    datetime updated_at
  }

  tb_justification_status_history {
    int id_history "PK"
    int id_justification "FK"
    int id_status_from "FK"
    int id_status_to "FK"
    int changed_by "FK"
    datetime changed_at
    string comment
  }

  tb_justification_statuses {
    int id_status "PK"
    string code
    string name
    string description
    int is_final
    int sort_order
    datetime created_at
  }

  tb_justifications {
    int id_justification "PK"
    string folio "Folio institucional único generado en el servidor"
    int id_student "FK"
    int id_status "FK"
    int id_reason_type "FK"
    date issue_date "Fecha de emisión del justificante"
    date start_date "Primer día de inasistencia"
    date end_date "Último día de inasistencia"
    int is_critical "Caso crítico: 1 = Sí / 0 = No"
    string reason "Motivo completo escrito por el solicitante"
    string observations
    int validity_days "Días hábiles configurados para la vigencia"
    date expires_at "Fecha de vencimiento calculada con días hábiles"
    int created_by "FK"
    int updated_by "FK"
    int approved_by "FK"
    int rejected_by "FK"
    datetime resolved_at
    string rejection_comment
    int version "Control de concurrencia optimista"
    datetime created_at
    datetime updated_at
    datetime deleted_at "Borrado lógico; nunca se elimina físicamente por la aplicación"
  }

  tb_non_working_days {
    int id_non_working_day "PK"
    int id_institution "FK"
    date non_working_date
    string description
    int is_recurring "1 = se repite cada año en mes/día"
    datetime created_at
  }

  tb_reason_types {
    int id_reason_type "PK"
    string code
    string name
    string description
    int requires_document
    int active
    datetime created_at
  }

  tb_roles {
    int id_role "PK"
    string code
    string name
    string description
    datetime created_at
  }

  tb_students {
    int id_student "PK"
    int id_group "FK"
    string enrollment "Matrícula institucional única"
    string first_name
    string last_name
    string second_last_name
    string email
    string phone
    enum status
    datetime created_at
    datetime updated_at
  }

  tb_subjects {
    int id_subject "PK"
    int id_career "FK"
    string code
    string name
    int credits
    int semester
    int active
    datetime created_at
    datetime updated_at
  }

  tb_supporting_documents {
    int id_document "PK"
    int id_justification "FK"
    int id_document_type "FK"
    string original_name "Nombre original solo para trazabilidad interna"
    string stored_name "Nombre aleatorio en disco"
    string storage_path "Ruta privada relativa; nunca una URL pública"
    string mime_type
    string extension
    int file_size
    string checksum_sha256
    int uploaded_by "FK"
    datetime uploaded_at
    enum validation_status
    int validated_by "FK"
    datetime validated_at
    string notes
    int is_private
  }

  tb_system_settings {
    string setting_key "PK"
    string setting_value
    string description
    int updated_by "FK"
    datetime updated_at
  }

  tb_teachers {
    int id_teacher "PK"
    int id_institution "FK"
    string employee_number
    string professional_title "Grado académico visible / por ejemplo MTI."
    string first_name
    string last_name
    string second_last_name
    string email
    string department
    int active
    datetime created_at
    datetime updated_at
  }

  tb_users {
    int id_user "PK"
    string username
    string email
    string password_hash "Hash bcrypt; nunca contraseña en texto plano"
    string full_name
    int id_student "FK"
    int id_teacher "FK"
    int active
    int failed_attempts
    datetime locked_until
    datetime last_login
    datetime created_at
    datetime updated_at
  }

  tbd_justification_subjects {
    int id_justification_subject "PK"
    int id_justification "FK"
    int id_subject "FK"
    int id_teacher "FK"
    int id_absence "FK"
    string observations
    datetime created_at
  }

  tbd_user_roles {
    int id_user "PK FK"
    int id_role "PK FK"
    datetime assigned_at
    int assigned_by "FK"
  }

  tb_careers ||--o{ tb_academic_staff : "fk_staff_career"
  tb_institutions ||--o{ tb_academic_staff : "fk_staff_institution"
  tb_users ||--o{ tb_academic_staff : "fk_staff_user"
  tb_users ||--o{ tb_audit_logs : "fk_audit_user"
  tb_institutions ||--o{ tb_careers : "fk_careers_institution"
  tb_careers ||--o{ tb_groups : "fk_groups_career"
  tb_students ||--o{ tb_guardians : "fk_guardians_student"
  tb_users ||--o{ tb_institutional_stamps : "fk_stamps_applied_by"
  tb_institutions ||--o{ tb_institutional_stamps : "fk_stamps_institution"
  tb_justifications ||--o{ tb_institutional_stamps : "fk_stamps_justification"
  tb_justifications ||--o{ tb_justification_absences : "fk_absences_justification"
  tb_guardians ||--o{ tb_justification_signatures : "fk_signatures_guardian"
  tb_justifications ||--o{ tb_justification_signatures : "fk_signatures_justification"
  tb_academic_staff ||--o{ tb_justification_signatures : "fk_signatures_staff"
  tb_users ||--o{ tb_justification_status_history : "fk_history_changed_by"
  tb_justifications ||--o{ tb_justification_status_history : "fk_history_justification"
  tb_justification_statuses ||--o{ tb_justification_status_history : "fk_history_status_from"
  tb_justification_statuses ||--o{ tb_justification_status_history : "fk_history_status_to"
  tb_users ||--o{ tb_justifications : "fk_justifications_approved_by"
  tb_users ||--o{ tb_justifications : "fk_justifications_created_by"
  tb_reason_types ||--o{ tb_justifications : "fk_justifications_reason_type"
  tb_users ||--o{ tb_justifications : "fk_justifications_rejected_by"
  tb_justification_statuses ||--o{ tb_justifications : "fk_justifications_status"
  tb_students ||--o{ tb_justifications : "fk_justifications_student"
  tb_users ||--o{ tb_justifications : "fk_justifications_updated_by"
  tb_institutions ||--o{ tb_non_working_days : "fk_non_working_institution"
  tb_groups ||--o{ tb_students : "fk_students_group"
  tb_careers ||--o{ tb_subjects : "fk_subjects_career"
  tb_justifications ||--o{ tb_supporting_documents : "fk_documents_justification"
  tb_document_types ||--o{ tb_supporting_documents : "fk_documents_type"
  tb_users ||--o{ tb_supporting_documents : "fk_documents_uploaded_by"
  tb_users ||--o{ tb_supporting_documents : "fk_documents_validated_by"
  tb_users ||--o{ tb_system_settings : "fk_settings_updated_by"
  tb_institutions ||--o{ tb_teachers : "fk_teachers_institution"
  tb_students ||--o{ tb_users : "fk_users_student"
  tb_teachers ||--o{ tb_users : "fk_users_teacher"
  tb_justification_absences ||--o{ tbd_justification_subjects : "fk_justification_subjects_absence"
  tb_justifications ||--o{ tbd_justification_subjects : "fk_justification_subjects_justification"
  tb_subjects ||--o{ tbd_justification_subjects : "fk_justification_subjects_subject"
  tb_teachers ||--o{ tbd_justification_subjects : "fk_justification_subjects_teacher"
  tb_users ||--o{ tbd_user_roles : "fk_user_roles_assigned_by"
  tb_roles ||--o{ tbd_user_roles : "fk_user_roles_role"
  tb_users ||--o{ tbd_user_roles : "fk_user_roles_user"
