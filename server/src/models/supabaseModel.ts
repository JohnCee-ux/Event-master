import { supabase } from '../config/supabase.js';

type Row = Record<string, any>;

const asString = (value: any): string => (value === null || value === undefined ? '' : String(value));

const matches = (row: Row, query: Row): boolean => {
  if (!query || Object.keys(query).length === 0) return true;

  for (const [key, expected] of Object.entries(query)) {
    if (key === '$or') {
      if (!Array.isArray(expected) || !expected.some((part) => matches(row, part))) return false;
      continue;
    }

    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('$in' in expected && !(expected.$in as any[]).some((value) => asString(value) === asString(actual))) return false;
      if ('$lt' in expected && !(actual < expected.$lt)) return false;
      if ('$exists' in expected && (actual !== undefined) !== expected.$exists) return false;
      if ('$ne' in expected) {
        if (Array.isArray(actual) ? actual.includes(expected.$ne) : actual === expected.$ne) return false;
        if (expected.$ne === null && (actual === null || actual === undefined)) return false;
      }
      if ('$regex' in expected && !new RegExp(expected.$regex, expected.$options || 'i').test(actual || '')) return false;
      continue;
    }
    if (asString(actual) !== asString(expected)) return false;
  }
  return true;
};

export class SupabaseQuery<T> implements PromiseLike<T> {
  private sortKey: string | null = null;
  private sortDirection: 1 | -1 = 1;
  private skipCount = 0;
  private limitCount: number | null = null;

  constructor(private readonly resolver: () => Promise<T>) {}

  sort(options: Record<string, 1 | -1>) {
    this.sortKey = Object.keys(options)[0] || null;
    this.sortDirection = this.sortKey ? options[this.sortKey] : 1;
    return this;
  }

  skip(count: number) {
    this.skipCount = Math.max(0, count);
    return this;
  }

  limit(count: number) {
    this.limitCount = Math.max(0, count);
    return this;
  }

  lean() { return this; }
  exec() { return this.resolve(); }
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<T> {
    const value: any = await this.resolver();
    if (!Array.isArray(value)) return value;
    const sorted = this.sortKey
      ? [...value].sort((a, b) => {
          if (a[this.sortKey!] < b[this.sortKey!]) return -1 * this.sortDirection;
          if (a[this.sortKey!] > b[this.sortKey!]) return 1 * this.sortDirection;
          return 0;
        })
      : value;
    return sorted.slice(this.skipCount, this.limitCount === null ? undefined : this.skipCount + this.limitCount) as T;
  }
}

export const toDbRow = (data: Row, mapping: Record<string, string>): Row => {
  const row: Row = {};
  for (const [key, value] of Object.entries(data)) {
    row[mapping[key] || key] = value;
  }
  return row;
};

export const fromDbRow = (row: Row, mapping: Record<string, string>): any => {
  const result: Row = {};
  for (const [key, value] of Object.entries(row || {})) {
    const modelKey = Object.entries(mapping).find(([, dbKey]) => dbKey === key)?.[0] || key;
    result[modelKey] =
      (modelKey === 'createdAt' ||
        modelKey === 'updatedAt' ||
        modelKey === 'registeredAt' ||
        modelKey === 'checkedInAt' ||
        modelKey === 'emailLastAttemptAt' ||
        modelKey === 'startedAt' ||
        modelKey === 'endedAt' ||
        modelKey === 'timestamp') && value
        ? new Date(value)
        : value;
  }
  result._id = result._id || result.id;
  Object.defineProperty(result, 'save', {
    value: async () => {
      const id = result._id;
      const updates = { ...result };
      delete updates._id;
      delete updates.id;
      delete updates.__table;
      updates.updatedAt = new Date();
      const dbUpdates = toDbRow(updates, mapping);
      const { data, error } = await supabase.from(result.__table).update(dbUpdates).eq('id', id).select().single();
      if (error) throw error;
      Object.assign(result, fromDbRow(data, mapping));
      return result;
    },
    enumerable: false,
  });
  return result;
};

export const createCollection = (
  table: string,
  mapping: Record<string, string>,
  options: { rpc?: Record<string, string> } = {},
) => {
  const fetchRows = async () => {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw error;
    return (data || []).map((row) => {
      const mapped = fromDbRow(row, mapping);
      mapped.__table = table;
      return mapped;
    });
  };

  const find = (query: Row = {}) => new SupabaseQuery(async () => (await fetchRows()).filter((row) => matches(row, query)));
  const findOne = (query: Row) => new SupabaseQuery(async () => (await find(query).exec())[0] || null);
  const findById = (id: any) => findOne({ _id: asString(id) });
  const create = async (data: Row) => {
    const { data: inserted, error } = await supabase.from(table).insert(toDbRow(data, mapping)).select().single();
    if (error) throw error;
    const mapped = fromDbRow(inserted, mapping);
    mapped.__table = table;
    return mapped;
  };
  const countDocuments = async (query: Row = {}) => (await find(query).exec()).length;
  const deleteMany = async (query: Row = {}) => {
    const rows = await find(query).exec();
    if (!rows.length) return { deletedCount: 0 };
    const { error } = await supabase.from(table).delete().in('id', rows.map((row) => row._id));
    if (error) throw error;
    return { deletedCount: rows.length };
  };
  const findByIdAndDelete = async (id: any) => {
    const existing = await findById(id);
    if (!existing) return null;
    const { error } = await supabase.from(table).delete().eq('id', asString(id));
    if (error) throw error;
    return existing;
  };
  const deleteOne = async (query: Row = {}) => {
    const row = (await find(query).exec())[0];
    if (!row) return { deletedCount: 0 };
    const { error } = await supabase.from(table).delete().eq('id', row._id);
    if (error) throw error;
    return { deletedCount: 1 };
  };
  const update = async (query: Row, changes: Row) => {
    const target = (await find(query).exec())[0];
    if (!target) return null;
    const updates: Row = {};
    if (changes.$set) Object.assign(updates, changes.$set);
    if (changes.$inc) {
      for (const [key, value] of Object.entries(changes.$inc)) updates[key] = (target[key] || 0) + value;
    }
    if (changes.$addToSet) {
      for (const [key, value] of Object.entries(changes.$addToSet)) {
        updates[key] = [...(target[key] || []), value].filter((item, index, list) => list.indexOf(item) === index);
      }
      updates.updatedAt = new Date();
    }
    const { data, error } = await supabase.from(table).update(toDbRow(updates, mapping)).eq('id', target._id).select().single();
    if (error) throw error;
    const mapped = fromDbRow(data, mapping);
    mapped.__table = table;
    return mapped;
  };

  return { find, findOne, findById, create, countDocuments, deleteMany, findByIdAndDelete, deleteOne, findOneAndUpdate: update };
};
