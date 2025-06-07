import { Table } from 'apache-arrow';
import { JavaScriptDataType } from 'apache-arrow/interfaces';
import { RecordSet } from './types';

export * from 'apache-arrow';
export { vectorFromArray } from 'apache-arrow/factories';
export { JavaScriptDataType } from 'apache-arrow/interfaces';
export * as ApacheTypes from 'apache-arrow/type';

export type EntityTableType<T extends RecordSet> = Table<{ [P in keyof T]: JavaScriptDataType<T[P]> }>;
