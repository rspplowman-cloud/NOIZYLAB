#!/bin/sh
# Xcode Cloud runs this right after it clones the repo. Keep it small: a failing script stops the build.
# No secrets here. Signing and keys live in Xcode Cloud's own settings (App Store Connect), never in git.
set -e
echo "NOIZY: Xcode Cloud post-clone"
# Swift macros and package plugins need trust to build without a person clicking "Trust".
defaults write com.apple.dt.Xcode IDESkipMacroFingerprintValidation -bool YES
defaults write com.apple.dt.Xcode IDESkipPackagePluginFingerprintValidation -bool YES
