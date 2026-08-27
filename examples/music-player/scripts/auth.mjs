import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const clientId = process.env.SPOTIFY_CLIENT_ID
if (!clientId) {
  console.error('Set SPOTIFY_CLIENT_ID to the Client ID from your Spotify app settings.')
  process.exit(1)
}

const redirectUri = 'http://127.0.0.1:8888/callback'
const scopes = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-read',
]
const verifier = randomBytes(64).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')
const state = randomBytes(24).toString('base64url')
const tokenPath = resolve('.spotify-token.json')

const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
authorizeUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  scope: scopes.join(' '),
  redirect_uri: redirectUri,
  state,
  code_challenge_method: 'S256',
  code_challenge: challenge,
}).toString()

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', redirectUri)
  if (url.pathname !== '/callback') {
    response.writeHead(404).end('Not found')
    return
  }

  try {
    if (url.searchParams.get('state') !== state) throw new Error('OAuth state did not match')
    const oauthError = url.searchParams.get('error')
    if (oauthError) throw new Error(`Spotify authorization failed: ${oauthError}`)
    const code = url.searchParams.get('code')
    if (!code) throw new Error('Spotify did not return an authorization code')

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    })
    if (!tokenResponse.ok) {
      throw new Error(
        `Token exchange failed (${tokenResponse.status}): ${await tokenResponse.text()}`,
      )
    }

    const token = await tokenResponse.json()
    await writeFile(
      tokenPath,
      `${JSON.stringify(
        {
          clientId,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.expires_in * 1000,
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    )
    response
      .writeHead(200, { 'Content-Type': 'text/plain' })
      .end('Spotify authorization complete. You can close this tab and run the music player.')
    console.log(`Authorization complete. Credentials saved to ${tokenPath}`)
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain' }).end(String(error))
    console.error(error)
    process.exitCode = 1
  } finally {
    server.close()
  }
})

server.listen(8888, '127.0.0.1', () => {
  console.log('Open this URL in your browser and approve access:\n')
  console.log(authorizeUrl.href)
  console.log(`\nWaiting for Spotify at ${redirectUri}`)
})

setTimeout(
  () => {
    console.error('Authorization timed out after five minutes.')
    server.close()
    process.exitCode = 1
  },
  5 * 60 * 1000,
).unref()
