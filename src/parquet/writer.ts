import {
  Compression,
  EnabledStatistics,
  Encoding,
  WriterPropertiesBuilder,
  WriterVersion,
} from 'parquet-wasm';
import { Entries } from './types';

export type EnabledStatisticsTypes = keyof typeof EnabledStatistics;
export type CompressionTypes = keyof typeof Compression;
export type EncodingTypes = keyof typeof Encoding;
export type WriterVersionTypes = keyof typeof WriterVersion;

export type WriterConfiguration = {
  writerVersion?: WriterVersionTypes;
  dataPagesizeLimit?: number;
  dictionaryPagesizeLimit?: number;
  writeBatchSize?: number;
  maxRowGroupSize?: number;
  createdBy?: string;
  encoding?: EncodingTypes;
  compression?: CompressionTypes;
  dictionaryEnabled?: boolean;
  statisticsEnabled?: EnabledStatisticsTypes;
  maxStatisticsSize?: number;
  columnEncoding?: { col: string; value: number };
  columnCompression?: { col: string; value: number };
  columnDictionaryEnabled?: { col: string; value: boolean };
  columnStatisticsEnabled?: { col: string; value: number };
  columnMaxStatisticsSize?: { col: string; value: number };
};

export const buildWriter = (configuration: WriterConfiguration) => {
  let writerProperties = new WriterPropertiesBuilder();

  const record: {
    [K in keyof WriterConfiguration]-?: (value: Required<WriterConfiguration>[K]) => WriterPropertiesBuilder;
  } = {
    writerVersion: value => writerProperties.setWriterVersion(WriterVersion[value]),
    encoding: value => writerProperties.setEncoding(Encoding[value]),
    compression: value => writerProperties.setDataPageSizeLimit(Compression[value]),
    statisticsEnabled: value => writerProperties.setDataPageSizeLimit(EnabledStatistics[value]),
    dataPagesizeLimit: value => writerProperties.setDataPageSizeLimit(value),
    dictionaryPagesizeLimit: value => writerProperties.setDictionaryPageSizeLimit(value),
    writeBatchSize: value => writerProperties.setWriteBatchSize(value),
    maxRowGroupSize: value => writerProperties.setMaxRowGroupSize(value),
    createdBy: value => writerProperties.setCreatedBy(value),
    dictionaryEnabled: value => writerProperties.setDictionaryEnabled(value),
    maxStatisticsSize: value => writerProperties.setMaxStatisticsSize(value),
    columnEncoding: value => writerProperties.setColumnEncoding(value.col, value.value),
    columnCompression: value => writerProperties.setColumnCompression(value.col, value.value),
    columnDictionaryEnabled: value => writerProperties.setColumnDictionaryEnabled(value.col, value.value),
    columnStatisticsEnabled: value => writerProperties.setColumnStatisticsEnabled(value.col, value.value),
    columnMaxStatisticsSize: value => writerProperties.setColumnMaxStatisticsSize(value.col, value.value),
  };

  if (!configuration.compression) configuration.compression = 'GZIP';
  const entries = Object.entries(configuration) as Entries<WriterConfiguration>;

  for (const [key, value] of entries) {
    if (value !== undefined && key in record) writerProperties = record[key](value as never);
  }

  return writerProperties.build();
};
