export type RecordSet<T = unknown> = Record<string, T>;

export type Entries<T extends RecordSet, K extends keyof T = keyof T> = [K, T[K]][];

export type Nullable<T extends RecordSet> = {
  [K in keyof T]-?: Exclude<T[K], undefined> | null;
};

export type ColumnTypes = 'string' | 'bigint' | 'boolean' | 'number' | 'null' | 'array' | 'date' | 'object';

type ToArray<T> = T extends Array<unknown> ? T : T extends boolean ? boolean | boolean[] : T | T[];
type ToRecord<T> = T extends Record<string, unknown>
  ? T
  : T extends boolean
  ? boolean | Record<string, boolean>
  : T | Record<string, T>;
export type ParquetTypes = ToRecord<ToArray<string | number | Date | boolean | Buffer | Uint8Array>>;

export type ColumnCommonOptions<T> = {
  name?: string;
  required?: boolean;
  default?: () => T;
};

export type ColumnStringOptions = ColumnCommonOptions<string> & {
  type: 'string';
};

export type ColumnNumberOptions = ColumnCommonOptions<number> & {
  type: 'tinyint' | 'smallint' | 'integer' | 'bigint' | 'float' | 'double';
};

export type ColumnNumberPrecisionOptions = ColumnCommonOptions<number> & {
  type: 'decimal';
  /**
   * Precision is the total number of digits, its maximum value is 38
   */
  precision: number;
  /**
   * Scale is the number of digits in fractional part, its maximum value is 38
   * default is 0
   */
  scale?: number;
};

export type ColumnDateTimeOptions = ColumnCommonOptions<Date> & {
  type: 'date';
};

export type ColumnTimestampTimeOptions = ColumnCommonOptions<Date> & {
  type: 'timestamp';
  timezone?: string;
};

export type ColumnBooleanOptions = ColumnCommonOptions<boolean> & {
  type: 'boolean';
};

export type ColumnBinaryOptions<T extends Buffer | Uint8Array> = ColumnCommonOptions<T> & {
  type: 'binary';
};

export type ColumnArrayOptions<T extends unknown[]> = ColumnCommonOptions<T> & {
  type: 'array';
  items: [SelectColumnOptions<T[number]>];
};

export type ColumnObjectOptions<T extends Record<string, unknown>> = ColumnCommonOptions<T> & {
  type: 'struct';
  properties: ParquetSchema<T>;
};

export type ColumnMapOptions<T extends Record<string, unknown>> = ColumnCommonOptions<T> & {
  type: 'map';
  value: SelectColumnOptions<T[keyof T]>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SelectColumnOptions<T = any> = T extends string
  ? ColumnStringOptions
  : T extends number
  ? ColumnNumberOptions | ColumnNumberPrecisionOptions
  : T extends Date
  ? ColumnDateTimeOptions | ColumnTimestampTimeOptions
  : T extends boolean
  ? ColumnBooleanOptions
  : T extends Buffer | Uint8Array
  ? ColumnBinaryOptions<T>
  : T extends unknown[]
  ? ColumnArrayOptions<T>
  : T extends Record<string | number, unknown>
  ? ColumnObjectOptions<T> | ColumnMapOptions<T>
  : never;

export type ParquetSchemaTypes = SelectColumnOptions['type'];

export type ParquetSchema<T extends Record<string, unknown>> = {
  -readonly [P in keyof T]-?: SelectColumnOptions<T[P]>;
};
