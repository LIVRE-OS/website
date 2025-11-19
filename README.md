# LIVRE OS
Sovereign Identity Operating System  
**Verify anything. Reveal nothing. Own everything.**

LIVRE OS is the first identity-native operating system: a modular, privacy-preserving foundation for digital identity, verification, and self-sovereign data control. This repository hosts the public marketing site plus the interactive MVP-1 demos.

**Live site:** https://livre-os.github.io/website/

---

## Overview

LIVRE OS replaces document sharing and personal data exposure with cryptographic proofs.

- No surveillance  
- No sensitive data retention  
- No centralized identity database  

Everything lives inside **Solivre**, the sovereign identity kernel. Applications receive yes/no answers through MPC / garbled circuits on **COTI gcEVM** instead of raw data.

This site introduces the vision, architecture, and components, and now links directly to the MVP-1 agent and verifier experience.

---

## MVP-1 Demo Surface

MVP-1 combines the static site with a minimal Fastify backend to illustrate the full flow:

- **Solivre Agent (`agent.html`)** - Create a synthetic identity, store birthdate/country attributes in the vault, and request the "age over 18 & resident in PT" proof.
- **Solivre Verifier (`verifier.html`)** - Paste the agent's proof bundle to call `/proof/verify`. The verifier recomputes the commitment against stored state to validate the claim without revealing attributes.

Together they demonstrate identity provisioning, vault updates, and selective disclosure end to end.

---

## Tech Stack

Marketing site:

- HTML5
- CSS3 custom theme (`styles.css`)
- Vanilla JavaScript (`script.js`, `assets/js/*`)
- Fully static deploy (no build tooling required)

Backend MVP (see `/src` in the repo root):

- Fastify + TypeScript
- Endpoints: `/identity`, `/vault/:id/attributes`, `/proof`, `/proof/verify`
- In-memory vault + deterministic proof hashing for demo purposes

---

## Structure

```
website/
|-- index.html            # Landing page
|-- architecture.html     # High-level OS architecture
|-- solivre.html          # Solivre identity kernel overview
|-- livreid.html          # LivreID naming layer
|-- vault.html            # LivreVault sovereign storage
|-- developers.html       # Developer-facing overview (LivreKit)
|-- roadmap.html          # Roadmap phases
|-- contact.html          # Contact & links
|-- solivre-wallet.html   # Wallet UI mock/demo (not in main nav)
|-- agent.html            # MVP-1 agent workflow
|-- verifier.html         # MVP-1 verifier workflow
|-- assets/
|   |-- css/styles.css
|   `-- js/
|       |-- agent.js
|       `-- verifier.js
`-- script.js             # Shared nav/highlight helpers
```

---

## Vision

Privacy should be the default, not the exception. LIVRE OS delivers sovereign control, cryptographic proofs, and composable identity infrastructure for the next generation of internet services. Welcome to LIVRE OS.
