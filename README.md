# dsh-speech-to-text

Universal speech recognition for DSH voice input: one `Speech to Text` recognizer that
transcribes recordings through **any OpenAI-compatible `/audio/transcriptions` endpoint you
already configured in Settings → Models**.

The plugin asks for no API key anywhere. It reads the provider, the base URL and the key from
the services that own them (Settings → Models and DSH credentials) and stores exactly two
values of its own: which provider recognizes, and which of its models.

## What you get

- **Plugins → Voice input → Recognition service** gains a permanent entry `Speech to Text`
  (as long as this plugin is installed).
- **Settings → Speech to Text** — a page with a switcher, a provider picker, a model picker
  and the recognition language.
- Recording, transcription and microphone behaviour stay exactly as the official voice-input
  bundle implements them; only the recognizer behind them changes.

## Requirements

- DSH `0.2.1-rc.2` or newer, Node.js 22.
- A profile that contains `@deepseek-ai/dsh-experimental-voice-input-bundle` — it provides
  `ctx.speechToText`. Without it the plugin stays pending (`waiting for service: speechToText`)
  and nothing else changes.
- At least one provider route with a stored key in **Settings → Models**.

## Installation

```sh
npm install
npm run build
dsh plugin --profile web add file:/path/to/dsh-speech-to-text/release
```

Reload the Web GUI after installing. If **Settings → Speech to Text** or the
`Speech to Text` entry in the microphone picker is missing, restart `dsh web`.

Installing does not change the voice-input selection: it stays on the bundled local
recognizer until you turn the switcher on.

## The settings page

```
Settings → Speech to Text

  Speech to Text                      [switch]  Use Speech to Text for voice input
      On: Plugins → Voice input uses Speech to Text as the recognition service.

  Provider                            [select]  vLLM
      Routes configured in the model settings; their keys stay there.  Settings → Models

  Model                               [select]  whisper-large-v3   [Retry]
      N models offered by this provider, as the endpoint lists them.

  Language                            [select]  Auto-detect
      Shared with Plugins → Voice input.
```

**The switcher is a mirror, not a second setting.** It reads and writes the same value the
official Voice input panel owns (`speech-to-text.defaultProvider`), so it can never disagree
with it:

- On → the recognition service becomes `Speech to Text`.
- Off → it becomes `SenseVoiceSmall` again. Because the bundled recognizer accepts only six
  languages, turning off also resets the shared language to *Auto-detect* — the only automatic
  write this plugin performs besides the provider itself.
- The switcher is disabled until both a provider and a model are chosen, so it cannot select a
  recognizer that would fail on the next recording.

**Provider** lists only the routes Settings → Models has configured — a base URL and a stored
key, the same two facts the host needs before it can place a request. DSH has no audio-modality
metadata, so a route that serves no transcription stays in the list until you select it and the
probe says so. **Model** is read from `GET {baseURL}/models` of the chosen route. When you select
a provider, the plugin first probes `POST {baseURL}/audio/transcriptions`, so a route that does
not serve transcription is named at that moment rather than after you record.

## Where values come from

| Value | Owned by | Read through |
| --- | --- | --- |
| provider route, base URL | Settings → Models | `ctx.llm.listConfigurableProviders()` + the route's stored profile |
| API key | DSH credentials | `profile.apiKeyEnv`, else the conventional `<ROUTE>_API_KEY` reference; `credentials/describe` tells the page whether it is stored |
| recognition service, language | official voice-input entry | `remote.speech.catalog()` / `configure()` |
| provider, model | this plugin (`dsh-speech-to-text` namespace) | its own settings form |

The key is resolved host-side per recording and is never sent to the browser, written to a
file of this plugin, or included in a message. Provider response bodies are never echoed into
errors: a refusal is reported by its HTTP status and a fixed sentence.

## Known limits

- **Recording size and duration are global.** `dsh-experimental-api-speech-to-text` caps every
  provider at 4 MiB of WAV and 120 s; the cap is not per provider and this plugin cannot raise it.
- **The model list may contain non-audio models.** DSH has no audio modality in its model
  catalog, so everything the endpoint advertises is offered, in the endpoint's own order.
- **One shared language.** The language field is the official voice-input language, not a copy.
  A language this plugin accepts but SenseVoice does not (for example Polish) is reset to Auto
  when the switcher turns off.
- **Removing the plugin while it is selected leaves a broken selection.** DSH has no
  post-uninstall lifecycle hook for a plugin to hand the selection back, so switch this page off
  before uninstalling. Otherwise the microphone reports an unavailable recognizer until you pick
  another one in Plugins → Voice input.
- **The `Settings → Models` link navigates the settings DOM.** There is no cross-plugin
  `openSection` API in `dsh-client-ui-settings`; the link clicks the sidebar entry, and if the
  layout ever changes it reports that the Models page should be opened manually.

## Privacy

For each recording the plugin sends the WAV audio, the selected model id and the language hint
to the chosen provider's `/audio/transcriptions` endpoint, and nothing else. No telemetry, no
intermediary, no stored transcripts.

## Development

```sh
npm run build        # client/client.js, then release/
npm run build:client # only client/client.js
npm test             # offline Jest suite (loopback HTTP stub, no keys, no network)
npm run lint         # ESLint over src/
npm run typecheck    # tsc --noEmit
```

`npm test` runs Jest with `--experimental-vm-modules`: `@deepseek-ai/schemastery` and the
`dsh-*` packages are ESM-only, so the suite needs Jest's ESM runtime.

```
release/                installable package (index.mjs, client/client.js, locale/, patch)
src/
  index.ts              host entry: recognizer, model discovery, page policy
  route.ts              provider route → base URL + key, from the owning services
  stt.ts                /audio/transcriptions, /models, capability probe
  client.ts             browser entry: registers the settings section
  page.tsx              the page above
  ui.tsx, styles.ts     hand-rolled controls and design-token styles
  constants.ts          ids, languages, limits
test/                   offline suite: fixtures/host.ts stubs the host, helpers/server.ts a stub API
```

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Speech to Text` missing from the microphone picker | The plugin is not installed in this profile, or the voice-input bundle is absent. Restart DSH after installing. |
| Provider list is empty | No route has both a base URL and a stored key in Settings → Models. |
| `Provider "X" has no audio transcription endpoint` | That route serves a model API without Whisper-style transcription. Choose another provider. |
| `Provider "X" rejected the stored API key` | Update the key in Settings → Models. |
| `Choose a provider in Settings → Speech to Text` at record time | The switcher is on while provider or model is empty. |
| Transcripts cut off around 120 s | The official voice-input API limit, shared by every recognizer. |
