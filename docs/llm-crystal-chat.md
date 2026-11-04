# Crystal assistant — LLM Settings and AI chat

## Using the assistant

1. Open **Library → LLM Settings**. Select Google Gemini API, enter a personal
   API key and model, or select Local vLLM, enter its server URL and model ID.
2. For Gemini, click **List Gemini models** to call the official API models.list
   endpoint with the configured key. The list shows only models advertising
   generateContent support; select one and click Save LLM settings in browser.
   A model being listed does not guarantee the current account has billing
   credit, quota or access to use it. For vLLM, List server models is also
   available. The password input is cleared on save.
3. Return to Crystal. Click the **Sohbet / Chat** button in the top navigation.
   This opens a wide (~910px), responsive conversation dock, separate from the
   right-hand analysis tool rail.
4. Use **Hide** to temporarily close the dock, or click the same top button
   again to reopen it. Hiding does not discard the draft, existing messages,
   history, or cancel an in-flight request. Navigating away from the editor
   hides the dock; restoring the editor lets it be reopened.
5. Ask about the active crystal. Only explicit Send transmits a message, prior
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

The chat opens as a wide workspace dock: no provider settings card, large context
box or lengthy privacy text. The History button reveals the saved-session
selector and the ability to delete the selected conversation. There is no
"delete all conversations" button in the chat pane. Users can also clear
the saved provider settings from the Library.
History is bounded to 30 sessions, 64 recent messages per session, 5000
characters per message and about 1 MiB of JSON. Model responses are rendered as a conservative **safe Markdown** subset
(headings, emphasis, ordered/unordered lists, links, tables, blockquotes,
code blocks and basic readable inline math). HTML from the model is shown as
inert text and never parsed or executed. Full TeX typesetting and arbitrary
HTML are intentionally not supported. Browser localStorage is **not an encrypted vault**;
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

## Diagnosing Gemini errors

- **HTTP 402:** Gemini API prepaid credit may be exhausted. Check Google AI
  Studio billing setup, credit balance and usage. Changing a model name alone
  is unlikely to fix a credit-related 402.
- **HTTP 404:** the model name/resource is missing, unsupported on that API
  version or unavailable to the account. Recheck models.list and access.
- **HTTP 401/403:** API-key validity, permissions and project restrictions.
- **HTTP 429:** quota or rate limits.

Errors are translated into user-actionable messages without echoing response
bodies or API keys. No production Gemini request is required by CI.

## Response progress, cancellation and retries

A compact animated three-dot "Preparing answer" indicator appears above the
conversation while a request is pending. The static waiting line is removed.
When reduced-motion is preferred, the indicator is not animated.

The previous hard-coded 45-second HTTP abort could appear in Chromium as
"signal is aborted without reason". The chat request timeout is now 120
seconds by default (bounded to three minutes if explicitly overridden).
Manual Cancel, model-response timeout and network/CORS failures show distinct
messages. A failed request removes its unsatisfied outgoing message from
the saved conversation and restores the draft to the input, avoiding a chain
of repeated unanswered blue bubbles on retry. Completed conversations are
still stored in localStorage.

These are UX/network changes, not proof of any provider availability.
