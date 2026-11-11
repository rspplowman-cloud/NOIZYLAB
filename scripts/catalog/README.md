# NOIZY file catalog: Forgejo + n8n + local AI

**One private list of every NOIZY file and library, with its history in Forgejo, searchable by meaning on M2Ultra.**
No file is moved. No file content is read. Nothing leaves M2Ultra.

## How it fits together

| Step | Tool | What it does |
|---|---|---|
| 1. Find | `library_finder.py`, `talespin_finder.py`, `project_finder.py` | Read the drives, write reports to `~/.noizy/`. |
| 2. Catalog | `scripts/catalog/catalog.py` | Merges the newest reports into `files.jsonl`, commits it to the private Forgejo repo **NOIZY/NOIZY-CATALOG**. Git keeps every version, so you can see what appeared or vanished, and when. |
| 3. Index | n8n workflow **NOIZY Catalog: index files** | On each Forgejo push (and daily at 03:00): checks HALT, reads `files.jsonl`, embeds each record with **local Ollama** (`nomic-embed-text`), stores it in **Qdrant**. |
| 4. Ask | n8n workflow **NOIZY Catalog: ask where a file is** | `POST {"q": "..."}` returns the 10 closest records with paths, copies and, for bought libraries, where to download them again. It only lists records; no model writes an answer, so nothing is made up. |

**Sealed:** records whose path names consent, kidz, family, vault or voice models stay in the catalog but are
dropped before the model. They are never embedded. Tested in `infra/n8n/test/workflows.test.mjs`.

**Built from community work, not from scratch:** the index flow follows the n8n community template
"Index local documents for RAG using Ollama embeddings and Qdrant" (n8n.io/workflows/17764). It uses only n8n's
built-in Webhook, Schedule, HTTP Request and Code nodes. The unofficial Forgejo community nodes are not needed;
Forgejo's own webhooks and REST API do the job. Back up n8n's own workflows to Forgejo with community template 2820.

**Red team:** profile `redteam/agents/CATALOG.json` (read-only; no shell, no writes, no vault).

## Set up once (RSP_001, in Warp or Ghostty)

1. In Forgejo (git.noizylab.ca), make a **private** repo `NOIZY/NOIZY-CATALOG`.
2. Clone it: `git clone http://127.0.0.1:3300/NOIZY/NOIZY-CATALOG.git ~/NOIZY-CATALOG`
3. Get the local model: `ollama pull nomic-embed-text`
4. In n8n (n8n.noizylab.ca): **Import from file** both files in `infra/n8n/workflows/`.
5. In n8n, make three **Header Auth** credentials. Each value comes from Proton Pass (VAULT-OPS):
   1. **Forgejo read token**: name `Authorization`, value `token <a read-only Forgejo token>`.
   2. **Forgejo webhook secret**: name `Authorization`, value a long random secret.
   3. **NOIZY ask key**: name `X-NOIZY-Key`, value a long random secret.
6. Open the **Config** node in each workflow. Set `HALT_URL`. Until it is set, the workflows stop (fail closed).
7. In Forgejo: NOIZY-CATALOG, then Settings, then Webhooks, then Add. URL: `https://n8n.noizylab.ca/webhook/noizy-catalog-push`.
   Put the same secret from step 5.2 in "Authorization header". Trigger on push.
8. Turn both workflows **on**.

## Every time

1. Run the finders on the healthy drives (never the 12 TB drive).
2. `python3 scripts/catalog/catalog.py --push` (checks HALT, commits, pushes; n8n re-indexes by itself).
3. Ask: send `{"q": "TaleSpin narration takes"}` to `https://n8n.noizylab.ca/webhook/noizy-files-ask`
   with the `X-NOIZY-Key` header. An iPhone Shortcut ("Get Contents of URL") does this by voice.
