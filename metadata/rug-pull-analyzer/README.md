# 🧪 Uniswap V2 Liquidity Pool Analyzer

This python script is designed for free version of Compute-to-Data feature from Ocean Protocol.
It aims fetching and analyzing the token pairs characteristics using **Uniswap V2** smart contracts
on **Base chain**.
It inspects various characteristics of the tokens involved in each pair and prints key risk and health
indicators. The results are saved into a PDF report (`report.pdf`) titled "Uniswap V2 Pair Characteristics".

## 🔍 What the Script Does

1. Connects to the Base chain via an RPC endpoint.
2. Interacts with the Uniswap V2 Factory contract.
3. Based on the input token address, it finds the corresponding pair backed up by WETH or USDC.
4. For each pair, it fetches:

   - Pair address
   - Token details (name, symbol, addresses)
   - Liquidity status
   - Ownership and minting capabilities
   - Self-destruct vulnerability
   - Market cap
   - Token age
   - 24h trading volume

5. Prints results to console and generates a clean PDF report.

## 📊 Parameters Analyzed Per Token or Pair

| Parameter                   |                                                       Description                                                        |
| --------------------------- | :----------------------------------------------------------------------------------------------------------------------: |
| `Token Name / Symbol `      |                                            Identity of the token in the pair.                                            |
| `Total Supply of LP Tokens` |                                          How many LP tokens exist for the pair.                                          |
| `Liquidity Status`          | Based on what percentage of the token's supply is locked in reserves: `LOCKED`, `PARTIALLY LOCKED`, or `FULLY UNLOCKED`. |
| `Market Cap`                |                                       Estimated based on liquidity pool reserves.                                        |
| `Minting Ability`           |                                 Can new tokens be minted? `MINTABLE` or `NOT MINTABLE`.                                  |
| `Total Supply Status`       |                               If minting is disabled, it's `FIXED`; otherwise `NOT FIXED`.                               |
| `Ownership Status`          |                     Checks if the contract has renounced ownership (`RENOUNCED` or `NOT RENOUNCED`).                     |
| `Token Age`                 |                                       Number of days since the token was deployed.                                       |
| `Self-Destruct`             |                     Check Indicates if a selfdestruct opcode exists in the bytecode. (`YES` or `NO`)                     |
| `24h Volume Total`          |                                   Total amount of tokens swapped in the last 24 hours.                                   |

## 📁 Output

- Console output with all parameters per pair.
- A PDF report saved as `report.pdf` with all printed logs.
- Title: `"Uniswap V2 Pair Characteristics"`

## 🚀 Requirements

- Python 3.8+
- web3.py
- reportlab
- Base chain RPC (e.g., `https://mainnet.base.org`)

### 1. Install dependencies within a new Dockerfile:

```bash
pip install web3 reportlab
```

### 2. Use existing docker image `oceanprotocol/c2d_examples:py-general`:

For running the algorithm seamlessly, use our already-built docker image within the VS Code extension:

- Docker image: `oceanprotocol/c2d_examples`
- Docker tag: `py-general`

## 🔐 Disclaimer

This tool is for research and educational purposes. It does not constitute financial advice or a complete risk assessment. Always do your own research before interacting with DeFi protocols.
