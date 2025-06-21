import fs from 'fs/promises'
import { MCPServerWrapper } from './core/wrapper'

const PROMPTS = {
  summarize_parquet: {
    name: 'summarize_parquet',
    description: 'Summarize the contents and structure of a Parquet file',
    arguments: [{ name: 'path', description: 'Path to the Parquet file', required: true }],
  },
}

const server = new MCPServerWrapper({
  name: 'mcp-servers/parquet',
  version: '0.1.0',
  prompts: PROMPTS,

  listResources: async request => {
    const files = await fs.readdir('./data')
    const parquetFiles = files.filter(f => f.endsWith('.parquet'))

    return {
      resources: parquetFiles.map(file => ({
        uri: `file://data/${file}`,
        name: `Parquet File: ${file}`,
        mimeType: 'application/parquet',
      })),
    }
  },

  listPrompts: async () => ({
    prompts: Object.values(PROMPTS),
  }),

  getPrompt: async request => {
    const prompt = PROMPTS[request.params.name as keyof typeof PROMPTS]
    if (prompt.name === 'summarize_parquet') {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please summarize the contents and structure of the Parquet file at \`${request.params.arguments?.path}\`.`,
            },
          },
        ],
      }
    }
    throw new Error('Prompt not found')
  },

  readResource: async request => {
    const filePath = request.params.uri.replace('file://', '')
    try {
      await fs.access(filePath, fs.constants.R_OK)
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'text/plain',
            text: `Conteúdo ou resumo do arquivo Parquet em ${filePath} seria retornado aqui.`,
          },
        ],
      }
    } catch (error: unknown) {
      const err = error as Error
      throw new Error(`Não foi possível ler o recurso em ${filePath}: ${err.message}`)
    }
  },

  listTools: async () => ({
    tools: [
      {
        name: 'get_parquet_schema',
        description: 'Get the schema of a Parquet file',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' }, // Changed 'path' to 'query' to match wrapper.ts expectation
          },
          required: ['query'], // Changed 'path' to 'query'
        },
      },
    ],
  }),

  callTool: async request => {
    if (request.params.name === 'get_parquet_schema') {
      const filePath = (request.params.input as any).query // Access 'query' property
      try {
        await fs.access(filePath)
        return {
          content: [
            {
              type: 'text',
              text: `Esquema do arquivo Parquet em ${filePath}: { \"coluna1\": \"tipo1\", \"coluna2\": \"tipo2\" }`,
            },
          ],
        }
      } catch (error: unknown) {
        const err = error as Error
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Erro ao obter o esquema do arquivo ${filePath}: ${err.message}`,
            },
          ],
        }
      }
    }
    throw new Error('Ferramenta não encontrada')
  },
})

server.listen(80)
