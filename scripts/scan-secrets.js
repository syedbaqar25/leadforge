const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IGNORED_FILES = new Set([
  '.env.example',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '.lintstagedrc.json',
  'scan-secrets.js',
]);

const SECRET_PATTERNS = [
  {
    name: 'Private Key',
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'AWS Access Key ID',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
  },
  {
    name: 'OpenAI Secret Key',
    regex: /sk-[a-zA-Z0-9T3BlbkFJ]{20,}/,
  },
  {
    name: 'Hardcoded Secret Assignment',
    regex:
      /(?:jwt_secret|api_key|apikey|client_secret|private_key|app_secret)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/i,
  },
  {
    name: 'Database URL with real password',
    regex: /postgresql:\/\/[^:]+:(?!CHANGE_ME)[^@]+@/i,
  },
];

function getFilesToCheck() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    return args;
  }

  // Fallback: check git staged files
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function scanFile(filePath) {
  const baseName = path.basename(filePath);
  if (IGNORED_FILES.has(baseName)) {
    return [];
  }

  if (
    filePath.includes('node_modules') ||
    filePath.includes('.next') ||
    filePath.includes('dist') ||
    filePath.includes('.git')
  ) {
    return [];
  }

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory() || stats.size > 2 * 1024 * 1024) {
      return []; // Skip directories and files > 2MB
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          // Verify it's not a documentation placeholder
          if (
            line.includes('CHANGE_ME') ||
            line.includes('placeholder') ||
            line.includes('example') ||
            line.includes('fake')
          ) {
            continue;
          }
          violations.push({
            rule: pattern.name,
            file: filePath,
            line: i + 1,
            snippet: line.trim().slice(0, 80),
          });
        }
      }
    }

    return violations;
  } catch {
    return [];
  }
}

function run() {
  // If gitleaks is installed on system, invoke it as well
  try {
    execSync('gitleaks version', { stdio: 'ignore' });
    try {
      execSync('gitleaks protect --staged -v', { stdio: 'inherit' });
    } catch {
      console.error('❌ Gitleaks detected a secret in staged changes!');
      process.exit(1);
    }
  } catch {
    // Gitleaks binary not in PATH; fallback to built-in pattern scanner
  }

  const files = getFilesToCheck();
  let totalViolations = [];

  for (const file of files) {
    const violations = scanFile(file);
    if (violations.length > 0) {
      totalViolations = totalViolations.concat(violations);
    }
  }

  if (totalViolations.length > 0) {
    console.error('\n🚨 SECRET SCANNER DETECTED POTENTIAL SECRETS:\n');
    for (const v of totalViolations) {
      console.error(`  [${v.rule}] ${v.file}:${v.line}`);
      console.error(`  > ${v.snippet}\n`);
    }
    console.error('Commit rejected. Never commit real secrets or credentials.');
    console.error('Use .env with .gitignore or placeholder values like CHANGE_ME.\n');
    process.exit(1);
  }

  console.log('✓ Secret scan passed: no secrets detected.');
  process.exit(0);
}

run();
