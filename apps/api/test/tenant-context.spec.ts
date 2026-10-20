import {
  tenantStorage,
  getTenantContext,
  getCurrentOrgId,
  getCurrentUserId,
  type TenantContext,
} from '../src/common/tenant/tenant.context';

describe('TenantContext & AsyncLocalStorage Isolation (PART 1.2)', () => {
  it('throws an error when accessed outside an active request context', () => {
    expect(() => getTenantContext()).toThrow(
      'TenantContext not available — this code is running outside an authenticated request lifecycle',
    );
  });

  it('correctly provides tenant context when run inside AsyncLocalStorage store', (done) => {
    const mockContext: TenantContext = {
      userId: 'user-uuid-1',
      organizationId: 'org-uuid-1',
      role: 'owner',
      requestId: 'req-123',
      ipAddress: '127.0.0.1',
      userAgent: 'JestTestRunner',
    };

    tenantStorage.run(mockContext, () => {
      expect(getTenantContext()).toEqual(mockContext);
      expect(getCurrentOrgId()).toBe('org-uuid-1');
      expect(getCurrentUserId()).toBe('user-uuid-1');
      done();
    });
  });

  it('maintains strict isolation across concurrent asynchronous execution contexts', async () => {
    const contextOrgA: TenantContext = {
      userId: 'user-a',
      organizationId: 'org-aaa',
      role: 'salesperson',
      requestId: 'req-a',
      ipAddress: '10.0.0.1',
      userAgent: 'AgentA',
    };

    const contextOrgB: TenantContext = {
      userId: 'user-b',
      organizationId: 'org-bbb',
      role: 'admin',
      requestId: 'req-b',
      ipAddress: '10.0.0.2',
      userAgent: 'AgentB',
    };

    const taskA = () =>
      new Promise<string>((resolve) => {
        tenantStorage.run(contextOrgA, async () => {
          await new Promise((r) => setTimeout(r, 20));
          resolve(getCurrentOrgId());
        });
      });

    const taskB = () =>
      new Promise<string>((resolve) => {
        tenantStorage.run(contextOrgB, async () => {
          await new Promise((r) => setTimeout(r, 10));
          resolve(getCurrentOrgId());
        });
      });

    const [resultA, resultB] = await Promise.all([taskA(), taskB()]);

    expect(resultA).toBe('org-aaa');
    expect(resultB).toBe('org-bbb');
    expect(resultA).not.toBe(resultB);
  });
});
