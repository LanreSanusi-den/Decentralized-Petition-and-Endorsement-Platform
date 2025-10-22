# AuthenticSupport: Decentralized Petition and Endorsement Platform

## Overview

AuthenticSupport is a Web3 project built on the Stacks blockchain using Clarity smart contracts. The core idea revolves around "signature verifications against fabricated support," addressing real-world problems like fake signatures in petitions, endorsements, or support campaigns. In traditional systems, petitions can be manipulated with fabricated signatures, bots, or duplicates, leading to misinformation, fraudulent fundraising, or skewed public opinion. This project leverages blockchain for transparent, verifiable, and tamper-proof support verification.

### Real-World Problems Solved
- **Fake Petitions and Endorsements**: Prevents fabrication by requiring cryptographic signatures from wallet addresses, ensuring each supporter is unique and verifiable.
- **Sybil Attacks in Governance**: In DAOs or community decisions, it verifies genuine support without multiple fake accounts.
- **Transparent Fundraising**: For causes like charity or political campaigns, donors/supporters can be verified on-chain, building trust.
- **Election Integrity**: Could extend to decentralized voting where support (e.g., nominations) is authenticated.
- **Review and Feedback Systems**: Applies to product endorsements or reviews, reducing fake positive/negative support.

The platform allows users to create petitions, gather support via wallet signatures, verify them against fabrication (e.g., duplicates, invalid signatures), and trigger actions like fund releases upon reaching verifiable thresholds.

### Key Features
- **Cryptographic Verification**: Uses ECDSA or similar for signature validation.
- **Decentralized Storage**: Petition data and signatures stored on-chain for immutability.
- **Threshold-Based Actions**: Automatically execute outcomes (e.g., mint NFTs for supporters, transfer funds) when verified support meets criteria.
- **User Privacy**: Supports anonymous yet verifiable signatures (e.g., via zero-knowledge proofs if integrated).
- **Integration with Stacks**: Leverages Bitcoin-anchored security for finality.

## Architecture

The project consists of 6 core Clarity smart contracts that interact to form a robust system. Clarity's decidable nature ensures safety and predictability, preventing common vulnerabilities like reentrancy.

1. **UserRegistry.clar**: Manages user registrations and basic verification (e.g., linking wallet to a unique ID). Prevents sybil attacks by requiring a small STX deposit or proof-of-humanity integration.
   
2. **PetitionFactory.clar**: Factory contract for deploying new petitions. It creates instances of Petition contracts and tracks all active petitions.

3. **Petition.clar**: Core contract for individual petitions. Handles creation, description storage, support thresholds, and signature collection. Verifies signatures against fabricated entries (e.g., checks for duplicates, valid timestamps).

4. **SignatureVerifier.clar**: Dedicated to cryptographic verification. Implements signature checks (e.g., recover public key from signature) and anti-fabrication logic like nonce validation and replay protection.

5. **SupportTracker.clar**: Aggregates and tallies verified supports across petitions. Includes functions for querying total unique supporters and preventing cross-petition fabrication.

6. **ActionExecutor.clar**: Triggers on-chain actions based on verified support levels, such as transferring STX, minting tokens, or emitting events for off-chain integrations.

### Contract Interactions
- Users register via `UserRegistry`.
- Creators deploy petitions through `PetitionFactory`, which instantiates `Petition`.
- Supporters submit signatures to `Petition`, verified by `SignatureVerifier`.
- `SupportTracker` updates tallies.
- When thresholds are met, `ActionExecutor` handles outcomes.

## Installation and Setup

### Prerequisites
- Stacks Wallet (e.g., Hiro Wallet)
- Clarity development environment (e.g., Clarinet CLI)
- Node.js for any frontend integrations (optional)

### Steps
1. Clone the repository:
   ```
   <this-repo>
   cd authenticsupport
   ```

2. Install Clarinet:
   ```
   curl -L https://clarinet.stacks.co/install | sh
   ```

3. Initialize the project:
   ```
   clarinet new authenticsupport
   ```
   (Or use the provided contracts in `/contracts`.)

4. Deploy to Devnet:
   ```
   clarinet integrate
   ```
   Test interactions in the Clarinet console.

5. For production, use Stacks mainnet deployment tools.

## Usage

### Creating a Petition
- Call `PetitionFactory.create-petition` with parameters like title, description, target-support, and deadline.
- Example Clarity call:
  ```
  (contract-call? .petition-factory create-petition "Save the Oceans" "Petition to ban plastic waste" u1000 u1728000000) ;; 1000 signatures, deadline in microstacks timestamp
  ```

### Signing a Petition
- Users sign a message (e.g., "I support petition ID X") off-chain and submit the signature to `Petition.add-signature`.
- Verification happens via `SignatureVerifier.verify-signature`.

### Verifying Support
- Query `SupportTracker.get-verified-count` for a petition ID to see unique, non-fabricated supports.

## Testing

Run unit tests with Clarinet:
```
clarinet test
```

Tests cover:
- Signature fabrication attempts (e.g., replay attacks).
- Threshold triggers.
- Edge cases like expired petitions.

## Security Considerations
- Clarity's lack of loops prevents infinite gas issues.
- All contracts are read-only where possible.
- Audit recommended before mainnet deployment.
- Anti-fabrication: Uses nonces, timestamps, and address uniqueness.

## Roadmap
- Integrate with IPFS for off-chain data storage.
- Add ZK-SNARKs for private verifications.
- Frontend dApp for user-friendly interactions.
- Expand to NFT-based rewards for verified supporters.

## Contributing
Fork the repo, create a branch, and submit a PR. Follow Clarity best practices.

## License
MIT License. See LICENSE file for details.