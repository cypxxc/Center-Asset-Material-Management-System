import path from 'path';

export interface MockResponse {
  data: any;
  error: any;
}

class SupabaseMockRegistry {
  private responses: Map<string, MockResponse> = new Map();
  private authUser: any = null;
  private authProfile: any = null;

  setTableResponse(table: string, data: any, error: any = null) {
    this.responses.set(`table:${table}`, { data, error });
  }

  setRpcResponse(rpcName: string, data: any, error: any = null) {
    this.responses.set(`rpc:${rpcName}`, { data, error });
  }

  setAuth(user: any, profile: any) {
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

  getTableResponse(table: string): MockResponse {
    return this.responses.get(`table:${table}`) || { data: [], error: null };
  }

  getRpcResponse(rpcName: string): MockResponse {
    return this.responses.get(`rpc:${rpcName}`) || { data: [], error: null };
  }

  clear() {
    this.responses.clear();
    this.authUser = null;
    this.authProfile = null;
  }
}

export const mockSupabaseRegistry = new SupabaseMockRegistry();

export function createMockQueryBuilder(tableName: string) {
  const chain: any = {
    select: (columns?: string) => chain,
    insert: (values: any) => chain,
    update: (values: any) => chain,
    delete: () => chain,
    eq: (column: string, value: any) => chain,
    neq: (column: string, value: any) => chain,
    order: (column: string, options?: any) => chain,
    range: (from: number, to: number) => chain,
    limit: (limit: number) => chain,
    is: (column: string, value: any) => chain,
    not: (column: string, operator: string, value: any) => chain,
    or: (filters: string) => chain,
    single: () => {
      const { data, error } = mockSupabaseRegistry.getTableResponse(tableName);
      return Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error });
    },
    maybeSingle: () => {
      const { data, error } = mockSupabaseRegistry.getTableResponse(tableName);
      return Promise.resolve({ data: Array.isArray(data) ? data[0] || null : data, error });
    },
    then: (onfulfilled: any) => {
      const { data, error } = mockSupabaseRegistry.getTableResponse(tableName);
      return Promise.resolve({ data, error }).then(onfulfilled);
    }
  };
  return chain;
}

export const mockSupabaseClient = {
  from: (table: string) => createMockQueryBuilder(table),
  rpc: (name: string, args?: any) => {
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
    signInWithPassword: async (credentials: any) => {
      const user = { id: 'mock-user-id', email: credentials.email || 'user@example.com' };
      const profile = { id: 'mock-user-id', email: credentials.email || 'user@example.com', role: 'admin', is_active: true };
      mockSupabaseRegistry.setAuth(user, profile);
      return { data: { user, session: { user } }, error: null };
    }
  },
  storage: {
    from: (bucket: string) => ({
      upload: async (path: string, file: any) => ({ data: { path: `mocked/${path}` }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.com/storage/v1/object/public/${bucket}/${path}` } }),
      list: async (path?: string, options?: any) => ({ data: [], error: null }),
      remove: async (paths: string[]) => ({ data: [], error: null }),
    })
  }
};

// Intercept `@/lib/supabase/server` globally using require.cache
const supabaseServerPath = require.resolve('../../lib/supabase/server');

require.cache[supabaseServerPath] = {
  id: supabaseServerPath,
  filename: supabaseServerPath,
  loaded: true,
  exports: {
    createClient: async () => mockSupabaseClient,
    createAdminClient: async () => mockSupabaseClient,
    createServiceRoleClient: () => mockSupabaseClient,
  }
} as any;
