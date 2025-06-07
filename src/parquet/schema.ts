import { DataType, Field, ApacheTypes as Types } from './arrow';
import {
  ColumnArrayOptions,
  ColumnBinaryOptions,
  ColumnBooleanOptions,
  ColumnDateTimeOptions,
  ColumnMapOptions,
  ColumnNumberOptions,
  ColumnNumberPrecisionOptions,
  ColumnObjectOptions,
  ColumnStringOptions,
  ColumnTimestampTimeOptions,
  ParquetSchema,
  ParquetSchemaTypes,
  SelectColumnOptions,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const apacheTypes: Record<ParquetSchemaTypes, (arg: any) => DataType> = {
  string: (_: ColumnStringOptions) => new Types.Utf8(),
  tinyint: (_: ColumnNumberOptions) => new Types.Int8(),
  smallint: (_: ColumnNumberOptions) => new Types.Int16(),
  integer: (_: ColumnNumberOptions) => new Types.Int32(),
  bigint: (_: ColumnNumberOptions) => new Types.Int64(),
  float: (_: ColumnNumberOptions) => new Types.Float32(),
  double: (_: ColumnNumberOptions) => new Types.Float64(),
  decimal: ({ scale = 0, precision }: ColumnNumberPrecisionOptions) => new Types.Decimal(scale, precision),
  date: (_: ColumnDateTimeOptions) => new Types.DateMillisecond(),
  timestamp: ({ timezone }: ColumnTimestampTimeOptions) => new Types.TimestampMillisecond(timezone),
  boolean: (_: ColumnBooleanOptions) => new Types.Bool(),
  binary: <T extends Buffer | Uint8Array>(_: ColumnBinaryOptions<T>) => new Types.Binary(),
  array: <T extends unknown[]>({ items, name = 'items' }: ColumnArrayOptions<T>): Types.List => {
    const field = createField({ name, ...items[0] });

    return new Types.List(field);
  },
  struct: <T extends Record<string, unknown>>({ properties }: ColumnObjectOptions<T>): Types.Struct => {
    const fields = Object.entries(properties).map(([key, value]) => createField({ name: key, ...value }));

    return new Types.Struct([...fields]);
  },
  map: <T extends Record<string, unknown>>({ name = 'items', value }: ColumnMapOptions<T>) => {
    const struct = createField({
      name,
      type: 'struct',
      properties: { primitiveType: { type: 'string' }, value },
    });

    return new Types.Map_(struct);
  },
};

const createField = (options: SelectColumnOptions & { name: string }): Field =>
  new Field(options.name, apacheTypes[options.type](options), !options.required);

export const createArrowType = <T extends Record<string, unknown>>(schema: ParquetSchema<T>) =>
  apacheTypes.struct({ properties: schema, type: 'struct' });
