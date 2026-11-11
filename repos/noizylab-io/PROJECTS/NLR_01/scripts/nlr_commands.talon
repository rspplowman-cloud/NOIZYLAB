# NLR_01 Voice Assistant - Talon Commands
# Copy to ~/.talon/user/nlr_01.talon

# Start/Stop NLR_01
nlr start: user.nlr_start()
nlr stop: user.nlr_stop()
nlr listen: user.nlr_listen()

# Provider switching
nlr use claude: user.nlr_set_provider("claude")
nlr use openai: user.nlr_set_provider("openai")
nlr use ollama: user.nlr_set_provider("ollama")
nlr use local: user.nlr_set_provider("ollama")

# Quick commands
nlr ask <user.text>$: user.nlr_ask(text)
nlr help: user.nlr_help()
nlr status: user.nlr_status()

# Context commands
nlr explain: user.nlr_explain_selection()
nlr refactor: user.nlr_refactor_selection()
nlr document: user.nlr_document_selection()
