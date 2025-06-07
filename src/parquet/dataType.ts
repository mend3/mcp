import { ApacheTypes, Field, TimeUnit, Type } from './arrow';
import { ColumnTypes } from './types';
import { getItem, isDate, isValue } from './utils';

const valueType = (value: unknown): ColumnTypes => {
  const type = typeof value;

  if (type === 'object')
    return value === null ? 'null' : Array.isArray(value) ? 'array' : isDate(value) ? 'date' : 'object';

  if (type === 'symbol' || type === 'function' || type === 'undefined') throw new TypeError(`Type ${type} is invalid`);

  return type;
};

const checkType = (key: string, value: unknown[]) => {
  try {
    const listTypes = value.map(valueType);
    const childType = listTypes.find(type => type !== 'null');

    if (childType && !listTypes.every(type => type === childType || type === 'null'))
      throw new TypeError('Array with different types');

    return {
      string: 'string' === childType,
      bigint: 'bigint' === childType,
      boolean: 'boolean' === childType,
      number: 'number' === childType,
      null: undefined === childType,
      array: 'array' === childType,
      date: 'date' === childType,
      object: 'object' === childType,
    };
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError(`${key}: ${error.message}`);
    else throw error;
  }
};

export function setDataType(value: unknown[], rootKey = ''): ApacheTypes.DataType {
  const valueIs = checkType(rootKey, value);

  if (valueIs.number) {
    return new ApacheTypes.Float64();
  }
  if (valueIs.string) {
    return new ApacheTypes.Utf8();
  }
  if (valueIs.bigint) {
    return new ApacheTypes.Int64();
  }
  if (valueIs.boolean) {
    return new ApacheTypes.Bool();
  }
  if (valueIs.date) {
    return new ApacheTypes.Timestamp(TimeUnit.MILLISECOND);
  }
  if (valueIs.array) {
    const array = value[0] as unknown[];
    const childType = setDataType([getItem(array)], rootKey);
    if (
      childType.typeId === Type.Struct ||
      array.every(ary => ary === null || setDataType([ary], rootKey).toString() === childType.toString())
    ) {
      return new ApacheTypes.List(new Field(rootKey, childType, true));
    }
    throw new TypeError(`${rootKey}: array with different types`);
  }
  if (valueIs.object) {
    const fields = new Map<string, Field>();
    for (const row of value as Record<string, unknown>[]) {
      for (const key of Object.keys(row)) {
        if (!fields.has(key) && isValue(row[key])) {
          fields.set(key, new Field(key, setDataType([row[key]], key), true));
        }
      }
    }
    return new ApacheTypes.Struct([...fields.values()]);
  }

  return new ApacheTypes.Null();
}

const getType = (value: unknown[], key: string) => {
  try {
    const listTypes = value.map(valueType);
    const childType = listTypes.find(type => type !== 'null');

    if (childType && !listTypes.every(type => type === childType || type === 'null'))
      throw new TypeError('Array with different types');

    return childType || 'null';
  } catch (error) {
    if (error instanceof TypeError) throw new TypeError(`${key}: ${error.message}`);
    else throw error;
  }
};

const recordDataTypes = {
  null: () => new ApacheTypes.Null(),
  number: () => new ApacheTypes.Float64(),
  string: () => new ApacheTypes.Utf8(),
  bigint: () => new ApacheTypes.Int64(),
  boolean: () => new ApacheTypes.Bool(),
  date: () => new ApacheTypes.Timestamp(TimeUnit.MILLISECOND),
  array: (value: unknown[], key: string) => {
    const array = value[0] as unknown[];
    const childType = inferType([getItem(array)], key);
    if (
      childType.typeId === Type.Struct ||
      array.every(ary => ary === null || inferType([ary], key).toString() === childType.toString())
    ) {
      return new ApacheTypes.List(new Field(key, childType, true));
    }
    throw new TypeError(`${key}: array with different types`);
  },
  object: (value: unknown[]) => {
    const item = getItem(value) as Record<string, unknown>;
    const fields = Object.keys(item).map(key => new Field(key, inferType([item[key]], key)));

    return new ApacheTypes.Struct(fields);
  },
};

export const inferType = (value: unknown[], key = 'root'): ApacheTypes.DataType => {
  const type = getType(value, key);

  const dataType = recordDataTypes[type];

  return dataType(value, key);
};
