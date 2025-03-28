# Voltr Client Scripts

A comprehensive toolkit for interacting with the Voltr Vault protocol on Solana. These scripts enable managing vaults with various DeFi strategies including Raydium concentrated liquidity positions.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Keypairs](#keypairs)
  - [Constants](#constants)
  - [Variables](#variables)
  - [Raydium Settings](#raydium-settings)
- [Usage Flows](#usage-flows)
  - [Standard Vault Flow](#standard-vault-flow)
    - [Initialize Vault (Admin)](#1-initialize-vault-admin)
    - [Update Vault (Admin)](#2-update-vault-admin)
    - [User Deposits](#3-user-deposits)
    - [User Withdrawals](#4-user-withdrawals)
    - [Admin Fee Harvesting](#5-admin-fee-harvesting)
  - [Raydium Concentrated Liquidity Flow](#raydium-concentrated-liquidity-flow)
    - [Creating Positions](#creating-positions)
    - [Increasing Liquidity](#increasing-liquidity)
    - [Decreasing Liquidity](#decreasing-liquidity)
- [Script Reference](#script-reference)
- [Monitoring & Querying](#monitoring--querying)
- [Protocol Integration Details](#protocol-integration-details)
- [Development](#development)

---

## Introduction

Voltr is a Solana-based DeFi protocol that provides a secure way to manage digital assets through vaults. These vaults can interact with various DeFi protocols to provide yield, liquidity, or other financial services. This repository contains client scripts for interacting with Voltr vaults and their strategies.

The codebase supports single integration path:

2. **AMM integrations** with Raydium concentrated liquidity positions

These scripts allow you to set up and manage a complete DeFi vault infrastructure from vault initialization to strategy management and user interactions.

---

## Prerequisites

1. **Node.js v18+**  
   Ensure you have Node.js version 18 or higher installed.

2. **pnpm**  
   This project uses pnpm for package management. Install it from [the pnpm website](https://pnpm.io/installation).

3. **Solana Keypairs**  
   You'll need separate Solana keypairs (in JSON format) for the following roles:

   - **Admin** - manages the vault configuration and protocols
   - **Manager** - handles strategy deposits and withdrawals
   - **User** - deposits assets and receives LP tokens

4. **Helius RPC URL**  
   A Helius RPC URL (or equivalent high-performance Solana RPC endpoint) is required for reliable transaction processing.

---

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-org/voltr-client-scripts.git
   cd voltr-client-scripts
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

---

## Configuration

### Keypairs

1. Create or obtain three keypair files and store them securely on your file system:

   - `/path/to/admin.json`
   - `/path/to/manager.json`
   - `/path/to/user.json`

2. **Important**: For security, never commit private key JSON files to version control. Keep them in a secure location.

### Constants

Protocol-specific constants are stored in the constants directory:

```
src/constants/
├── global.ts      # Oracle addresses, MIME types, program IDs
```

These files contain protocol-specific addresses on mainnet-beta. You should only modify them if you need to use a different network or custom addresses.

### Variables

The primary configuration is in `src/variables.ts`:

```typescript
// Required paths and connection information
export const adminFilePath = "/path/to/admin.json";
export const managerFilePath = "/path/to/manager.json";
export const userFilePath = "/path/to/user.json";
export const heliusRpcUrl = "https://your-helius-rpc-url";

// Vault-related constants
export const vaultAddress = "your-vault-address-after-initialization";
export const assetMintAddress = ORACLE.USDC.MINT; // Token being deposited
export const assetTokenProgram = ORACLE.USDC.PROGRAM_ID;

// Transaction optimization
export const useLookupTable = true;
export const lookupTableAddress = "your-lookup-table-after-creation";

// Amount constants (respect token decimals)
export const depositAssetAmountVault = 1_000_000; // 1 USDC (6 decimals)
export const withdrawAssetAmountVault = 500_000; // 0.5 USDC
export const withdrawLpAmountVault = 500_000_000; // LP tokens (9 decimals)
```

You must update these variables with your specific configuration before running scripts.

### Raydium Settings

For Raydium concentrated liquidity positions, additional settings are required:

```typescript
// Raydium CLMM pair configuration
export const outputMintAddress = ORACLE.USDS.MINT;
export const outputTokenProgram = ORACLE.USDS.PROGRAM_ID;
export const outputTokenOracle = ORACLE.USDS.PYTH_PULL_ORACLE;
export const poolId = "AS5MV3ear4NZPMWXbCsEz3AdbCaXEnq4ChdaWsvLgkcM";
export const startPrice = 0.99; // OUTPUT PER ASSET
export const endPrice = 1.01; // OUTPUT PER ASSET

// Jupiter swap settings for handling token conversions
export const JUP_SWAP_SLIPPAGE_BPS = 100;
export const JUP_SWAP_MAX_ACCOUNTS = 20;
```

---

## Usage Flows

### Standard Vault Flow

#### 1. Initialize Vault (Admin)

Creates a new vault and adds the Raydium adaptor to enable concentrated liquidity strategies:

```bash
pnpm ts-node src/scripts/admin-init-vault.ts
```

This outputs the vault's public key and lookup table address (if enabled). Update these in `variables.ts`.

#### 2. Update Vault (Admin)

Updates an existing vault's configuration:

```bash
pnpm ts-node src/scripts/admin-update-vault.ts
```

#### 3. User Deposits

Users deposit tokens into the vault and receive LP tokens:

```bash
pnpm ts-node src/scripts/user-deposit-vault.ts
```

#### 4. User Withdrawals

Users can withdraw from the vault in three ways:

**Request Withdrawal**

```bash
pnpm ts-node src/scripts/user-request-withdraw-vault.ts
```

**Process Withdrawal After Request**

```bash
pnpm ts-node src/scripts/user-withdraw-vault.ts
```

**Combined Request and Withdraw** (if withdrawal waiting period is 0)

```bash
pnpm ts-node src/scripts/user-request-and-withdraw-vault.ts
```

#### 5. Admin Fee Harvesting

Admins can collect protocol and performance fees:

```bash
pnpm ts-node src/scripts/admin-harvest-fee.ts
```

### Raydium Concentrated Liquidity Flow

#### Creating Positions

The manager creates a Raydium CLMM position:

```bash
pnpm ts-node src/scripts/manager-create-position.ts
```

#### Increasing Liquidity

The manager adds more liquidity to a position:

```bash
pnpm ts-node src/scripts/manager-increase-liquidity.ts
```

#### Decreasing Liquidity

The manager removes liquidity from a position:

```bash
pnpm ts-node src/scripts/manager-decrease-liquidity.ts
```

---

## Script Reference

### Admin Scripts

- **admin-init-vault.ts** - Initialize a new vault with admin/manager keys
- **admin-update-vault.ts** - Update an existing vault's configuration
- **admin-harvest-fee.ts** - Harvest performance and protocol fees

### Manager Scripts

- **manager-create-position.ts** - Create a new Raydium CLMM position
- **manager-increase-liquidity.ts** - Add liquidity to a Raydium position
- **manager-decrease-liquidity.ts** - Remove liquidity from a Raydium position

### User Scripts

- **user-deposit-vault.ts** - Deposit assets into the vault for LP tokens
- **user-withdraw-vault.ts** - Complete a withdrawal after the waiting period
- **user-request-and-withdraw-vault.ts** - Combine request and withdrawal (if period is 0)
- **user-query-position.ts** - Get user's LP amount and equivalent asset value

### Query Scripts

- **all-query-strategy-positions.ts** - Query positions across all strategies

---

## Monitoring & Querying

To monitor positions and vault status:

```bash
# Check all strategy positions and total value
pnpm ts-node src/scripts/all-query-strategy-positions.ts

# Check a specific user's position
pnpm ts-node src/scripts/user-query-position.ts
```

These scripts provide information about:

- Total vault value
- Strategy allocations
- User LP token amounts
- Equivalent asset values before/after fees

---

## Protocol Integration Details

### Raydium CLMM Integration

Supports creating and managing concentrated liquidity positions with:

- Precise price range specification
- Liquidity management (increase/decrease)
- Token swap via Jupiter for paired tokens
- Reward collecting

---

## Development

### Project Structure

```
src
├── constants/         # Protocol and global constants
├── utils/             # Helper functions and utilities
│   ├── marshmallow/   # Buffer layout utilities
│   ├── helper.ts      # Transaction and account helpers
│   └── raydium.ts     # Raydium-specific utilities
├── scripts/           # Executable scripts
└── variables.ts       # User configuration
```

### Required Dependencies

```bash
# Core dependencies
pnpm add @coral-xyz/anchor @solana/web3.js @solana/spl-token @voltr/vault-sdk

# Raydium support
pnpm add @raydium-io/raydium-sdk-v2 decimal.js bs58

# Development dependencies
pnpm add -D typescript ts-node @types/node
```

### Extending the Codebase

When adding new protocols or features:

1. Add protocol constants to a new file in `src/constants/`
2. Create helper utilities in `src/utils/` if needed
3. Create script files in `src/scripts/` following existing patterns
4. Update the relevant sections in `variables.ts`

---

For questions or support, please refer to the [Voltr documentation](https://docs.voltr.finance) or open an issue in this repository.
