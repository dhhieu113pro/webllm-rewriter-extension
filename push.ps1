# Creates GitHub repo dhhieu113pro/webllm-rewriter-extension (private) and pushes
# Run: .\push.ps1
$ErrorActionPreference = "Stop"

$repo = "dhhieu113pro/webllm-rewriter-extension"
$dir  = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $dir

# Init git if needed
if (-not (Test-Path ".git")) {
    git init
    git branch -M main
}

# Create .gitignore if missing
if (-not (Test-Path ".gitignore")) {
    @"
bin/
obj/
screenshots/
*.user
.vscode/
"@ | Set-Content .gitignore -Encoding UTF8
}

# Stage & commit
git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m "Initial commit: webllm-rewriter-extension"
}

# Create private repo + push
gh repo create $repo --private --source=. --remote=origin --push

Pop-Location
Write-Host "Done: https://github.com/$repo"
