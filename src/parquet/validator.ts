import FastestValidator, { SyncCheckFunction, ValidationRuleObject, ValidationSchema } from 'fastest-validator';
import {
  ColumnMapOptions,
  ColumnNumberPrecisionOptions,
  ColumnObjectOptions,
  ParquetSchema,
  ParquetSchemaTypes,
  SelectColumnOptions,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const validationRules: Record<ParquetSchemaTypes, (arg: any) => ValidationRuleObject> = {
  string: (_: SelectColumnOptions<string>) => ({
    type: 'string',
  }),
  tinyint: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    integer: true,
    min: Math.pow(-2, 7),
    max: Math.pow(2, 7) - 1,
  }),
  smallint: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    integer: true,
    min: Math.pow(-2, 15),
    max: Math.pow(2, 15) - 1,
  }),
  integer: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    integer: true,
    min: Math.pow(-2, 31),
    max: Math.pow(2, 31) - 1,
  }),
  bigint: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    integer: true,
    min: Math.pow(-2, 63),
    max: Math.pow(2, 63) - 1,
  }),
  float: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    min: Math.pow(-2, 31),
    max: Math.pow(2, 31) - 1,
  }),
  double: (_: SelectColumnOptions<number>) => ({
    type: 'number',
    min: Math.pow(-2, 63),
    max: Math.pow(2, 63) - 1,
  }),
  decimal: ({ precision, scale = 0 }: ColumnNumberPrecisionOptions) => ({
    type: 'number',
    min: Math.pow(10, precision - scale) - Math.pow(10, -scale) * -1,
    max: Math.pow(10, precision - scale) - Math.pow(10, -scale),
  }),
  date: (_: SelectColumnOptions<Date>) => ({
    type: 'date',
  }),
  timestamp: (_: SelectColumnOptions<Date>) => ({
    type: 'date',
  }),
  boolean: (_: SelectColumnOptions<boolean>) => ({
    type: 'boolean',
  }),
  //TODO - test binary data
  binary: (_: SelectColumnOptions<Buffer>) => ({
    type: 'any',
  }),
  array: ({ items }: SelectColumnOptions<unknown[]>) => {
    const rules = items.map(options => getRule(options));

    return {
      type: 'array',
      items: rules,
    };
  },
  struct: ({ properties }: ColumnObjectOptions<Record<string, unknown>>) => {
    const rules = Object.entries(properties).map(([key, options]) => [key, getRule(options)]);

    return {
      type: 'object',
      properties: Object.fromEntries(rules),
      strict: 'remove',
    };
  },
  map: <T extends Record<string, unknown>>({ value }: ColumnMapOptions<T>) => {
    const rule = getRule(value);

    return {
      type: 'record',
      key: {
        type: 'string',
      },
      value: rule,
    };
  },
};

const getRule = (options: SelectColumnOptions): ValidationRuleObject => {
  const rule = validationRules[options.type](options);

  return {
    ...rule,
    optional: !options.required,
    default: options.required ? undefined : options.default || (() => null),
  };
};

const createValidationSchema = <T extends Record<string, unknown>>(properties: ParquetSchema<T>) => {
  const items = getRule({ type: 'struct', properties });

  return {
    $$root: true,
    type: 'array',
    items,
  } as ValidationSchema<T>;
};

export const createValidation = <T extends Record<string, unknown>>(schema: ParquetSchema<T>) => {
  const validationSchema = createValidationSchema(schema);
  const validator = new FastestValidator({
    useNewCustomCheckerFunction: true,
    defaults: {
      string: { trim: true, empty: true },
      number: { convert: true },
      array: { empty: true },
      boolean: { convert: true },
      date: { convert: true },
    },
  });

  const check = validator.compile(validationSchema) as SyncCheckFunction;

  return (value: T[]) => {
    const validation = check(value);

    if (validation !== true) {
      const validationMessage = Object.values(
        validation.reduceRight(
          (all: Record<string, string>, { field, message }) => ({ ...all, [field]: message || '' }),
          {}
        )
      ).join(' ');
      throw new Error(`Invalid input: ${validationMessage}`);
    }
    return value;
  };
};
