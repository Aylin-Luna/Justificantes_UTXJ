'use strict';

const { query, queryOne, execute, withTransaction } = require('../../database/pool');
const { conflict, badRequest } = require('../utils/errors');

const USER_COLUMNS = `
  u.id_user, u.username, u.email, u.password_hash, u.full_name,
  u.id_student, u.id_teacher, u.active, u.failed_attempts, u.locked_until,
  u.last_login, u.created_at, u.updated_at
`;

const hydrateUser = async (row) => {
  if (!row) return null;
  const roles = await query(
    `SELECT r.id_role, r.code, r.name
       FROM tbd_user_roles ur
       JOIN tb_roles r ON r.id_role = ur.id_role
      WHERE ur.id_user = ?
      ORDER BY r.id_role`,
    [row.id_user]
  );
  const staff = await query(
    `SELECT id_staff, id_institution, id_career, position, full_name
       FROM tb_academic_staff
      WHERE id_user = ? AND active = 1
      ORDER BY id_staff`,
    [row.id_user]
  );
  const student = row.id_student
    ? await queryOne(
        `SELECT s.id_student, s.enrollment, s.first_name, s.last_name, s.second_last_name,
                s.email, s.phone, s.status, s.id_group,
                g.name AS group_name, g.grade, g.shift, g.school_period,
                c.id_career, c.name AS career_name, c.code AS career_code
           FROM tb_students s
           JOIN tb_groups g ON g.id_group = s.id_group
           JOIN tb_careers c ON c.id_career = g.id_career
          WHERE s.id_student = ?`,
        [row.id_student]
      )
    : null;
  const teacher = row.id_teacher
    ? await queryOne(
        `SELECT t.id_teacher, t.employee_number, t.professional_title,
                t.first_name, t.last_name, t.second_last_name, t.email, t.department
           FROM tb_teachers t
          WHERE t.id_teacher = ?`,
        [row.id_teacher]
      )
    : null;

  return {
    id: row.id_user,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    active: Boolean(row.active),
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    lastLogin: row.last_login,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    idStudent: row.id_student,
    idTeacher: row.id_teacher,
    roles: roles.map((role) => role.code),
    roleDetails: roles,
    staff,
    student,
    teacher,
  };
};

const findByUsernameOrEmail = async (identifier) => {
  const row = await queryOne(
    `SELECT ${USER_COLUMNS}
       FROM tb_users u
      WHERE u.username = ? OR u.email = ?
      LIMIT 1`,
    [identifier, identifier]
  );
  return hydrateUser(row);
};

const findById = async (idUser) => {
  const row = await queryOne(
    `SELECT ${USER_COLUMNS} FROM tb_users u WHERE u.id_user = ? LIMIT 1`,
    [idUser]
  );
  return hydrateUser(row);
};

const findPublicById = async (idUser) => {
  const user = await findById(idUser);
  if (!user) return null;
  delete user.passwordHash;
  return user;
};

const registerFailedAttempt = async (idUser, maxAttempts, lockMinutes) => {
  await execute(
    `UPDATE tb_users
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE
              WHEN failed_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
              ELSE locked_until
            END
      WHERE id_user = ?`,
    [maxAttempts, lockMinutes, idUser]
  );
  return queryOne(
    'SELECT failed_attempts, locked_until FROM tb_users WHERE id_user = ?',
    [idUser]
  );
};

const registerSuccessfulLogin = async (idUser) => {
  await execute(
    `UPDATE tb_users
        SET failed_attempts = 0, locked_until = NULL, last_login = NOW()
      WHERE id_user = ?`,
    [idUser]
  );
};

const updatePassword = async (idUser, passwordHash) => {
  await execute(
    `UPDATE tb_users
        SET password_hash = ?, failed_attempts = 0, locked_until = NULL
      WHERE id_user = ?`,
    [passwordHash, idUser]
  );
};

const listUsers = async (filters = {}) => {
  const where = [];
  const params = [];
  if (filters.search) {
    where.push('(u.username LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)');
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters.active !== null && filters.active !== undefined) {
    where.push('u.active = ?');
    params.push(filters.active ? 1 : 0);
  }
  if (filters.role) {
    where.push(`EXISTS (
      SELECT 1 FROM tbd_user_roles ur
      JOIN tb_roles r ON r.id_role = ur.id_role
      WHERE ur.id_user = u.id_user AND r.code = ?
    )`);
    params.push(filters.role);
  }

  const rows = await query(
    `SELECT ${USER_COLUMNS},
            (SELECT GROUP_CONCAT(r.code ORDER BY r.id_role)
               FROM tbd_user_roles ur
               JOIN tb_roles r ON r.id_role = ur.id_role
              WHERE ur.id_user = u.id_user) AS roles
       FROM tb_users u
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY u.full_name`,
    params
  );

  return rows.map((row) => ({
    id: row.id_user,
    username: row.username,
    email: row.email,
    fullName: row.full_name,
    active: Boolean(row.active),
    roles: row.roles ? row.roles.split(',') : [],
    lastLogin: row.last_login,
    createdAt: row.created_at,
    idStudent: row.id_student,
    idTeacher: row.id_teacher,
  }));
};

const setActive = async (idUser, active) => {
  await execute('UPDATE tb_users SET active = ? WHERE id_user = ?', [active ? 1 : 0, idUser]);
  return findPublicById(idUser);
};

const setRoles = async (idUser, roleCodes, assignedBy) => {
  const roles = await query(
    `SELECT id_role, code FROM tb_roles WHERE code IN (${roleCodes.map(() => '?').join(', ')})`,
    roleCodes
  );
  if (roles.length !== new Set(roleCodes).size) {
    throw new Error('Uno o más roles no existen');
  }
  await execute('DELETE FROM tbd_user_roles WHERE id_user = ?', [idUser]);
  for (const role of roles) {
    await execute(
      'INSERT INTO tbd_user_roles (id_user, id_role, assigned_by) VALUES (?, ?, ?)',
      [idUser, role.id_role, assignedBy || null]
    );
  }
  return findPublicById(idUser);
};

const resetPassword = async (idUser, passwordHash) => {
  await execute(
    `UPDATE tb_users
        SET password_hash = ?, failed_attempts = 0, locked_until = NULL
      WHERE id_user = ?`,
    [passwordHash, idUser]
  );
  return findPublicById(idUser);
};

/**
 * Crea (o vincula) el expediente de un alumno y su cuenta de acceso en una
 * sola transacción. Solo se vincula un expediente existente cuando la
 * matrícula y el correo coinciden exactamente y aún no tiene cuenta.
 */
const registerStudentAccount = async (data, audit = {}) => withTransaction(async (connection) => {
  const enrollment = data.enrollment;
  const email = data.email;

  const [groupRows] = await connection.query(
    `SELECT id_group, id_career
       FROM tb_groups
      WHERE id_group = ? AND active = 1
      LIMIT 1`,
    [data.idGroup]
  );
  if (groupRows.length === 0) {
    throw badRequest('El grupo seleccionado no está disponible');
  }
  if (data.idCareer && groupRows[0].id_career !== data.idCareer) {
    throw badRequest('El grupo seleccionado no corresponde a la carrera');
  }

  const [studentRows] = await connection.query(
    `SELECT s.id_student, s.enrollment, s.email, s.id_group, s.status,
            s.first_name, s.last_name, s.second_last_name,
            (SELECT u.id_user FROM tb_users u WHERE u.id_student = s.id_student LIMIT 1) AS id_user
       FROM tb_students s
      WHERE s.enrollment = ?
      LIMIT 1`,
    [enrollment]
  );

  let idStudent;
  let fullName = data.fullName;
  const existingStudent = studentRows[0];
  if (existingStudent) {
    if (existingStudent.id_user) {
      throw conflict('La matrícula ya tiene una cuenta registrada. Inicie sesión o acuda a Control Escolar.');
    }
    if (existingStudent.status !== 'activo') {
      throw conflict('El expediente no está activo. Acuda a Control Escolar para regularizarlo.');
    }
    if (!existingStudent.email || existingStudent.email.toLowerCase() !== email.toLowerCase()) {
      throw conflict('La matrícula ya existe en Control Escolar. Acuda a Control Escolar para vincular su cuenta.');
    }
    idStudent = existingStudent.id_student;
    fullName = [existingStudent.first_name, existingStudent.last_name, existingStudent.second_last_name]
      .filter(Boolean)
      .join(' ');
  } else {
    const [studentEmailRows] = await connection.query(
      'SELECT id_student FROM tb_students WHERE email = ? LIMIT 1',
      [email]
    );
    if (studentEmailRows.length > 0) {
      throw conflict('El correo electrónico ya está registrado en otro expediente. Acuda a Control Escolar.');
    }

    const [studentResult] = await connection.query(
      `INSERT INTO tb_students
        (id_group, enrollment, first_name, last_name, second_last_name, email, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'activo')`,
      [
        data.idGroup,
        enrollment,
        data.firstName,
        data.lastName,
        data.secondLastName || null,
        email,
        data.phone || null,
      ]
    );
    idStudent = studentResult.insertId;
  }

  const [userConflicts] = await connection.query(
    `SELECT id_user, username, email
       FROM tb_users
      WHERE username = ? OR email = ?
      LIMIT 1`,
    [data.username, email]
  );
  if (userConflicts.length > 0) {
    const row = userConflicts[0];
    if (row.username.toLowerCase() === data.username.toLowerCase()) {
      throw conflict('El nombre de usuario ya está en uso. Elija otro.');
    }
    throw conflict('El correo electrónico ya está asociado a una cuenta.');
  }

  const [roleRows] = await connection.query(
    "SELECT id_role FROM tb_roles WHERE code = 'alumno' LIMIT 1"
  );
  if (roleRows.length === 0) {
    throw new Error('El rol de alumno no está configurado en la base de datos');
  }

  const [userResult] = await connection.query(
    `INSERT INTO tb_users (username, email, password_hash, full_name, id_student, active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [data.username, email, data.passwordHash, fullName, idStudent]
  );
  const idUser = userResult.insertId;

  await connection.query(
    'INSERT INTO tbd_user_roles (id_user, id_role, assigned_by) VALUES (?, ?, NULL)',
    [idUser, roleRows[0].id_role]
  );

  return { idUser, idStudent };
}, { ip: audit.ip, source: 'registro', userId: null });

const logAuthEvent = async ({ idUser, username, action, description, ip }) => {
  await execute(
    `INSERT INTO tb_audit_logs
      (table_name, operation, record_id, user_id, db_user, client_ip, source, change_description)
     VALUES ('tb_users', 'UPDATE', ?, ?, USER(), ?, 'auth', ?)`,
    [String(idUser || username || 'anonimo').slice(0, 64), idUser || null, ip || null, description]
  );
  return action;
};

module.exports = {
  findByUsernameOrEmail,
  findById,
  findPublicById,
  registerFailedAttempt,
  registerSuccessfulLogin,
  updatePassword,
  listUsers,
  setActive,
  setRoles,
  resetPassword,
  registerStudentAccount,
  logAuthEvent,
};
