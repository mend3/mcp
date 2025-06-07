import { readParquet, writeParquet } from 'parquet-wasm';
import {
  ApacheTypes,
  DataType,
  EntityTableType,
  RecordBatch,
  Schema,
  Table,
  Vector,
  tableFromIPC,
  tableToIPC,
  vectorFromArray,
} from './arrow';
import { inferType, setDataType } from './dataType';
import { createArrowType } from './schema';
import { ParquetSchema, RecordSet } from './types';
import { isUint8Array, recordNullable } from './utils';
import { createValidation } from './validator';
import { WriterConfiguration, buildWriter, } from './writer';

export function tableFromObject<T extends RecordSet>(object: T | T[], dataType?: DataType): EntityTableType<T> {
  const normalize = recordNullable(object);
  const array = Array.isArray(normalize) ? normalize : [normalize];
  const types = dataType ?? setDataType(array, 'root');
  const vector = vectorFromArray(array, types) as Vector<ApacheTypes.Struct>;
  const batch = new RecordBatch(new Schema(vector.type.children), vector.data[0]);

  return new Table(batch);
}

export function parquetFromTable<T extends RecordSet>(
  table: EntityTableType<T>,
  writerProperties: WriterConfiguration = {}
): Uint8Array {
  const writer = buildWriter(writerProperties);
  const arrow = tableToIPC(table, 'stream');
  const parquet = writeParquet(arrow as any, writer);

  return parquet;
}

export function parquetFromObject<T extends RecordSet>(
  object: T | T[],
  writerProperties: WriterConfiguration = {}
): Uint8Array {
  const table = tableFromObject(object);
  const parquet = parquetFromTable(table, writerProperties);

  return parquet;
}

export function tableFromParquet<T extends RecordSet>(buffer: Uint8Array | Buffer): EntityTableType<T> {
  const parquet = isUint8Array(buffer) ? (buffer as Uint8Array) : new Uint8Array(buffer);
  const arrow = readParquet(parquet);
  const table = tableFromIPC(arrow);

  return table;
}

export function objectFromParquet<T extends RecordSet>(buffer: Uint8Array | Buffer) {
  const data: T[] = [];
  const table = tableFromParquet<T>(buffer);

  for (const row of table) {
    data.push(JSON.parse(row.toString()));
  }

  return data;
}

export function tableFromArray<T extends RecordSet>(array: T[], dataType?: DataType): EntityTableType<T> {
  const types = dataType ?? inferType(array, 'root');
  const vector = vectorFromArray(array, types) as Vector<ApacheTypes.Struct>;
  const batch = new RecordBatch(new Schema(vector.type.children), vector.data[0]);

  return new Table(batch);
}

export function objectToTable<T extends RecordSet>(object: T | T[], schema: ParquetSchema<T>): EntityTableType<T> {
  const validator = createValidation(schema);
  const array = validator(Array.isArray(object) ? object : [object]);
  const types = createArrowType(schema);
  const vector = vectorFromArray(array, types) as Vector<ApacheTypes.Struct>;
  const batch = new RecordBatch(new Schema(vector.type.children), vector.data[0]);

  return new Table(batch);
}

export function objectToParquet<T extends RecordSet>(
  object: T | T[],
  schema: ParquetSchema<T>,
  writerProperties: WriterConfiguration = {}
): Uint8Array {
  const table = objectToTable(object, schema);
  const parquet = parquetFromTable(table, writerProperties);

  return parquet;
}
