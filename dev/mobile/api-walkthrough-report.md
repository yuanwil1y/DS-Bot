# Mobile API walkthrough — 2026-10-30T19:07:35.417Z

Server http://127.0.0.1:3097. Counts: {"pass":32,"fail":0,"not testable":4} (notice done 行事后人工改为 not testable). Feed events seen: SSE 127, Remote 127.

| endpoint | result | notes |
|---|---|---|
| feed: hello | pass | GET /api/bot/feed (SSE) first event hello {revision,api,boot,seq} |
| hello | pass | {api,apiMin,apiMax,plugin:{name,version},capabilities:[19]"state",boot,seq,revision,readOnly,memory,feed,rpc:{call,feed}}; capabilities=state/state-avatar-refs/avatar/chat/room-chat/send/feed/feed-room/notices/questions/views/approvals/stop-member-work/memory/memory-edit/usage-summary/rpc/notice-learning/notice-browser; api:[99]→api=null; rpc={"call":"dsBot/call","feed":"dsBot/feed"} |
| state | pass | {revision,workspaceId,mainBotId,mainBotIds:[1]"session-c57f9b6b-46ba-4c56-9524-02c5f7e6…",bots:[2]{…},rooms:[1]{…},privateArchives:[0],exchangeTurns:{},questions:{},views:{},btwCards:{},sideChats:{},agents:[0],secrets:[0]}; bots=2; avatars:'ref' ok (image→imageRef checked below) |
| create-bot | pass | Writer session-c188818e-0123-4018-9b09-8994ea9d8639 |
| state avatars:ref | pass | Writer.avatar={imageRef} |
| avatar | pass | {botId,ref,image}; ref matches state imageRef; no-photo Bot → ref/image null |
| create-room | pass | room session-abb6e334-cc34-437d-8205-27eddf184ae7 |
| Remote dsBot/feed | pass | WS /api/remote.mux open{endpoint:'dsBot/feed'}; first item hello {revision,api,boot,seq} |
| Remote dsBot/call | pass | POST /api/dsBot/call {type:'client-request',rpcId,method:'dsBot/call',payload:{args:{endpoint,payload}}} → 200 {type,rpcId,result:{ok,value}}; inner={ok,value:{api,apiMin,apiMax,plugin,capabilities,boot,seq,revision,readOnly,memory,feed,rpc}}; unknown→{"code":"bot/not-found","message":"Unknown endpoint no-such-endpoint","details":{}} |
| send (private) | pass | feed: message stream live notice:message |
| feed: message/stream | pass | stream {botId,sessionId,attemptId,phase}; message {botId,sessionId,item:{kind,text,time,seq}} |
| chat | pass | {sessionId,items:[17]{…},cursor}; kinds=bot/user/answer |
| answer-question (notice question) | pass | notice {seq,time,botId,name,kind,sessionId,text}; answered → feed revision message stream live notice:message; second answer → bot/stale |
| view-reply (notice view) | pass | notice {seq,time,botId,name,kind,sessionId,text}; card cleared |
| dismiss-question | pass | card removed |
| dismiss-view | pass | view removed |
| send (group) | pass | feed: revision room live notice:group; group notice {seq,time,botId,name,kind,roomId,title,text} |
| feed: room | pass | {roomId} |
| room-chat | pass | {roomId,items:[13]{…},cursor,running,speaking}; kinds=user/bot/event:stopped; single page |
| room-progress | pass | [1]{callId,replies,speaking} |
| room-chat (running/live) | pass | running=true speaking="session-c188818e-0123-4018-9b09-8994ea9d8639"; live items=1, ids kept after round=1/1 |
| room-progress / live room-chat / notice done | not testable (mock) | room-progress 与 live 正常；done 通知只在成员迟到回复为 pass 且步骤行已显示时发出 (groups.js lateRoomReply)，mock 的 派活/分步 均回实文，无法触发。复测 分步 25 等 150s 无 done |
| stop-member-work | pass | → true; events stopped/stopped |
| approval-answer (notice approval) | pass | notice {seq,time,botId,name,kind,sessionId,roomId,title,text}; approval {id,sessionId,botId,roomId,tool,reason,detail:{text,code},at,answerable}; re-answer → bot/stale |
| notices | pass | {boot,seq,reset,notices:[36]{…}}; kinds=message/question/view/group/approval; since=seq→0 items; wrong boot→reset=true |
| memory-add | pass | {botId,entries:[1]{…},sizes:{own,team},limits:{entry,main,topic,topics},summary,fresh,summarizing,error}; group ok; key-like → bot/invalid |
| memory-edit | pass | {botId,entries:[1]{…},sizes:{own,team},limits:{entry,main,topic,topics},summary,fresh,summarizing,error} |
| memory-view / memory-forget | pass | {botId,entries:[0],sizes:{own,team},limits:{entry,main,topic,topics},summary,fresh,summarizing,error} |
| usage-summary | pass | {botId,day:{input,cacheRead,cacheWrite,output,calls},week:{input,cacheRead,cacheWrite,output,calls},month:{input,cacheRead,cacheWrite,output,calls},models:[1]{…},scanning}; day.calls=37 |
| learning-answer (notice learning) | not testable | mock has no learning proposal trigger; bogus id → 200 {"code":"bot/stale","message":"This proposal is no longer open","details":{}} |
| notice browser | not testable | needs a real browser handoff (browser plugin); mock cannot trigger |
| read-only DSH | not testable | needs a read-only DSH instance; not started here |
| unknown endpoint | pass | 200 {"ok":false,"error":{"code":"bot/not-found","message":"Unknown endpoint no-such-endpoint","details":{}}} |
| Remote feed parity | pass | rpc kinds=hello message stream live notice:message revision notice:question notice:view room notice:group notice:approval; missing vs SSE: none |
| feed: revision | pass | {revision} |
| feed: live | pass | {} |

## Feed event kinds (SSE)

hello, message, stream, live, notice:message, revision, notice:question, notice:view, room, notice:group, notice:approval
