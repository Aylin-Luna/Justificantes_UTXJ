'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const justificantesModel = require('../models/justificantes.model');
const catalogosModel = require('../models/catalogos.model');
const {
  badRequest,
  forbidden,
  notFound,
  conflict,
  unprocessable,
} = require('../utils/errors');
const validators = require('../utils/validators');
const dates = require('../utils/dates');
const files = require('../utils/files');
const { buildSignatureSvg, buildStampSvg } = require('../utils/signatures');

const FINAL_STATUSES = ['aprobado', 'rechazado', 'cancelado', 'vencido'];
const EDITABLE_STATUSES = ['pendiente'];
const REVIEWABLE_STATUSES = ['pendiente', 'en_revision'];

const parseJsonInput = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw badRequest('La información enviada no tiene un formato válido');
  }
};

const pagination = (query) => {
  const page = validators.clampInt(query.page, 1, 10000, 1);
  const limit = validators.clampInt(query.limit, 1, 100, 15);
  return { page, limit };
};

const filtersFromQuery = (query) => ({
  status: query.estado || query.status || null,
  folio: query.folio || null,
  enrollment: query.matricula || null,
  search: query.buscar || null,
  careerId: validators.toInt(query.carrera) || null,
  onlyCritical: validators.toBoolean(query.criticos, false),
  from: query.desde || null,
  to: query.hasta || null,
  pendingForReview: validators.toBoolean(query.pendientes, false),
});

const loadScoped = async (id, user) => {
  const scope = justificantesModel.buildScope(user);
  const justification = await justificantesModel.detail(id, scope);
  if (!justification) throw notFound('El justificante no existe o no está a su alcance');
  return justification;
};

const assertStatus = (justification, allowed, message) => {
  if (!allowed.includes(justification.status)) {
    throw conflict(message || `La operación no está permitida en estado ${justification.statusName}`);
  }
};

const isOwner = (user, justification) =>
  user.roles.includes('alumno') && Number(user.idStudent) === Number(justification.studentId);

const canManage = (user, justification) => {
  if (user.roles.includes('admin')) return true;
  if (isOwner(user, justification)) return true;
  if (user.roles.includes('tutor') || user.roles.includes('directora')) {
    const scope = justificantesModel.buildScope(user);
    return scope.sql !== '1 = 0';
  }
  return false;
};

const resolveDocumentType = async (rawId) => {
  const types = await catalogosModel.getDocumentTypes();
  if (types.length === 0) throw unprocessable('No hay tipos de documento configurados');
  const id = validators.toInt(rawId, null);
  if (!id) return types.find((type) => type.code === 'otro') || types[types.length - 1];
  const found = types.find((type) => type.id === id);
  if (!found) throw badRequest('El tipo de documento seleccionado no existe');
  return found;
};

const validateSubjects = async (rawSubjects, absenceDates, context) => {
  const parsed = parseJsonInput(rawSubjects, []);
  if (!Array.isArray(parsed)) throw badRequest('La lista de materias es inválida');
  if (parsed.length === 0) return [];

  const subjectIds = [...new Set(parsed.map((item) => {
    const id = typeof item === 'object' && item !== null
      ? validators.toInt(item.materia_id ?? item.subjectId ?? item.id_subject ?? item.id, null)
      : validators.toInt(item, null);
    return id;
  }).filter(Boolean))];

  if (subjectIds.length !== parsed.length && parsed.some((item) => typeof item === 'object')) {
    // Los objetos pueden repetir materia para distintas fechas; no es un error.
  }
  if (subjectIds.length === 0) throw badRequest('Seleccione al menos una materia válida');

  const validSubjects = await justificantesModel.getSubjectsByIds(subjectIds, context.idCareer);
  if (validSubjects.length !== subjectIds.length) {
    throw badRequest('Una o más materias no pertenecen a la carrera del estudiante');
  }

  const teacherIds = [...new Set(parsed.map((item) =>
    typeof item === 'object' && item !== null
      ? validators.toInt(item.docente_id ?? item.teacherId ?? item.id_teacher, null)
      : null
  ).filter(Boolean))];
  if (teacherIds.length > 0) {
    const activeTeachers = await justificantesModel.getActiveTeachers(teacherIds);
    if (activeTeachers.length !== teacherIds.length) {
      throw badRequest('Uno o más docentes no existen o están inactivos');
    }
  }

  const rows = [];
  const seen = new Set();
  for (const item of parsed) {
    const subjectId = typeof item === 'object' && item !== null
      ? validators.toInt(item.materia_id ?? item.subjectId ?? item.id_subject ?? item.id, null)
      : validators.toInt(item, null);
    const teacherId = typeof item === 'object' && item !== null
      ? validators.toInt(item.docente_id ?? item.teacherId ?? item.id_teacher, null)
      : null;
    const observations = typeof item === 'object' && item !== null
      ? validators.toText(item.observaciones ?? item.observations).slice(0, 255) || null
      : null;
    const requestedDate = typeof item === 'object' && item !== null
      ? (item.fecha || item.absenceDate || item.absence_date || null)
      : null;

    const targetDates = requestedDate ? [String(requestedDate).slice(0, 10)] : absenceDates;
    for (const date of targetDates) {
      if (!absenceDates.includes(date)) {
        throw badRequest(`La fecha ${date} de la materia no está dentro de las inasistencias registradas`);
      }
      const key = `${subjectId}|${teacherId || 0}|${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ subjectId, teacherId, date, observations });
    }
  }
  return rows;
};

const buildCorePayload = async (body, options) => {
  const errors = [];
  const context = options.context;
  const existing = options.existing || null;
  const issueDate = existing ? existing.issueDate : dates.todayISO();

  const reasonTypeId = validators.toInt(body.motivo_id ?? body.reasonTypeId, existing ? existing.reasonTypeId : null);
  if (!reasonTypeId) errors.push('Seleccione el motivo del justificante');
  const reasonType = reasonTypeId ? await justificantesModel.getReasonType(reasonTypeId) : null;
  if (reasonTypeId && (!reasonType || !reasonType.active)) {
    errors.push('El motivo seleccionado no está disponible');
  }

  const reason = validators.requiredString(errors, body.motivo ?? body.reason, 'motivo', 'El motivo', { max: 2000, min: 10 });
  const observations = validators.optionalString(errors, body.observaciones ?? body.observations, 'observaciones', 'Las observaciones', { max: 2000 });
  const startDate = validators.requiredDate(errors, body.fecha_inicio ?? body.startDate, 'La fecha inicial');
  const endDate = validators.requiredDate(errors, body.fecha_fin ?? body.endDate, 'La fecha final');
  const isCritical = validators.toBoolean(body.caso_critico ?? body.isCritical, false);
  const today = dates.todayISO();

  if (startDate && endDate) {
    if (endDate < startDate) errors.push('La fecha final no puede ser anterior a la fecha inicial');
    if (endDate > today) errors.push('No se pueden justificar inasistencias futuras');
    if (dates.daysBetween(startDate, endDate) > 60) errors.push('El periodo no puede exceder 60 días naturales');
    if (dates.daysBetween(startDate, today) > 365) errors.push('No se pueden justificar inasistencias de hace más de un año');
  }

  let absenceDates = parseJsonInput(body.fechas ?? body.absenceDates, null);
  if (absenceDates !== null && !Array.isArray(absenceDates)) {
    errors.push('La lista de fechas de inasistencia es inválida');
    absenceDates = [];
  }
  if (!absenceDates || absenceDates.length === 0) {
    absenceDates = startDate && endDate ? dates.eachDate(startDate, endDate, { skipWeekends: true }) : [];
    if (absenceDates.length === 0 && startDate) absenceDates = [startDate];
  }

  absenceDates = [...new Set(absenceDates.map((date) => String(date).slice(0, 10)))];
  if (absenceDates.length > 60) errors.push('No se pueden registrar más de 60 fechas de inasistencia');
  for (const date of absenceDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`La fecha de inasistencia ${date} no es válida`);
      continue;
    }
    if (startDate && endDate && (date < startDate || date > endDate)) {
      errors.push(`La fecha ${date} está fuera del periodo indicado`);
    }
    if (date > today) {
      errors.push(`La fecha ${date} es futura y no puede justificarse`);
    }
  }

  if (errors.length > 0) {
    validators.ensureNoErrors(errors);
  }

  let subjects = [];
  if (context) {
    subjects = await validateSubjects(body.materias ?? body.subjects, absenceDates, context);
  }

  const requiresDocument = Boolean(isCritical || (reasonType && reasonType.requiresDocument));
  const documentType = options.file ? await resolveDocumentType(body.tipo_documento_id ?? body.documentTypeId) : null;

  return {
    issueDate,
    startDate,
    endDate,
    reasonTypeId,
    reason,
    observations,
    isCritical,
    absenceDates,
    subjects,
    requiresDocument,
    documentType,
  };
};

const buildDocumentPayload = (file, documentType, uploadedBy) => {
  if (!file) return null;
  const persisted = files.persistUploadedDocument(file);
  return {
    documentTypeId: documentType.id,
    originalName: persisted.originalName,
    storedName: persisted.storedName,
    storagePath: persisted.storagePath,
    mimeType: persisted.mimeType,
    extension: persisted.extension,
    size: persisted.size,
    checksum: persisted.checksum,
    uploadedBy,
  };
};

const list = async (user, query) => {
  const scope = justificantesModel.buildScope(user);
  const { page, limit } = pagination(query);
  return justificantesModel.list({
    filters: filtersFromQuery(query),
    scope,
    page,
    limit,
  });
};

const detail = async (id, user) => loadScoped(id, user);

const formContext = async (user) => {
  const context = user.idStudent ? await justificantesModel.getStudentContext(user.idStudent) : null;
  if (!context) throw forbidden('El perfil no tiene un estudiante activo asociado');
  const [subjects, reasonTypes, documentTypes, guardians, settings] = await Promise.all([
    catalogosModel.getSubjects(context.idCareer),
    catalogosModel.getReasonTypes(),
    catalogosModel.getDocumentTypes(),
    justificantesModel.getGuardians(context.idStudent),
    catalogosModel.getPublicSettings(),
  ]);
  return { student: context, subjects, reasonTypes, documentTypes, guardians, settings };
};

const create = async (user, body, file, ip) => {
  if (!user.idStudent) throw forbidden('El perfil no tiene un estudiante asociado');
  const context = await justificantesModel.getStudentContext(user.idStudent);
  if (!context) throw unprocessable('El estudiante no está activo');

  const core = await buildCorePayload(body, { context, file });
  if (core.requiresDocument && !file) {
    throw badRequest('Este motivo o caso crítico requiere adjuntar un comprobante PDF, JPG o PNG');
  }

  let documentPayload = null;
  try {
    documentPayload = buildDocumentPayload(file, core.documentType, user.id);
    const created = await justificantesModel.create({
      studentId: context.idStudent,
      institutionId: context.idInstitution,
      createdBy: user.id,
      issueDate: core.issueDate,
      startDate: core.startDate,
      endDate: core.endDate,
      reasonTypeId: core.reasonTypeId,
      reason: core.reason,
      observations: core.observations,
      isCritical: core.isCritical,
      absenceDates: core.absenceDates,
      subjects: core.subjects,
      document: documentPayload,
    }, { userId: user.id, ip, source: 'api:crear_justificante' });

    const result = await loadScoped(created.id, user);
    return result;
  } catch (error) {
    if (documentPayload) files.removePrivateFile(documentPayload.storagePath);
    throw error;
  }
};

const update = async (id, user, body, file, ip) => {
  const justification = await loadScoped(id, user);
  if (!canManage(user, justification)) throw forbidden();
  if (!isOwner(user, justification) && !user.roles.includes('admin')) {
    throw forbidden('Solo el alumno propietario puede editar su justificante');
  }
  assertStatus(justification, EDITABLE_STATUSES, 'Solo se puede editar un justificante pendiente');
  assertStatus(justification, ['pendiente'], 'Un justificante en revisión o resuelto ya no puede editarse');

  const context = await justificantesModel.getStudentContext(justification.studentId);
  const core = await buildCorePayload(body, { context, existing: justification, file });

  if (core.requiresDocument && justification.documents.length === 0 && !file) {
    throw badRequest('El justificante es crítico o su motivo exige comprobante; adjunte uno antes de guardar');
  }

  await justificantesModel.update(id, {
    reasonTypeId: core.reasonTypeId,
    startDate: core.startDate,
    endDate: core.endDate,
    isCritical: core.isCritical,
    reason: core.reason,
    observations: core.observations,
    absenceDates: core.absenceDates,
    subjects: core.subjects,
    updatedBy: user.id,
  }, { userId: user.id, ip, source: 'api:editar_justificante' });

  if (file) {
    await addDocument(id, user, file, body.tipo_documento_id, ip);
  }

  return loadScoped(id, user);
};

const startReview = async (id, user, ip) => {
  const justification = await loadScoped(id, user);
  if (justification.status === 'en_revision') return justification;
  assertStatus(justification, ['pendiente'], 'Solo un justificante pendiente puede pasar a revisión');
  await justificantesModel.setStatus(id, 'en_revision', user.id, 'Revisión iniciada por el tutor educativo', {
    userId: user.id, ip, source: 'api:iniciar_revision',
  });
  return loadScoped(id, user);
};

const selectStaff = (user, position) => {
  const staff = (user.staff || []).find((item) => item.position === position);
  if (!staff) {
    throw forbidden(`No hay un responsable con el perfil ${position} vinculado a su cuenta`);
  }
  return staff;
};

const registerSignature = async (justification, user, kind, ip) => {
  const signerType = kind === 'tutor' ? 'tutor_educativo' : 'director_carrera';
  const existing = justification.signatures.find((signature) => signature.signerType === signerType);
  if (existing && existing.status === 'firmado') {
    throw conflict('La firma ya fue registrada y no puede sustituirse');
  }

  const staff = selectStaff(user, signerType);
  const signerName = staff.full_name || user.fullName;
  const svg = buildSignatureSvg({
    name: signerName,
    role: signerType === 'tutor_educativo' ? 'Tutor educativo' : 'Dirección de carrera',
    date: dates.todayISO(),
    folio: justification.folio,
  });
  const stored = files.persistGeneratedSvg(config.uploads.signatures, 'firma', svg);

  try {
    await justificantesModel.registerSignature(justification.id, {
      signerType,
      staffId: staff.id_staff,
      guardianId: null,
      signerName,
      fileRef: stored.storagePath,
      sha256: stored.checksum,
    }, { userId: user.id, ip, source: `api:firmar_${kind}` });
  } catch (error) {
    files.removePrivateFile(stored.storagePath);
    throw error;
  }
  return { signerName, stored };
};

const sign = async (id, user, kind, ip) => {
  const justification = await loadScoped(id, user);
  assertStatus(justification, REVIEWABLE_STATUSES, 'El justificante ya está resuelto o no admite firma');

  if (kind === 'director') {
    assertStatus(justification, ['en_revision'], 'La dirección solo puede firmar un justificante en revisión');
  }

  if (kind === 'tutor' && justification.status === 'pendiente') {
    await justificantesModel.setStatus(id, 'en_revision', user.id, 'Revisión iniciada al firmar el tutor', {
      userId: user.id, ip, source: 'api:iniciar_revision',
    });
  }

  const current = await loadScoped(id, user);
  await registerSignature(current, user, kind, ip);
  return loadScoped(id, user);
};

const ensureDirectorSignature = async (justification, user, ip) => {
  const existing = justification.signatures.find(
    (signature) => signature.signerType === 'director_carrera' && signature.status === 'firmado'
  );
  if (existing) return;
  await registerSignature(justification, user, 'director', ip);
};

const ensureStamp = async (justification, user, ip) => {
  if (justification.stamp) return;
  const institution = await catalogosModel.getInstitution(justification.institutionId);
  const svg = buildStampSvg({
    institution: institution ? institution.acronym : 'UTXJ',
    folio: justification.folio,
    date: dates.todayISO(),
    director: user.fullName,
  });
  const stored = files.persistGeneratedSvg(config.uploads.stamps, 'sello', svg);
  try {
    await justificantesModel.registerStamp(justification.id, {
      institutionId: justification.institutionId,
      fileRef: stored.storagePath,
      sha256: stored.checksum,
      appliedBy: user.id,
    }, { userId: user.id, ip, source: 'api:aplicar_sello' });
  } catch (error) {
    files.removePrivateFile(stored.storagePath);
    throw error;
  }
};

const approve = async (id, user, body, ip) => {
  let justification = await loadScoped(id, user);
  assertStatus(justification, ['en_revision'], 'Solo un justificante en revisión puede aprobarse');

  if (justification.isCritical) {
    const validated = justification.documents.filter((document) => document.validationStatus === 'validado');
    if (validated.length === 0) {
      throw unprocessable('Un caso crítico requiere al menos un comprobante validado por el tutor');
    }
  }
  const hasTutor = justification.signatures.some(
    (signature) => signature.signerType === 'tutor_educativo' && signature.status === 'firmado'
  );
  if (!hasTutor) {
    throw unprocessable('Falta la firma del tutor educativo antes de la aprobación');
  }

  await ensureDirectorSignature(justification, user, ip);
  justification = await loadScoped(id, user);
  await ensureStamp(justification, user, ip);

  const comment = validators.optionalString(
    [],
    body.comentario ?? body.comment,
    'comentario',
    'El comentario',
    { max: 500 }
  );

  await justificantesModel.setStatus(
    id,
    'aprobado',
    user.id,
    comment || 'Justificante aprobado, firmado y sellado por la dirección',
    { userId: user.id, ip, source: 'api:aprobar_justificante' }
  );
  return loadScoped(id, user);
};

const reject = async (id, user, body, ip) => {
  const justification = await loadScoped(id, user);
  assertStatus(justification, REVIEWABLE_STATUSES, 'El justificante ya está resuelto');

  const errors = [];
  const comment = validators.requiredString(
    errors,
    body.comentario ?? body.comment,
    'comentario',
    'El comentario de rechazo',
    { min: 5, max: 500 }
  );
  validators.ensureNoErrors(errors);

  await justificantesModel.setStatus(id, 'rechazado', user.id, comment, {
    userId: user.id, ip, source: 'api:rechazar_justificante',
  });
  return loadScoped(id, user);
};

const cancel = async (id, user, body, ip) => {
  const justification = await loadScoped(id, user);
  if (!isOwner(user, justification) && !user.roles.includes('admin')) {
    throw forbidden('Solo el alumno propietario puede cancelar su justificante');
  }
  assertStatus(justification, ['pendiente'], 'Solo se puede cancelar un justificante pendiente');
  const reason = validators.optionalString([], body.comentario, 'comentario', 'El comentario', { max: 500 })
    || 'Cancelado por el alumno';
  await justificantesModel.setStatus(id, 'cancelado', user.id, reason, {
    userId: user.id, ip, source: 'api:cancelar_justificante',
  });
  return loadScoped(id, user);
};

const addDocument = async (id, user, file, rawDocumentType, ip) => {
  const justification = await loadScoped(id, user);
  if (!canManage(user, justification)) throw forbidden();
  if (FINAL_STATUSES.includes(justification.status)) {
    throw conflict('No se pueden agregar documentos a un justificante finalizado');
  }
  if (!file) throw badRequest('Seleccione un archivo PDF, JPG o PNG');

  const documentType = await resolveDocumentType(rawDocumentType);
  const payload = buildDocumentPayload(file, documentType, user.id);
  try {
    await justificantesModel.addDocument(id, payload, {
      userId: user.id, ip, source: 'api:cargar_documento',
    });
  } catch (error) {
    files.removePrivateFile(payload.storagePath);
    throw error;
  }
  return loadScoped(id, user);
};

const validateDocument = async (id, documentId, user, body, ip) => {
  const justification = await loadScoped(id, user);
  if (FINAL_STATUSES.includes(justification.status)) {
    throw conflict('El justificante ya está finalizado');
  }
  const document = justification.documents.find((item) => item.id === Number(documentId));
  if (!document) throw notFound('El documento no existe en este justificante');

  const status = String(body.estado || body.validationStatus || '').toLowerCase();
  if (!['pendiente', 'validado', 'rechazado'].includes(status)) {
    throw badRequest('Indique si el documento se valida o se rechaza');
  }
  const errors = [];
  const notes = validators.optionalString(errors, body.notas ?? body.notes, 'notas', 'Las observaciones', { max: 500 });
  if (status === 'rechazado' && !notes) errors.push('Indique el motivo del rechazo del documento');
  validators.ensureNoErrors(errors);

  await justificantesModel.validateDocument(document.id, status, user.id, notes, {
    userId: user.id, ip, source: 'api:validar_documento',
  });
  return loadScoped(id, user);
};

const deleteDocument = async (id, documentId, user, ip) => {
  const justification = await loadScoped(id, user);
  const document = justification.documents.find((item) => item.id === Number(documentId));
  if (!document) throw notFound('El documento no existe en este justificante');

  const ownerAllowed = isOwner(user, justification) && justification.status === 'pendiente';
  if (!ownerAllowed && !user.roles.includes('admin')) {
    throw forbidden('Solo el alumno puede eliminar comprobantes de un justificante pendiente');
  }
  if (FINAL_STATUSES.includes(justification.status)) {
    throw conflict('No se pueden eliminar documentos de un justificante finalizado');
  }

  const reasonType = await justificantesModel.getReasonType(justification.reasonTypeId);
  const requiresDocument = justification.isCritical || (reasonType && reasonType.requiresDocument);
  if (requiresDocument && justification.documents.length <= 1) {
    throw unprocessable('No puede eliminar el único comprobante de un justificante que lo requiere');
  }

  const storagePath = await justificantesModel.findDocument(id, document.id);
  await justificantesModel.removeDocument(document.id);
  if (storagePath) files.removePrivateFile(storagePath.storagePath);
  return loadScoped(id, user);
};

const downloadDocument = async (id, documentId, user, res) => {
  await loadScoped(id, user);
  const document = await justificantesModel.findDocument(id, documentId);
  if (!document) throw notFound('El documento no existe');
  const absolute = files.absolutePathFromStorage(document.storagePath);
  if (!fs.existsSync(absolute)) throw notFound('El archivo ya no está disponible en el servidor');

  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Content-Length', document.fileSize);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.sendFile(path.resolve(absolute));
};

const printPayload = async (id, user) => {
  const justification = await loadScoped(id, user);
  const signatures = justification.signatures.map((signature) => {
    let svg = null;
    if (signature.status === 'firmado' && signature.fileRef) {
      try {
        svg = files.readPrivateFile(signature.fileRef).toString('utf8');
      } catch (error) {
        svg = null;
      }
    }
    return { ...signature, svg };
  });

  let stamp = null;
  if (justification.stamp) {
    let svg = null;
    try {
      svg = files.readPrivateFile(justification.stamp.fileRef).toString('utf8');
    } catch (error) {
      svg = null;
    }
    stamp = { ...justification.stamp, svg };
  }

  return {
    ...justification,
    signatures,
    stamp,
    issuedBy: 'Universidad Tecnológica de Xicotepec de Juárez',
    verificationText: `Documento verificable con el folio ${justification.folio}`,
  };
};

const dashboard = async (user) => {
  const scope = justificantesModel.buildScope(user);
  const [stats, recent] = await Promise.all([
    justificantesModel.stats(scope),
    justificantesModel.list({ filters: {}, scope, page: 1, limit: 6 }),
  ]);

  const response = { stats, recent: recent.items, roles: user.roles };
  if (user.roles.includes('tutor')) {
    const pendingDocs = await justificantesModel.list({
      filters: { pendingForReview: true },
      scope,
      page: 1,
      limit: 5,
    });
    response.reviewQueue = pendingDocs.items;
  }
  if (user.roles.includes('directora')) {
    const toApprove = await justificantesModel.list({
      filters: { status: 'en_revision' },
      scope,
      page: 1,
      limit: 5,
    });
    response.approvalQueue = toApprove.items;
  }
  return response;
};

const expire = async (user) => {
  await justificantesModel.pendingExpiration(user ? user.id : null);
  return true;
};

module.exports = {
  list,
  detail,
  formContext,
  create,
  update,
  startReview,
  sign,
  approve,
  reject,
  cancel,
  addDocument,
  validateDocument,
  deleteDocument,
  downloadDocument,
  printPayload,
  dashboard,
  expire,
  isOwner,
  canManage,
};
