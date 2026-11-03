'use strict';

const { query, queryOne, execute, withTransaction } = require('../../database/pool');

const STATUS_META = {
  pendiente: { label: 'Pendiente', tone: 'amber' },
  en_revision: { label: 'En revisión', tone: 'blue' },
  aprobado: { label: 'Aprobado', tone: 'green' },
  rechazado: { label: 'Rechazado', tone: 'red' },
  cancelado: { label: 'Cancelado', tone: 'gray' },
  vencido: { label: 'Vencido', tone: 'slate' },
};

const SIGNER_LABELS = {
  padre_madre_tutor: 'Padre / madre / tutor',
  tutor_educativo: 'Tutor educativo',
  director_carrera: 'Dirección de carrera',
};

const buildScope = (user) => {
  if (!user) return { sql: '1 = 0', params: [] };
  if (user.roles.includes('admin')) return { sql: '1 = 1', params: [] };
  if (user.roles.includes('alumno') && user.idStudent) {
    return { sql: 'j.id_student = ?', params: [user.idStudent] };
  }
  if (user.roles.includes('tutor') || user.roles.includes('directora')) {
    const careers = [...new Set(
      (user.staff || []).map((item) => item.id_career).filter((id) => Number.isInteger(Number(id)) && Number(id) > 0)
    )];
    const institutionWide = (user.staff || []).some((item) => !item.id_career);
    if (careers.length === 0 && institutionWide) return { sql: '1 = 1', params: [] };
    if (careers.length > 0) {
      return {
        sql: `c.id_career IN (${careers.map(() => '?').join(', ')})`,
        params: careers,
      };
    }
  }
  return { sql: '1 = 0', params: [] };
};

const mapBase = (row) => ({
  id: Number(row.id_justification),
  folio: row.folio,
  studentId: row.id_student,
  enrollment: row.enrollment,
  studentName: row.student_name,
  studentFirstName: row.first_name,
  studentLastName: row.last_name,
  studentSecondLastName: row.second_last_name,
  email: row.email,
  groupName: row.group_name,
  grade: row.grade,
  shift: row.shift,
  schoolPeriod: row.school_period,
  careerId: row.id_career,
  careerName: row.career_name,
  careerCode: row.career_code,
  institutionId: row.id_institution,
  institutionName: row.institution_name,
  institutionAcronym: row.institution_acronym,
  institutionLogo: row.logo_path,
  institutionAddress: row.address,
  institutionCity: row.city,
  institutionState: row.state_name,
  institutionPhone: row.phone,
  institutionEmail: row.email_institution,
  status: row.status_code,
  statusName: row.status_name,
  statusTone: (STATUS_META[row.status_code] || {}).tone || 'gray',
  reasonTypeId: row.id_reason_type,
  reasonType: row.reason_type_name,
  issueDate: row.issue_date,
  startDate: row.start_date,
  endDate: row.end_date,
  isCritical: Boolean(row.is_critical),
  reason: row.reason,
  observations: row.observations,
  validityDays: row.validity_days,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  resolvedAt: row.resolved_at,
  rejectionComment: row.rejection_comment,
  version: row.version,
  createdBy: row.created_by,
  approvedBy: row.approved_by,
  rejectedBy: row.rejected_by,
  documentsCount: row.documents_count !== undefined ? Number(row.documents_count) : undefined,
  signaturesCount: row.signatures_count !== undefined ? Number(row.signatures_count) : undefined,
  validatedDocuments: row.validated_documents !== undefined ? Number(row.validated_documents) : undefined,
  hasTutorSignature: row.has_tutor_signature !== undefined ? Boolean(row.has_tutor_signature) : undefined,
  hasDirectorSignature: row.has_director_signature !== undefined ? Boolean(row.has_director_signature) : undefined,
});

const BASE_SELECT = `
  j.id_justification, j.folio, j.id_student, j.id_status, j.id_reason_type,
  j.issue_date, j.start_date, j.end_date, j.is_critical, j.reason, j.observations,
  j.validity_days, j.expires_at, j.created_at, j.updated_at, j.resolved_at,
  j.rejection_comment, j.version, j.created_by, j.approved_by, j.rejected_by,
  CONCAT_WS(' ', s.first_name, s.last_name, s.second_last_name) AS student_name,
  s.enrollment, s.first_name, s.last_name, s.second_last_name, s.email,
  g.name AS group_name, g.grade, g.shift, g.school_period,
  c.id_career, c.name AS career_name, c.code AS career_code,
  i.id_institution, i.name AS institution_name, i.acronym AS institution_acronym,
  i.logo_path, i.address, i.city, i.state_name, i.phone, i.email AS email_institution,
  st.code AS status_code, st.name AS status_name,
  rt.name AS reason_type_name
`;

const BASE_JOINS = `
  FROM tb_justifications j
  JOIN tb_students s ON s.id_student = j.id_student
  JOIN tb_groups g ON g.id_group = s.id_group
  JOIN tb_careers c ON c.id_career = g.id_career
  JOIN tb_institutions i ON i.id_institution = c.id_institution
  JOIN tb_justification_statuses st ON st.id_status = j.id_status
  LEFT JOIN tb_reason_types rt ON rt.id_reason_type = j.id_reason_type
`;

const COUNT_SELECT = `
  (SELECT COUNT(*) FROM tb_supporting_documents d WHERE d.id_justification = j.id_justification) AS documents_count,
  (SELECT COUNT(*) FROM tb_justification_signatures f
    WHERE f.id_justification = j.id_justification AND f.status = 'firmado') AS signatures_count,
  (SELECT COUNT(*) FROM tb_supporting_documents d
    WHERE d.id_justification = j.id_justification AND d.validation_status = 'validado') AS validated_documents,
  (SELECT COUNT(*) FROM tb_justification_signatures f
    WHERE f.id_justification = j.id_justification AND f.status = 'firmado'
      AND f.signer_type = 'tutor_educativo') AS has_tutor_signature,
  (SELECT COUNT(*) FROM tb_justification_signatures f
    WHERE f.id_justification = j.id_justification AND f.status = 'firmado'
      AND f.signer_type = 'director_carrera') AS has_director_signature
`;

const list = async ({ filters = {}, scope = { sql: '1 = 1', params: [] }, page = 1, limit = 20 }) => {
  const where = ['j.deleted_at IS NULL', scope.sql];
  const params = [...scope.params];

  if (filters.status) {
    where.push('st.code = ?');
    params.push(filters.status);
  }
  if (filters.folio) {
    where.push('j.folio LIKE ?');
    params.push(`%${filters.folio}%`);
  }
  if (filters.enrollment) {
    where.push('s.enrollment LIKE ?');
    params.push(`%${filters.enrollment}%`);
  }
  if (filters.search) {
    where.push('(j.folio LIKE ? OR s.enrollment LIKE ? OR CONCAT_WS(\' \', s.first_name, s.last_name, s.second_last_name) LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.careerId) {
    where.push('c.id_career = ?');
    params.push(filters.careerId);
  }
  if (filters.onlyCritical) {
    where.push('j.is_critical = 1');
  }
  if (filters.from) {
    where.push('j.end_date >= ?');
    params.push(filters.from);
  }
  if (filters.to) {
    where.push('j.start_date <= ?');
    params.push(filters.to);
  }
  if (filters.pendingForReview) {
    where.push("st.code IN ('pendiente','en_revision')");
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const totalRow = await queryOne(
    `SELECT COUNT(*) AS total
       FROM tb_justifications j
       JOIN tb_students s ON s.id_student = j.id_student
       JOIN tb_groups g ON g.id_group = s.id_group
       JOIN tb_careers c ON c.id_career = g.id_career
       JOIN tb_justification_statuses st ON st.id_status = j.id_status
      ${whereSql}`,
    params
  );

  const offset = (page - 1) * limit;
  const rows = await query(
    `SELECT ${BASE_SELECT}, ${COUNT_SELECT}
     ${BASE_JOINS}
     ${whereSql}
     ORDER BY
       CASE st.code WHEN 'pendiente' THEN 1 WHEN 'en_revision' THEN 2 WHEN 'aprobado' THEN 3 ELSE 4 END,
       j.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapBase),
    total: Number(totalRow.total),
    page,
    limit,
    pages: Math.max(1, Math.ceil(Number(totalRow.total) / limit)),
  };
};

const findById = async (id, scope = { sql: '1 = 1', params: [] }) => {
  const row = await queryOne(
    `SELECT ${BASE_SELECT}, ${COUNT_SELECT}
     ${BASE_JOINS}
     WHERE j.id_justification = ? AND j.deleted_at IS NULL AND ${scope.sql}
     LIMIT 1`,
    [id, ...scope.params]
  );
  return row ? mapBase(row) : null;
};

const getAbsences = async (id) => {
  const rows = await query(
    `SELECT id_absence, absence_date, notes
       FROM tb_justification_absences
      WHERE id_justification = ?
      ORDER BY absence_date`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id_absence),
    date: row.absence_date,
    notes: row.notes,
  }));
};

const getSubjects = async (id) => {
  const rows = await query(
    `SELECT js.id_justification_subject, sub.id_subject, sub.code, sub.name,
            t.id_teacher, t.professional_title, t.first_name, t.last_name, t.second_last_name,
            a.absence_date, js.observations
       FROM tbd_justification_subjects js
       JOIN tb_subjects sub ON sub.id_subject = js.id_subject
       LEFT JOIN tb_teachers t ON t.id_teacher = js.id_teacher
       JOIN tb_justification_absences a ON a.id_absence = js.id_absence
      WHERE js.id_justification = ?
      ORDER BY a.absence_date, sub.name`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id_justification_subject),
    subjectId: row.id_subject,
    code: row.code,
    name: row.name,
    teacherId: row.id_teacher,
    teacherName: [row.professional_title, row.first_name, row.last_name, row.second_last_name]
      .filter(Boolean).join(' '),
    date: row.absence_date,
    observations: row.observations,
  }));
};

const getDocuments = async (id) => {
  const rows = await query(
    `SELECT d.id_document, d.id_document_type, dt.code AS type_code, dt.name AS type_name,
            d.original_name, d.stored_name, d.storage_path, d.mime_type, d.extension,
            d.file_size, d.uploaded_by, d.uploaded_at, d.validation_status,
            d.validated_by, d.validated_at, d.notes,
            u.full_name AS uploaded_by_name, v.full_name AS validated_by_name
       FROM tb_supporting_documents d
       JOIN tb_document_types dt ON dt.id_document_type = d.id_document_type
       LEFT JOIN tb_users u ON u.id_user = d.uploaded_by
       LEFT JOIN tb_users v ON v.id_user = d.validated_by
      WHERE d.id_justification = ?
      ORDER BY d.uploaded_at`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id_document),
    documentTypeId: row.id_document_type,
    typeCode: row.type_code,
    typeName: row.type_name,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    extension: row.extension,
    fileSize: Number(row.file_size),
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    validationStatus: row.validation_status,
    validatedBy: row.validated_by,
    validatedByName: row.validated_by_name,
    validatedAt: row.validated_at,
    notes: row.notes,
    downloadUrl: `/api/justificantes/${id}/documentos/${row.id_document}/archivo`,
  }));
};

const getSignatures = async (id) => {
  const rows = await query(
    `SELECT f.id_signature, f.signer_type, f.id_staff, f.id_guardian, f.signer_name,
            f.status, f.signed_at, f.signature_file_ref, f.signature_sha256,
            f.observations, f.created_at
       FROM tb_justification_signatures f
      WHERE f.id_justification = ?
      ORDER BY FIELD(f.signer_type, 'padre_madre_tutor', 'tutor_educativo', 'director_carrera')`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id_signature),
    signerType: row.signer_type,
    signerTypeLabel: SIGNER_LABELS[row.signer_type] || row.signer_type,
    staffId: row.id_staff,
    guardianId: row.id_guardian,
    signerName: row.signer_name,
    status: row.status,
    signedAt: row.signed_at,
    fileRef: row.signature_file_ref,
    sha256: row.signature_sha256,
    observations: row.observations,
    createdAt: row.created_at,
  }));
};

const getStamp = async (id) => {
  const row = await queryOne(
    `SELECT s.id_stamp, s.id_institution, s.stamp_file_ref, s.stamp_sha256,
            s.applied_at, s.applied_by, s.observations, i.name AS institution_name,
            i.acronym, u.full_name AS applied_by_name
       FROM tb_institutional_stamps s
       JOIN tb_institutions i ON i.id_institution = s.id_institution
       LEFT JOIN tb_users u ON u.id_user = s.applied_by
      WHERE s.id_justification = ?
      LIMIT 1`,
    [id]
  );
  if (!row) return null;
  return {
    id: Number(row.id_stamp),
    institutionId: row.id_institution,
    institutionName: row.institution_name,
    acronym: row.acronym,
    fileRef: row.stamp_file_ref,
    sha256: row.stamp_sha256,
    appliedAt: row.applied_at,
    appliedBy: row.applied_by,
    appliedByName: row.applied_by_name,
    observations: row.observations,
  };
};

const getHistory = async (id) => {
  const rows = await query(
    `SELECT h.id_history, h.changed_at, h.comment,
            sf.code AS status_from, sf.name AS status_from_name,
            st.code AS status_to, st.name AS status_to_name,
            u.full_name AS changed_by_name
       FROM tb_justification_status_history h
       LEFT JOIN tb_justification_statuses sf ON sf.id_status = h.id_status_from
       JOIN tb_justification_statuses st ON st.id_status = h.id_status_to
       LEFT JOIN tb_users u ON u.id_user = h.changed_by
      WHERE h.id_justification = ?
      ORDER BY h.changed_at, h.id_history`,
    [id]
  );
  return rows.map((row) => ({
    id: Number(row.id_history),
    changedAt: row.changed_at,
    comment: row.comment,
    statusFrom: row.status_from,
    statusFromName: row.status_from_name,
    statusTo: row.status_to,
    statusToName: row.status_to_name,
    changedByName: row.changed_by_name,
  }));
};

const detail = async (id, scope) => {
  const justification = await findById(id, scope);
  if (!justification) return null;
  const [absences, subjects, documents, signatures, stamp, history] = await Promise.all([
    getAbsences(id),
    getSubjects(id),
    getDocuments(id),
    getSignatures(id),
    getStamp(id),
    getHistory(id),
  ]);
  return { ...justification, absences, subjects, documents, signatures, stamp, history };
};

const create = async (payload, context) => withTransaction(async (connection) => {
  const params = [
    payload.studentId,
    payload.issueDate,
    payload.startDate,
    payload.endDate,
    payload.isCritical ? 1 : 0,
    payload.reasonTypeId || null,
    payload.reason,
    payload.observations || null,
    payload.institutionId || null,
    payload.createdBy,
    JSON.stringify(payload.absenceDates || []),
    payload.subjects && payload.subjects.length > 0
      ? JSON.stringify(payload.subjects.map((subject) => ({
        id_subject: subject.subjectId,
        id_teacher: subject.teacherId || null,
        absence_date: subject.date,
        observations: subject.observations || null,
      })))
      : null,
    payload.document ? payload.document.documentTypeId : null,
    payload.document ? payload.document.originalName : null,
    payload.document ? payload.document.storedName : null,
    payload.document ? payload.document.storagePath : null,
    payload.document ? payload.document.mimeType : null,
    payload.document ? payload.document.extension : null,
    payload.document ? payload.document.size : null,
    payload.document ? payload.document.checksum : null,
  ];

  await connection.query(
    `CALL sp_registrar_justificante(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @out_id, @out_folio)`,
    params
  );
  const [outRows] = await connection.query('SELECT @out_id AS id, @out_folio AS folio');
  return { id: Number(outRows[0].id), folio: outRows[0].folio };
}, context);

const update = async (id, payload, context) => withTransaction(async (connection) => {
  await connection.query(
    `UPDATE tb_justifications
        SET id_reason_type = ?, start_date = ?, end_date = ?, is_critical = ?,
            reason = ?, observations = ?, updated_by = ?
      WHERE id_justification = ?`,
    [
      payload.reasonTypeId || null,
      payload.startDate,
      payload.endDate,
      payload.isCritical ? 1 : 0,
      payload.reason,
      payload.observations || null,
      payload.updatedBy,
      id,
    ]
  );

  await connection.query('DELETE FROM tbd_justification_subjects WHERE id_justification = ?', [id]);
  await connection.query('DELETE FROM tb_justification_absences WHERE id_justification = ?', [id]);

  for (const date of payload.absenceDates) {
    await connection.query(
      'INSERT INTO tb_justification_absences (id_justification, absence_date) VALUES (?, ?)',
      [id, date]
    );
  }

  if (payload.subjects && payload.subjects.length > 0) {
    for (const subject of payload.subjects) {
      await connection.query(
        `INSERT INTO tbd_justification_subjects
          (id_justification, id_subject, id_teacher, id_absence, observations)
         SELECT ?, ?, ?, a.id_absence, ?
           FROM tb_justification_absences a
          WHERE a.id_justification = ? AND a.absence_date = ?`,
        [id, subject.subjectId, subject.teacherId || null, subject.observations || null,
          id, subject.date]
      );
    }
  }

  return findById(id);
}, context);

const setStatus = async (id, statusCode, userId, comment, context) => withTransaction(async (connection) => {
  await connection.query(
    'CALL sp_cambiar_estado_justificante(?, ?, ?, ?, @out_ok)',
    [id, statusCode, userId, comment || null]
  );
  const [rows] = await connection.query('SELECT @out_ok AS ok');
  return Boolean(rows[0].ok);
}, context);

const addDocument = async (id, document, context) => withTransaction(async (connection) => {
  await connection.query(
    `CALL sp_registrar_documento_comprobante(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, @out_id)`,
    [
      id,
      document.documentTypeId,
      document.originalName,
      document.storedName,
      document.storagePath,
      document.mimeType,
      document.extension,
      document.size,
      document.checksum,
      document.uploadedBy,
    ]
  );
  const [rows] = await connection.query('SELECT @out_id AS id');
  return Number(rows[0].id);
}, context);

const validateDocument = async (documentId, status, userId, notes, context) =>
  withTransaction(async (connection) => {
    await connection.query(
      'CALL sp_validar_documento_comprobante(?, ?, ?, ?)',
      [documentId, status, userId, notes || null]
    );
    return true;
  }, context);

const findDocument = async (id, documentId) => {
  const row = await queryOne(
    `SELECT id_document, id_justification, stored_name, storage_path, original_name,
            mime_type, extension, file_size, validation_status
       FROM tb_supporting_documents
      WHERE id_document = ? AND id_justification = ?
      LIMIT 1`,
    [documentId, id]
  );
  return row ? {
    id: Number(row.id_document),
    justificationId: Number(row.id_justification),
    storedName: row.stored_name,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    extension: row.extension,
    fileSize: Number(row.file_size),
    validationStatus: row.validation_status,
  } : null;
};

const removeDocument = async (documentId) => {
  await execute('DELETE FROM tb_supporting_documents WHERE id_document = ?', [documentId]);
};

const registerSignature = async (id, signature, context) => withTransaction(async (connection) => {
  await connection.query(
    'CALL sp_registrar_firma(?, ?, ?, ?, ?, ?, ?, @out_id)',
    [
      id,
      signature.signerType,
      signature.staffId || null,
      signature.guardianId || null,
      signature.signerName,
      signature.fileRef,
      signature.sha256 || null,
    ]
  );
  const [rows] = await connection.query('SELECT @out_id AS id');
  return Number(rows[0].id);
}, context);

const registerStamp = async (id, stamp, context) => withTransaction(async (connection) => {
  await connection.query(
    'CALL sp_registrar_sello(?, ?, ?, ?, ?, @out_id)',
    [id, stamp.institutionId, stamp.fileRef, stamp.sha256 || null, stamp.appliedBy]
  );
  const [rows] = await connection.query('SELECT @out_id AS id');
  return Number(rows[0].id);
}, context);

const stats = async (scope) => {
  const rows = await query(
    `SELECT st.code, COUNT(*) AS total
       FROM tb_justifications j
       JOIN tb_students s ON s.id_student = j.id_student
       JOIN tb_groups g ON g.id_group = s.id_group
       JOIN tb_careers c ON c.id_career = g.id_career
       JOIN tb_justification_statuses st ON st.id_status = j.id_status
      WHERE j.deleted_at IS NULL AND ${scope.sql}
      GROUP BY st.code`,
    scope.params
  );
  const counts = { total: 0 };
  for (const row of rows) {
    counts[row.code] = Number(row.total);
    counts.total += Number(row.total);
  }
  const documents = await queryOne(
    `SELECT
       SUM(CASE WHEN d.validation_status = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
       COUNT(*) AS total
     FROM tb_supporting_documents d
     JOIN tb_justifications j ON j.id_justification = d.id_justification
     JOIN tb_students s ON s.id_student = j.id_student
     JOIN tb_groups g ON g.id_group = s.id_group
     JOIN tb_careers c ON c.id_career = g.id_career
     WHERE j.deleted_at IS NULL AND ${scope.sql}`,
    scope.params
  );
  const critical = await queryOne(
    `SELECT COUNT(*) AS total
       FROM tb_justifications j
       JOIN tb_students s ON s.id_student = j.id_student
       JOIN tb_groups g ON g.id_group = s.id_group
       JOIN tb_careers c ON c.id_career = g.id_career
      WHERE j.deleted_at IS NULL AND j.is_critical = 1 AND ${scope.sql}`,
    scope.params
  );
  return {
    total: counts.total,
    pendiente: counts.pendiente || 0,
    en_revision: counts.en_revision || 0,
    aprobado: counts.aprobado || 0,
    rechazado: counts.rechazado || 0,
    cancelado: counts.cancelado || 0,
    vencido: counts.vencido || 0,
    documentosPendientes: Number(documents.pendientes || 0),
    documentosTotal: Number(documents.total || 0),
    criticos: Number(critical.total || 0),
  };
};

const getStudentContext = async (idStudent) => {
  const row = await queryOne(
    `SELECT s.id_student, s.enrollment, s.first_name, s.last_name, s.second_last_name,
            s.id_group, g.id_career, g.name AS group_name, g.grade, g.shift,
            c.id_institution, c.name AS career_name, c.code AS career_code
       FROM tb_students s
       JOIN tb_groups g ON g.id_group = s.id_group
       JOIN tb_careers c ON c.id_career = g.id_career
      WHERE s.id_student = ? AND s.status = 'activo'`,
    [idStudent]
  );
  return row ? {
    idStudent: row.id_student,
    enrollment: row.enrollment,
    fullName: [row.first_name, row.last_name, row.second_last_name].filter(Boolean).join(' '),
    idGroup: row.id_group,
    idCareer: row.id_career,
    groupName: row.group_name,
    grade: row.grade,
    shift: row.shift,
    idInstitution: row.id_institution,
    careerName: row.career_name,
    careerCode: row.career_code,
  } : null;
};

const getReasonType = async (idReasonType) => {
  if (!idReasonType) return null;
  const row = await queryOne(
    `SELECT id_reason_type, code, name, requires_document, active
       FROM tb_reason_types WHERE id_reason_type = ?`,
    [idReasonType]
  );
  return row ? {
    id: row.id_reason_type,
    code: row.code,
    name: row.name,
    requiresDocument: Boolean(row.requires_document),
    active: Boolean(row.active),
  } : null;
};

const getSubjectsByIds = async (ids, idCareer) => {
  if (!ids || ids.length === 0) return [];
  const rows = await query(
    `SELECT id_subject, code, name, id_career
       FROM tb_subjects
      WHERE id_subject IN (${ids.map(() => '?').join(', ')})
        AND id_career = ? AND active = 1`,
    [...ids, idCareer]
  );
  return rows.map((row) => ({
    id: row.id_subject,
    code: row.code,
    name: row.name,
    careerId: row.id_career,
  }));
};

const getActiveTeachers = async (ids) => {
  if (!ids || ids.length === 0) return [];
  const rows = await query(
    `SELECT id_teacher FROM tb_teachers
      WHERE id_teacher IN (${ids.map(() => '?').join(', ')}) AND active = 1`,
    ids
  );
  return rows.map((row) => Number(row.id_teacher));
};

const getGuardians = async (idStudent) => {
  const rows = await query(
    `SELECT id_guardian, full_name, relationship, phone, email
       FROM tb_guardians
      WHERE id_student = ? AND active = 1
      ORDER BY id_guardian`,
    [idStudent]
  );
  return rows;
};

const pendingExpiration = async (userId) => {
  await execute('CALL sp_vencer_justificantes(?)', [userId]);
  const row = await queryOne('SELECT ROW_COUNT() AS afectados');
  return row ? Number(row.afectados) : 0;
};

module.exports = {
  STATUS_META,
  SIGNER_LABELS,
  buildScope,
  list,
  findById,
  detail,
  create,
  update,
  setStatus,
  addDocument,
  validateDocument,
  findDocument,
  removeDocument,
  registerSignature,
  registerStamp,
  stats,
  getStudentContext,
  getReasonType,
  getSubjectsByIds,
  getActiveTeachers,
  getGuardians,
  getAbsences,
  getSubjects,
  getDocuments,
  getSignatures,
  getStamp,
  getHistory,
  pendingExpiration,
};
