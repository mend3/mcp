# 🧠 MCP Servers

> A curated collection of custom **MCP (Model Context Protocol)** servers for internal use.

These servers expose specific toolsets (like browser automation or database interaction) via a natural language interface using the MCP protocol.

## 📦 Included Servers

- **Puppeteer**  
  Natural language interface to control automated browsers using Puppeteer and Chrome/Browserless.

- **Postgres Vector Store**  
  Interface to search and interact with a PostgreSQL-backed vector database.

- **MySQL**  
  Allows users to query and interact with a MySQL database using natural language prompts.

- **Parquet** _(in progress)_  
  Experimental server that converts between JSON and Parquet formats using natural language instructions.

---

## 🚀 Getting Started

**Clone and build:**

```bash
# 1 - clone this repo
git clone https://github.com/mend3/mcp

# 2 - that will create a folder called "mcp" on your current directory
# with that in mind, you can just attach the docker-compose
docker compose up \
  # your docker-compose
  -f docker-compose.yml \ 
  # mcp docker-compose
  -f mcp/docker-compose.yml \ 
  build mcp-*
```

**Start all MCP servers using Docker Compose:**

```bash
docker compose up -d mcp-*
```

**Run a specific server locally (in development mode):**

```bash
tsx src/[server]
```

Replace `[server]` with the desired module (e.g., `puppeteer`, `mysql`, `pgvector`).

---

## 🔌 Easy Integration with Clients (Claude, Cursor, etc.)

MCP servers integrate **natively** with clients like **Claude**, **Cursor**, and other MCP-compatible tools.

Just point the client to your MCP server by adding it to your configuration file like this:

**After server is running:**

```json
{
  "mcpServers": {
    "puppeteer": {
      "url": "http://localhost:8000/sse"
    },
    "pgvector": {
      "url": "http://localhost:8001/sse"
    },
    "mysql": {
      "url": "http://localhost:8002/sse"
    }
  }
}
```

This makes your server instantly accessible to tools capable of understanding the MCP protocol.

---

## 📖 Official MCP Documentation

- [MCP Introduction](https://modelcontextprotocol.io/introduction)
- [MCP Examples](https://modelcontextprotocol.io/examples)
- [Quickstart: Node.js Client](https://modelcontextprotocol.io/quickstart/client#node)
- [MCP TypeScript SDK (GitHub)](https://github.com/modelcontextprotocol/typescript-sdk)

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

```txt
                                      _  _
                            _____*~~~  **  ~~~*_____
                         __* ___     |\__/|     ___ *__
                       _*  / 888~~\__(8OO8)__/~~888 \  *_
                     _*   /88888888888888888888888888\   *_
                     *   |8888888888888888888888888888|   *
                    /~*  \8888/~\88/~\8888/~\88/~\8888/  *~
                   /  ~*  \88/   \/   (88)   \/   \88/  *~
                  /    ~*  \/          \/          \/  *~
                 /       ~~*_                      _*~~/
                /            ~~~~~*___ ** ___*~~~~~  /
               /                      ~  ~         /
              /                                  /
             /                                 /
            /                                /
           /                    ___sws___  /
          /                    | ####### |
         /            ___      | ####### |             ____i__
        /  _____p_____l_l____  | ####### |            | ooooo |         qp
i__p__ /  |  ###############  || ####### |__l___xp____| ooooo |      |~~~~|
 oooo |_I_|  ###############  || ####### |oo%Xoox%ooxo| ooooo |p__h__|##%#|
 oooo |ooo|  ###############  || ####### |o%xo%%xoooo%| ooooo |      |#xx%|
 oooo |ooo|  ###############  || ####### |o%ooxx%ooo%%| ooooo |######|x##%|
 oooo |ooo|  ###############  || ####### |oo%%x%oo%xoo| ooooo |######|##%x|
 oooo |ooo|  ###############  || ####### |%x%%oo%/oo%o| ooooo |######|/#%x|
 oooo |ooo|  ###############  || ####### |%%x/oo/xx%xo| ooooo |######|#%x/|
 oooo |ooo|  ###############  || ####### |xxooo%%/xo%o| ooooo |######|#^x#|
 oooo |ooo|  ###############  || ####### |oox%%o/x%%ox| ooooo |~~~$~~|x##/|
 oooo |ooo|  ###############  || ####### |x%oo%x/o%//x| ooooo |_KKKK_|#x/%|
 oooo |ooo|  ###############  || ####### |oox%xo%%oox%| ooooo |_|~|~~|xx%/|
 oooo |oHo|  #####AAAA######  || ##XX### |x%x%WWx%%/ox| ooDoo |_| |Y||xGGx|
 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
```
