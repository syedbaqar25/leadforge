import { hasPermission, getPermissionsForRole, PERMISSIONS } from '../permissions';
import { emailSchema, passwordSchema, paginationSchema } from '../schemas';

describe('Shared RBAC Permissions Map', () => {
  it('correctly grants owner all permissions', () => {
    expect(hasPermission('owner', 'lead:delete')).toBe(true);
    expect(hasPermission('owner', 'org:billing')).toBe(true);
    expect(hasPermission('owner', 'org:delete')).toBe(true);
  });

  it('prohibits salesperson from accessing organization settings or billing', () => {
    expect(hasPermission('salesperson', 'org:billing')).toBe(false);
    expect(hasPermission('salesperson', 'org:settings')).toBe(false);
    expect(hasPermission('salesperson', 'lead:delete')).toBe(false);
  });

  it('allows salesperson to manage their own leads and tasks', () => {
    expect(hasPermission('salesperson', 'lead:read:own')).toBe(true);
    expect(hasPermission('salesperson', 'lead:update:own')).toBe(true);
    expect(hasPermission('salesperson', 'task:create')).toBe(true);
  });

  it('prohibits admin from deleting the organization or modifying billing', () => {
    expect(hasPermission('admin', 'org:delete')).toBe(false);
    expect(hasPermission('admin', 'org:billing')).toBe(false);
    expect(hasPermission('admin', 'org:settings')).toBe(true);
  });

  it('returns valid permission list for each role', () => {
    const ownerPerms = getPermissionsForRole('owner');
    const salespersonPerms = getPermissionsForRole('salesperson');

    expect(ownerPerms.length).toBeGreaterThan(salespersonPerms.length);
    expect(salespersonPerms).toContain('lead:create');
  });
});

describe('Shared Zod Schemas Validation', () => {
  it('normalizes email addresses to lowercase and trims whitespace', () => {
    const parsed = emailSchema.parse('  User.Name@Example.COM  ');
    expect(parsed).toBe('user.name@example.com');
  });

  it('rejects passwords shorter than minimum length', () => {
    const result = passwordSchema.safeParse('short');
    expect(result.success).toBe(false);
  });

  it('accepts passwords meeting length requirements', () => {
    const result = passwordSchema.safeParse('SecurePassword123!');
    expect(result.success).toBe(true);
  });

  it('enforces maximum page size on pagination', () => {
    const parsed = paginationSchema.parse({ page: 2, pageSize: 50 });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(50);

    const oversized = paginationSchema.safeParse({ page: 1, pageSize: 500 });
    expect(oversized.success).toBe(false);
  });
});
