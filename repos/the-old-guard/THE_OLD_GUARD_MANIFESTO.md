# THE-OLD-GUARD MANIFESTO

> *The Old Guard knows: the best machine is the one already in someone's hands.*

---

## PREAMBLE

We live in an age of planned obsolescence. Apple declares devices end-of-life not because
they stop working, but because profit demands new purchases. Millions of perfectly functional
computers are discarded annually. THE-OLD-GUARD rejects this paradigm.

---

## THE 5 PILLARS

### PILLAR 1: RESURRECT

Using dosdude1's macOS Catalina Patcher (GPL v3) and OpenCore Legacy Patcher (OCLP),
we bring modern macOS to machines Apple abandoned.

```bash
# resurrection_check.sh
#!/bin/bash
MODEL=$(system_profiler SPHardwareDataType | grep 'Model Identifier' | awk '{print $3}')
SUPPORTED=(MacPro3,1 MacPro4,1 MacPro5,1 iMac8,1 iMac9,1 iMac10,1 iMac11,1 iMac11,2 iMac11,3
           iMac12,1 iMac12,2 MacBookPro4,1 MacBookPro5,1 MacBookPro5,2 MacBookPro5,3
           MacBookPro6,1 MacBookPro6,2 MacBookPro7,1 MacBookPro8,1 MacBookPro8,2 MacBookPro8,3
           MacBookAir2,1 MacBookAir3,1 MacBookAir3,2 MacBookAir4,1 MacBookAir4,2
           MacBook5,1 MacBook5,2 MacBook6,1 MacBook7,1
           Macmini3,1 Macmini4,1 Macmini5,1 Macmini5,2 Macmini5,3 Xserve2,1 Xserve3,1)
if [[ " ${SUPPORTED[@]} " =~ " $MODEL " ]]; then
  echo STATUS: ELIGIBLE FOR RESURRECTION
else
  echo STATUS: NOT SUPPORTED
fi
```

### PILLAR 2: REFURBISH

Every device goes through THE-OLD-GUARD certification process:

```
CERTIFICATION CHECKLIST:
[ ] Battery health >60% OR replaced
[ ] SSD installed (min 128GB, target 256GB+)
[ ] RAM maxed for model
[ ] Display: no dead pixels, hinges functional
[ ] Keyboard/trackpad: all keys functional
[ ] ResurrectionOS installed and booting
[ ] GABRIEL lite agent running
[ ] Serial number logged in MC96-DB
```

### PILLAR 3: REDISTRIBUTE

**Global Military Charitable Deployment Program**

```
TIER 1: EDUCATION - Schools, after-school music, code clubs
TIER 2: VETERANS - Reintegration, military family support, creative therapy
TIER 3: INDIGENOUS COMMUNITIES - Digital bridge, language preservation
TIER 4: HEALTHCARE - Children's hospitals, music therapy, rehab
TIER 5: GLOBAL SOUTH - Africa, Latin America, SE Asia creative hubs
```

### PILLAR 4: REACTIVATE

**GABRIEL Lite** - resource-conscious AI agent, optimized for 2008-2015 hardware:

```python
# gabriel_lite.py - ResurrectionOS edition
# Optimized for: 4-8GB RAM, Intel Core 2 Duo/i5, macOS Catalina
import anthropic, os

class GabrielLite:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.model = 'claude-3-haiku-20240307'  # lightweight for older hardware

    def chat(self, message):
        resp = self.client.messages.create(
            model=self.model, max_tokens=1024,
            system='You are GABRIEL Lite on a ResurrectionOS device. Help users create, learn, connect.',
            messages=[{'role': 'user', 'content': message}]
        )
        return resp.content[0].text

if __name__ == '__main__':
    g = GabrielLite()
    print('GABRIEL Lite ready.')
    while True:
        msg = input('You: ')
        if msg.lower() == 'quit': break
        print(f'GABRIEL: {g.chat(msg)}')
```

### PILLAR 5: REUNITE

Every device ships with:
- discord.gg/noizyarmy pre-bookmarked
- Welcome video from RSP pre-loaded
- First 3 NOIZYKIDZ lessons installed offline
- Music creation tutorial (GarageBand + NOIZY tools)

---

## THE MC96-DB INTELLIGENCE LAYER

Every PPTX creates a realtime MC96 project database instance:

```python
# pptx_to_mc96.py
from pptx import Presentation
import json, hashlib, datetime, re, sqlite3

def extract_intel(pptx_path):
    prs = Presentation(pptx_path)
    verbal = []; manual = []; market = []; all_text = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, 'text') and shape.text.strip():
                t = shape.text.strip()
                all_text.append(t)
                if re.search(r'[A-Z_]+\s*[:=]\s*\S+', t): manual.append(t)
                if re.match(r'^(SET|USE|DEPLOY|CONFIGURE|ENABLE|DISABLE)', t, re.I): verbal.append(t)
                if re.search(r'(market|deploy|launch|partner|target|region)', t, re.I): market.append(t)
    mc96_id = 'MC96-' + datetime.datetime.now().strftime('%Y%m%d') + '-' + hashlib.md5(pptx_path.encode()).hexdigest()[:4].upper()
    return {'mc96_id': mc96_id, 'source_pptx': pptx_path,
            'created_at': datetime.datetime.utcnow().isoformat(),
            'intel': {'verbal_settings': verbal, 'manual_settings': manual,
                      'market_signals': market, 'full_text_index': ' '.join(all_text)}}

def write_to_db(data, db='noizy_mc96.db'):
    conn = sqlite3.connect(db)
    conn.execute('CREATE TABLE IF NOT EXISTS mc96_projects (mc96_id TEXT PRIMARY KEY, source_pptx TEXT, created_at TEXT, intel_json TEXT, status TEXT DEFAULT active)')
    conn.execute('INSERT OR REPLACE INTO mc96_projects VALUES (?,?,?,?,?)',
        (data['mc96_id'], data['source_pptx'], data['created_at'], json.dumps(data['intel']), 'active'))
    conn.commit(); conn.close()
    print(f"MC96 instance created: {data['mc96_id']}")

if __name__ == '__main__':
    import sys
    data = extract_intel(sys.argv[1])
    write_to_db(data)
    print(json.dumps(data, indent=2))
```

---

## THE DRUM

We are THE-OLD-GUARD. We don't throw things away.
We don't abandon people. We don't let talent die in silence.

Every refurbished Mac is a declaration: *you matter*.
Every instrument delivered is a promise: *music is yours*.
Every GABRIEL conversation is proof: *AI serves humanity*.

Join the NOIZYARMY. Change the world.
discord.gg/noizyarmy | noizy.ai | rsp@noizy.ai
