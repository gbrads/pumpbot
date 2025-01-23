import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import dotenv from 'dotenv';
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
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
        figlet.textSync('BUY', { horizontalLayout: 'full' })
    )
);

function getQuestionMessage(questionText, answers) {
    clear();
    
    console.log(
        chalk.yellow(
            figlet.textSync('BUY', { horizontalLayout: 'full' })
        )
    );

    let summary = '\n';
    if (answers && Object.keys(answers).length > 0) {
        if (answers.tokenAddress) 
            summary += `${chalk.white('Token Address: ')}${chalk.green(answers.tokenAddress)}\n`;
        if (answers.amount) 
            summary += `${chalk.white('Amount: ')}${chalk.green(answers.amount)}\n`;
        if (answers.denominatedInSol !== undefined) 
            summary += `${chalk.white('Amount Type: ')}${chalk.green(answers.denominatedInSol ? 'SOL' : 'Tokens')}\n`;
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

async function executeBuyWithWallet(walletIndex, tokenAddress, walletInfo, baseParams) {
    try {
        const walletPrivateKey = process.env[`WALLET_${walletIndex + 1}_PRIVATE_KEY`];
        if (!walletPrivateKey) {
            console.log(chalk.yellow(`Skipping wallet ${walletIndex + 1} - No private key found`));
            return;
        }

        console.log(chalk.cyan(`\nExecuting buy with ${walletInfo.name} (${walletInfo.amount} SOL)...`));

        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "publicKey": Keypair.fromSecretKey(
                    bs58.decode(walletPrivateKey)
                ).publicKey.toBase58(),
                "action": "buy",
                "mint": tokenAddress,
                "denominatedInSol": "true",
                "amount": walletInfo.amount,
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

async function executeMultiWalletBuy(tokenAddress, baseParams) {
    console.log(chalk.yellow('\nStarting multi-wallet buy sequence...'));
    
    for (let i = 0; i < walletConfig.wallets.length; i++) {
        const wallet = walletConfig.wallets[i];
        
        // Random delay between buys
        if (i > 0) {
            const delay = getRandomDelay(walletConfig.delayRange.min, walletConfig.delayRange.max);
            console.log(chalk.gray(`Waiting ${delay}ms before next buy...`));
            await sleep(delay);
        }
        
        await executeBuyWithWallet(i, tokenAddress, wallet, baseParams);
    }
}

async function main() {
    try {
        const answers = await inquirer.prompt(questions);
        
        // Display configuration summary
        console.log('\n');
        console.log(chalk.cyan('=== Buy Configuration ==='));
        console.log(chalk.white('Token Address: ') + chalk.green(answers.tokenAddress));
        console.log(chalk.white('Number of Wallets: ') + chalk.green(walletConfig.wallets.length));
        console.log(chalk.white('Total SOL: ') + 
            chalk.green(walletConfig.wallets.reduce((sum, w) => sum + w.amount, 0)));
        console.log(chalk.white('Delay Range: ') + 
            chalk.green(`${walletConfig.delayRange.min}-${walletConfig.delayRange.max}ms`));
        
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow('Start buying with all wallets?'),
            default: false
        }]);

        if (confirm) {
            await executeMultiWalletBuy(answers.tokenAddress, {
                slippage: parseFloat(answers.slippage),
                priorityFee: parseFloat(answers.priorityFee)
            });
            console.log(chalk.green('\nMulti-wallet buy sequence completed! 🎉'));
        } else {
            console.log(chalk.yellow('Operation cancelled'));
        }
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 