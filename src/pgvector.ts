import { Client } from 'pg'
import { MCPServerWrapper } from './core/wrapper'

const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env

const pg = new Client({
  connectionString: `postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`,
})
await pg.connect()

const PROMPTS = {
  summarize_vectors: {
    name: 'summarize_vectors',
    description: 'Summarize the contents and purpose of a pgvector table',
    arguments: [{ name: 'table', description: 'Table name', required: true }],
  },
}

const server = new MCPServerWrapper({
  name: 'mcp-servers/pgvector',
  version: '0.1.0',
  listResources: async () => {
    const res = await pg.query(`
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE udt_name = 'vector_db' AND table_schema = 'public';
  `)

    const tableNames = res.rows.map(r => r.table_name)
    return {
      resources: tableNames.map(name => ({
        uri: `pgvector://public/${name}`,
        name: `Vector Table: ${name}`,
        mimeType: 'text/plain',
      })),
    }
  },
  readResource: async request => {
    const table = request.params.uri.split('/').pop()
    const res = await pg.query(
      `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_name = $1 AND table_schema = 'public'`,
      [table],
    )

    const schema = res.rows
      .map(col => `${col.column_name}: ${col.udt_name === 'vector_db' ? 'vector_db' : col.data_type}`)
      .join('\n')

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'text/plain',
          text: schema,
        },
      ],
    }
  },
  listTools: async () => ({
    tools: [
      {
        name: 'run_vector_query',
        description: 'Run a read-only SELECT SQL query on pgvector tables',
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
  listPrompts: async () => ({
    prompts: Object.values(PROMPTS),
  }),
  getPrompt: async request => {
    const prompt = PROMPTS[request.params.name as keyof typeof PROMPTS]
    if (prompt.name === 'summarize_vectors') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize the contents and structure of the pgvector table \`${request.params.arguments?.table}\`.`,
            },
          },
        ],
      }
    }
    throw new Error('Prompt not found')
  },
  callTool: async request => {
    const query = String(request.params.arguments?.query ?? '').trim()
    if (!query.toLowerCase().startsWith('select')) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Only SELECT queries are allowed.' }],
      }
    }

    try {
      const res = await pg.query(query)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(res.rows, null, 2),
          },
        ],
      }
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${err.message}` }],
      }
    }
  },
})

server.listen(80)
