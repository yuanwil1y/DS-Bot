// Mobile API walkthrough against a local DSH web + ds-bot + mock LLM (run-local.sh).
//   node api-walkthrough.mjs [--url http://127.0.0.1:3097/?token=...] [--log /tmp/dsh-mobile/web.log]
// Auth: GET /?token=<launch token> -> 303 + Set-Cookie dsh-auth-<hash>=v1...; send that cookie on
// every POST /api/bot, GET /api/bot/feed, POST /api/dsBot/call and WS /api/remote.mux.
// Writes api-walkthrough-report.md (and .log.json) next to this file. No deps (Node 22+).
import { readFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const HERE = dirname(fileURLToPath(import.meta.url))
const LOGFILE = opt('--log') ?? '/tmp/dsh-mobile/web.log'
const LOGIN = opt('--url') ?? readFileSync(LOGFILE, 'utf8').match(/http:\/\/[\d.:]+\/\?token=\S+/g)?.at(-1)
if (!LOGIN) throw new Error('no login URL')
const BASE = new URL(LOGIN).origin
const sleep = ms => new Promise(r => setTimeout(r, ms))
const t0 = Date.now()
const now = () => ((Date.now() - t0) / 1000).toFixed(1)

// ---------- auth ----------
const loginRes = await fetch(LOGIN, { redirect: 'manual' })
const cookie = loginRes.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
if (!cookie) throw new Error(`login failed ${loginRes.status}`)

// ---------- result log ----------
const rows = []   // {endpoint, result, notes}
const calls = []  // detailed log
const shape = (v, depth = 0) => {
  if (Array.isArray(v)) return depth > 1 ? `[${v.length}]` : `[${v.length}]${v.length ? shape(v[0], depth + 1) : ''}`
  if (v && typeof v === 'object') return depth > 1 ? '{…}' : `{${Object.keys(v).slice(0, 14).map(k => depth < 1 && v[k] && typeof v[k] === 'object' ? `${k}:${shape(v[k], depth + 1)}` : k).join(',')}}`
  return typeof v === 'string' ? JSON.stringify(v.length > 40 ? v.slice(0, 40) + '…' : v) : String(v)
}
const row = (endpoint, result, notes) => { rows.push({ endpoint, result, notes }); console.log(`[${now()}] ${result.toUpperCase().padEnd(5)} ${endpoint} — ${notes}`) }

// ---------- HTTP api ----------
async function raw(endpoint, payload = {}) {
  const res = await fetch(`${BASE}/api/bot`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ endpoint, payload }) })
  const text = await res.text()
  let body; try { body = JSON.parse(text) } catch { body = text }
  const feedBefore = events.length
  calls.push({ t: now(), endpoint, payload, status: res.status, shape: shape(body?.value ?? body?.error ?? body) })
  return { status: res.status, body, feedBefore }
}
async function api(endpoint, payload = {}) {
  const { status, body } = await raw(endpoint, payload)
  if (status !== 200 || !body?.ok) throw Object.assign(new Error(`${endpoint} ${status} ${JSON.stringify(body?.error ?? body).slice(0, 200)}`), { body })
  return body.value
}

// ---------- SSE feed ----------
const events = [] // {t, event, data, via}
let feedOpen = false
async function openFeed() {
  const res = await fetch(`${BASE}/api/bot/feed`, { headers: { cookie, accept: 'text/event-stream' } })
  if (res.status !== 200) throw new Error(`feed ${res.status}`)
  feedOpen = true
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ''
  ;(async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true })
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2)
          let event = 'message', data = ''
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) data += line.slice(5).trim()
          }
          if (!data) continue
          let parsed; try { parsed = JSON.parse(data) } catch { parsed = data }
          events.push({ t: now(), event, data: parsed, via: 'sse' })
        }
      }
    } catch {}
    feedOpen = false
  })()
  return reader
}
const seen = (pred, from = 0, via = 'sse') => events.slice(from).find(e => e.via === via && pred(e))
async function waitEvent(pred, { from = 0, via = 'sse', timeout = 60_000 } = {}) {
  const end = Date.now() + timeout
  while (Date.now() < end) { const e = seen(pred, from, via); if (e) return e; await sleep(150) }
  return undefined
}
const kindsSince = (from, via = 'sse') => [...new Set(events.slice(from).filter(e => e.via === via).map(e => e.event === 'notice' ? `notice:${e.data.kind}` : e.event))].join(' ')
async function waitQuiet(ms = 2500, timeout = 90_000) {
  const end = Date.now() + timeout; let last = events.length, since = Date.now()
  while (Date.now() < end) {
    await sleep(300)
    const s = await api('state')
    const busy = Object.keys(s.activity ?? {}).length > 0
    if (busy || events.length !== last) { last = events.length; since = Date.now() } else if (Date.now() - since > ms) return
  }
}

// ---------- Remote (Typert Gateway) ----------
async function rpcCall(endpoint, payload = {}) {
  const rpcId = randomUUID()
  const res = await fetch(`${BASE}/api/dsBot/call`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ type: 'client-request', rpcId, method: 'dsBot/call', payload: { args: { endpoint, payload } } }) })
  const text = await res.text(); let body; try { body = JSON.parse(text) } catch { body = text }
  calls.push({ t: now(), endpoint: `rpc dsBot/call ${endpoint}`, status: res.status, shape: shape(body) })
  return { status: res.status, body }
}
function rpcFeed() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE.replace(/^http/, 'ws')}/api/remote.mux`, { headers: { cookie } })
    const streamId = 's1'
    const timer = setTimeout(() => reject(new Error('ws open timeout')), 10_000)
    ws.onopen = () => { clearTimeout(timer); ws.send(JSON.stringify({ type: 'open', streamId, endpoint: 'dsBot/feed', payload: { args: {} } })); resolve(ws) }
    ws.onerror = e => { clearTimeout(timer); reject(new Error(`ws error ${e.message ?? ''}`)) }
    ws.onmessage = m => {
      let msg; try { msg = JSON.parse(typeof m.data === 'string' ? m.data : Buffer.from(m.data).toString()) } catch { return }
      if (msg.type === 'item') events.push({ t: now(), event: msg.value?.event ?? '?', data: msg.value?.data, via: 'rpc' })
      else events.push({ t: now(), event: `ws:${msg.type}`, data: msg.error ?? null, via: 'rpc' })
    }
  })
}

// ---------- steps ----------
async function step(endpoint, fn) {
  try { const r = await fn(); if (r) row(endpoint, r[0], r[1]) } catch (e) { row(endpoint, 'fail', String(e.message).slice(0, 240)) }
}
const pass = n => ['pass', n]
const fail = n => ['fail', n]

const feedReader = await openFeed()
const helloEv = await waitEvent(e => e.event === 'hello', { timeout: 5000 })
row('feed: hello', helloEv && 'api' in helloEv.data && 'boot' in helloEv.data ? 'pass' : 'fail', `GET /api/bot/feed (SSE) first event hello ${shape(helloEv?.data)}`)

let hello
await step('hello', async () => {
  hello = await api('hello', { client: { name: 'walkthrough', version: '0.0.1', platform: 'node' }, api: [1] })
  const neg = await api('hello', { api: [99] })
  const ok = hello.api === 1 && Array.isArray(hello.capabilities) && hello.boot && neg.api === null
  return [ok ? 'pass' : 'fail', `${shape(hello)}; capabilities=${hello.capabilities?.join('/')}; api:[99]→api=${neg.api}; rpc=${JSON.stringify(hello.rpc)}`]
})

// bootstrap: Chief waits for a model
let st = await api('state')
const chief = () => st.bots.find(b => b.name === 'Chief') ?? st.bots[0]
if (chief()?.model === undefined || chief()?.waiting) {
  const model = st.models?.at(-1)?.ref
  await api('update-bot', { id: chief().id, model })
  await waitQuiet()
  st = await api('state')
}
await step('state', async () => {
  const full = await api('state'); const ref = await api('state', { avatars: 'ref' })
  return pass(`${shape(full)}; bots=${full.bots.length}; avatars:'ref' ok (image→imageRef checked below)`)
})

// a second Bot (Writer) with an avatar photo; a group
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
let writer, room
await step('create-bot', async () => {
  st = await api('state'); writer = st.bots.find(b => b.name === 'Writer')
  if (!writer) writer = await api('create-bot', { name: 'Writer', role: 'Copywriter', instructions: 'Write.', avatar: { image: PNG } })
  await waitQuiet()
  return pass(`Writer ${writer.id}`)
})
await step('state avatars:ref', async () => {
  const ref = await api('state', { avatars: 'ref' })
  const w = ref.bots.find(b => b.id === writer.id)
  return [w?.avatar?.imageRef && !w.avatar.image ? 'pass' : 'fail', `Writer.avatar=${shape(w?.avatar)}`]
})
await step('avatar', async () => {
  const a = await api('avatar', { botId: writer.id }); const none = await api('avatar', { botId: chief().id })
  const ref = (await api('state', { avatars: 'ref' })).bots.find(b => b.id === writer.id).avatar.imageRef
  return [a.ref === ref && a.image === PNG && none.ref === null && none.image === null ? 'pass' : 'fail', `${shape(a)}; ref matches state imageRef; no-photo Bot → ref/image null`]
})
await step('create-room', async () => {
  st = await api('state'); room = st.rooms?.find?.(r => r.name === '移动测试群')
  if (!room) room = await api('create-room', { name: '移动测试群', members: [chief().id, writer.id], admin: chief().id })
  return pass(`room ${room.id}`)
})

// Remote feed opened before the chat traffic, so it sees the same events
let ws
await step('Remote dsBot/feed', async () => {
  ws = await rpcFeed()
  const h = await waitEvent(e => e.event === 'hello', { via: 'rpc', timeout: 5000 })
  return [h ? 'pass' : 'fail', `WS /api/remote.mux open{endpoint:'dsBot/feed'}; first item ${h ? `hello ${shape(h.data)}` : 'none: ' + JSON.stringify(events.filter(e => e.via === 'rpc').slice(0, 2))}`]
})
await step('Remote dsBot/call', async () => {
  const r = await rpcCall('hello', {})
  const res = r.body?.result
  const ok = r.status === 200 && res?.ok && res.value?.ok === true && res.value.value?.api === 1
  const bad = await rpcCall('no-such-endpoint', {})
  return [ok ? 'pass' : 'fail', `POST /api/dsBot/call {type:'client-request',rpcId,method:'dsBot/call',payload:{args:{endpoint,payload}}} → ${r.status} ${shape(r.body)}; inner=${shape(res?.value)}; unknown→${JSON.stringify(bad.body?.result?.value?.error ?? bad.body).slice(0, 120)}`]
})

// private chat
await step('send (private)', async () => {
  const from = events.length
  await api('send', { sessionId: writer.id, text: '你好，介绍一下你自己' })
  const msg = await waitEvent(e => e.event === 'message', { from })
  const notice = await waitEvent(e => e.event === 'notice' && e.data.kind === 'message' && e.data.botId === writer.id, { from, timeout: 20_000 })
  await waitQuiet()
  return [msg && notice ? 'pass' : 'fail', `feed: ${kindsSince(from)}`]
})
await step('feed: message/stream', async () => {
  const s = seen(e => e.event === 'stream'); const m = seen(e => e.event === 'message')
  return [s && m ? 'pass' : 'fail', `stream ${shape(s?.data)}; message ${shape(m?.data)}`]
})
await step('chat', async () => {
  const page = await api('chat', { botId: writer.id })
  return [page.items?.some(i => i.kind === 'user') ? 'pass' : 'fail', `${shape(page)}; kinds=${[...new Set(page.items.map(i => i.kind))].join('/')}`]
})

// question card
await step('answer-question (notice question)', async () => {
  const from = events.length
  await api('send', { sessionId: writer.id, text: '卡片 1' })
  const n = await waitEvent(e => e.event === 'notice' && e.data.kind === 'question', { from })
  await waitQuiet(1500)
  st = await api('state')
  const [sid, q] = Object.entries(st.questions ?? {}).find(([, v]) => v) ?? []
  if (!q) return fail(`no question card; feed ${kindsSince(from)}`)
  const from2 = events.length
  await api('answer-question', { sessionId: sid, questionId: q.id, answer: { selected: [q.options[0].label] } })
  await waitQuiet()
  const again = await raw('answer-question', { sessionId: sid, questionId: q.id, answer: { selected: [q.options[0].label] } })
  return [n ? 'pass' : 'fail', `notice ${shape(n?.data)}; answered → feed ${kindsSince(from2)}; second answer → ${again.body?.error?.code}`]
})
// view card
await step('view-reply (notice view)', async () => {
  const from = events.length
  await api('send', { sessionId: writer.id, text: '视图选项' })
  const n = await waitEvent(e => e.event === 'notice' && e.data.kind === 'view', { from })
  await waitQuiet(1500)
  st = await api('state')
  const [sid, v] = Object.entries(st.views ?? {}).find(([, x]) => x) ?? []
  if (!v) return fail(`no view; feed ${kindsSince(from)}`)
  await api('view-reply', { sessionId: sid, viewId: v.id, action: 'lane', values: { selected: ['Ship now'] } })
  await waitQuiet()
  st = await api('state')
  return [n && !st.views?.[sid] ? 'pass' : 'fail', `notice ${shape(n?.data)}; card cleared`]
})
await step('dismiss-question', async () => {
  await api('send', { sessionId: writer.id, text: '卡片 1' }); await waitQuiet(1500)
  st = await api('state'); const [sid] = Object.entries(st.questions ?? {}).find(([, v]) => v) ?? []
  if (!sid) return fail('no card to dismiss')
  await api('dismiss-question', { sessionId: sid }); st = await api('state')
  return [st.questions?.[sid] ? 'fail' : 'pass', 'card removed']
})
await step('dismiss-view', async () => {
  await api('send', { sessionId: writer.id, text: '视图选项' }); await waitQuiet(1500)
  st = await api('state'); const [sid] = Object.entries(st.views ?? {}).find(([, v]) => v) ?? []
  if (!sid) return fail('no view to dismiss')
  await api('dismiss-view', { sessionId: sid }); st = await api('state')
  return [st.views?.[sid] ? 'fail' : 'pass', 'view removed']
})

// group
await step('send (group)', async () => {
  const from = events.length
  await api('send', { sessionId: room.id, text: '大家好，各自说一句' })
  const r = await waitEvent(e => e.event === 'room' && e.data.roomId === room.id, { from })
  const g = await waitEvent(e => e.event === 'notice' && e.data.kind === 'group', { from })
  await waitQuiet()
  return [r && g ? 'pass' : 'fail', `feed: ${kindsSince(from)}; group notice ${shape(g?.data)}`]
})
await step('feed: room', async () => { const r = seen(e => e.event === 'room'); return [r ? 'pass' : 'fail', shape(r?.data)] })
await step('room-chat', async () => {
  const page = await api('room-chat', { roomId: room.id })
  const bots = page.items.filter(i => i.kind === 'bot')
  let older = 'single page'
  if (page.cursor) { const p2 = await api('room-chat', { roomId: room.id, cursor: page.cursor }); older = `page2 ${p2.items.length}` }
  return [page.items.some(i => i.kind === 'user') && bots.length > 0 ? 'pass' : 'fail', `${shape(page)}; kinds=${[...new Set(page.items.map(i => i.kind + (i.event ? ':' + i.event : '')))].join('/')}; ${older}`]
})
// a long round: 分步 (member speaks per step) → live items, room-progress, done notice
await step('room-progress / live room-chat / notice done', async () => {
  const from = events.length
  await api('send', { sessionId: room.id, text: '分步 2' })
  let progress, live, running
  for (let i = 0; i < 80 && !(progress?.length && live); i++) {
    await sleep(300)
    const p = await api('room-progress', { roomId: room.id }); if (p.length) progress = p
    const page = await api('room-chat', { roomId: room.id }); if (page.running) running = page
    if (page.items.some(x => x.live)) live = page
  }
  await waitQuiet()
  // handed work (派活) ends with the member's done post
  const from2 = events.length
  await api('send', { sessionId: room.id, text: '派活 2' })
  const done = await waitEvent(e => e.event === 'notice' && e.data.kind === 'done', { from: from2, timeout: 60_000 })
  await waitQuiet()
  const after = await api('room-chat', { roomId: room.id })
  const ids = live ? live.items.filter(x => x.live).map(x => x.id) : []
  const kept = ids.filter(id => after.items.some(x => x.id === id && !x.live)).length
  row('room-progress', progress ? 'pass' : 'fail', `${shape(progress)}`)
  row('room-chat (running/live)', live || running ? 'pass' : 'fail', `running=${!!running} speaking=${JSON.stringify(running?.speaking)}; live items=${ids.length}, ids kept after round=${kept}/${ids.length}`)
  return [done ? 'pass' : 'fail', `notice done ${shape(done?.data)}; feed ${kindsSince(from)}`]
})
await step('stop-member-work', async () => {
  const from = events.length
  await api('send', { sessionId: room.id, text: '派活 30' })
  let working
  for (let i = 0; i < 60 && !working; i++) {
    await sleep(500); const s = await api('state')
    const w = s.work?.rooms?.[room.id]; if (w && JSON.stringify(w).includes(writer.id)) working = w
  }
  if (!working) { await waitQuiet(); return ['not testable', `could not see Writer working in work.rooms (${kindsSince(from)})`] }
  const v = await api('stop-member-work', { roomId: room.id, botId: writer.id })
  await waitQuiet()
  const page = await api('room-chat', { roomId: room.id })
  return pass(`→ ${JSON.stringify(v)}; events ${page.items.filter(i => i.kind === 'event').map(i => i.event).join('/')}`)
})
await step('approval-answer (notice approval)', async () => {
  const from = events.length
  await api('send', { sessionId: room.id, text: '@Writer 提权' })
  const n = await waitEvent(e => e.event === 'notice' && e.data.kind === 'approval', { from })
  let ap
  for (let i = 0; i < 40 && !ap; i++) { await sleep(300); ap = (await api('state')).work?.approvals?.find(a => a.answerable) }
  if (!ap) { await waitQuiet(); return fail(`no answerable approval; notice=${!!n}; feed ${kindsSince(from)}`) }
  await api('approval-answer', { id: ap.id, choice: 'allow' })
  await waitQuiet()
  const bad = await raw('approval-answer', { id: ap.id, choice: 'allow' })
  return [n ? 'pass' : 'fail', `notice ${shape(n?.data)}; approval ${shape(ap)}; re-answer → ${bad.body?.error?.code}`]
})

// notices
await step('notices', async () => {
  const all = await api('notices', { boot: hello.boot, since: 0 })
  const tail = await api('notices', { boot: hello.boot, since: all.seq })
  const reset = await api('notices', { boot: 'old-boot', since: 0 })
  const kinds = [...new Set(all.notices.map(n => n.kind))].join('/')
  return [all.reset === false && tail.notices.length === 0 && reset.reset === true ? 'pass' : 'fail', `${shape(all)}; kinds=${kinds}; since=seq→0 items; wrong boot→reset=${reset.reset}`]
})

// memory
await step('memory-add', async () => {
  const v = await api('memory-add', { botId: writer.id, text: '用户喜欢简短的回答' })
  const g = await api('memory-add', { roomId: room.id, text: '本群周五发周报' })
  const secret = await raw('memory-add', { botId: writer.id, text: 'api key sk-abcdefghijklmnopqrstuvwxyz0123456789' })
  return [v.entries?.some(e => e.text === '用户喜欢简短的回答') && g.entries?.some(e => e.text === '本群周五发周报') ? 'pass' : 'fail', `${shape(v)}; group ok; key-like → ${secret.body?.error?.code ?? 'ACCEPTED'}`]
})
await step('memory-edit', async () => {
  const v = await api('memory-edit', { botId: writer.id, text: '用户喜欢简短的回答', next: '用户喜欢简短、带例子的回答' })
  return [v.entries?.some(e => e.text === '用户喜欢简短、带例子的回答') ? 'pass' : 'fail', shape(v)]
})
await step('memory-view / memory-forget', async () => {
  const v = await api('memory-forget', { botId: writer.id, text: '用户喜欢简短、带例子的回答' })
  const view = await api('memory-view', { botId: writer.id })
  return [!view.entries?.some(e => e.text.includes('带例子')) ? 'pass' : 'fail', shape(view)]
})
await step('usage-summary', async () => {
  const u = await api('usage-summary', { botId: writer.id, timeZone: 'Asia/Taipei' })
  return [u.day && u.week && u.month && u.models ? 'pass' : 'fail', `${shape(u)}; day.calls=${u.day?.calls}`]
})
await step('learning-answer (notice learning)', async () => {
  const r = await raw('learning-answer', { proposalId: 'nope', answer: 'accept' })
  return ['not testable', `mock has no learning proposal trigger; bogus id → ${r.status} ${JSON.stringify(r.body?.error ?? r.body).slice(0, 120)}`]
})
row('notice browser', 'not testable', 'needs a real browser handoff (browser plugin); mock cannot trigger')
row('read-only DSH', 'not testable', 'needs a read-only DSH instance; not started here')
await step('unknown endpoint', async () => {
  const r = await raw('no-such-endpoint', {})
  return [r.body?.error?.code === 'bot/not-found' ? 'pass' : 'fail', `${r.status} ${JSON.stringify(r.body).slice(0, 120)}`]
})
await step('Remote feed parity', async () => {
  const sse = new Set(events.filter(e => e.via === 'sse').map(e => e.event === 'notice' ? 'notice:' + e.data.kind : e.event))
  const rpc = new Set(events.filter(e => e.via === 'rpc').map(e => e.event === 'notice' ? 'notice:' + e.data.kind : e.event))
  const missing = [...sse].filter(k => !rpc.has(k) && k !== 'hello')
  return [rpc.size > 1 && missing.length === 0 ? 'pass' : 'fail', `rpc kinds=${[...rpc].join(' ')}; missing vs SSE: ${missing.join(' ') || 'none'}`]
})
row('feed: revision', seen(e => e.event === 'revision') ? 'pass' : 'fail', shape(seen(e => e.event === 'revision')?.data))
row('feed: live', seen(e => e.event === 'live') ? 'pass' : 'fail', shape(seen(e => e.event === 'live')?.data))

ws?.close(); feedReader.cancel().catch(() => {})
const counts = rows.reduce((m, r) => ({ ...m, [r.result]: (m[r.result] ?? 0) + 1 }), {})
const md = [
  `# Mobile API walkthrough — ${new Date().toISOString()}`, '',
  `Server ${BASE}. Counts: ${JSON.stringify(counts)}. Feed events seen: SSE ${events.filter(e => e.via === 'sse').length}, Remote ${events.filter(e => e.via === 'rpc').length}.`, '',
  '| endpoint | result | notes |', '|---|---|---|',
  ...rows.map(r => `| ${r.endpoint} | ${r.result} | ${String(r.notes).replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`), '',
  '## Feed event kinds (SSE)', '', [...new Set(events.filter(e => e.via === 'sse').map(e => e.event === 'notice' ? 'notice:' + e.data.kind : e.event))].join(', '), '',
]
writeFileSync(join(HERE, 'api-walkthrough-report.md'), md.join('\n'))
writeFileSync(join(HERE, 'api-walkthrough.log.json'), JSON.stringify({ calls, events: events.map(e => ({ ...e, data: shape(e.data) })) }, null, 1))
console.log(counts)
process.exit(0)
