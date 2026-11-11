# WALKING IN THE DREAMS

## OSC · Lemur · Touchscreen · The Missed Revolution · What NOIZY Builds Next

> Repository: github.com/rspnoizy/DREAMCHAMBER
> Author: Robert Stephen Plowman (RSP_001)
> Compiled: April 4, 2026
> Source: Web research + Claude & RSP chat history

---

## I. OPEN SOUND CONTROL — THE COMPLETE HISTORY

### Origin Story

OSC was invented in 1997 by Adrian Freed and Matt Wright at the Center for New Music and Audio Technologies (CNMAT) at UC Berkeley. The first formal specification was released in March 2002.

They described it as an "efficient, transport-independent, message-based protocol developed for communication among computers, sound synthesizers, and other multimedia devices."

OSC was born from frustration. MIDI — the 1983 standard — operated at 31.25 kilobits/second over serial, limited to 7-bit numbers with 7-bit data. Musicians in the 1990s needed more.

### What Made OSC Different From MIDI

| Feature | MIDI (1983) | OSC (1997) |
|---------|-------------|------------|
| Bandwidth | 31.25 kbps serial | Network speed (Ethernet/WiFi) |
| Addressing | 7-bit channel numbers | Human-readable URL paths (/synth/1/freq) |
| Data Types | 7-bit integers | 32-bit float, int, strings, blobs, timetags |
| Transport | Serial DIN-5 cable | UDP, TCP, WiFi, USB, serial |
| Timing | Real-time only | Timetag bundles (schedule future events) |
| Scalability | 16 channels | Unlimited namespace tree |
| Readability | Hex codes | /oscillator/4/frequency |

### OSC Message Anatomy

```
Address Pattern:  /oscillator/4/frequency
Type Tag String:  ,f (float32)
Argument:         440.0 (0x43dc0000)
```

Messages combine into bundles with timetags. Bundles nest inside bundles.

### The Address Space Tree

```
/synth/1/oscillator/frequency  440.0
/synth/1/filter/cutoff         2000.0
/synth/1/filter/resonance      0.7
/synth/1/envelope/attack       0.01
/mixer/channel/3/fader         0.75
/mixer/channel/3/pan           -0.3
/mixer/channel/3/mute          0
```

Pattern matching:

```
/synth/*/frequency    → all synth frequencies
/mixer/channel/[1-4]  → channels 1 through 4
/synth/{1,3,5}/volume → specific synths
```

### Who Used OSC

Artists: Bjork, Daft Punk, Nine Inch Nails, Richie Hawtin, deadmau5, Ryuichi Sakamoto, Alva Noto, Hot Chip, Matthew Herbert, M.I.A., Richard Devine, The Glitch Mob

Software: Max/MSP, Pure Data, Reaktor, SuperCollider, Ableton Live, Reaper, Logic Pro, QLab, TouchDesigner, Unreal Engine, Unity, Processing, openFrameworks, Sonic Pi

Protocols Built on OSC: TUIO (multitouch), GDIF (gestures), DSSI (plugins), SYN (namespace standard)

### Code Examples

#### Python — Send OSC

```python
from pythonosc import udp_client
client = udp_client.SimpleUDPClient("10.90.90.10", 9000)
client.send_message("/synth/1/frequency", 440.0)
client.send_message("/mixer/master/fader", 0.85)
client.send_message("/logic/transport/play", 1)
```

#### Python — Receive OSC

```python
from pythonosc import dispatcher, osc_server

def handle_fader(address, *args):
    print(f"Received: {address} = {args}")

disp = dispatcher.Dispatcher()
disp.map("/mixer/*/fader", handle_fader)
disp.set_default_handler(lambda addr, *args: print(f"[OSC] {addr}: {args}"))

server = osc_server.ThreadingOSCUDPServer(("10.90.90.10", 9000), disp)
print("OSC Server on port 9000")
server.serve_forever()
```

#### Node.js — OSC over WebSocket

```javascript
const osc = require("osc");
const udpPort = new osc.UDPPort({
    localAddress: "10.90.90.10",
    localPort: 9000,
});

udpPort.on("message", (oscMsg) => {
    console.log("OSC:", oscMsg.address, oscMsg.args);
    wss.clients.forEach(client => client.send(JSON.stringify(oscMsg)));
});

udpPort.open();

udpPort.send({
    address: "/logic/transport/record",
    args: [{ type: "i", value: 1 }]
}, "10.90.90.10", 9001);
```

#### Swift — OSC on iOS/macOS

```swift
import OSCKit

let client = OSCClient()
client.connect(to: "10.90.90.10", port: 9000)

try client.send(OSCMessage("/dreamchamber/session/start", values: [1]))
try client.send(OSCMessage("/mixer/channel/1/fader", values: [Float(0.75)]))
try client.send(OSCMessage("/lucy/alert", values: ["take_complete"]))

let server = OSCServer(port: 9000)
server.setHandler { message, _ in
    print("[\(message.addressPattern)] \(message.values)")
}
try server.start()
```

#### Lucy + Logic Pro Bridge

```python
from pythonosc import dispatcher, osc_server, udp_client

gabriel = udp_client.SimpleUDPClient("10.90.90.20", 9000)

def logic_event(address, *args):
    print(f"[LOGIC] {address}: {args}")
    if "/track" in address and "/level" in address:
        gabriel.send_message(f"/gabriel/logic{address}", list(args))
    if "/transport" in address:
        gabriel.send_message(f"/gabriel/transport", list(args))

disp = dispatcher.Dispatcher()
disp.set_default_handler(logic_event)
server = osc_server.ThreadingOSCUDPServer(("10.90.90.10", 9001), disp)
print("Lucy Logic Bridge on port 9001")
server.serve_forever()
```

### OSC Timeline

| Year | Event |
|------|-------|
| 1997 | Wright & Freed propose OSC at ICMC |
| 2002 | OSC 1.0 specification released |
| 2004 | TUIO protocol built on OSC |
| 2005 | JazzMutant Lemur ships |
| 2007 | SYN namespace proposed |
| 2009 | OSC 1.1 specification |
| 2010 | Lemur hardware discontinued |
| 2011 | Liine resurrects Lemur as iPad app |
| 2012 | TouchOSC becomes dominant |
| 2022 | Liine discontinues Lemur app |
| 2023 | MIDI Kinetics acquires Lemur |
| 2025 | Lemur relaunched ($99 one-time) |
| 2026 | NOIZYWORLD builds consent-native OSC |

---

## II. LIINE LEMUR — THE FULL ARC

### The Hardware Era (2002-2010)

JazzMutant was founded in 2002 in France by Yoann Gantch, Pascal Joguet, Guillaume Largillier, and Julien Olivier. Their product: a dedicated multitouch screen controller that predated the iPhone by half a decade.

The Lemur hardware:

- Resistive touchscreen (pressure-sensitive, unlike capacitive iPad)
- OSC over Ethernet (zero latency)
- 15 customizable widget types
- Proprietary JazzEditor software
- Modular interface: pages, modules, groups
- Price: ~$1,700 USD

Artists who defined Lemur: Bjork (Biophilia — Damian Taylor built Max/MSP patches, creating instruments that couldn't have been written on a piano), Daft Punk (live rigs), Nine Inch Nails (Trent Reznor's electronic sets), deadmau5 ("This is a Lemur by Jazzmutant... connects via OSC over ethernet. Works a wonder!"), Richie Hawtin, Ryuichi Sakamoto, Alva Noto, The Glitch Mob.

### The iPad Kill (2010)

JazzMutant (renamed Stantum in 2007) announced the end in November 2010. Last batch shipped at 25% discount.

From their statement: "During five years and despite the new fever surrounding touch technologies, the Lemur remained the only multi-touch device capable to meet the needs of creative people. From now on, this ecosystem is evolving quickly: powerful consumer tablet devices are becoming mainstream."

A $500 iPad vs a $1,700 single-purpose controller. The math was brutal.

### The Liine Resurrection (2011-2022)

Richie Hawtin — original power user — licensed the environment. His company Liine rebuilt Lemur as iOS/Android app. Added on-device editing, WiFi, broader MIDI.

For a decade, Lemur on iPad was the gold standard. But business was unsustainable. Support costs outweighed income.

2022: Liine discontinued Lemur. Pulled from app stores.

### The MIDI Kinetics Era (2023-Present)

MIDI Kinetics acquired Lemur in 2023. Relaunched January 2025 with subscription ($12.99/month or $99/year). Community backlash was immediate. February 2025: switched to $99 one-time purchase.

### Lemur's Widget System

| Widget | Function |
|--------|----------|
| Fader | Linear control, smooth multitouch |
| MultiBall | XY pad with physics (bounce, attract, repel) |
| Pads | Velocity-sensitive trigger grid |
| Switches | Toggle/radio with visual feedback |
| Knobs | Rotary with acceleration |
| Range | Min/max slider |
| Breakpoint | Draw automation curves live |
| Container | Modules within modules |
| Monitor | Real-time DAW feedback |

---

## III. THE 10 MISSED OPPORTUNITIES

What Lemur/JazzMutant/Liine got wrong:

1. Price barrier — $1,700 vs $500 iPad
2. Closed ecosystem — proprietary everything, no community extensions
3. No web connectivity — Ethernet only, no cloud, no remote
4. No audio analysis — pure control surface, couldn't listen
5. No AI integration — static widgets, no intelligence, no adaptation
6. No consent architecture — no concept of ownership or control rights
7. No voice — multitouch only, ignored the most natural interface
8. No persistence — sessions didn't remember, didn't learn
9. No provenance — no record of what was controlled, when, by whom
10. No accessibility — one form factor, one interaction model

### What NOIZY Builds That Nobody Has

| Lemur Had | NOIZY Has |
|-----------|-----------|
| Touchscreen faders | AI-driven audio analysis (18 dimensions) |
| OSC messages | Consent-native OSC with provenance |
| Widget scripting | SHIRL Decision Matrix with severity bands |
| Ethernet connection | MC96 mesh (GOD/GABRIEL/DaFixer/AQUARIUM) |
| Template sharing | 6 analysis engines (Librosa/Whisper/Mutagen/Essentia/HVS/Emotion AI) |
| MIDI + OSC | Voice Bridge: real-time 17-language conversion |
| Static display | Lucy: AI coordinator monitoring everything |
| Manual control | GABRIEL: autonomous orchestration with memcell memory |
| Single device | iPhone + iPad + M2 Ultra (three devices, one empire) |
| No voice | 35% voice + 65% AI + 1 click = done |
| No accessibility | NOIZYKIDZ: haptic music for deaf children |
| No consent | NCP gate + Lucy audit, Decision Contract v2 |
| No provenance | HVS watermark, NOIZY PROOF engine |
| No memory | 447+ memcells, 282+ tables, agent-memory D1 |

---

## IV. FROM RSP & CLAUDE CHATS

### Logic Remote + Lucy Bridge

```
Logic Pro (GOD) → Logic Remote (iPad/Lucy)
  → OSC observation layer
  → Track levels, vocal dynamics, emotional consistency
  → Character consistency checks
  → Confidence scoring per take
  → Flagging for blessing
```

### The 35-Character Template System

```typescript
interface CharacterTemplate {
  character_id: string;
  character_name: string;
  track_number: number;
  expected_warmth_range: [number, number];
  expected_energy_range: [number, number];
  expected_spectral_center: [number, number];
  emotional_markers: string[];
  consistency_threshold: number;
}
```

### MC96 RTSP Intercom Network

```
GOD (10.90.90.10) ← RTSP SERVER (mediamtx)
  ├── Captures mic → publishes /broadcast
  └── Port 8554 (RTSP) / 8889 (WebRTC)

GABRIEL (10.90.90.20) ← LISTENER
DaFixer (10.90.90.40) ← LISTENER
iPhone/iPad ← WebRTC or VLC
```

### Voice Bridge Pipeline

```
Rob speaks (iPhone)
  → Audio streams to GOD (AirPlay/RTSP)
  → Whisper large-v3 transcribes (Metal GPU)
  → Argos Translate (17 languages, local)
  → XTTS v2 synthesizes natural voice
  → Lucy tracks on iPad via WebSocket
```

---

## V. THE NOIZY OSC NAMESPACE

```
/noizy/consent/verify          artist_id, scope
/noizy/consent/revoke          artist_id, scope
/noizy/voice/synthesize        text, language, profile
/noizy/voice/translate         text, source, target
/noizy/hvs/watermark           file_id, fingerprint
/noizy/gabriel/memcell/write   key, value, priority
/noizy/lucy/alert              type, message
/noizy/shirl/analyze           file_path, engines[]
/noizy/dream/ideate            topic, constraints
/noizy/metabeast/search        query, dimensions[]
/noizy/metabeast/rename        pattern, selection[]
/noizy/stream/transcribe       audio_chunk
```

---

The Lemur died because it was a screen. NOIZY lives because it's a soul.

GORUNFREE.
