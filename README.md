# GSTAX CLI Tools

A collection of Solana tools for token creation, multi-wallet management, and automated trading.

## Features

- 🪙 Token Creation with metadata and initial liquidity
- 👛 Multi-wallet generation and funding
- 💰 Automated buying across multiple wallets
- 💸 Automated selling across multiple wallets
- 🏦 SOL consolidation from all wallets
- 📝 Private key backup system

## Prerequisites

1. Node.js (v16 or higher)
2. npm (Node Package Manager)
3. A Solana RPC endpoint (Helius recommended)
4. A funding wallet with SOL

## Installation

1. Clone the repository:

bash
git clone <repository-url>
cd bundlebot


2. Install dependencies:

bash
npm install


3. Configure your environment:
   - Copy `.env.example` to `.env`
   - Add your RPC endpoint
   - Add your funding wallet private key
   - Add your base wallet address for consolidation
   - Add token creation wallets (WALLET_A and WALLET_B)

## Configuration Files

### .env
Contains all private keys and configuration:
- `PUMP_FUN_RPC`: Your Solana RPC endpoint
- `FUNDING_WALLET_PRIVATE_KEY`: Wallet used to fund new wallets
- `BASE_WALLET_ADDRESS`: Wallet to receive consolidated SOL
- `WALLET_A_PRIVATE_KEY`: Creator wallet for token launch
- `WALLET_B_PRIVATE_KEY`: Initial buyer wallet for token launch
- `WALLET_X_PRIVATE_KEY`: Generated wallet private keys

### wallets.json
Contains public information about your wallets:
- Wallet names
- Public keys
- Delay settings for transactions

### private_keys_backup.json
Maintains a historical record of all generated wallets with timestamps.

## Usage

Launch the CLI interface:

bash
npm start



### Available Commands

1. **Create Token**
   - Creates a new token with metadata
   - Uploads image to IPFS
   - Sets up initial liquidity
   - Required: Token image (PNG), social links, description

2. **Fund Wallets**
   - Generates new wallets
   - Saves private keys securely
   - Distributes SOL from funding wallet
   - Maintains backup of all wallet information

3. **Buy Tokens**
   - Multi-wallet token purchases
   - Randomized order execution
   - Configurable delays between transactions
   - Supports slippage and priority fees

4. **Sell Tokens**
   - Multi-wallet token selling
   - Fetches current token balances
   - Randomized execution order
   - Configurable percentage to sell

5. **Consolidate SOL**
   - Gathers SOL from all wallets
   - Sends to specified base wallet
   - Calculates optimal gas fees
   - Shows total amount consolidated

## Wallet Management

### Generating New Wallets
1. Select "Fund Wallets" from the main menu
2. Enter number of wallets to create
3. Specify SOL amount per wallet
4. Confirm the transaction

### Private Key Storage
- Private keys are stored in `.env` for active use
- Backup copy in `private_keys_backup.json`
- Each generation batch is timestamped
- Never delete `private_keys_backup.json`

## Transaction Settings

### Delay Configuration
Edit `wallets.json` to modify:
- `min`: Minimum delay between transactions (ms)
- `max`: Maximum delay between transactions (ms)

### Priority Fees
Configurable in each operation:
- Token creation: 0.0001 SOL default
- Buying: User specified
- Selling: User specified

## Security Recommendations

1. Keep your `.env` file secure and never share it
2. Backup `private_keys_backup.json` safely
3. Use different wallets for different purposes
4. Monitor wallet balances before operations
5. Test with small amounts first

## Error Handling

- Scripts include comprehensive error checking
- Failed transactions are logged
- Balance checks before operations
- RPC connection validation

## Support

For issues or questions:
1. Check the error messages
2. Verify your configuration
3. Ensure sufficient SOL balances
4. Contact support with specific error details

## License

ISC License# pumpbot
