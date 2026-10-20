export const PERMISSIONS = {
  // Leads
  'lead:create': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'lead:read:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'lead:read:team': ['owner', 'admin', 'sales_manager'],
  'lead:read:all': ['owner', 'admin'],
  'lead:update:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'lead:update:any': ['owner', 'admin', 'sales_manager'],
  'lead:delete': ['owner', 'admin'],
  'lead:import': ['owner', 'admin', 'sales_manager'],
  'lead:export': ['owner', 'admin', 'sales_manager'],
  'lead:assign': ['owner', 'admin', 'sales_manager'],
  'lead:merge': ['owner', 'admin'],

  // Pipeline & Deals
  'deal:create': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'deal:read:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'deal:read:team': ['owner', 'admin', 'sales_manager'],
  'deal:read:all': ['owner', 'admin'],
  'deal:update:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'deal:update:any': ['owner', 'admin', 'sales_manager'],
  'deal:delete': ['owner', 'admin'],
  'pipeline:view': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'pipeline:manage': ['owner', 'admin'],

  // Tasks
  'task:create': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'task:read:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'task:read:team': ['owner', 'admin', 'sales_manager'],
  'task:read:all': ['owner', 'admin'],
  'task:update:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'task:update:any': ['owner', 'admin', 'sales_manager'],
  'task:delete': ['owner', 'admin'],

  // AI
  'ai:analyze': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'ai:draft': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'ai:assistant': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'ai:documents:upload': ['owner', 'admin'],
  'ai:settings': ['owner', 'admin'],

  // Approvals
  'approval:view': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'approval:decide': ['owner', 'admin', 'sales_manager'],

  // Communications
  'email:send': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'email:template:manage': ['owner', 'admin', 'sales_manager'],
  'whatsapp:send': ['owner', 'admin', 'sales_manager', 'salesperson'],

  // Automation
  'workflow:create': ['owner', 'admin'],
  'workflow:manage': ['owner', 'admin'],
  'workflow:view': ['owner', 'admin', 'sales_manager'],

  // Analytics
  'analytics:view:own': ['owner', 'admin', 'sales_manager', 'salesperson'],
  'analytics:view:team': ['owner', 'admin', 'sales_manager'],
  'analytics:view:all': ['owner', 'admin'],
  'analytics:export': ['owner', 'admin'],

  // Organization
  'org:settings': ['owner', 'admin'],
  'org:billing': ['owner'],
  'org:members:invite': ['owner', 'admin'],
  'org:members:manage': ['owner', 'admin'],
  'org:members:remove': ['owner', 'admin'],
  'org:integrations': ['owner', 'admin'],
  'org:delete': ['owner'],

  // Scoring
  'scoring:rules:view': ['owner', 'admin', 'sales_manager'],
  'scoring:rules:manage': ['owner', 'admin'],

  // Audit
  'audit:view': ['owner', 'admin'],
  'audit:export': ['owner', 'admin'],

  // Notifications
  'notification:preferences': ['owner', 'admin', 'sales_manager', 'salesperson'],

  // API Keys
  'apikey:create': ['owner', 'admin'],
  'apikey:manage': ['owner', 'admin'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission];
  return (allowed as readonly string[]).includes(role);
}

export function getPermissionsForRole(role: string): Permission[] {
  return (Object.entries(PERMISSIONS) as [Permission, readonly string[]][])
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm);
}
