# Security Policy

## Reporting a Vulnerability

The Leadforge team takes the security of our software and user data seriously. If you believe you have discovered a vulnerability, security flaw, or security-sensitive bug in Leadforge, please report it privately.

### Responsible Disclosure Channels

- **Email**: Send vulnerability reports directly to [security@example.com](mailto:security@example.com).
- **GitHub Private Vulnerability Reporting**: You can report vulnerabilities via the "Security" tab on our GitHub repository by clicking "Report a vulnerability".

Please do **not** disclose vulnerabilities via public GitHub issues, discussions, or pull requests until they have been reviewed and addressed.

### What to Include in Your Report

To help us triage and resolve issues quickly, please provide:

1. A clear description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
3. The affected component, file, endpoint, or environment.
4. Any potential mitigations or suggested fixes you have identified.

### Response Timelines

- **Initial Acknowledgment**: Within 48 hours of receipt.
- **Triage & Assessment**: Within 5 business days.
- **Patch Release & Advisory**: We coordinate patches and public disclosure in consultation with the reporter.

---

## Zero Default Credentials Policy

Leadforge ships with **NO default credentials, hardcoded passwords, or active secrets**.

- All credentials, API tokens, encryption keys, and connection strings must be generated independently per deployment.
- The `.env.example` file contains strictly dummy placeholders (e.g. `CHANGE_ME_...`).
- Running instances configured with default or placeholder secrets must never be used in staging or production environments.

---

## Key Rotation Procedure

When credentials or secrets need to be rotated (e.g., periodic rotation or incident response), follow this procedure:

### 1. Database Credentials (`DATABASE_URL`)

1. Create the new user credentials on the PostgreSQL server with appropriate least-privilege permissions.
2. Update the `DATABASE_URL` environment variable across running instances.
3. Perform a rolling restart of the application services.
4. Verify application connectivity and revoke previous credentials from the PostgreSQL server.

### 2. JWT Signing Secret (`JWT_SECRET`)

1. Rotating `JWT_SECRET` immediately invalidates active sessions unless a dual-secret / key-ring rotation strategy is employed.
2. Generate a new high-entropy string (minimum 32 bytes / 256 bits):
   ```bash
   openssl rand -hex 32
   ```
3. Update `JWT_SECRET` in application environment configurations.
4. Restart the API servers. Users will be required to authenticate again.

### 3. Data Encryption Key (`ENCRYPTION_KEY`)

1. The AES-256-GCM encryption key secures sensitive stored tokens (such as third-party OAuth access and refresh tokens).
2. Generate a new 32-byte hex-encoded key (64 hexadecimal characters):
   ```bash
   openssl rand -hex 32
   ```
3. When rotating an active encryption key, run the database re-encryption utility script to decrypt existing records with the existing key and re-encrypt with the new key prior to retiring the old key.

### 4. Third-Party API Keys (OpenAI, Gmail OAuth, WhatsApp, n8n, Razorpay)

1. Generate a new key/secret pair in the respective provider dashboard.
2. Update the environment variables in your deployment environment.
3. Deploy / restart services.
4. Confirm functionality through health checks and monitoring.
5. Revoke the old keys in the provider dashboard.
