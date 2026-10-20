import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Pre-commit Secret Scanner Gate (PART 1.1)', () => {
  const tempDir = path.join(__dirname, 'fixtures');
  const cleanFilePath = path.join(tempDir, 'clean-file.ts');
  const dirtyFilePath = path.join(tempDir, 'leaked-secret.ts');
  const scannerScript = path.join(__dirname, '../../../scripts/scan-secrets.js');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(
      cleanFilePath,
      `export const API_URL = 'https://api.example.com';\nexport const MAX_RETRY = 3;\n`,
    );
  });

  afterAll(() => {
    if (fs.existsSync(cleanFilePath)) fs.unlinkSync(cleanFilePath);
    if (fs.existsSync(dirtyFilePath)) fs.unlinkSync(dirtyFilePath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  });

  it('passes cleanly when files contain no secrets', () => {
    expect(() => {
      execSync(`node "${scannerScript}" "${cleanFilePath}"`, {
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
  it('actively catches leaked fake secrets and halts with non-zero exit code', () => {
    // Write an artificial fake AWS secret key
    const prefix = 'AKIA';
    const rest = 'IOSFODNN7EXAMPLE';
    fs.writeFileSync(dirtyFilePath, `export const awsKey = "${prefix}${rest}";\n`);

    let caughtError: any = null;
    try {
      execSync(`node "${scannerScript}" "${dirtyFilePath}"`, {
        stdio: 'pipe',
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError.status).toBe(1);
    const stderr = caughtError.stderr.toString();
    expect(stderr).toContain('SECRET SCANNER DETECTED POTENTIAL SECRETS');
  });
});
