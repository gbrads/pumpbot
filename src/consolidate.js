import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import walletConfig from './config/wallets.json' assert { type: "json" };

dotenv.config();

const RPC_ENDPOINT = process.env.PUMP_FUN_RPC;
const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Clear the terminal screen
clear();

// Display welcome message
console.log(
    chalk.yellow(
        figlet.textSync('MERGE', { horizontalLayout: 'full' })
    )
);

async function getWalletBalance(publicKey) {
    try {
        const balance = await web3Connection.getBalance(publicKey);
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error(chalk.red(`Error fetching balance: ${error.message}`));
        return 0;
    }
}

async function consolidateWallet(walletIndex, baseWalletPublicKey) {
    try {
        const walletPrivateKey = process.env[`WALLET_${walletIndex + 1}_PRIVATE_KEY`];
        if (!walletPrivateKey) {
            console.log(chalk.yellow(`Skipping wallet ${walletIndex + 1} - No private key found`));
            return 0;
        }

        const walletKeypair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
        const balance = await getWalletBalance(walletKeypair.publicKey);

        if (balance <= 0) {  // Only skip if completely empty
            console.log(chalk.yellow(`Skipping wallet ${walletIndex + 1} - No balance`));
            return 0;
        }

        console.log(chalk.cyan(`\nProcessing Wallet ${walletIndex + 1}`));
        console.log(chalk.white('Address: ') + chalk.green(walletKeypair.publicKey.toString()));
        console.log(chalk.white('Balance: ') + chalk.green(`${balance} SOL`));

        // Create transaction to send entire balance
        const transaction = new Transaction();
        
        // Get recent blockhash for transaction
        const { blockhash } = await web3Connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = walletKeypair.publicKey;

        // Calculate exact fee
        const fee = await web3Connection.getFeeForMessage(
            transaction.compileMessage(),
            'confirmed'
        );

        // Add transfer instruction for remaining balance after fee
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: walletKeypair.publicKey,
                toPubkey: baseWalletPublicKey,
                lamports: balance * LAMPORTS_PER_SOL - fee
            })
        );

        const signature = await web3Connection.sendTransaction(transaction, [walletKeypair]);
        
        console.log(chalk.green('Transfer successful!'));
        console.log(chalk.white('Amount: ') + chalk.green(`${(balance * LAMPORTS_PER_SOL - fee) / LAMPORTS_PER_SOL} SOL`));
        console.log(chalk.white('Transaction: ') + chalk.cyan(`https://solscan.io/tx/${signature}`));

        return (balance * LAMPORTS_PER_SOL - fee) / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error(chalk.red(`Error consolidating wallet ${walletIndex + 1}:`), error.message);
        return 0;
    }
}

const questions = [
    {
        type: 'confirm',
        name: 'confirm',
        message: (answers) => getQuestionMessage('Are you sure you want to consolidate SOL from all wallets?', answers),
        default: false,
        prefix: ''
    }
];

function getQuestionMessage(questionText, answers) {
    clear();
    
    console.log(
        chalk.yellow(
            figlet.textSync('MERGE', { horizontalLayout: 'full' })
        )
    );

    let summary = '\n';
    if (process.env.BASE_WALLET_ADDRESS) {
        summary += `${chalk.white('Base Wallet: ')}${chalk.green(process.env.BASE_WALLET_ADDRESS)}\n`;
        summary += `${chalk.white('Number of Wallets: ')}${chalk.green(walletConfig.wallets.length)}\n`;
    }
    return summary + '\n' + chalk.green(questionText);
}

async function main() {
    try {
        if (!process.env.BASE_WALLET_ADDRESS) {
            console.error(chalk.red('BASE_WALLET_ADDRESS not found in .env file'));
            return;
        }

        // Validate base wallet address format
        try {
            const baseWalletPublicKey = new PublicKey(process.env.BASE_WALLET_ADDRESS);
        } catch (error) {
            console.error(chalk.red('Invalid BASE_WALLET_ADDRESS in .env file. Please provide a valid Solana address.'));
            return;
        }

        const answers = await inquirer.prompt(questions);
        
        if (answers.confirm) {
            console.log(chalk.yellow('\nStarting consolidation process...'));
            let totalConsolidated = 0;

            for (let i = 0; i < walletConfig.wallets.length; i++) {
                const amountSent = await consolidateWallet(i, baseWalletPublicKey);
                totalConsolidated += amountSent;
            }

            console.log(chalk.green('\nConsolidation completed! 🎉'));
            console.log(chalk.white('Total SOL consolidated: ') + chalk.green(`${totalConsolidated.toFixed(4)} SOL`));
        } else {
            console.log(chalk.yellow('Operation cancelled'));
        }
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 