export interface MockResponse {
  data: unknown;
  error: unknown;
}

type MockOperation = [string, ...unknown[]];

export interface MockQueryLogEntry {
  table: string;
  operations: MockOperation[];
}

export interface MockRpcLogEntry {
  name: string;
  args?: Record<string, unknown>;
}

interface MockUser {
  id: string;
  email?: string;
}

interface MockProfile extends MockUser {
  role?: string;
  is_active?: boolean;
}

interface MockQueryResult {
  data: unknown;
  error: unknown;
  count: number;
}

interface MockQueryBuilder extends PromiseLike<MockQueryResult> {
  select(columns?: string, options?: unknown): MockQueryBuilder;
  insert(values: unknown): MockQueryBuilder;
  update(values: unknown): MockQueryBuilder;
  delete(): MockQueryBuilder;
  eq(column: string, value: unknown): MockQueryBuilder;
  neq(column: string, value: unknown): MockQueryBuilder;
  in(column: string, values: unknown[]): MockQueryBuilder;
  order(column: string, options?: unknown): MockQueryBuilder;
  range(from: number, to: number): MockQueryBuilder;
  limit(limit: number): MockQueryBuilder;
  is(column: string, value: unknown): MockQueryBuilder;
  not(column: string, operator: string, value: unknown): MockQueryBuilder;
  or(filters: string): MockQueryBuilder;
  single(): Promise<MockQueryResult>;
  maybeSingle(): Promise<MockQueryResult>;
}

class SupabaseMockRegistry {
  private responses: Map<string, MockResponse> = new Map();
  private anonTableErrors: Map<string, unknown> = new Map();
  private tableDelays: Map<string, number> = new Map();
  private storageDelay = 0;
  private queryLog: MockQueryLogEntry[] = [];
  private rpcLog: MockRpcLogEntry[] = [];
  private authUser: MockUser | null = null;
  private authProfile: MockProfile | null = null;

  setTableResponse(table: string, data: unknown, error: unknown = null) {
    this.responses.set(`table:${table}`, { data, error });
  }

  setTableDelay(table: string, delayMs: number) {
    this.tableDelays.set(table, delayMs);
  }

  setStorageDelay(delayMs: number) {
    this.storageDelay = delayMs;
  }

  getTableDelay(table: string) {
    return this.tableDelays.get(table) ?? 0;
  }

  getStorageDelay() {
    return this.storageDelay;
  }

  recordQuery(entry: MockQueryLogEntry) {
    this.queryLog.push(entry);
  }

  recordRpc(entry: MockRpcLogEntry) {
    this.rpcLog.push(entry);
  }

  getQueryLog() {
    return [...this.queryLog];
  }

  getRpcLog() {
    return [...this.rpcLog];
  }

  setAnonTableError(table: string, error: unknown) {
    this.anonTableErrors.set(table, error);
  }

  setRpcResponse(rpcName: string, data: unknown, error: unknown = null) {
    this.responses.set(`rpc:${rpcName}`, { data, error });
  }

  setAuth(user: MockUser | null, profile: MockProfile | null) {
    this.authUser = user;
    this.authProfile = profile;
    // Also save profile to the profile table response
    if (profile) {
      this.setTableResponse('profiles', [profile]);
    }
  }

  getAuth() {
    return { user: this.authUser, profile: this.authProfile };
  }

  getTableResponse(table: string, clientKind: 'anon' | 'service' = 'anon'): MockResponse {
    if (clientKind === 'anon' && this.anonTableErrors.has(table)) {
      return { data: null, error: this.anonTableErrors.get(table) };
    }
    return this.responses.get(`table:${table}`) || { data: [], error: null };
  }

  getRpcResponse(rpcName: string): MockResponse {
    return this.responses.get(`rpc:${rpcName}`) || { data: [], error: null };
  }

  clear() {
    this.responses.clear();
    this.anonTableErrors.clear();
    this.tableDelays.clear();
    this.storageDelay = 0;
    this.queryLog = [];
    this.rpcLog = [];
    this.authUser = null;
    this.authProfile = null;
  }
}

export const mockSupabaseRegistry = new SupabaseMockRegistry();

export function createMockQueryBuilder(tableName: string, clientKind: 'anon' | 'service' = 'anon') {
  const operations: MockOperation[] = [];

  const waitForDelay = async () => {
    const delayMs = mockSupabaseRegistry.getTableDelay(tableName);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  };

  const resolveResponse = () => {
    const { data, error } = mockSupabaseRegistry.getTableResponse(tableName, clientKind);
    const count = Array.isArray(data) ? data.length : data ? 1 : 0;
    return { data, error, count };
  };

  const record = (operation: MockOperation) => {
    operations.push(operation);
    return chain;
  };

  const recordAndResolve = async () => {
    mockSupabaseRegistry.recordQuery({ table: tableName, operations: [...operations] });
    await waitForDelay();
    return resolveResponse();
  };

  const chain: MockQueryBuilder = {
    select: () => record(['select']),
    insert: () => record(['insert']),
    update: () => record(['update']),
    delete: () => record(['delete']),
    eq: (column: string, value: unknown) => record(['eq', column, value]),
    neq: (column: string, value: unknown) => record(['neq', column, value]),
    in: (column: string, values: unknown[]) => record(['in', column, values]),
    order: (column: string) => record(['order', column]),
    range: (from: number, to: number) => record(['range', from, to]),
    limit: (limit: number) => record(['limit', limit]),
    is: (column: string, value: unknown) => record(['is', column, value]),
    not: (column: string, operator: string, value: unknown) => record(['not', column, operator, value]),
    or: (filters: string) => record(['or', filters]),
    single: async () => {
      const { data, error, count } = await recordAndResolve();
      return { data: Array.isArray(data) ? data[0] : data, error, count };
    },
    maybeSingle: async () => {
      const { data, error, count } = await recordAndResolve();
      return { data: Array.isArray(data) ? data[0] || null : data, error, count };
    },
    then: <TResult1 = MockQueryResult, TResult2 = never>(
      onfulfilled?: ((value: MockQueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => {
      return recordAndResolve().then(onfulfilled ?? undefined, onrejected ?? undefined);
    }
  };
  return chain;
}

export function createMockSupabaseClient(clientKind: 'anon' | 'service' = 'anon') {
  return {
  from: (table: string) => createMockQueryBuilder(table, clientKind),
  rpc: (name: string, args?: Record<string, unknown>) => {
    mockSupabaseRegistry.recordRpc({ name, args });
    const { data, error } = mockSupabaseRegistry.getRpcResponse(name);
    return Promise.resolve({ data, error });
  },
  auth: {
    getUser: async () => {
      const { user } = mockSupabaseRegistry.getAuth();
      if (!user) return { data: { user: null }, error: { message: 'Not authenticated' } };
      return { data: { user }, error: null };
    },
    getSession: async () => {
      const { user } = mockSupabaseRegistry.getAuth();
      if (!user) return { data: { session: null }, error: null };
      return { data: { session: { user } }, error: null };
    },
    signOut: async () => {
      mockSupabaseRegistry.clear();
      return { error: null };
    },
    signInWithPassword: async (credentials: { email?: string }) => {
      const user = { id: 'mock-user-id', email: credentials.email || 'user@example.com' };
      const profile = { id: 'mock-user-id', email: credentials.email || 'user@example.com', role: 'admin', is_active: true };
      mockSupabaseRegistry.setAuth(user, profile);
      return { data: { user, session: { user } }, error: null };
    }
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string) => ({ data: { path: `mocked/${path}` }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.com/storage/v1/object/public/${bucket}/${path}` } }),
      list: async () => {
        const delayMs = mockSupabaseRegistry.getStorageDelay();
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        return { data: [], error: null };
      },
      remove: async () => ({ data: [], error: null }),
    })
  }
  };
}

export const mockSupabaseClient = createMockSupabaseClient();

// Intercept `@/lib/supabase/server` globally using require.cache
const supabaseServerPath = require.resolve('../../lib/supabase/server');

require.cache[supabaseServerPath] = {
  id: supabaseServerPath,
  filename: supabaseServerPath,
  loaded: true,
  exports: {
    createClient: async () => createMockSupabaseClient('anon'),
    createAdminClient: async () => createMockSupabaseClient('service'),
    createServiceRoleClient: () => createMockSupabaseClient('service'),
  }
} as NodeJS.Module;
