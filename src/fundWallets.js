import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const RPC_ENDPOINT = process.env.PUMP_FUN_RPC;
const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Clear the terminal screen
clear();

// Display welcome message
console.log(
    chalk.yellow(
        figlet.textSync('FUND', { horizontalLayout: 'full' })
    )
);

const questions = [
    {
        type: 'input',
        name: 'numberOfWallets',
        message: (answers) => getQuestionMessage('How many wallets do you want to create?', answers),
        validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1) {
                return 'Please enter a valid number greater than 0';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'solPerWallet',
        message: (answers) => getQuestionMessage('How much SOL per wallet?', answers),
        validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num) || num <= 0) {
                return 'Please enter a valid amount greater than 0';
            }
            return true;
        },
        prefix: ''
    }
];

function getQuestionMessage(questionText, answers) {
    clear();
    
    console.log(
        chalk.yellow(
            figlet.textSync('FUND', { horizontalLayout: 'full' })
        )
    );

    let summary = '\n';
    if (answers.numberOfWallets) {
        summary += `${chalk.white('Number of Wallets: ')}${chalk.green(answers.numberOfWallets)}\n`;
    }
    if (answers.solPerWallet) {
        summary += `${chalk.white('SOL per Wallet: ')}${chalk.green(answers.solPerWallet)}\n`;
    }
    return summary + '\n' + chalk.green(questionText);
}

async function generateAndSaveWallets(numberOfWallets) {
    const wallets = [];
    const privateKeys = {};
    
    for (let i = 0; i < numberOfWallets; i++) {
        const wallet = Keypair.generate();
        wallets.push({
            name: `Wallet ${i + 1}`,
            publicKey: wallet.publicKey.toString(),
            amount: 0
        });
        privateKeys[`WALLET_${i + 1}_PRIVATE_KEY`] = bs58.encode(wallet.secretKey);
    }

    // Save wallet config (this still overwrites as we only want current wallets here)
    const configPath = join(__dirname, 'config', 'wallets.json');
    fs.writeFileSync(configPath, JSON.stringify({
        wallets,
        delayRange: {
            min: 100,
            max: 1000
        }
    }, null, 2));

    // Load and merge with existing private keys backup
    const backupPath = join(__dirname, 'config', 'private_keys_backup.json');
    let existingPrivateKeys = {};
    
    try {
        if (fs.existsSync(backupPath)) {
            existingPrivateKeys = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        }
    } catch (error) {
        console.log(chalk.yellow('No existing private keys backup found, creating new one.'));
    }

    // Generate timestamp for this batch
    const timestamp = new Date().toISOString();
    
    // Add new batch to existing keys with timestamp
    existingPrivateKeys[timestamp] = {
        ...privateKeys,
        walletPublicKeys: wallets.map(w => w.publicKey)  // Also store public keys for reference
    };

    // Save updated backup
    fs.writeFileSync(backupPath, JSON.stringify(existingPrivateKeys, null, 2));

    // Update .env file
    let envContent = fs.readFileSync('.env', 'utf8');
    Object.entries(privateKeys).forEach(([key, value]) => {
        const regex = new RegExp(`${key}=.*`);
        if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${key}=${value}`);
        } else {
            envContent += `\n${key}=${value}`;
        }
    });
    fs.writeFileSync('.env', envContent);

    return { wallets, privateKeys };
}

async function fundWallet(sourceKeypair, destinationPublicKey, amount) {
    try {
        const transaction = new Transaction();
        
        transaction.add(
            SystemProgram.transfer({
                fromPubkey: sourceKeypair.publicKey,
                toPubkey: new PublicKey(destinationPublicKey),
                lamports: Math.floor(amount * LAMPORTS_PER_SOL)
            })
        );

        const signature = await web3Connection.sendTransaction(transaction, [sourceKeypair]);
        return signature;
    } catch (error) {
        throw error;
    }
}

async function main() {
    try {
        if (!process.env.FUNDING_WALLET_PRIVATE_KEY) {
            console.error(chalk.red('FUNDING_WALLET_PRIVATE_KEY not found in .env file'));
            return;
        }

        const answers = await inquirer.prompt(questions);
        
        // Generate new wallets
        console.log(chalk.yellow('\nGenerating wallets...'));
        const { wallets } = await generateAndSaveWallets(parseInt(answers.numberOfWallets));
        console.log(chalk.green('Wallets generated and saved!'));

        // Fund the wallets
        console.log(chalk.yellow('\nStarting funding process...'));
        const fundingWallet = Keypair.fromSecretKey(
            bs58.decode(process.env.FUNDING_WALLET_PRIVATE_KEY)
        );

        let totalFunded = 0;
        for (const wallet of wallets) {
            try {
                console.log(chalk.cyan(`\nFunding ${wallet.name}...`));
                const signature = await fundWallet(
                    fundingWallet, 
                    wallet.publicKey, 
                    parseFloat(answers.solPerWallet)
                );
                
                console.log(chalk.green('Transfer successful!'));
                console.log(chalk.white('Amount: ') + chalk.green(`${answers.solPerWallet} SOL`));
                console.log(chalk.white('Transaction: ') + 
                    chalk.cyan(`https://solscan.io/tx/${signature}`));
                
                totalFunded += parseFloat(answers.solPerWallet);
            } catch (error) {
                console.error(chalk.red(`Error funding ${wallet.name}:`), error.message);
            }
        }

        console.log(chalk.green('\nFunding completed! 🎉'));
        console.log(chalk.white('Total SOL distributed: ') + chalk.green(`${totalFunded.toFixed(4)} SOL`));
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 