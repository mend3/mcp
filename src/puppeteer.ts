import type { CallToolResult, ImageContent, TextContent, Tool } from '@modelcontextprotocol/sdk/types'
import puppeteer, { Browser, Page } from 'puppeteer'
import { MCPServerWrapper } from './core/wrapper'

const TOOLS: Tool[] = [
  {
    name: 'puppeteer_navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        launchOptions: {
          type: 'object',
          description:
            "PuppeteerJS LaunchOptions. Default null. If changed and not null, browser restarts. Example: { headless: true, args: ['--no-sandbox'] }",
        },
        allowDangerous: {
          type: 'boolean',
          description:
            'Allow dangerous LaunchOptions that reduce security. When false, dangerous args like --no-sandbox will throw errors. Default false.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'puppeteer_screenshot',
    description: 'Take a screenshot of the current page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the screenshot' },
        selector: { type: 'string', description: 'CSS selector or XPath for element to screenshot' },
        width: { type: 'number', description: 'Width in pixels (default: 800)' },
        height: { type: 'number', description: 'Height in pixels (default: 600)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'puppeteer_click',
    description: 'Click an element on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for element to click' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'puppeteer_fill',
    description: 'Fill out an input field',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for input field' },
        value: { type: 'string', description: 'Value to fill' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'puppeteer_select',
    description: 'Select an element on the page with Select tag',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for element to select' },
        value: { type: 'string', description: 'Value to select' },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'puppeteer_hover',
    description: 'Hover an element on the page',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for element to hover' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'puppeteer_evaluate',
    description: 'Execute JavaScript in the browser console',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['script'],
    },
  },
  {
    name: 'puppeteer_waitForSelector',
    description: 'Wait until a specific element appears in the page DOM before continuing',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'The CSS selector or XPath of the element to wait for' },
        timeout: {
          type: 'number',
          description: 'Maximum time to wait for the selector to appear, in milliseconds (optional)',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'puppeteer_waitForNavigation',
    description: 'Wait until the page has fully navigated to a new URL or reloaded',
    inputSchema: {
      type: 'object',
      properties: {
        timeout: { type: 'number', description: 'Maximum time to wait for navigation, in milliseconds (optional)' },
        waitUntil: {
          type: 'string',
          description:
            'When to consider navigation finished (e.g., load, domcontentloaded, networkidle0). Default: load',
        },
      },
      required: [],
    },
  },
  {
    name: 'puppeteer_scrollTo',
    description: 'Scroll to a specific position on the page',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Horizontal pixel value to scroll to (default: 0)' },
        y: { type: 'number', description: 'Vertical pixel value to scroll to (default: 0)' },
      },
      required: [],
    },
  },
  {
    name: 'puppeteer_scrollElement',
    description: 'Scroll a specific element to a given position',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for the scrollable element' },
        x: { type: 'number', description: 'Horizontal pixel value to scroll to (default: 0)' },
        y: { type: 'number', description: 'Vertical pixel value to scroll to (default: 0)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'puppeteer_evaluateAll',
    description: 'Evaluate JavaScript across all elements matching a selector and return structured results',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector or XPath for elements to evaluate' },
        expression: { type: 'string', description: 'JavaScript expression to run on each selected element' },
      },
      required: ['selector', 'expression'],
    },
  },
  {
    name: 'puppeteer_pressKey',
    description: 'Simulate pressing a keyboard key',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The name of the key to press (e.g., Enter, ArrowDown)' },
        delay: { type: 'number', description: 'Time to wait between keydown and keyup in milliseconds (optional)' },
      },
      required: ['key'],
    },
  },
  {
    name: 'puppeteer_closePage',
    description: 'Close the current page',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'puppeteer_reloadPage',
    description: 'Reload the current page',
    inputSchema: {
      type: 'object',
      properties: {
        waitUntil: {
          type: 'string',
          description:
            'When to consider reload finished (e.g., load, domcontentloaded, networkidle0). Default: networkidle0',
        },
      },
      required: [],
    },
  },
  {
    name: 'puppeteer_closeBrowser',
    description: 'Closes the current browser',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

let browser: Browser | null
let page: Page | null
const consoleLogs: string[] = []
const screenshots = new Map<string, string>()
let previousLaunchOptions: any = null

async function ensureBrowser({ launchOptions, allowDangerous }: any) {
  const DANGEROUS_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-web-security',
    '--ignore-certificate-errors',
    '--disable-features=IsolateOrigins',
    '--disable-site-isolation-trials',
    '--allow-running-insecure-content',
  ]

  let envConfig = {}
  try {
    envConfig = JSON.parse(process.env.PUPPETEER_LAUNCH_OPTIONS || '{}')
  } catch (error: any) {
    console.warn('Failed to parse PUPPETEER_LAUNCH_OPTIONS:', error?.message || error)
  }

  const mergedConfig = deepMerge(envConfig, launchOptions || {})

  if (mergedConfig?.args) {
    const dangerousArgs = mergedConfig.args?.filter?.((arg: string) =>
      DANGEROUS_ARGS.some((dangerousArg: string) => arg.startsWith(dangerousArg)),
    )
    if (dangerousArgs?.length > 0 && !(allowDangerous || process.env.ALLOW_DANGEROUS === 'true')) {
      throw new Error(
        `Dangerous browser arguments detected: ${dangerousArgs.join(', ')}. Fround from environment variable and tool call argument. ` +
          'Set allowDangerous: true in the tool call arguments to override.',
      )
    }
  }

  try {
    if (
      (browser && !browser.connected) ||
      (launchOptions && JSON.stringify(launchOptions) != JSON.stringify(previousLaunchOptions))
    ) {
      await browser?.close()
      browser = null
    }
  } catch (error) {
    browser = null
  }

  previousLaunchOptions = launchOptions

  if (!browser) {
    browser = await puppeteer.connect(
      deepMerge(
        {
          headless: true,
          acceptInsecureCerts: true,
          browserWSEndpoint: process.env.BROWSER_URL || 'ws://localhost:9222/devtools/browser',
          defaultViewport: null,
          protocol: 'cdp',
        },
        mergedConfig,
      ),
    )
    const pages = await browser.pages()
    page = pages[0]

    page.on('console', msg => {
      const logEntry = `[${msg.type()}] ${msg.text()}`
      consoleLogs.push(logEntry)
      server.notification({
        method: 'notifications/resources/updated',
        params: { uri: 'console://logs' },
      })
    })
  }
  return page!
}

function deepMerge(target: any, source: any): any {
  const output = Object.assign({}, target)
  if (typeof target !== 'object' || typeof source !== 'object') return source

  for (const key of Object.keys(source)) {
    const targetVal = target[key]
    const sourceVal = source[key]
    if (Array.isArray(targetVal) && Array.isArray(sourceVal)) {
      output[key] = [
        ...new Set([
          ...(key === 'args' || key === 'ignoreDefaultArgs'
            ? targetVal.filter(
                (arg: string) =>
                  !sourceVal.some(
                    (launchArg: string) => arg.startsWith('--') && launchArg.startsWith(arg.split('=')[0]),
                  ),
              )
            : targetVal),
          ...sourceVal,
        ]),
      ]
    } else if (sourceVal instanceof Object && key in target) {
      output[key] = deepMerge(targetVal, sourceVal)
    } else {
      output[key] = sourceVal
    }
  }
  return output
}

declare global {
  interface Window {
    mcpHelper: {
      logs: string[]
      originalConsole: Partial<typeof console>
    }
  }
}

async function handleToolCall(name: string, args: any): Promise<CallToolResult> {
  const page = await ensureBrowser(args)

  switch (name) {
    case 'puppeteer_waitForNavigation':
      await page.waitForNavigation({
        timeout: args.timeout,
        waitUntil: args.waitUntil || 'load',
      })
      return {
        content: [{ type: 'text', text: `Waited for navigation (waitUntil: ${args.waitUntil || 'load'})` }],
        isError: false,
      }

    case 'puppeteer_scrollTo':
      await page.evaluate(({ x = 0, y = 0 }) => window.scrollTo(x, y), { x: args.x, y: args.y })
      return {
        content: [{ type: 'text', text: `Scrolled to position x:${args.x || 0}, y:${args.y || 0}` }],
        isError: false,
      }
    case 'puppeteer_closeBrowser':
      if (browser) await browser.close()
      return {
        content: [{ type: 'text', text: `Browser closed` }],
        isError: false,
      }

    case 'puppeteer_scrollElement':
      await page.evaluate(
        ({ selector, x = 0, y = 0 }) => {
          const el = document.querySelector(selector)
          if (el) el.scrollTo(x, y)
        },
        { selector: args.selector, x: args.x, y: args.y },
      )
      return {
        content: [{ type: 'text', text: `Scrolled element ${args.selector} to x:${args.x || 0}, y:${args.y || 0}` }],
        isError: false,
      }

    case 'puppeteer_evaluateAll':
      const results = await page.$$eval(
        args.selector,
        (elements, expression) => {
          return elements.map(el => {
            try {
              return eval(expression)
            } catch (e) {
              return null
            }
          })
        },
        args.expression,
      )
      return {
        content: [{ type: 'text', text: JSON.stringify(results) }],
        isError: false,
      }

    case 'puppeteer_pressKey':
      await page.keyboard.press(args.key, {
        delay: args.delay,
      })
      return {
        content: [{ type: 'text', text: `Pressed key ${args.key}` }],
        isError: false,
      }

    case 'puppeteer_closePage':
      await page.close()
      return {
        content: [{ type: 'text', text: `Closed the page` }],
        isError: false,
      }

    case 'puppeteer_reloadPage':
      await page.reload({ waitUntil: args.waitUntil || 'load' })
      return {
        content: [{ type: 'text', text: `Reloaded the page (waitUntil: ${args.waitUntil || 'load'})` }],
        isError: false,
      }

    case 'puppeteer_navigate':
      await page.goto(args.url)
      return {
        content: [
          {
            type: 'text',
            text: `Navigated to ${args.url}`,
          },
        ],
        isError: false,
      }

    case 'puppeteer_screenshot': {
      const width = args.width ?? 800
      const height = args.height ?? 600
      await page.setViewport({ width, height })

      const screenshot = await (args.selector
        ? (await page.$(args.selector))?.screenshot({ encoding: 'base64' })
        : page.screenshot({ encoding: 'base64', fullPage: false }))

      if (!screenshot) {
        return {
          content: [
            {
              type: 'text',
              text: args.selector ? `Element not found: ${args.selector}` : 'Screenshot failed',
            },
          ],
          isError: true,
        }
      }

      screenshots.set(args.name, screenshot as string)
      server.notification({
        method: 'notifications/resources/list_changed',
      })

      return {
        content: [
          {
            type: 'text',
            text: `Screenshot '${args.name}' taken at ${width}x${height}`,
          } as TextContent,
          {
            type: 'image',
            data: screenshot,
            mimeType: 'image/png',
          } as ImageContent,
        ],
        isError: false,
      }
    }

    case 'puppeteer_click':
      try {
        await page.click(args.selector)
        return {
          content: [
            {
              type: 'text',
              text: `Clicked: ${args.selector}`,
            },
          ],
          isError: false,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to click ${args.selector}: ${(error as Error).message}`,
            },
          ],
          isError: true,
        }
      }

    case 'puppeteer_fill':
      try {
        await page.waitForSelector(args.selector)
        await page.type(args.selector, args.value)
        return {
          content: [
            {
              type: 'text',
              text: `Filled ${args.selector} with: ${args.value}`,
            },
          ],
          isError: false,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fill ${args.selector}: ${(error as Error).message}`,
            },
          ],
          isError: true,
        }
      }

    case 'puppeteer_select':
      try {
        await page.waitForSelector(args.selector)
        await page.select(args.selector, args.value)
        return {
          content: [
            {
              type: 'text',
              text: `Selected ${args.selector} with: ${args.value}`,
            },
          ],
          isError: false,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to select ${args.selector}: ${(error as Error).message}`,
            },
          ],
          isError: true,
        }
      }

    case 'puppeteer_hover':
      try {
        await page.waitForSelector(args.selector)
        await page.hover(args.selector)
        return {
          content: [
            {
              type: 'text',
              text: `Hovered ${args.selector}`,
            },
          ],
          isError: false,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to hover ${args.selector}: ${(error as Error).message}`,
            },
          ],
          isError: true,
        }
      }

    case 'puppeteer_evaluate':
      try {
        await page.evaluate(() => {
          window.mcpHelper = {
            logs: [],
            originalConsole: { ...console },
          }
          ;['log', 'info', 'warn', 'error'].forEach(method => {
            ;(console as any)[method] = (...args: any[]) => {
              window.mcpHelper.logs.push(`[${method}] ${args.join(' ')}`)
              ;(window.mcpHelper.originalConsole as any)[method](...args)
            }
          })
        })

        const result = await page.evaluate(args.script)

        const logs = await page.evaluate(() => {
          Object.assign(console, window.mcpHelper.originalConsole)
          const logs = window.mcpHelper.logs
          delete (window as any).mcpHelper
          return logs
        })

        return {
          content: [
            {
              type: 'text',
              text: `Execution result:\n${JSON.stringify(result, null, 2)}\n\nConsole output:\n${logs.join('\n')}`,
            },
          ],
          isError: false,
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Script execution failed: ${(error as Error).message}`,
            },
          ],
          isError: true,
        }
      }

    default:
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      }
  }
}

const server = new MCPServerWrapper({
  name: 'mcp-servers/puppeteer',
  version: '0.1.0',
  listResources: async () => ({
    resources: [
      {
        uri: 'console://logs',
        mimeType: 'text/plain',
        name: 'Browser console logs',
      },
      ...Array.from(screenshots.keys()).map(name => ({
        uri: `screenshot://${name}`,
        mimeType: 'image/png',
        name: `Screenshot: ${name}`,
      })),
    ],
  }),
  readResource: async request => {
    {
      const uri = request.params.uri.toString()

      if (uri === 'console://logs') {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: consoleLogs.join('\n'),
            },
          ],
        }
      }

      if (uri.startsWith('screenshot://')) {
        const name = uri.split('://')[1]
        const screenshot = screenshots.get(name)
        if (screenshot) {
          return {
            contents: [
              {
                uri,
                mimeType: 'image/png',
                blob: screenshot,
              },
            ],
          }
        }
      }

      throw new Error(`Resource not found: ${uri}`)
    }
  },
  listTools: () => ({
    tools: TOOLS,
  }),
  callTool: async request => {
    handleToolCall(request.params.name, request.params.arguments ?? {})
  },
})

server.listen(80)
