#!/bin/bash
# ============================================================
# GABRIEL - Push to NOIZYLAB-io GitHub Organization
# https://github.com/NOIZYLAB-io/GABRIEL
# MC96DIGIUNIVERSE AI LIFELUV INFINITE ENERGY ⚡
# ============================================================

set -e

GABRIEL_ROOT="/Users/m2ultra/NOIZYLAB/GABRIEL"
GITHUB_ORG="NOIZYLAB-io"
REPO_NAME="GABRIEL"

echo ""
echo "🚀 GABRIEL → NOIZYLAB-io GitHub Push Script"
echo "============================================"
echo ""

cd "$GABRIEL_ROOT"

# Check if we're in a git repo
if [ -d ".git" ]; then
    echo "📁 Git repository detected"
    
    # Show current remotes
    echo ""
    echo "📡 Current remotes:"
    git remote -v
    
    # Check if NOIZYLAB-io remote exists
    if git remote | grep -q "noizylab-io"; then
        echo ""
        echo "✓ Remote 'noizylab-io' already exists"
    else
        echo ""
        echo "➕ Adding NOIZYLAB-io remote..."
        git remote add noizylab-io "https://github.com/${GITHUB_ORG}/${REPO_NAME}.git"
        echo "✓ Remote added: https://github.com/${GITHUB_ORG}/${REPO_NAME}.git"
    fi
else
    echo "⚠️  Not a git repository. Initializing..."
    git init
    git remote add origin "https://github.com/${GITHUB_ORG}/${REPO_NAME}.git"
fi

echo ""
echo "📊 Git Status:"
echo "=============="
git status --short | head -20
echo ""

# Stage all changes
echo "📦 Staging all changes..."
git add -A

# Create commit
echo ""
echo "💾 Creating commit..."
COMMIT_MSG="🧠 GABRIEL Consolidated - $(date '+%Y-%m-%d %H:%M')"
git commit -m "$COMMIT_MSG" --allow-empty

echo ""
echo "============================================"
echo "📤 Ready to push to: https://github.com/${GITHUB_ORG}/${REPO_NAME}"
echo ""
echo "Run one of these commands to push:"
echo ""
echo "  # Push to NOIZYLAB-io (new org):"
echo "  git push -u noizylab-io main"
echo ""
echo "  # Or push to existing origin:"
echo "  git push -u origin main"
echo ""
echo "  # Force push (if needed):"
echo "  git push -u noizylab-io main --force"
echo ""
echo "============================================"
echo "💫 GABRIEL KNOWS & CONTROLS ALL! 💫"
echo ""
