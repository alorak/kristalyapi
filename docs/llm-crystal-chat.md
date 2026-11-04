# Crystal assistant — LLM Settings and AI chat

## Using the assistant

1. Open **Library → LLM Settings**. Select Google Gemini API, enter a personal
   API key and model, or select Local vLLM, enter its server URL and model ID.
2. Click Save LLM settings in browser. The password input is cleared.
3. Return to Crystal. Click the AI icon immediately below Structure Info on
   the right tool rail.
4. Ask about the active crystal. Only explicit Send transmits a message, prior
   conversation turns and a bounded snapshot of the active crystal.

The optional List server models button queries the configured vLLM endpoint.
It performs a request only when clicked.

Gemini: official HTTPS REST generateContent with X-goog-api-key as a header.
vLLM: OpenAI-compatible /v1/chat/completions endpoint and optional /v1/models.
A vLLM chat template must be configured for the served model.

## Snapshot and scientific boundaries

Each conversation captures one editor snapshot: workspace ID, material name,
unit-cell lengths (Å) and angles (degrees), symmetry information, repetitions,
occupancy-weighted element counts, and at most 80 fractional atomic positions
with elements/labels. For larger structures the snapshot explicitly reports
the number of omitted positions. The original editor structure is not modified.

The snapshots are user-provided or imported structural data. They do not
establish experimental observations or quantum-mechanical simulation
results. The system instruction specifically discourages unsupported band
gap, energy, magnetism, XRD, or phase-identity claims. A session retains
its original crystal snapshot when the user changes structures. Its
fingerprint is an approximate UI change detector, not a cryptographic
scientific provenance identifier.

## Browser persistence

The settings use localStorage key kristalyapi.llm.settings.v1: provider,
Gemini key/model, vLLM URL/model and optional vLLM access token.
The conversations use localStorage key kristalyapi.llm.history.v1: per-session
structure snapshot, message roles and text, provider/model labels. The
application does not write provider keys into chat history.

The user can start a new conversation, open saved sessions, delete the
selected session, delete all chats, or clear the saved provider settings.
History is bounded to 30 sessions, 64 recent messages per session, 5000
characters per message and about 1 MiB of JSON. Model messages are rendered
as text, never active HTML. Browser localStorage is **not an encrypted vault**;
same-origin JavaScript and privileged browser extensions can read it.
Use personal keys on trusted devices; clearing site data also clears history.

No request is initiated automatically by page load, structure import or
structure change. Provider requests occur on explicit Send, and optional
vLLM model discovery occurs on the List server models click.

## Network considerations

Local HTTP is supported only for loopback/private/LAN addresses. Other
servers require HTTPS. From GitHub Pages (HTTPS), a local HTTP endpoint
may be blocked by mixed content policy, private-network access policy
or CORS. The vLLM server must allow the browser application origin, or
be placed behind a carefully controlled HTTPS reverse proxy. Do not
open an unsecured model server to the public internet just for CORS.

vLLM itself may expose inference endpoints that are not protected by
its --api-key option. Restrict access at the network/reverse-proxy layer.

- Gemini REST: https://ai.google.dev/api/generate-content
- Gemini key safety: https://ai.google.dev/gemini-api/docs/api-key
- vLLM server: https://docs.vllm.ai/en/stable/serving/online_serving/openai_compatible_server/

## Tests

- Node unit: node --test tests/llm-crystal.test.mjs
- Playwright smoke: node tests/browser/llm-crystal.test.mjs

The automated tests use synthetic Gemini/vLLM results and do not prove that
a real account, model or LAN environment is reachable.
