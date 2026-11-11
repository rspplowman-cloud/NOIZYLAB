VENV_BIN=.venv/bin
PYTHON=$(VENV_BIN)/python3
RUFF=$(VENV_BIN)/ruff

doctor:
	$(PYTHON) tools/gabriel_doctor.py --root . --fix-python --delete-empty --manifest --dupes

fast:
	$(RUFF) format .
	$(RUFF) check . --fix --unsafe-fixes
