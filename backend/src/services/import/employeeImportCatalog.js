/** Destination fields + column aliases for employee roster import. */

export const EMPLOYEE_IMPORT_FIELDS = [
  {
    key: 'employeeId',
    label: 'Employee ID',
    /** Required unless import job has autoGenerateEmployeeIds enabled. */
    required: false,
    aliases: ['employeeid', 'emp id', 'emp_id', 'staff id', 'staffid', 'employee code', 'empcode', 'id'],
  },
  { key: 'name', label: 'Name', required: true, aliases: ['name', 'full name', 'employee name', 'fullname'] },
  { key: 'email', label: 'Email', required: true, aliases: ['email', 'email address', 'mail', 'work email'] },
  { key: 'phone', label: 'Phone', required: false, aliases: ['phone', 'mobile', 'cell', 'telephone', 'contact'] },
  { key: 'department', label: 'Department', required: false, aliases: ['department', 'dept', 'division'] },
  { key: 'team', label: 'Team', required: false, aliases: ['team', 'group', 'squad'] },
];

export function getEmployeeImportCatalog() {
  return {
    destinationFields: EMPLOYEE_IMPORT_FIELDS.map(({ key, label, required }) => ({
      key,
      label,
      type: 'text',
      required: Boolean(required),
      section: 'employee',
      builtIn: true,
      ...(key === 'employeeId'
        ? { hint: 'Optional when auto-generate employee IDs is enabled' }
        : {}),
    })),
  };
}

export function suggestEmployeeField(headerLabel = '') {
  const norm = String(headerLabel)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!norm) return '';
  for (const field of EMPLOYEE_IMPORT_FIELDS) {
    if (field.aliases.some((a) => a === norm || norm.includes(a) || a.includes(norm))) {
      return field.key;
    }
  }
  return '';
}
