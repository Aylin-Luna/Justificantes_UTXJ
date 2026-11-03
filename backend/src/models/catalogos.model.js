'use strict';

const { query, queryOne, execute } = require('../../database/pool');

const getInstitution = async (id = 1) => {
  const row = await queryOne(
    `SELECT id_institution, name, acronym, address, city, state_name, country,
            phone, email, logo_path, active
       FROM tb_institutions WHERE id_institution = ? LIMIT 1`,
    [id]
  );
  return row ? {
    id: row.id_institution,
    name: row.name,
    acronym: row.acronym,
    address: row.address,
    city: row.city,
    stateName: row.state_name,
    country: row.country,
    phone: row.phone,
    email: row.email,
    logoPath: row.logo_path,
    active: Boolean(row.active),
  } : null;
};

const getCareers = async () => {
  const rows = await query(
    `SELECT c.id_career, c.code, c.name, c.level, c.id_institution,
            (SELECT COUNT(*) FROM tb_groups g WHERE g.id_career = c.id_career AND g.active = 1) AS groups_count
       FROM tb_careers c
      WHERE c.active = 1
      ORDER BY c.name`
  );
  return rows.map((row) => ({
    id: row.id_career,
    code: row.code,
    name: row.name,
    level: row.level,
    institutionId: row.id_institution,
    groupsCount: Number(row.groups_count),
  }));
};

const getGroups = async (idCareer = null) => {
  const params = [];
  let where = 'g.active = 1';
  if (idCareer) {
    where += ' AND g.id_career = ?';
    params.push(idCareer);
  }
  const rows = await query(
    `SELECT g.id_group, g.id_career, g.name, g.grade, g.shift, g.school_period,
            g.capacity, c.name AS career_name, c.code AS career_code,
            (SELECT COUNT(*) FROM tb_students s WHERE s.id_group = g.id_group AND s.status = 'activo') AS students_count
       FROM tb_groups g
       JOIN tb_careers c ON c.id_career = g.id_career
      WHERE ${where}
      ORDER BY c.name, g.grade, g.name`,
    params
  );
  return rows.map((row) => ({
    id: row.id_group,
    careerId: row.id_career,
    careerName: row.career_name,
    careerCode: row.career_code,
    name: row.name,
    grade: row.grade,
    shift: row.shift,
    schoolPeriod: row.school_period,
    capacity: row.capacity,
    studentsCount: Number(row.students_count),
  }));
};

const getSubjects = async (idCareer = null) => {
  const params = [];
  let where = 's.active = 1';
  if (idCareer) {
    where += ' AND s.id_career = ?';
    params.push(idCareer);
  }
  const rows = await query(
    `SELECT s.id_subject, s.id_career, s.code, s.name, s.credits, s.semester,
            c.name AS career_name
       FROM tb_subjects s
       JOIN tb_careers c ON c.id_career = s.id_career
      WHERE ${where}
      ORDER BY c.name, s.semester, s.name`,
    params
  );
  return rows.map((row) => ({
    id: row.id_subject,
    careerId: row.id_career,
    careerName: row.career_name,
    code: row.code,
    name: row.name,
    credits: row.credits,
    semester: row.semester,
  }));
};

const getTeachers = async (idCareer = null) => {
  const params = [];
  let where = 't.active = 1';
  if (idCareer) {
    where += ` AND EXISTS (
      SELECT 1 FROM tbd_justification_subjects js
      JOIN tb_subjects s ON s.id_subject = js.id_subject
      JOIN tb_justifications j ON j.id_justification = js.id_justification
      JOIN tb_students st ON st.id_student = j.id_student
      JOIN tb_groups g ON g.id_group = st.id_group
      JOIN tb_careers c ON c.id_career = g.id_career
      WHERE js.id_teacher = t.id_teacher AND c.id_career = ?
    )`;
    params.push(idCareer);
  }
  const rows = await query(
    `SELECT t.id_teacher, t.employee_number, t.professional_title, t.first_name,
            t.last_name, t.second_last_name, t.email, t.department
       FROM tb_teachers t
      WHERE ${where}
      ORDER BY t.last_name, t.first_name`,
    params
  );
  return rows.map((row) => ({
    id: row.id_teacher,
    employeeNumber: row.employee_number,
    fullName: [row.professional_title, row.first_name, row.last_name, row.second_last_name]
      .filter(Boolean).join(' '),
    email: row.email,
    department: row.department,
  }));
};

const getReasonTypes = async () => {
  const rows = await query(
    `SELECT id_reason_type, code, name, description, requires_document
       FROM tb_reason_types WHERE active = 1 ORDER BY id_reason_type`
  );
  return rows.map((row) => ({
    id: row.id_reason_type,
    code: row.code,
    name: row.name,
    description: row.description,
    requiresDocument: Boolean(row.requires_document),
  }));
};

const getDocumentTypes = async () => {
  const rows = await query(
    `SELECT id_document_type, code, name, description, allowed_extensions, requires_validation
       FROM tb_document_types WHERE active = 1 ORDER BY id_document_type`
  );
  return rows.map((row) => ({
    id: row.id_document_type,
    code: row.code,
    name: row.name,
    description: row.description,
    allowedExtensions: row.allowed_extensions.split(',').map((item) => item.trim()),
    requiresValidation: Boolean(row.requires_validation),
  }));
};

const getStatuses = async () => {
  const rows = await query(
    `SELECT id_status, code, name, description, is_final, sort_order
       FROM tb_justification_statuses ORDER BY sort_order`
  );
  return rows.map((row) => ({
    id: row.id_status,
    code: row.code,
    name: row.name,
    description: row.description,
    isFinal: Boolean(row.is_final),
  }));
};

const getSettings = async () => {
  const rows = await query(
    `SELECT s.setting_key, s.setting_value, s.description, s.updated_at,
            u.full_name AS updated_by_name
       FROM tb_system_settings s
       LEFT JOIN tb_users u ON u.id_user = s.updated_by
      ORDER BY s.setting_key`
  );
  return rows.map((row) => ({
    key: row.setting_key,
    value: row.setting_value,
    description: row.description,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by_name,
  }));
};

const getPublicSettings = async () => {
  const settings = await getSettings();
  const keys = ['validity_days', 'max_file_size_mb', 'allowed_extensions', 'password_min_length'];
  return settings
    .filter((setting) => keys.includes(setting.key))
    .reduce((accumulator, setting) => {
      accumulator[setting.key] = setting.value;
      return accumulator;
    }, {});
};

const updateSetting = async (key, value, userId) => {
  const result = await execute(
    `UPDATE tb_system_settings
        SET setting_value = ?, updated_by = ?
      WHERE setting_key = ?`,
    [value, userId, key]
  );
  if (result.affectedRows === 0) return null;
  const settings = await getSettings();
  return settings.find((setting) => setting.key === key) || null;
};

const getNonWorkingDays = async (idInstitution = 1) => {
  const rows = await query(
    `SELECT id_non_working_day, non_working_date, description, is_recurring
       FROM tb_non_working_days
      WHERE id_institution = ?
      ORDER BY non_working_date`,
    [idInstitution]
  );
  return rows.map((row) => ({
    id: row.id_non_working_day,
    date: row.non_working_date,
    description: row.description,
    isRecurring: Boolean(row.is_recurring),
  }));
};

const getRoles = async () => {
  const rows = await query('SELECT id_role, code, name, description FROM tb_roles ORDER BY id_role');
  return rows.map((row) => ({
    id: row.id_role,
    code: row.code,
    name: row.name,
    description: row.description,
  }));
};

module.exports = {
  getInstitution,
  getCareers,
  getGroups,
  getSubjects,
  getTeachers,
  getReasonTypes,
  getDocumentTypes,
  getStatuses,
  getSettings,
  getPublicSettings,
  updateSetting,
  getNonWorkingDays,
  getRoles,
};
