import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import dotenv from 'dotenv';
import { VersionedTransaction, Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import walletConfig from './config/wallets.json' assert { type: "json" };
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

dotenv.config();

const RPC_ENDPOINT = process.env.PUMP_FUN_RPC;
const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Clear the terminal screen
clear();

// Display welcome message
console.log(
    chalk.yellow(
        figlet.textSync('SELL', { horizontalLayout: 'full' })
    )
);

function getQuestionMessage(questionText, answers) {
    clear();
    
    console.log(
        chalk.yellow(
            figlet.textSync('SELL', { horizontalLayout: 'full' })
        )
    );

    let summary = '\n';
    if (answers && Object.keys(answers).length > 0) {
        if (answers.tokenAddress) 
            summary += `${chalk.white('Token Address: ')}${chalk.green(answers.tokenAddress)}\n`;
        if (answers.percentToSell) 
            summary += `${chalk.white('Percent to Sell: ')}${chalk.green(answers.percentToSell)}%\n`;
        if (answers.slippage) 
            summary += `${chalk.white('Slippage: ')}${chalk.green(answers.slippage)}%\n`;
        if (answers.priorityFee) 
            summary += `${chalk.white('Priority Fee: ')}${chalk.green(answers.priorityFee)} SOL\n`;
    }
    return summary + chalk.green(questionText);
}

const questions = [
    {
        type: 'input',
        name: 'tokenAddress',
        message: (answers) => getQuestionMessage('Enter token address:', answers),
        validate: (input) => {
            if (input.length !== 44) {
                return 'Please enter a valid Solana token address';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'percentToSell',
        message: (answers) => getQuestionMessage('Enter percentage of tokens to sell (1-100):', answers),
        default: '100',
        validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num) || num < 1 || num > 100) {
                return 'Please enter a number between 1 and 100';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'slippage',
        message: (answers) => getQuestionMessage('Enter slippage percentage (1-100):', answers),
        default: '10',
        validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num) || num < 1 || num > 100) {
                return 'Please enter a number between 1 and 100';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'priorityFee',
        message: (answers) => getQuestionMessage('Enter priority fee in SOL:', answers),
        default: '0.00001',
        validate: (input) => {
            if (isNaN(input) || parseFloat(input) <= 0) {
                return 'Please enter a valid number greater than 0';
            }
            return true;
        },
        prefix: ''
    }
];

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeSellWithWallet(walletIndex, tokenAddress, walletInfo, baseParams) {
    try {
        const walletPrivateKey = process.env[`WALLET_${walletIndex + 1}_PRIVATE_KEY`];
        if (!walletPrivateKey) {
            console.log(chalk.yellow(`Skipping wallet ${walletIndex + 1} - No private key found`));
            return;
        }

        console.log(chalk.cyan(`\nExecuting sell with ${walletInfo.name}...`));

        // Get wallet's token balance using web3.js
        const walletKeypair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
        const walletPublicKey = walletKeypair.publicKey;

        // Find token account
        const tokenAccounts = await web3Connection.getParsedTokenAccountsByOwner(
            walletPublicKey,
            { mint: new PublicKey(tokenAddress) }
        );

        if (tokenAccounts.value.length === 0) {
            console.log(chalk.yellow(`No token balance found for ${walletInfo.name}`));
            return;
        }

        const tokenBalance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        console.log(chalk.white('Current Balance: ') + chalk.green(tokenBalance));

        const amountToSell = baseParams.percentToSell === 100 ? 
            tokenBalance : 
            (tokenBalance * baseParams.percentToSell / 100);

        if (amountToSell <= 0) {
            console.log(chalk.yellow(`Insufficient balance for ${walletInfo.name}`));
            return;
        }

        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": walletPublicKey.toBase58(),
                "action": "sell",
                "mint": tokenAddress,
                "denominatedInSol": "false",
                "amount": amountToSell,
                "slippage": baseParams.slippage,
                "priorityFee": baseParams.priorityFee,
                "pool": "pump"
            })
        });

        if (response.status === 200) {
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));
            const signerKeyPair = Keypair.fromSecretKey(bs58.decode(walletPrivateKey));
            
            tx.sign([signerKeyPair]);
            const signature = await web3Connection.sendTransaction(tx);
            
            console.log(chalk.green(`Success! ${walletInfo.name}`));
            console.log(chalk.white('Transaction: ') + 
                chalk.cyan(`https://solscan.io/tx/${signature}`));
            
            return signature;
        }
    } catch (error) {
        console.error(chalk.red(`Error with ${walletInfo.name}:`), error.message);
    }
}

async function executeMultiWalletSell(tokenAddress, baseParams) {
    console.log(chalk.yellow('\nStarting multi-wallet sell sequence...'));
    
    // Randomize wallet order for selling
    const shuffledWallets = [...walletConfig.wallets]
        .sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffledWallets.length; i++) {
        const wallet = shuffledWallets[i];
        
        // Random delay between sells
        if (i > 0) {
            const delay = getRandomDelay(walletConfig.delayRange.min, walletConfig.delayRange.max);
            console.log(chalk.gray(`Waiting ${delay}ms before next sell...`));
            await sleep(delay);
        }
        
        await executeSellWithWallet(
            walletConfig.wallets.findIndex(w => w.name === wallet.name), 
            tokenAddress, 
            wallet, 
            baseParams
        );
    }
}

async function main() {
    try {
        const answers = await inquirer.prompt(questions);
        
        // Display configuration summary
        console.log('\n');
        console.log(chalk.cyan('=== Sell Configuration ==='));
        console.log(chalk.white('Token Address: ') + chalk.green(answers.tokenAddress));
        console.log(chalk.white('Number of Wallets: ') + chalk.green(walletConfig.wallets.length));
        console.log(chalk.white('Percent to Sell: ') + chalk.green(`${answers.percentToSell}%`));
        console.log(chalk.white('Delay Range: ') + 
            chalk.green(`${walletConfig.delayRange.min}-${walletConfig.delayRange.max}ms`));
        
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow('Start selling with all wallets?'),
            default: false
        }]);

        if (confirm) {
            await executeMultiWalletSell(answers.tokenAddress, {
                percentToSell: parseFloat(answers.percentToSell),
                slippage: parseFloat(answers.slippage),
                priorityFee: parseFloat(answers.priorityFee)
            });
            console.log(chalk.green('\nMulti-wallet sell sequence completed! 🎉'));
        } else {
            console.log(chalk.yellow('Operation cancelled'));
        }
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 