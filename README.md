# gpt-live-codex-bridge

Run Hermes Agent's **native GPT-Live voice** on a **ChatGPT subscription** instead of a metered
OpenAI API key.

Hermes' built-in GPT-Live mode (the "GPT-Live" option on the Desktop composer's voice button) only
accepts an OpenAI API key. The Codex CLI can place the same kind of voice call on the ChatGPT
subscription it is signed in with. This project connects the two without modifying Hermes.

Unofficial. Not affiliated with Nous Research or OpenAI.

## How it works

```
Hermes Desktop / Webapp (browser)                      host running Hermes
┌──────────────────────────────┐   SDP offer   ┌────────────────────────────────────┐
│ native GPT-Live client       │ ───────────▶  │ Hermes gateway                     │
│  + desktop-plugin/plugin.js  │               │   voice.gpt_live.base_url ──┐      │
│    (translates event names)  │ ◀───────────  │                             ▼      │
└──────────────┬───────────────┘   SDP answer  │ bridge.py ──▶ codex app-server     │
               │                               └────────────────────────────────────┘
               └──── WebRTC audio + events, direct ────▶ OpenAI
```

Two small pieces:

- **`bridge.py`** stands in for `POST /v1/live/sessions`. For each call it starts a locked-down
  `codex app-server`, has it negotiate the WebRTC call, and returns the answer. Audio never passes
  through the bridge; it flows from the browser to OpenAI directly, so it works from any machine
  that can reach your Hermes.
- **`desktop-plugin/plugin.js`** is a Hermes Desktop plugin. A Codex-negotiated call speaks a
  different event dialect ("v3") on the data channel than the Live API dialect Hermes' client
  speaks. The plugin translates both directions in the browser. It only touches calls the bridge
  marked (the answer's SDP `s=` line is `hermes-codex-bridge`); every other WebRTC call is untouched.

## Requirements

- Hermes Agent with native GPT-Live (`tools/voice_live.py`; tested on v0.23.2).
- Codex CLI installed and signed in with ChatGPT (`codex login`) for the user that runs the bridge
  (tested with codex-cli 0.166.0). The account must have voice access.
- Python 3.10+ (standard library only).

## Install

1. Create the shared token and start the bridge:

   ```sh
   mkdir -p ~/.config/gpt-live-codex-bridge
   (umask 077; python3 -c "import secrets;print('glcb_'+secrets.token_urlsafe(32))" \
     > ~/.config/gpt-live-codex-bridge/token)
   python3 bridge.py            # or install systemd/gpt-live-codex-bridge.service as a user unit
   curl http://127.0.0.1:18642/healthz
   ```

2. Install the Desktop plugin into the Hermes home:

   ```sh
   mkdir -p ~/.hermes/desktop-plugins/gpt-live-codex-bridge
   cp desktop-plugin/plugin.js ~/.hermes/desktop-plugins/gpt-live-codex-bridge/
   ```

3. Point Hermes' GPT-Live at the bridge (the "API key" is the bridge token, not an OpenAI key):

   ```sh
   hermes config set voice.gpt_live.base_url http://127.0.0.1:18642/v1
   hermes config set voice.gpt_live.api_key "$(cat ~/.config/gpt-live-codex-bridge/token)"
   hermes config set voice.gpt_live.voice cove
   ```

   `hermes config set` warns that `base_url` is not a recognized key; Hermes reads it anyway.

4. Reload the Desktop app or Webapp, open the voice menu on the composer, and choose **GPT-Live**.

## Configuration

Environment variables for `bridge.py`:

| Variable | Default | Meaning |
|---|---|---|
| `BRIDGE_HOST` / `BRIDGE_PORT` | `127.0.0.1` / `18642` | Listen address. Keep it on loopback. |
| `BRIDGE_TOKEN_FILE` | `~/.config/gpt-live-codex-bridge/token` | Bearer token Hermes must present. |
| `BRIDGE_CODEX_BINARY` | `codex` on `PATH` | Codex CLI to launch. |
| `BRIDGE_VOICE` | `cove` | Voice used when Hermes asks for one the subscription lacks. |
| `BRIDGE_MAX_CALLS` | `3` | Concurrent calls. |
| `BRIDGE_MAX_CALL_SECONDS` | `7200` | Hard cap on one call. |

Subscription voices: arbor, breeze, cove, ember, juniper, maple, sol, spruce, vale.

## Limitations

- **It depends on unstable interfaces.** `codex app-server --enable realtime_conversation` is an
  experimental Codex feature and the v3 event dialect is undocumented. Either can change and break
  this without notice.
- **Call setup takes several seconds** (about 5 to 10 in testing) because each call starts a fresh
  Codex app-server.
- **GPT-Live delegates.** The voice model has no tools; each real request becomes a Hermes turn and
  the voice speaks the result when the turn finishes. That is Hermes' design, not the bridge's.
- **Each hand-off also reaches the Codex thread**, which is fenced off (no tools, read-only sandbox,
  instructed to reply `skip`). It still consumes a small amount of subscription usage.
- **Earlier chat history is passed as quoted background in the prompt**, capped at 6000 characters.
- Mute is handled by the client disabling the microphone track; no mute event is sent upstream.
- Usage counts against your ChatGPT plan's limits. Check that this use fits the terms of your plan.

## Testing

```sh
npm test                                   # event translation unit tests (Node 18+)
```

Browser test against a real call (needs the bridge running, ffmpeg with libflite, and Chrome):

```sh
ffmpeg -f lavfi -i "flite=text='Hello. Please check how long the gateway has been running and tell me the answer.':voice=slt" \
  -af "adelay=2500,apad=pad_dur=40" -ar 24000 -ac 1 test/speech.wav
python3 test/server.py                     # then open http://127.0.0.1:18650/test/page.html
```

The page behaves like Hermes' native client (Live API event names only) and reports whether it saw
the hand-off, what the voice said, and a clean close.

## Credits

The approach of negotiating a subscription voice call through `codex app-server`, and the
lock-down applied to the carrier thread, follow
[hermes-talk](https://github.com/TheSmokeDev/hermes-talk) by SmokeDev (MIT).

## License

MIT
