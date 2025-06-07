import { types } from 'util';
import { Nullable } from './types';

export const isUint8Array = (value: unknown): value is Uint8Array => types.isUint8Array(value);

export const isDate = (value: unknown): value is Date => types.isDate(value);

export const isValue = <T>(value: T | null | undefined): value is T => value !== undefined && value !== null;

export const isObject = <T extends Record<string, unknown>>(value: unknown | T): value is T =>
  typeof value === 'object' && value !== null && !isDate(value);

export const getItem = <T>(array: T[]): T => {
  if (!array.length) return null as T;

  if (array.every(isObject)) {
    const map = new Map();
    for (const object of array as Record<string, unknown>[]) {
      Object.entries(object).forEach(([key, value]) => {
        if (value !== undefined && value !== null)
          map.set(key, Array.isArray(value) ? [getItem([...value, ...(map.get(key) || [])])] : value);
      });
    }

    return Object.fromEntries(map.entries());
  }

  return array?.[array.findIndex(ary => ary !== null)];
};

const setRecordNull = <T extends Record<string, unknown>>(object: T, keys: string[]): Nullable<T> =>
  Object.fromEntries(keys.map(key => [key, object[key] ?? null])) as Nullable<T>;

export const normalizeObject = <T>(object: T): T | null => {
  if (Array.isArray(object)) {
    if (object.every(isObject)) {
      if (object.length === 0) return null;
      const base = getItem(object);
      const keys = Object.keys(base);

      return object.map(value => normalizeObject(setRecordNull(value, keys))) as T;
    }
  } else if (isObject(object)) {
    return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, normalizeObject(value)])) as T;
  }

  return object ?? null;
};

const getAllKeys = (array: Record<string, unknown>[]) => {
  const set = new Set<string>();
  for (const value of array) for (const key in value) set.add(key);

  return [...set.values()];
};

export const recordNullable = <T>(object: T): T | null => {
  if (Array.isArray(object)) {
    if (object.every(isObject)) {
      if (object.length === 0) return null;
      const keys = getAllKeys(object);

      return object.map(value => recordNullable(setRecordNull(value, keys))) as T;
    }
  } else if (isObject(object)) {
    return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, recordNullable(value)])) as T;
  }

  return object ?? null;
};
