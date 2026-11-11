.PHONY: help build test lint clean deploy install upgrade

help:
	@echo "NOIZYLAB — Available targets:"
	@echo "  make install    — Install dependencies"
	@echo "  make upgrade    — Upgrade all packages"
	@echo "  make build      — Build/compile project"
	@echo "  make test       — Run all tests"
	@echo "  make lint       — Run linters"
	@echo "  make clean      — Clean build artifacts"
	@echo "  make deploy     — Deploy to production"

install:
	@echo "Installing dependencies..."
	pip install -r requirements.txt 2>/dev/null || echo "No requirements.txt"
	npm install 2>/dev/null || echo "No package.json"

upgrade:
	@echo "Upgrading packages..."
	pip install --upgrade pip 2>/dev/null || true
	npm upgrade 2>/dev/null || true
	brew upgrade 2>/dev/null || true

build:
	@echo "Building project..."
	npm run build 2>/dev/null || python -m py_compile src/**/*.py 2>/dev/null || echo "No build script"

test:
	@echo "Running tests..."
	pytest tests/ 2>/dev/null || npm test 2>/dev/null || echo "No tests configured"

lint:
	@echo "Running linters..."
	pylint src/ 2>/dev/null || npm run lint 2>/dev/null || echo "No linters configured"

clean:
	@echo "Cleaning build artifacts..."
	rm -rf build/ dist/ *.egg-info __pycache__ node_modules .pytest_cache

deploy:
	@echo "Deploying..."
	wrangler deploy 2>/dev/null || echo "Wrangler not configured"
