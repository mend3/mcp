import * as typeorm from 'typeorm'
import { MCPServerWrapper } from './core/wrapper'

const {
  MYSQL_DRIVER = 'mysql',
  MYSQL_HOST = 'localhost',
  MYSQL_USER,
  MYSQL_PASSWORD,
  MYSQL_DATABASE,
  IO_REDIS_HOST = null,
  DEBUG = 'false',
} = process.env

export const mysqlOptions: typeorm.DataSourceOptions = {
  host: MYSQL_HOST,
  username: MYSQL_USER,
  password: MYSQL_PASSWORD,
  database: MYSQL_DATABASE,
  type: MYSQL_DRIVER as 'mysql' | 'mariadb',
  entities: [],
  subscribers: [],
  migrations: [],
  synchronize: false,
  logging: true,
  debug: DEBUG != undefined && DEBUG != null && DEBUG !== 'false',
  cache: !IO_REDIS_HOST
    ? undefined
    : {
        type: 'ioredis',
        options: {
          family: 4,
          db: 0,
          host: IO_REDIS_HOST,
          connectTimeout: 5000,
          enableAutoPipelining: true,
          name: `${MYSQL_DRIVER}-mcp-server`,
          connectionName: process.env.APP,
          lazyConnect: false,
          enableReadyCheck: true,
          maxRetriesPerRequest: null, // only retry failed requests once
          enableOfflineQueue: false,
        },
        alwaysEnabled: true,
        duration: 3600, // 1 hour
      },
}

const PROMPTS = {
  summarize_table: {
    name: 'summarize_table',
    description: 'Summarize the contents of a table',
    arguments: [{ name: 'table', description: 'Table name', required: true }],
  },
}

const db = new typeorm.DataSource(mysqlOptions)

await db.initialize()

const server = new MCPServerWrapper({
  name: 'mcp-servers/mysql',
  version: '0.1.0',
  prompts: PROMPTS,
  listResources: async () => {
    const [tables] = await db.query('SHOW TABLES')
    const tableNames = tables.map((row: any) => Object.values(row)[0])
    return {
      resources: tableNames.map((name: string) => ({
        uri: `mysql://schema/${name}`,
        name: `Table Schema: ${name}`,
        mimeType: 'text/plain',
      })),
    }
  },
  readResource: async request => {
    const tableName = request.params.uri.split('/').pop()
    const [columns] = await db.query(`DESCRIBE \`${tableName}\``)
    const schemaText = columns.map((col: any) => `${col.Field}: ${col.Type}`).join('\n')
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/plain',
          text: schemaText,
        },
      ],
    }
  },
  listTools: async () => ({
    tools: [
      {
        name: 'run_query',
        description: 'Run a read-only SQL query',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ],
  }),
  callTool: async request => {
    const query = (request.params.arguments?.query ?? '') as unknown as string
    if (!query.toLowerCase().startsWith('select')) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Only SELECT queries are allowed.' }],
      }
    }
    try {
      const [results] = await db.query(query)
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err.message}` }],
      }
    }
  },
  listPrompts: async () => ({
    prompts: Object.values(PROMPTS),
  }),
  getPrompt: async request => {
    const prompt = PROMPTS[request.params.name as keyof typeof PROMPTS]
    if (prompt.name === 'summarize_table') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize the data in the table \`${request.params.arguments?.table}\`.`,
            },
          },
        ],
      }
    }
    throw new Error('Prompt not found')
  },
})

server.listen(80)
