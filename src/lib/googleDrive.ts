// Google Drive reference integration boundary.
//
// AURA never copies a Drive file's bytes — a "Drive reference" is only ever
// metadata (file id, name, mime type, thumbnail/preview URL) that lets the
// UI display and link back to the file. Google Drive stays the single
// source of truth for the actual image.
//
// This module loads the Google Identity Services (auth) and Picker (file
// selection) scripts from Google's own CDN at runtime — they are NOT bundled
// with the app — and only runs once real credentials are supplied via env
// vars. No client secret is ever needed for this flow: the Picker API uses
// an OAuth *access token* (short-lived, requested client-side via GIS) plus
// a public API key that is safe to expose to the browser (it is restricted
// to specific APIs/origins in the Google Cloud Console, not a secret).
//
// Required setup (see .env.example for the exact variable names):
//   1. In Google Cloud Console, create/select a project.
//   2. Enable the "Google Drive API" and the "Google Picker API".
//   3. Create an OAuth 2.0 Client ID (type: Web application) and add this
//      app's origin(s) to "Authorized JavaScript origins". This is
//      VITE_GOOGLE_CLIENT_ID.
//   4. Create an API key, then restrict it to the Picker API and to this
//      app's HTTP referrers. This is VITE_GOOGLE_API_KEY.
//   5. Set both as environment variables (e.g. in a git-ignored .env.local)
//      before building/running the app. Never commit real values.
//
// Until both are configured, isGoogleDriveConfigured() returns false and the
// References UI shows a "Google Drive isn't connected" state instead of
// pretending the integration works.

export interface DriveFilePicked {
  driveFileId: string
  name: string
  mimeType: string
  thumbnailLink?: string
  previewLink?: string
  webViewLink?: string
  iconLink?: string
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'

export function isGoogleDriveConfigured(): boolean {
  return Boolean(CLIENT_ID && API_KEY)
}

let scriptLoadPromise: Promise<void> | undefined

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

function ensureGoogleScriptsLoaded(): Promise<void> {
  if (!scriptLoadPromise) {
    scriptLoadPromise = Promise.all([loadScript(GIS_SRC), loadScript(GAPI_SRC)]).then(() => undefined)
  }
  return scriptLoadPromise
}

// Minimal shape of the bits of the `google` global this module actually
// uses — the real script defines much more, but we only need this much.
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
      picker: {
        PickerBuilder: new () => GooglePickerBuilder
        ViewId: { DOCS_IMAGES: string }
        Action: { PICKED: string; CANCEL: string }
        Response: { ACTION: string; DOCUMENTS: string }
        Document: { ID: string; NAME: string; MIME_TYPE: string; THUMBNAILS: string; URL: string }
      }
    }
    gapi?: {
      load: (api: string, callback: () => void) => void
    }
  }
}

interface GooglePickerBuilder {
  addView: (viewId: string) => GooglePickerBuilder
  setOAuthToken: (token: string) => GooglePickerBuilder
  setDeveloperKey: (key: string) => GooglePickerBuilder
  enableFeature: (feature: string) => GooglePickerBuilder
  setCallback: (callback: (data: unknown) => void) => GooglePickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

/**
 * Opens the Google account picker, then the Drive file picker, and resolves
 * with metadata for the images the user selected — never their bytes.
 * Rejects if Drive isn't configured (call isGoogleDriveConfigured() first
 * to show a proper "not connected" state instead of triggering this).
 */
export async function openGoogleDrivePicker(): Promise<DriveFilePicked[]> {
  if (!CLIENT_ID || !API_KEY) {
    throw new Error('Google Drive is not configured for this deployment.')
  }

  await ensureGoogleScriptsLoaded()

  const accessToken = await new Promise<string>((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services failed to load'))
      return
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Google sign-in was cancelled'))
          return
        }
        resolve(response.access_token)
      },
    })
    tokenClient.requestAccessToken()
  })

  await new Promise<void>((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error('Google API loader failed to load'))
      return
    }
    window.gapi.load('picker', () => resolve())
  })

  return new Promise<DriveFilePicked[]>((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Picker failed to load'))
      return
    }
    const { picker } = window.google
    const view = picker.ViewId.DOCS_IMAGES

    const pickerInstance = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(API_KEY)
      .enableFeature('multiselectEnabled')
      .setCallback((data: unknown) => {
        const response = data as {
          action?: string
          docs?: Array<{
            id: string
            name: string
            mimeType: string
            thumbnailLink?: string
            url?: string
            iconUrl?: string
          }>
        }
        if (response.action === picker.Action.PICKED && response.docs) {
          resolve(
            response.docs.map((doc) => ({
              driveFileId: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              thumbnailLink: doc.thumbnailLink,
              webViewLink: doc.url,
              iconLink: doc.iconUrl,
            })),
          )
        } else if (response.action === picker.Action.CANCEL) {
          resolve([])
        }
      })
      .build()

    pickerInstance.setVisible(true)
  })
}
