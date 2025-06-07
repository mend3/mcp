import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { NotificationOptions } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { Notification } from '@modelcontextprotocol/sdk/types.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  isInitializeRequest,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import express, { RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'

type Handler<T = any, R = any> = (req: T) => Promise<R> | R

interface MCPServerWrapperOptions {
  name: string
  version: string
  listResources?: Handler
  readResource?: Handler
  listTools?: Handler
  callTool?: Handler
  listPrompts?: Handler
  getPrompt?: Handler
  prompts?: Record<string, any>
}

export class MCPServerWrapper {
  private app = express()
  private transports: Record<string, StreamableHTTPServerTransport | undefined> = {}
  private mcpServer: Server

  constructor(private options: MCPServerWrapperOptions) {
    this.app.use(express.json())

    // Setup MCP Server
    this.mcpServer = new Server(
      { name: options.name, version: options.version },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: options.prompts || {},
        },
      },
    )

    // Register handlers if provided
    if (options.listResources) this.mcpServer.setRequestHandler(ListResourcesRequestSchema, options.listResources)
    if (options.readResource) this.mcpServer.setRequestHandler(ReadResourceRequestSchema, options.readResource)
    if (options.listTools) this.mcpServer.setRequestHandler(ListToolsRequestSchema, options.listTools)
    if (options.callTool) this.mcpServer.setRequestHandler(CallToolRequestSchema, options.callTool)
    if (options.listPrompts) this.mcpServer.setRequestHandler(ListPromptsRequestSchema, options.listPrompts)
    if (options.getPrompt) this.mcpServer.setRequestHandler(GetPromptRequestSchema, options.getPrompt)

    // SSE endpoint
    this.app.post('/sse', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string
      let transport: StreamableHTTPServerTransport

      if (sessionId && this.transports[sessionId]) {
        transport = this.transports[sessionId]!
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: sid => {
            this.transports[sid] = transport
          },
        })
        transport.onclose = () => {
          if (transport.sessionId) delete this.transports[transport.sessionId]
        }
        await this.mcpServer.connect(transport)
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        })
        return
      }

      await transport.handleRequest(req, res, req.body)
    })

    // GET and DELETE for session management
    const handleSessionRequest: RequestHandler = async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string
      if (!sessionId || !this.transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID')
        return
      }
      const transport = this.transports[sessionId]!
      await transport.handleRequest(req, res)
    }

    this.app.get('/sse', handleSessionRequest)
    this.app.delete('/sse', handleSessionRequest)

    this.app.get('/healthz', async (req, res) => {
      res.status(200).send('ok')
    })
  }

  notification(notification: Notification, options?: NotificationOptions) {
    this.mcpServer.notification(notification, options)
  }

  listen(port: number) {
    process.stdin.on('close', () => {
      console.error('MCP Server closed')
    })

    this.app.listen(port, () => {
      console.log(`🧠 MCP SSE Server running at http://localhost:${port}/sse`)
    })
  }
}
