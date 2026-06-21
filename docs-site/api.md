# API

XYNQ speaks the OpenAI wire format, so most existing tooling works by changing
nothing but the base URL. The free public chat needs no key; just call it.

Base URL: `https://xynq.ai/api/v1`

## Chat

`POST /api/v1/chat/completions`

```bash
curl https://xynq.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "xynq",
    "messages": [{"role": "user", "content": "explain entropy in one line"}],
    "stream": true
  }'
```

With `"stream": true` the response is a Server-Sent Events feed: each event
carries a `delta`, and the feed closes with a literal `data: [DONE]`. Drop
`stream` (or set it false) to get a single JSON completion instead.

Using an OpenAI SDK? Point it at the base URL above and send any non-empty
string as the API key — the public endpoint ignores it.

## Listing what's live

`GET /api/v1/models` returns only the models that currently have enough healthy
nodes to serve, so it reflects real capacity rather than a static menu.

| Ask for…           | …and you get       |
| ------------------ | ------------------ |
| `xynq` / `default` | `jaguar`           |
| `qwen`             | `qwen-3.5-27b`     |
| `supergemma`       | `supergemma-4-26b` |

## Images

`POST /api/images/generate` takes a `prompt` (plus optional `steps`, `width`,
`height`) and returns a base64 image as `b64_json`. Like chat, neither the
prompt nor the result is retained.

## Notes

- Responses can briefly 503 while the mesh is rebalancing capacity; retry with
  backoff.
- There are no usage dashboards or stored history by design — if you need logs,
  keep them on your side.
