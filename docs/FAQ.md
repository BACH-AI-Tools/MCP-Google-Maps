# 常见问题 / FAQ

本文件回答新用户在安装、配置和调用本 MCP server 时最常遇到的问题。每条结论都标注了源码位置，方便核对。
This FAQ covers the most common setup and usage problems. Each answer references the source location it is based on.

---

## 中文

### 1. 启动就报 `Google Maps API key is required. Please set GOOGLE_MAPS_API_KEY environment variable.`

**原因**：进程启动时会读取环境变量 `GOOGLE_MAPS_API_KEY`，如果为空就直接抛错退出（`src/config/environment.ts:21`、`src/config/environment.ts:34-38`）。这一检查发生在连接 MCP 客户端之前，所以客户端看到的是「server 启动失败 / 没有工具」。

**解决**：在 MCP 客户端的配置里把 key 写进 `env`（README 示例见 `README.md:35-53`），例如：

```json
"env": { "GOOGLE_MAPS_API_KEY": "你的key" }
```

不要只把 key 放在仓库根目录的 `.env` 里就以为一定会生效：程序用 `dotenv.config()` 且没有指定路径（`src/config/environment.ts:4`），`.env` 是从**进程当前工作目录**读取的；用 `npx` 在别的目录启动时就找不到它。最稳妥的做法是写在 MCP 配置的 `env` 里。

### 2. 客户端日志里只有一句 `Fatal error in main()`，没有别的信息

**原因**：stdio 入口把所有未捕获异常打到 stderr 后以状态码 1 退出（`src/index.ts:18-21`）。由于 MCP 走标准输入输出，很多客户端把 stderr 收在日志里而不是界面上。

**排查步骤**：
1. 在终端里直接跑 `npx -y @bachstudio/mcp-google-maps`（包名与 bin 见 `README.md:19-29`、`package.json:35-37`），看完整报错；
2. 90% 的情况是第 1 条的 API key 缺失；
3. 如果报错里出现 `Cannot find module`，说明安装/网络有问题，先重装再试。

### 3. 到底该用哪个命令启动？

发布的包是 `@bachstudio/mcp-google-maps`，可执行命令名是 `bachstudio-mcp-google-maps`（`package.json:35-37`、`package.json:2`）。客户端配置里推荐用 `npx -y @bachstudio/mcp-google-maps`，这样不用全局安装（`README.md:35-53`）。全局安装只是为了在终端里手动测试（`README.md:19-29`），不是客户端配置的必需步骤。

### 4. 有 HTTP / 端口 3333 模式吗？`PORT` 环境变量管用吗？

**当前发布的包只有 stdio 入口**：构建脚本只打包 `src/index.ts`（`package.json:7-14`），`bin` 也只指向 `dist/index.cjs`（`package.json:35-37`），所以 `src/mcp/http-server.ts` 不在发布产物里，改 `PORT` 也不会影响 stdio 模式。

仓库里确实有一个 HTTP 版本（`src/mcp/http-server.ts`），它读取 `PORT`、默认 3333（`src/mcp/http-server.ts:73-77`），但需要自行把它加入构建/启动脚本后才能使用。另外该文件把允许的 Host 写死为 `127.0.0.1`、`localhost`、`localhost:3333`（`src/mcp/http-server.ts:19`），所以即使本地跑起来，只要把端口改成别的值，Host 校验可能不通过——这属于代码层面待处理的问题，不在配置层面能绕过。

### 5. `search_nearby` 的 `center` 怎么写？

`center` 是一个对象，两个字段（`src/schemas/tool-schemas.ts:3-6`）：

- 传地址或地名：`{ "value": "上海外滩", "isCoordinates": false }`
- 传坐标：`{ "value": "31.2397,121.4998", "isCoordinates": true }`

**注意**：坐标必须是「纬度,经度」用英文逗号分隔，且 `isCoordinates` 必须为 `true`。否则 `value` 会被当成地址去 geocode（`src/services/places.ts:41-51`）；如果格式不对会先触发 `Invalid latitude. Must be between -90 and 90 degrees` 之类的校验错误（`src/utils/error-handling.ts:37-44`）。

### 6. 返回 `No results found for the given address`

**原因**：geocode 没有匹配到任何结果时直接报这个错（`src/services/places.ts:203-205`）。少数地名、缩写、门牌号不完整时会这样。

**解决**：换更完整的写法（加上城市/国家），或先用 `get_geocode` 单独试一次，确认能查到再用于 `search_nearby`。

### 7. 设了 `minRating`，结果变成空数组

**原因**：`minRating` 是在拿到 Google 返回结果之后做的本地过滤（`src/services/places.ts:79-83`），不是在服务端过滤。如果附近结果都不满足评分，就会返回空列表（`success: true`、`data: []`）。

**解决**：把 `minRating` 调低，或把 `radius` 放大（默认 1000 米，`src/schemas/tool-schemas.ts:13`）。空结果不是报错，客户端不会看到 `isError`。

### 8. `get_place_details` 报 `Google Places API error: ...` 或 `Missing required place data`

**原因**：工具会把 Google 返回的状态码和错误信息原样拼进错误里（`src/services/places.ts:127-131`、`src/services/places.ts:141-145`）。也就是说，错误内容来自 Google，不是本项目的判断。

**排查**：
1. 先确认 `placeId` 是真正的 Place ID（以 `ChIJ` 之类开头），不是搜索关键词——本工具不做地址到 Place ID 的转换，可先用 `search_nearby` 拿到 `placeId`；
2. 如果错误信息是 Google 侧的鉴权/未开通类提示，需要到 Google Cloud 控制台核对该 key 是否启用了 Places API、是否有 key 限制或配额问题。这部分是 Google 侧配置，仓库代码不做校验。

### 9. 缓存和限流配置（`ENABLE_CACHING`、`CACHE_TTL`、`MAX_REQUESTS_PER_SECOND`、`MAX_REQUESTS_PER_DAY`）好像没生效

**这是目前已知的情况**：这四个变量会被读进配置对象（`src/config/environment.ts:24-31`），但仓库里没有实现缓存和限流的代码——`config.caching` 和 `config.rateLimit` 在业务逻辑中没有任何引用（`src/services/places.ts`、`src/services/map-directions.ts`、`src/mcp/*.ts` 均未使用）。

**含义**：目前每次工具调用都会真实打到 Google，不会去重、也不会节流，费用和配额按实际调用量计。请按自己的配额控制调用频率。README 里的这些参数（`README.md:41-49`）暂时只能算「预留配置」。

### 10. `DEFAULT_LANGUAGE` / `DEFAULT_REGION` 影响哪些结果？

- `DEFAULT_LANGUAGE` 会传给 nearby 搜索、地点详情、geocode、反查、距离矩阵、路线（`src/services/places.ts:60`、`src/services/places.ts:104`、`src/services/places.ts:198`、`src/services/places.ts:233`、`src/services/places.ts:268`、`src/services/places.ts:300`），默认 `en`。
- `DEFAULT_REGION` **只**用在 geocode 上（`src/services/places.ts:199`），默认 `US`；反查、nearby、路线都不带 region。

所以想把返回语言改成中文，把 `DEFAULT_LANGUAGE` 设为 `zh-CN`；但地址解析偏好的区域只在 `get_geocode` 上生效，其他工具请直接在参数里写清城市。

### 11. `get_map_with_directions` 报 `Origin must include address, lat, and lng`

**原因**：该工具要求起点/终点同时带 `address`、`lat`、`lng` 三个字段（`src/services/map-directions.ts:114-131`），参数结构见 `src/schemas/tool-schemas.ts:50-73`。只传地址或只传坐标都会被拒绝。

**已知代码问题**：这里的校验用的是「值是否为真」的写法，所以 `lat` 或 `lng` 等于 `0`（赤道、本初子午线附近）也会被判定为缺失。如果你确实要传 0，目前会失败，这个限制是代码问题而不是你的用法问题，已经在跟进。

### 12. `get_map_with_directions` 返回的 `staticMapUrl` 能直接发给用户/贴到公开地方吗？

**不要**。这个 URL 里带着 Google Maps API key（`src/services/map-directions.ts:94-103`），代码注释本身也写了「不要把该 URL 直接发给客户端，因为包含 API key」（`src/services/map-directions.ts:102`），但工具结果仍然把完整 URL 放进了返回值（`src/services/map-directions.ts:159-161`）。

**建议**：把它当成内部中间结果使用，自己取图或在本地打开，不要把带 key 的 URL 写进公开文档、截图、聊天记录。这个行为已作为问题记录，待修复。若已外泄，请到 Google Cloud 控制台轮换 key。

### 13. `get_directions` 报 `No route found`

**原因**：Google 没有返回任何路线时会报这个错（`src/services/places.ts:304-306`）。常见于出行方式与路线不匹配（例如跨海用 `walking`）或起终点无法连通。

**解决**：确认 `mode` 取值只支持 `driving`、`walking`、`bicycling`、`transit`（`src/schemas/tool-schemas.ts:8`，默认 `driving`），换一种方式重试。`mode` 传其他值会被参数校验直接拒绝。

---

## English

### 1. The server exits with `Google Maps API key is required. Please set GOOGLE_MAPS_API_KEY environment variable.`

**Cause**: the API key is read from the environment at startup and the process throws immediately when it is empty (`src/config/environment.ts:21`, `src/config/environment.ts:34-38`). This happens before the MCP handshake, so the client just shows a server that failed to start.

**Fix**: put the key in the `env` block of your MCP client config (example: `README.md:35-53`):

```json
"env": { "GOOGLE_MAPS_API_KEY": "your_key_here" }
```

Note that a `.env` file in the repo root is not guaranteed to be picked up: `dotenv.config()` is called without a path (`src/config/environment.ts:4`), so `.env` is loaded from the **process working directory**. When launching via `npx` from another directory it will not be found. Prefer the client `env` block.

### 2. The client log shows only `Fatal error in main()`

**Cause**: the stdio entry point prints uncaught errors to stderr and exits with code 1 (`src/index.ts:18-21`). Many clients hide stderr in a log file.

**How to debug**:
1. Run `npx -y @bachstudio/mcp-google-maps` in a terminal to see the full error (package and bin name: `README.md:19-29`, `package.json:35-37`);
2. Nine times out of ten it is the missing API key from item 1;
3. `Cannot find module` means the install/network failed — reinstall first.

### 3. Which command should I actually use?

The published package is `@bachstudio/mcp-google-maps` and the executable is `bachstudio-mcp-google-maps` (`package.json:2`, `package.json:35-37`). Use `npx -y @bachstudio/mcp-google-maps` in the client config so no global install is needed (`README.md:35-53`). The global install (`README.md:19-29`) is only for manual testing in a terminal.

### 4. Is there an HTTP mode / port 3333? Does `PORT` do anything?

**The published package is stdio-only**: the build script bundles `src/index.ts` only (`package.json:7-14`) and `bin` points to `dist/index.cjs` (`package.json:35-37`), so `src/mcp/http-server.ts` is not part of the published artifact. Changing `PORT` has no effect in stdio mode.

An HTTP variant does exist in the repo (`src/mcp/http-server.ts`); it reads `PORT`, defaulting to 3333 (`src/mcp/http-server.ts:73-77`), but you must add it to the build/start scripts yourself to use it. It also hard-codes the allowed hosts to `127.0.0.1`, `localhost` and `localhost:3333` (`src/mcp/http-server.ts:19`), so once you run it on a different port the host check may reject requests. That is a code-level issue, not something you can work around with configuration.

### 5. How do I fill in `center` for `search_nearby`?

`center` is an object with two fields (`src/schemas/tool-schemas.ts:3-6`):

- Address or place name: `{ "value": "Times Square, New York", "isCoordinates": false }`
- Coordinates: `{ "value": "40.7580,-73.9855", "isCoordinates": true }`

The coordinate format must be `lat,lng` with a plain comma, and `isCoordinates` must be `true`. Otherwise the value is treated as an address and geocoded (`src/services/places.ts:41-51`); a malformed value fails coordinate validation first (`src/utils/error-handling.ts:37-44`).

### 6. `No results found for the given address`

**Cause**: geocoding returned zero results and the code throws this error (`src/services/places.ts:203-205`). Incomplete addresses, abbreviations and ambiguous names trigger it.

**Fix**: use a fuller address (city/country included), or call `get_geocode` on its own first to confirm the address resolves.

### 7. Setting `minRating` gives me an empty array

**Cause**: `minRating` is a client-side filter applied after Google responds (`src/services/places.ts:79-83`). If nothing nearby meets the rating, you get `success: true` with an empty list.

**Fix**: lower `minRating` or increase `radius` (default 1000 m, `src/schemas/tool-schemas.ts:13`). An empty result is not an error and does not set `isError`.

### 8. `get_place_details` returns `Google Places API error: ...` or `Missing required place data`

**Cause**: the tool passes Google's status code and error message straight through (`src/services/places.ts:127-131`, `src/services/places.ts:141-145`). The text comes from Google, not from this project.

**How to debug**:
1. Make sure the value is a real Place ID (usually starting with `ChIJ`), not a search phrase. This tool does not convert addresses to Place IDs — get one from `search_nearby` first;
2. If the message looks like an auth/entitlement problem, check in Google Cloud Console that the key has the required Places API enabled and no key/quota restrictions are blocking it. That is Google-side configuration; this repo does not validate it.

### 9. The caching and rate-limit settings (`ENABLE_CACHING`, `CACHE_TTL`, `MAX_REQUESTS_PER_SECOND`, `MAX_REQUESTS_PER_DAY`) appear to do nothing

**Known state**: the four variables are read into the config object (`src/config/environment.ts:24-31`), but there is no caching or rate-limiting implementation in the repo — `config.caching` and `config.rateLimit` are never referenced in the request paths (`src/services/places.ts`, `src/services/map-directions.ts`, `src/mcp/*.ts`).

**What it means**: every tool call hits Google for real; there is no de-duplication and no throttling, so cost and quota follow your actual call volume. Control your own call frequency. Treat these values (`README.md:41-49`) as reserved settings for now.

### 10. What do `DEFAULT_LANGUAGE` / `DEFAULT_REGION` actually affect?

- `DEFAULT_LANGUAGE` is sent with nearby search, place details, geocode, reverse geocode, distance matrix and directions (`src/services/places.ts:60`, `:104`, `:198`, `:233`, `:268`, `:300`); default `en`.
- `DEFAULT_REGION` is used **only** for geocoding (`src/services/places.ts:199`); default `US`. Reverse geocoding, nearby search and directions do not send it.

So set `DEFAULT_LANGUAGE=zh-CN` to get Chinese results, but the region bias only applies to `get_geocode`. For the other tools, put the city in the address you pass.

### 11. `get_map_with_directions` returns `Origin must include address, lat, and lng`

**Cause**: origin and destination must each carry `address`, `lat` and `lng` (`src/services/map-directions.ts:114-131`; schema in `src/schemas/tool-schemas.ts:50-73`). Address-only or coordinates-only input is rejected.

**Known code issue**: the check is written as a truthiness test, so a `lat` or `lng` of `0` (equator / prime meridian) is treated as missing. If you genuinely need 0, it currently fails — that is a code problem, not a misuse, and it is being tracked.

### 12. Can I share the `staticMapUrl` returned by `get_map_with_directions`?

**No.** The URL carries your Google Maps API key (`src/services/map-directions.ts:94-103`). The code comment itself warns not to send this URL to the client because of the key (`src/services/map-directions.ts:102`), yet the tool still returns the full URL in its result (`src/services/map-directions.ts:159-161`).

**Recommendation**: treat it as an internal intermediate value — fetch the image yourself or open it locally — and never paste a key-bearing URL into public docs, screenshots or chat logs. This behaviour is logged as a bug to fix. If a URL has already leaked, rotate the key in Google Cloud Console.

### 13. `get_directions` returns `No route found`

**Cause**: Google returned no routes (`src/services/places.ts:304-306`). Typically the travel mode cannot connect the two points (e.g. `walking` across water) or the endpoints are unreachable.

**Fix**: `mode` accepts only `driving`, `walking`, `bicycling`, `transit` (`src/schemas/tool-schemas.ts:8`, default `driving`); any other value is rejected by schema validation. Retry with a different mode.
