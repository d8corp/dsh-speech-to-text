/**
 * Settings → Speech to Text.
 *
 * Four controls: two write to this plugin's own namespace (provider, model)
 * and two write to the namespace the official voice-input bundle owns (the
 * selected recognizer and the recognition language). Nothing here stores an
 * enable flag or a key — the switch reads `speech-to-text.defaultProvider`
 * back, so the page and Plugins → Voice input cannot disagree, and a credential
 * stays where Settings → Models put it.
 * @module dsh-speech-to-text/page
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { FALLBACK_PROVIDER_ID, LANGUAGE_LABELS, LANGUAGES, PROVIDER_ID, PROVIDER_NAME, SETTINGS_NS } from './constants'
import type { SelectOption } from './ui'
import { Button, Link, Notice, Row, Select, Switch } from './ui'

/** Values this plugin owns. */
export interface SectionValues {
  provider: string
  model: string
}

/** Shared form over this plugin's settings namespace. */
export interface FormLike {
  getSnapshot: () => { status: 'loading' | 'ready' | 'unavailable', value: SectionValues | undefined }
  subscribe: (listener: () => void) => () => void
  set: (field: string, value: unknown) => Promise<boolean>
}

/** One configured provider route. */
export interface RouteEntry {
  provider: string
  displayName: string
}

/**
 * What every generated Remote method resolves to: the Host's value, or the
 * carrier's failure. The Remote face folds transport faults into the error
 * branch, so a call never rejects and an unread answer is a silent lie —
 * `catalog()` answers `{ ok, value }`, not the catalog.
 */
export type RemoteAnswer<T> =
  | { ok: true, value: T }
  | { ok: false, error: { message: string } }

/** The current selection the voice-input bundle owns, as the Remote reports it. */
export interface SpeechCatalog {
  selection: { providerId: string, language: string }
}

/** Selection read from the official speech service. */
export interface Selection {
  providerId: string
  language: string
}

/** Speech remote face used by this page. */
export interface SpeechLike {
  catalog: () => Promise<RemoteAnswer<SpeechCatalog>>
  configure: (patch: { providerId?: string, language?: string }) => Promise<RemoteAnswer<void>>
}

/** LLM remote face used by this page. */
export interface LlmLike {
  listConfigurableProviders: () => Promise<RemoteAnswer<RouteEntry[]>>
  discoverModels: (settingsNs: string, request: { provider: string }) => Promise<RemoteAnswer<Array<{ id: string }>>>
}

/** Props injected by the slot registration. */
export interface SettingsProps {
  form: FormLike
  speech: SpeechLike
  llm: LlmLike
  /** Re-reads on settings, adapter or credential changes. */
  subscribe: (listener: () => void) => () => void
  /** Activates the built-in Models section; false when the shell has no such cell. */
  openModels: () => boolean
}

/**
 * Read a user-facing message out of a failure.
 *
 * @param cause whatever the remote call threw.
 * @param fallback wording used when the failure carries no message.
 * @returns a trimmed message.
 */
function messageOf (cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim() !== '') return cause.message.trim()

  return typeof cause === 'string' && cause.trim() !== '' ? cause.trim() : fallback
}

/**
 * Read the value out of a {@link RemoteAnswer}.
 *
 * A failed Remote call resolves rather than rejects, so this is the only place
 * its message can reach the notice line: throwing here routes it through the
 * same catch every reader and writer already has.
 *
 * @param answer what the Remote resolved to.
 * @returns the Host's value.
 * @throws the failure's message when the answer carries one.
 */
function valueOf<T> (answer: RemoteAnswer<T>): T {
  if (answer.ok) return answer.value

  throw new Error(answer.error.message)
}

/**
 * The page body.
 *
 * @param props injected services and the Models navigation action.
 * @returns the settings section.
 */
export function Settings (props: SettingsProps) {
  const [values, setValues] = useState<SectionValues | undefined>(() => props.form.getSnapshot().value)
  const [selection, setSelection] = useState<Selection | undefined>(undefined)
  const [routes, setRoutes] = useState<RouteEntry[]>([])
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [listingModels, setListingModels] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')

  /** Route whose model list is already in `models`, so a re-render does not re-ask. */
  const loadedForRef = useRef<string | null>(null)

  const current = values ?? { provider: '', model: '' }

  /** Re-read the recognition language and service the voice-input bundle owns. */
  const refreshSelection = useCallback(async () => {
    try {
      const { selection } = valueOf(await props.speech.catalog())

      setSelection({ providerId: selection.providerId, language: selection.language })
    } catch (cause) {
      setError(messageOf(cause, 'Voice input settings are unavailable in this profile.'))
    }
  }, [props.speech])

  /** Re-read the provider routes Settings → Models has configured. */
  const refreshRoutes = useCallback(async () => {
    try {
      const listed = valueOf(await props.llm.listConfigurableProviders())

      setRoutes(listed.filter((entry) => entry.provider !== ''))
    } catch (cause) {
      setError(messageOf(cause, 'Could not read the configured providers.'))
    }
  }, [props.llm])

  /**
   * Ask the host which models one route's endpoint advertises.
   *
   * The host probes the transcription endpoint on the way, so a provider that
   * cannot recognize speech is refused here, at selection time, and the reason
   * lands on this page.
   *
   * @param provider route id.
   */
  const loadModels = useCallback(async (provider: string) => {
    if (provider === '') {
      loadedForRef.current = provider
      setModels([])

      return
    }

    setListingModels(true)

    try {
      const listed = valueOf(await props.llm.discoverModels(SETTINGS_NS, { provider }))

      loadedForRef.current = provider
      setModels(listed.map((model) => model.id))
      setError('')
    } catch (cause) {
      loadedForRef.current = provider
      setModels([])
      setError(messageOf(cause, 'Could not read the model list.'))
    } finally {
      setListingModels(false)
    }
  }, [props.llm])

  useEffect(() => props.form.subscribe(() => {
    setValues(props.form.getSnapshot().value)
  }), [props.form])

  useEffect(() => {
    let alive = true

    /** Both readers swallow their own failures into the notice line, so no rejection escapes. */
    const refresh = () => {
      if (alive) {
        refreshSelection()
        refreshRoutes()
      }
    }

    const unsubscribe = props.subscribe(refresh)

    Promise.all([refreshSelection(), refreshRoutes()]).then(() => {
      if (alive) setLoading(false)
    })

    return () => {
      alive = false
      unsubscribe()
    }
  }, [props.subscribe, refreshRoutes, refreshSelection])

  useEffect(() => {
    if (values === undefined || loadedForRef.current === current.provider) return

    loadModels(current.provider)
  }, [current.provider, loadModels, values])

  const enabled = selection?.providerId === PROVIDER_ID
  const configured = current.provider !== '' && current.model !== ''

  /**
   * Move the official selection onto this recognizer, or back to the bundled one.
   *
   * Reverting has to state a language too: the selection is validated against
   * the provider that ends up selected, and the bundled local recognizer accepts
   * fewer languages than this one advertises.
   *
   * @param next the requested switch position.
   */
  const toggle = useCallback(async (next: boolean) => {
    setSwitching(true)
    setError('')

    try {
      valueOf(await props.speech.configure(next
        ? { providerId: PROVIDER_ID }
        : { providerId: FALLBACK_PROVIDER_ID, language: 'auto' }))
    } catch (cause) {
      setError(messageOf(cause, 'The recognition service could not be changed.'))
    }

    await refreshSelection()
    setSwitching(false)
  }, [props.speech, refreshSelection])

  /**
   * Change the language hint the recognizer is asked for.
   *
   * @param language one accepted language code.
   */
  const changeLanguage = useCallback(async (language: string) => {
    setError('')

    try {
      valueOf(await props.speech.configure({ language }))
    } catch (cause) {
      setError(messageOf(cause, 'The recognition language could not be changed.'))
    }

    await refreshSelection()
  }, [props.speech, refreshSelection])

  /**
   * Choose the provider route that will recognize recordings.
   *
   * The saved model is cleared with it: a model id means nothing to another
   * endpoint, and keeping it would offer a transcription the provider refuses.
   *
   * @param provider route id.
   */
  const changeProvider = useCallback((provider: string) => {
    setError('')
    loadedForRef.current = provider

    // A form write rejects only on transport failure; the model is cleared in
    // the same queue so a half-saved route never reaches the microphone.
    props.form.set('provider', provider)
      .then(() => props.form.set('model', ''))
      .then(() => loadModels(provider))
      .catch((cause: unknown) => { setError(messageOf(cause, 'The provider could not be saved.')) })
  }, [loadModels, props.form])

  /**
   * Save the model the chosen route will be asked to use.
   *
   * @param model model id as the endpoint lists it.
   */
  const saveModel = useCallback((model: string) => {
    setError('')

    props.form.set('model', model)
      .catch((cause: unknown) => { setError(messageOf(cause, 'The model could not be saved.')) })
  }, [props.form])

  const providerOptions = routes.map((entry) => ({ value: entry.provider, label: entry.displayName }))

  if (current.provider !== '' && !providerOptions.some((option) => option.value === current.provider)) {
    providerOptions.push({ value: current.provider, label: current.provider })
  }

  const modelOptions = models.map((id) => ({ value: id, label: id }))

  if (current.model !== '' && !modelOptions.some((option) => option.value === current.model)) {
    modelOptions.push({ value: current.model, label: current.model })
  }

  const language = selection?.language ?? 'auto'
  const languageOptions: SelectOption[] = LANGUAGES.map((code) => ({ value: code, label: LANGUAGE_LABELS[code] ?? code }))

  if (!languageOptions.some((option) => option.value === language)) {
    languageOptions.push({ value: language, label: language })
  }

  if (loading) {
    return <div className='sst-section'><p className='sst-loading' role='status'>Loading settings…</p></div>
  }

  return (
    <div className='sst-section'>
      <Row
        title={PROVIDER_NAME}
        description={selection === undefined
          ? 'The official voice-input service reported no selection, so the recognizer cannot be switched from here.'
          : enabled
            ? 'On: Plugins → Voice input uses Speech to Text as the recognition service.'
            : configured
              ? 'Off: the microphone uses the bundled local recognizer. Turn on to switch to Speech to Text.'
              : 'Choose a provider and a model below, then turn this on to select Speech to Text.'}
      >
        <Switch
          checked={enabled}
          disabled={selection === undefined || switching || !configured}
          label={`Use ${PROVIDER_NAME} for voice input`}
          onChange={(next) => { toggle(next) }}
        />
      </Row>

      <Row
        title='Provider'
        htmlFor='sst-provider'
        description={
          <>
            Routes configured in the model settings; their keys stay there.{' '}
            <Link onClick={() => { if (!props.openModels()) setError('Open Settings → Models from the settings sidebar.') }}>
              Settings → Models
            </Link>
          </>
        }
      >
        <Select
          id='sst-provider'
          value={current.provider}
          options={[{ value: '', label: routes.length === 0 ? 'No configured providers' : 'Choose a provider' }, ...providerOptions]}
          disabled={routes.length === 0}
          onChange={(value) => { changeProvider(value) }}
        />
      </Row>

      <Row
        title='Model'
        htmlFor='sst-model'
        description={current.provider === ''
          ? 'Pick a provider first; its models are read from the endpoint.'
          : listingModels
            ? 'Reading the provider’s model list…'
            : models.length === 0
              ? 'No models were read. Check the provider’s base URL and key in Settings → Models, then retry.'
              : `${models.length} models offered by this provider, as the endpoint lists them.`}
      >
        <>
          <Select
            id='sst-model'
            value={current.model}
            options={[{ value: '', label: 'Choose a model' }, ...modelOptions]}
            disabled={current.provider === '' || models.length === 0}
            onChange={(value) => { saveModel(value) }}
          />
          <Button disabled={current.provider === '' || listingModels} onClick={() => { loadModels(current.provider) }}>
            {listingModels ? 'Loading…' : 'Retry'}
          </Button>
        </>
      </Row>

      <Row
        title='Language'
        htmlFor='sst-language'
        description='Shared with Plugins → Voice input. Switching this page off resets it to Auto, because the bundled recognizer does not accept every language listed here.'
      >
        <Select
          id='sst-language'
          value={language}
          options={languageOptions}
          disabled={selection === undefined}
          onChange={(value) => { changeLanguage(value) }}
        />
      </Row>

      <Notice kind='error' text={error} />
    </div>
  )
}
