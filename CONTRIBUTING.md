# Contributing to Leadforge

Thank you for your interest in contributing to Leadforge! We welcome contributions, bug reports, and pull requests from the community.

## Code of Conduct

All contributors are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

1. **Prerequisites**:
   - Node.js >= 20.0.0
   - pnpm >= 9.15.4

2. **Setup**:
   - Fork the repository on GitHub.
   - Clone your fork locally:
     ```bash
     git clone https://github.com/<your-username>/leadforge.git
     cd leadforge
     ```
   - Install dependencies:
     ```bash
     pnpm install
     ```
   - Copy `.env.example` to `.env` for local testing (never commit `.env` files):
     ```bash
     cp .env.example .env
     ```

## Development Workflow

1. **Branching**:
   - Create a feature or bugfix branch off `main`:
     ```bash
     git checkout -b feat/feature-name
     # or
     git checkout -b fix/issue-description
     ```

2. **Code Standards**:
   - TypeScript strict mode is enabled across the entire codebase. Do not disable strict checks or bypass compiler warnings.
   - Adhere to the design system and editorial principles described in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).
   - Ensure your code is formatted with Prettier and passes all linting:
     ```bash
     pnpm format
     pnpm lint
     pnpm typecheck
     ```

3. **Testing**:
   - All tests must pass before submitting a pull request:
     ```bash
     pnpm test
     ```

4. **Security & Secrets**:
   - **Never commit real credentials, keys, passwords, or secrets.**
   - All commits are scanned for secrets. If secrets are detected, the commit will be rejected.
   - Only `.env.example` with dummy values may be checked into version control.

## Submitting a Pull Request (PR)

1. Push your branch to your fork on GitHub.
2. Open a Pull Request against the `main` branch of the official Leadforge repository.
3. Complete the PR description template, including the motivation for changes and any linked issues.
4. Ensure all continuous integration (CI) status checks pass.
5. Reviewers will examine the code and may request changes before merging.

## Licensing

Leadforge is released under the [MIT License](LICENSE). By submitting a pull request or contributing code to this repository, you agree that your contributions will be licensed under the MIT License.
