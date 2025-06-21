import type {
  CallToolRequest,
  CallToolResult,
  ListResourcesRequest,
  ListResourcesResult,
  ReadResourceRequest,
  ReadResourceResult,
  Tool,
} from '@modelcontextprotocol/sdk/types'
import { Browser, LaunchOptions, Page } from 'puppeteer'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { MCPServerWrapper } from './core/wrapper'
import { deepMerge } from './functions'

let browser: Browser | null = null
let page: Page | null = null
const consoleLogs: string[] = []
const screenshots = new Map<string, string>()
let previousLaunchOptions: LaunchOptions | null = null

puppeteer.use(StealthPlugin())

const {
  USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  BROWSER_HOST, // 'ws://localhost:9222/devtools/browser'
  PORT = 80,
  PUPPETEER_LAUNCH_OPTIONS = '{}',
  ALLOW_DANGEROUS = 'false',
} = process.env

const browserize = (userAgent: string, page: Page) =>
  page.evaluateOnNewDocument(__USER_AGENT__ => {
    // https://intoli.com/blog/making-chrome-headless-undetectable/
    // https://antoinevastel.com/bot%20detection/2018/01/17/detect-chrome-headless-v2.html
    // Hide overridden properties from `Object.getOwnPropertyNames`
    const originalNavigator = { ...navigator }
    for (const key in originalNavigator) {
      if (!Object.prototype.hasOwnProperty.call(navigator, key)) {
        Object.defineProperty(navigator, key, {
          get: () => originalNavigator[key as keyof typeof originalNavigator],
          configurable: true,
        })
      }
    }

    // Clean up `navigator` properties
    Object.defineProperties(navigator, {
      deviceMemory: { value: 4 },
      hardwareConcurrency: { value: 4 },
      webdriver: {
        get: () => false,
        configurable: true,
        enumerable: false,
      },
      platform: {
        get: () => 'Win32',
      },
      appVersion: {
        get: () => __USER_AGENT__,
      },
      userAgent: {
        get: () => __USER_AGENT__,
      },
      userAgentData: {
        get: () => ({
          brands: [
            { brand: 'Google Chrome', version: '137' },
            { brand: 'Chromium', version: '137' },
            { brand: 'Not/A)Brand', version: '24' },
          ],
          mobile: false,
          platform: 'Windows',
        }),
      },
      languages: { get: () => ['pt-BR', 'en-US', 'pt', 'en'] },
      plugins: {
        get: function () {
          const pluginData = [
            { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            {
              name: 'Microsoft Edge PDF Viewer',
              filename: 'internal-pdf-viewer',
              description: 'Portable Document Format',
            },
            { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          ]
          const pluginArray: {
            name: string
            filename: string
            description: string
          }[] = []
          pluginData.forEach(p => {
            function FakePlugin() {
              return p
            }
            const plugin = FakePlugin()
            Object.setPrototypeOf(plugin, Plugin.prototype)
            pluginArray.push(plugin)
          })
          Object.setPrototypeOf(pluginArray, PluginArray.prototype)
          return pluginArray
        },
      },
    })

    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      // UNMASKED_VENDOR_WEBGL
      if (parameter === 37445) {
        return 'Google Inc. (NVIDIA)'
      }
      // UNMASKED_RENDERER_WEBGL
      if (parameter === 37446) {
        return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)'
      }

      return new WebGLRenderingContext().getParameter(parameter)
    }
    ;['height', 'width'].forEach(property => {
      // store the existing descriptor
      const imageDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, property)

      // redefine the property with a patched descriptor
      Object.defineProperty(HTMLImageElement.prototype, property, {
        ...imageDescriptor,
        get: function () {
          // return an arbitrary non-zero dimension if the image failed to load
          if (this.complete && this.naturalHeight === 0) return 20

          // otherwise, return the actual dimension
          return imageDescriptor?.get?.apply(this)
        },
      })
    })

    // store the existing descriptor
    const elementDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

    // redefine the property with a patched descriptor
    Object.defineProperty(HTMLDivElement.prototype, 'offsetHeight', {
      ...elementDescriptor,
      get: function () {
        if (this.id === 'modernizr') return 1

        return elementDescriptor?.get?.apply(this)
      },
    })
  }, userAgent)

async function ensureBrowser({
  launchOptions,
  allowDangerous,
}: {
  launchOptions: LaunchOptions
  allowDangerous: boolean
}) {
  const DANGEROUS_ARGS = [
    '--no-sandbox', // Required for some environments, but disables Chrome's sandbox. Remove if not needed.
    '--no-zygote',
    '--disable-setuid-sandbox',
    '--single-process',
    '--disable-web-security',
    '--ignore-certificate-errors',
    '--disable-features=IsolateOrigins,site-per-process', // Reduces site isolation fingerprinting
    '--disable-site-isolation-trials',
    '--allow-running-insecure-content',
  ]

  const defaultConfig = {
    headless: false,
    acceptInsecureCerts: true,
    defaultViewport: null,
    protocol: 'cdp',
    args: [
      // Anonymity & Fingerprinting
      '--disable-infobars', // Hides "Chrome is being controlled by automated test software"
      '--disable-blink-features=AutomationControlled', // Removes automation flag from JS
      '--disable-dev-shm-usage', // Avoids /dev/shm issues in Docker
      // Security
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-extensions', // Disables all extensions
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--password-store=basic',
      '--use-mock-keychain',

      // Performance
      '--disable-gpu', // Disable GPU hardware acceleration
      '--disable-software-rasterizer',
      '--no-default-browser-check',
      '--disable-notifications',
      '--mute-audio',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-accelerated-2d-canvas',
      '--disable-accelerated-jpeg-decoding',
      '--disable-accelerated-mjpeg-decode',
      '--disable-accelerated-video-decode',

      // Privacy
      '--disable-logging',
      '--disable-permissions-api',
      '--disable-geolocation',
      '--disable-webgl',
      '--disable-webrtc',
    ],
  }

  let envConfig: Partial<typeof defaultConfig> = {}
  try {
    envConfig = JSON.parse(PUPPETEER_LAUNCH_OPTIONS)
  } catch (error: any) {
    console.warn('Failed to parse PUPPETEER_LAUNCH_OPTIONS:', error?.message || error)
  }

  const mergedConfig = deepMerge(
    {
      ...defaultConfig,
      ...envConfig,
      args: Array.from(new Set(defaultConfig.args.concat(envConfig.args || [])).values()),
    },
    launchOptions || {},
  ) as LaunchOptions

  if (mergedConfig?.args) {
    const dangerousArgs = mergedConfig.args.filter(arg =>
      DANGEROUS_ARGS.some(dangerousArg => arg.startsWith(dangerousArg)),
    )
    if (dangerousArgs?.length > 0 && !(allowDangerous || ALLOW_DANGEROUS === 'true')) {
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
    browser = await (BROWSER_HOST
      ? puppeteer.connect({
          acceptInsecureCerts: true,
          browserWSEndpoint: BROWSER_HOST,
          defaultViewport: null,
          protocol: 'cdp',
          headers: {
            'keep-alive': '300000',
            'user-agent': USER_AGENT,
          },
        })
      : puppeteer.launch(
          deepMerge(
            {
              headless: false,
              acceptInsecureCerts: true,
              defaultViewport: null,
              protocol: 'cdp',
            },
            mergedConfig,
          ),
        ))
    const pages = await browser.pages()
    page = pages[0]
    await page.setUserAgent(USER_AGENT)
    await browserize(USER_AGENT, page)

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
    name: 'puppeteer_openPage',
    description: 'Open a new page',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
    },
  },
  {
    name: 'puppeteer_screenshot',
    description: 'Take a screenshot of the current page or a specific element',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', description: 'If true, take a full page screenshot (default: true)' },
      },
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
    name: 'puppeteer_evaluate',
    description:
      'Execute JavaScript in the browser console. Expected a string of code to execute (e.g., `document.querySelector("div.main-content").innerText.trim()`). Care to use coalescing operator to handle nullish values.',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['script'],
    },
  },
  {
    name: 'puppeteer_evaluateAll',
    description:
      'Evaluates a JavaScript expression on all elements matching a selector. The expression can reference the element as `el` and is evaluated in the browser context. Returns an array of results. The results are an object with the following properties: evaluationOutput (output from the expression), element (useful properties of the element).',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description:
            'CSS or XPath selector to target elements (e.g., "div.main-content" or "//div[@class=\'main-content\']"). A single selector is expected.',
        },
        expression: {
          type: 'string',
          description:
            'JavaScript expression (function body) to run on each selected element. The current element is passed as `el`. For example: `return el.innerText?.trim();`. This will be evaluated using `new Function("el", expression)` so it is IMPERATIVE that the expression is a valid JavaScript function body with a return statement.',
        },
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

const listResources: (request: ListResourcesRequest) => Promise<ListResourcesResult> = async request => {
  return {
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
  }
}

const readResource: (request: ReadResourceRequest) => Promise<ReadResourceResult> = async request => {
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
}

const formatResponse = (content: CallToolResult['content'][number], isError = false): CallToolResult => {
  return { isError, content: [content] }
}

const callTool = async (
  request: CallToolRequest,
): Promise<CallToolResult['content'][number] & { isError?: boolean }> => {
  const { name, arguments: _args } = request.params as { name: string; arguments: any }
  const args = { ...(_args || {}) }
  console.log(`Handling tool call: ${name}`, args)
  page = await ensureBrowser(args)

  if (!page || page.isClosed()) throw new Error('Failed to get a page. Call tool to open a new page.')

  switch (name) {
    case 'puppeteer_reloadPage': {
      await page.reload({ waitUntil: args.waitUntil || 'load' })
      return {
        type: 'text',
        text: `Reloaded the page (waitUntil: ${args.waitUntil || 'load'})`,
      }
    }

    case 'puppeteer_openPage': {
      page = await ensureBrowser(args)
      await page.goto(args.url, { waitUntil: 'load' })
      return {
        type: 'text',
        text: `Navigated to ${args.url}`,
      }
    }

    case 'puppeteer_navigate': {
      await page.goto(args.url, { waitUntil: 'load' })
      return {
        type: 'text',
        text: `Navigated to ${args.url}`,
      }
    }
    case 'puppeteer_waitForNavigation': {
      await page.waitForNavigation({
        timeout: args.timeout,
        waitUntil: args.waitUntil || 'load',
      })
      return {
        type: 'text',
        text: `Waited for navigation (waitUntil: ${args.waitUntil || 'load'})`,
      }
    }

    case 'puppeteer_closeBrowser': {
      if (browser) await browser.close()
      return {
        type: 'text',
        text: `Browser closed`,
      }
    }

    case 'puppeteer_scrollElement': {
      await page.evaluate(
        ({ selector, x = 0, y = 0 }) => {
          const el = document.querySelector(selector)
          if (el) el.scrollTo(x, y)
        },
        { selector: args.selector, x: args.x, y: args.y },
      )
      return {
        type: 'text',
        text: `Scrolled element ${args.selector} to x:${args.x || 0}, y:${args.y || 0}`,
      }
    }

    case 'puppeteer_scrollTo': {
      await page.evaluate(({ x = 0, y = 0 }) => window.scrollTo(x, y), { x: args.x, y: args.y })
      return {
        type: 'text',
        text: `Scrolled to position x:${args.x || 0}, y:${args.y || 0}`,
      }
    }

    case 'puppeteer_evaluate': {
      await page.evaluate(() => {
        window.mcpHelper = {
          logs: [],
          originalConsole: { ...console },
        }
        const levels = ['log', 'info', 'warn', 'error'] as const
        levels.forEach(method => {
          console[method] = (...args: any[]) => {
            window.mcpHelper.logs.push(`[${method}] ${args.join(' ')}`)
            window.mcpHelper.originalConsole[method](...args)
          }
        })
      })

      const evaluatedResult = await page.$eval(args.selector || '*', args.script)
      const result = typeof evaluatedResult === 'function' ? await evaluatedResult() : evaluatedResult

      const logs = await page.evaluate(() => {
        Object.assign(console, window.mcpHelper.originalConsole)
        const logs = window.mcpHelper.logs
        delete (window as any).mcpHelper
        return logs
      })

      return {
        type: 'text',
        text: `Execution result:\n${JSON.stringify(result, null, 2)}\n\nConsole output:\n${logs.join('\n')}`,
      }
    }

    case 'puppeteer_evaluateAll': {
      const results = await page.$$eval(
        args.selector,
        (elements, expression) =>
          (elements || []).map(el => {
            const element = {
              attributes: Object.entries(el.attributes).reduce(
                (acc, [name, attr]) => {
                  acc[attr.name] = attr.value
                  return acc
                },
                {} as Record<string, string>,
              ),
              tagName: el.tagName,
              id: el.id,
              classList: Array.from(el.classList),
              innerHTML: el.innerHTML,
              outerHTML: el.outerHTML,
              textContent: el.textContent,
            }

            const fnExpression = expression.indexOf('return ') === -1 ? `return ${expression}` : expression
            try {
              const fn = new Function('el', fnExpression)
              return fn(el)
            } catch (error) {
              return {
                evaluationError: (error as Error).message,
                evaluationErrorStack: (error as Error).stack,
                expression: fnExpression,
                element,
              }
            }
          }),
        args.expression,
      )
      return {
        type: 'text',
        text: JSON.stringify(results.filter(Boolean)),
      }
    }

    case 'puppeteer_pressKey': {
      await page.keyboard.press(args.key, {
        delay: args.delay,
      })
      return {
        type: 'text',
        text: `Pressed key ${args.key}`,
      }
    }

    case 'puppeteer_closePage': {
      const { title } = page.mainFrame()
      await page.close()
      return {
        type: 'text',
        text: `Page ${title} closed`,
      }
    }

    case 'puppeteer_waitForSelector': {
      await page.waitForSelector(args.selector)
      return {
        type: 'text',
        text: `Selector found: ${args.selector}`,
      }
    }

    case 'puppeteer_click': {
      await page.waitForSelector(args.selector)
      await page.hover(args.selector)
      await page.click(args.selector)
      return {
        type: 'text',
        text: `Clicked: ${args.selector}`,
      }
    }

    case 'puppeteer_fill': {
      await page.waitForSelector(args.selector)
      await page.hover(args.selector)
      await page.type(args.selector, args.value)
      return {
        type: 'text',
        text: `Filled ${args.selector} with: ${args.value}`,
      }
    }

    case 'puppeteer_select': {
      await page.waitForSelector(args.selector)
      await page.hover(args.selector)
      await page.select(args.selector, args.value)
      return {
        type: 'text',
        text: `Selected ${args.selector} with: ${args.value}`,
      }
    }

    case 'puppeteer_hover': {
      await page.waitForSelector(args.selector)
      await page.hover(args.selector)
      return {
        type: 'text',
        text: `Hovered ${args.selector}`,
      }
    }

    case 'puppeteer_screenshot': {
      const screenshot = await page.screenshot({ encoding: 'base64', fullPage: args.fullPage || true })

      if (!screenshot) {
        throw new Error('Screenshot failed')
      }

      const name = `screenshot-${Date.now()}`

      screenshots.set(name, screenshot as string)
      server.notification({
        method: 'notifications/resources/list_changed',
      })

      return {
        type: 'image',
        data: screenshot,
        mimeType: 'image/png',
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

const server = new MCPServerWrapper({
  name: 'mcp-servers/puppeteer',
  version: '0.1.0',
  listTools: () => ({
    tools: TOOLS,
  }),
  listResources,
  readResource,
  callTool: request =>
    callTool(request)
      .then(({ isError, ...result }) => formatResponse(result, isError))
      .catch(error =>
        formatResponse(
          {
            type: 'text',
            text: `Failed to handle tool call: ${request.params.name}\n\tArgs: ${JSON.stringify(request.params.arguments)}\n\tError: ${error.message}`,
          },
          true,
        ),
      ),
})

server.listen(+(PORT || 80))
