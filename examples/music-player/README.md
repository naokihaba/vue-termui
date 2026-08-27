# Spoterm

A Spotify Connect controller built with `vue-termui` and Spotify's Web API.

Spotify's Client Credentials flow from the general getting-started tutorial
cannot access or control a user's player. Use the Authorization Code with PKCE
flow and request:

- `user-read-playback-state`
- `user-modify-playback-state`
- `user-read-currently-playing`
- `user-library-read`

Set the app's redirect URI to exactly `http://127.0.0.1:8888/callback` (`localhost`
is not accepted), copy its Client ID, then authorize this example:

```bash
SPOTIFY_CLIENT_ID=your_client_id pnpm --filter @vue-termui/example-music-player auth
pnpm --filter @vue-termui/example-music-player dev
```

The helper opens a local callback, prints Spotify's authorization URL, exchanges
the returned code with PKCE, and saves `.spotify-token.json` with owner-only
permissions. The file is ignored by Git; the app refreshes expired access tokens
automatically. Delete it to disconnect.

Without credentials the app opens in a safe demo mode. A Spotify Premium account
and an active Connect device are required for playback control. Never commit a
client secret, access token, refresh token, or `.env` file. A Client Secret is
not needed for PKCE.

Playback failures remain visible in the app and are also appended to
`logs/music-player.log`. A `403` response generally means Spotify rejected the
command because the account is not Premium, the token lacks playback permission,
or the active device cannot play the current item. The response detail in the
error panel and log identifies the reason Spotify returned. If permissions have
changed, delete `.spotify-token.json` and run `auth` again.

Use `1`/`2`/`3` or click the sidebar to open Main, Search, and Favorites. The
queue comes from the active Spotify session. Select tracks with `j`/`k` and
Enter or click one to play it. Click or drag on the progress bar to seek. The
layout switches to compact top navigation on narrow terminals.
