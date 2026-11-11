#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# MS365 / AZURE SECURITY LOCKDOWN SCRIPT
# GABRIEL ALMEIDA - NOIZYLAB
# Purpose: Lock down Microsoft 365 and Azure to 100% security
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "        MS365 / AZURE SECURITY LOCKDOWN - GABRIEL ALMEIDA"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "⚠️  Azure CLI not found. Installing..."
    brew install azure-cli
fi

# Check if Microsoft Graph CLI is installed
if ! command -v mgc &> /dev/null; then
    echo "⚠️  Microsoft Graph CLI not found."
    echo "   Install with: brew install microsoft-graph-cli"
fi

echo ""
echo "🔐 MS365 SECURITY LOCKDOWN CHECKLIST"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 1. IDENTITY & ACCESS MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════
echo "📋 1. IDENTITY & ACCESS MANAGEMENT"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'IDENTITY'
   [ ] Enable MFA for ALL users (no exceptions)
   [ ] Implement Conditional Access policies
   [ ] Configure Azure AD Identity Protection
   [ ] Disable legacy authentication protocols
   [ ] Set password policies (complexity, expiration)
   [ ] Enable Self-Service Password Reset (SSPR)
   [ ] Configure Privileged Identity Management (PIM)
   [ ] Review and limit Global Admin accounts (<5)
   [ ] Enable Azure AD Sign-in Risk policies
   [ ] Configure User Risk policies
IDENTITY
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 2. EMAIL SECURITY (EXCHANGE ONLINE)
# ═══════════════════════════════════════════════════════════════════════════════
echo "📧 2. EMAIL SECURITY (EXCHANGE ONLINE)"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'EMAIL'
   [ ] Enable Defender for Office 365
   [ ] Configure Safe Attachments policies
   [ ] Configure Safe Links policies
   [ ] Enable Anti-phishing protection
   [ ] Configure DMARC, DKIM, SPF records
   [ ] Enable Mailbox Auditing (all mailboxes)
   [ ] Block auto-forwarding to external domains
   [ ] Configure Transport Rules for sensitive data
   [ ] Enable Unified Audit Logging
   [ ] Review Mail Flow rules
EMAIL
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 3. DATA PROTECTION
# ═══════════════════════════════════════════════════════════════════════════════
echo "🔒 3. DATA PROTECTION"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'DATA'
   [ ] Enable Microsoft Information Protection (MIP)
   [ ] Configure Sensitivity Labels
   [ ] Enable Data Loss Prevention (DLP) policies
   [ ] Configure Azure Information Protection
   [ ] Enable Cloud App Security
   [ ] Configure eDiscovery holds
   [ ] Enable Litigation Hold for key mailboxes
   [ ] Configure Retention Policies
   [ ] Enable Customer Lockbox
   [ ] Review Sharing policies (SharePoint/OneDrive)
DATA
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 4. DEVICE SECURITY
# ═══════════════════════════════════════════════════════════════════════════════
echo "📱 4. DEVICE SECURITY (INTUNE/ENDPOINT MANAGER)"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'DEVICE'
   [ ] Enable Microsoft Defender for Endpoint
   [ ] Configure Device Compliance policies
   [ ] Enable BitLocker encryption
   [ ] Configure Windows Hello for Business
   [ ] Enable Application Protection policies
   [ ] Configure MAM (Mobile Application Management)
   [ ] Block non-compliant devices
   [ ] Enable Attack Surface Reduction rules
   [ ] Configure Endpoint Detection & Response
   [ ] Enable Controlled Folder Access
DEVICE
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 5. AZURE SECURITY
# ═══════════════════════════════════════════════════════════════════════════════
echo "☁️  5. AZURE SECURITY"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'AZURE'
   [ ] Enable Azure Security Center (Defender for Cloud)
   [ ] Configure Security Score improvements
   [ ] Enable Just-In-Time VM Access
   [ ] Configure Network Security Groups
   [ ] Enable Azure Firewall
   [ ] Configure Private Endpoints
   [ ] Enable Key Vault with soft delete
   [ ] Configure Azure DDoS Protection
   [ ] Enable Storage Account encryption
   [ ] Review RBAC assignments (least privilege)
AZURE
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 6. MONITORING & ALERTS
# ═══════════════════════════════════════════════════════════════════════════════
echo "📊 6. MONITORING & ALERTS"
echo "──────────────────────────────────────────────────────────────────────────────"
cat << 'MONITOR'
   [ ] Enable Microsoft Sentinel
   [ ] Configure Alert policies
   [ ] Enable Sign-in activity monitoring
   [ ] Configure Risky sign-in alerts
   [ ] Enable Cloud App Security alerts
   [ ] Configure Azure Activity Log alerts
   [ ] Enable Defender for Identity
   [ ] Configure Threat Intelligence
   [ ] Review Security Reports regularly
   [ ] Enable automated investigation & response
MONITOR
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# QUICK AZURE CLI COMMANDS
# ═══════════════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "🛠️  QUICK AZURE CLI COMMANDS"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

cat << 'COMMANDS'
# Login to Azure
az login

# Check current subscription
az account show

# List all users
az ad user list --output table

# Check MFA status (requires MS Graph)
# mgc users list --select displayName,userPrincipalName

# List Conditional Access policies
# az rest --method get --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"

# Check Security Score
# az rest --method get --url "https://graph.microsoft.com/v1.0/security/secureScores?$top=1"

# List Azure resources
az resource list --output table

# Check role assignments
az role assignment list --all --output table

# List storage accounts (check encryption)
az storage account list --query "[].{Name:name,Encryption:encryption.services.blob.enabled}" --output table

# List key vaults
az keyvault list --output table
COMMANDS

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "📚 RESOURCES"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "  • Microsoft Secure Score: https://security.microsoft.com/securescore"
echo "  • Azure Security Center:  https://portal.azure.com/#blade/Microsoft_Azure_Security"
echo "  • MS365 Security Center:  https://security.microsoft.com"
echo "  • Entra Admin Center:     https://entra.microsoft.com"
echo "  • Compliance Center:      https://compliance.microsoft.com"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "🚀 GABRIEL ALMEIDA - 24/7 Production Partner"
echo "═══════════════════════════════════════════════════════════════════════════════"
