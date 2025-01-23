import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import FormData from 'form-data';
import fs from 'fs';
import dotenv from 'dotenv';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

// Clear the terminal screen
clear();

// Display welcome message
console.log(
    chalk.yellow(
        figlet.textSync('CREATE', { horizontalLayout: 'full' })
    )
);

function getQuestionMessage(questionText, answers) {
    // Clear the terminal to keep it clean
    clear();
    
    // Show the banner again
    console.log(
        chalk.yellow(
            figlet.textSync('CREATE', { horizontalLayout: 'full' })
        )
    );

    let summary = '\n';  // Add initial newline for spacing
    if (answers && Object.keys(answers).length > 0) {
        // Show all previous answers with labels, without the inquirer markers
        if (answers.tokenName) 
            summary += `${chalk.white('Token Name: ')}${chalk.green(answers.tokenName)}\n`;
        if (answers.tokenSymbol) 
            summary += `${chalk.white('Token Symbol: ')}${chalk.green(answers.tokenSymbol)}\n`;
        if (answers.tokenDescription) 
            summary += `${chalk.white('Description: ')}${chalk.green(answers.tokenDescription)}\n`;
        if (answers.xLink) 
            summary += `${chalk.white('X (Twitter): ')}${chalk.green(answers.xLink)}\n`;
        if (answers.telegramLink) 
            summary += `${chalk.white('Telegram: ')}${chalk.green(answers.telegramLink)}\n`;
        if (answers.websiteLink) 
            summary += `${chalk.white('Website: ')}${chalk.green(answers.websiteLink)}\n`;
        if (answers.amount) 
            summary += `${chalk.white('Amount: ')}${chalk.green(answers.amount)}\n`;
    }
    return summary + chalk.green(questionText);
}

const questions = [
    {
        type: 'input',
        name: 'tokenName',
        message: (answers) => getQuestionMessage('Enter token name:', answers),
        validate: (input) => {
            if (input.length < 1) {
                return 'Token name cannot be empty';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'tokenSymbol',
        message: (answers) => getQuestionMessage('Enter token symbol:', answers),
        validate: (input) => {
            if (input.length < 1) {
                return 'Token symbol cannot be empty';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'tokenDescription',
        message: (answers) => getQuestionMessage('Enter token description:', answers),
        validate: (input) => {
            if (input.length < 1) {
                return 'Token description cannot be empty';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'xLink',
        message: (answers) => getQuestionMessage('Enter X (Twitter) link:', answers),
        validate: (input) => {
            if (!input.startsWith('https://')) {
                return 'Please enter a valid URL starting with https://';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'telegramLink',
        message: (answers) => getQuestionMessage('Enter Telegram link:', answers),
        validate: (input) => {
            if (!input.startsWith('https://')) {
                return 'Please enter a valid URL starting with https://';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'websiteLink',
        message: (answers) => getQuestionMessage('Enter Website link:', answers),
        validate: (input) => {
            if (!input.startsWith('https://')) {
                return 'Please enter a valid URL starting with https://';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'imagePath',
        message: (answers) => getQuestionMessage('Enter path to token image (PNG format):', answers),
        validate: (input) => {
            if (!fs.existsSync(input)) {
                return 'Image file does not exist';
            }
            if (!input.toLowerCase().endsWith('.png')) {
                return 'Please provide a PNG image file';
            }
            return true;
        },
        prefix: ''
    },
    {
        type: 'input',
        name: 'amount',
        message: (answers) => getQuestionMessage('Enter amount to buy (in tokens):', answers),
        validate: (input) => {
            if (isNaN(input) || parseFloat(input) <= 0) {
                return 'Please enter a valid amount greater than 0';
            }
            return true;
        },
        prefix: ''
    }
];

const updatedQuestions = questions.map(question => ({
    ...question,
    prefix: ''
}));

async function createTokenBundle(tokenData) {
    try {
        console.log(chalk.yellow('\nPreparing to create token...'));

        // Create signers from private keys in .env
        const signerKeyPairs = [
            Keypair.fromSecretKey(bs58.decode(process.env.WALLET_A_PRIVATE_KEY)),
            Keypair.fromSecretKey(bs58.decode(process.env.WALLET_B_PRIVATE_KEY))
        ];

        const mintKeypair = Keypair.generate();

        // Prepare metadata
        let formData = new FormData();
        formData.append("file", await fs.openAsBlob(tokenData.imagePath));
        formData.append("name", tokenData.tokenName);
        formData.append("symbol", tokenData.tokenSymbol);
        formData.append("description", tokenData.tokenDescription);
        formData.append("twitter", tokenData.xLink);
        formData.append("telegram", tokenData.telegramLink);
        formData.append("website", tokenData.websiteLink);
        formData.append("showName", "true");

        console.log(chalk.yellow('Uploading metadata to IPFS...'));
        
        const metadataResponse = await fetch("https://pump.fun/api/ipfs", {
            method: "POST",
            body: formData,
        });
        
        const metadataResponseJSON = await metadataResponse.json();

        // Prepare bundle transactions
        const bundledTxArgs = [
            {
                "publicKey": signerKeyPairs[0].publicKey.toBase58(),
                "action": "create",
                "tokenMetadata": {
                    name: tokenData.tokenName,
                    symbol: tokenData.tokenSymbol,
                    uri: metadataResponseJSON.metadataUri
                },
                "mint": mintKeypair.publicKey.toBase58(),
                "denominatedInSol": "false",
                "amount": tokenData.amount,
                "slippage": 10,
                "priorityFee": 0.0001,
                "pool": "pump"
            },
            {
                publicKey: signerKeyPairs[1].publicKey.toBase58(),
                "action": "buy",
                "mint": mintKeypair.publicKey.toBase58(),
                "denominatedInSol": "false",
                "amount": tokenData.amount,
                "slippage": 10,
                "priorityFee": 0.00005,
                "pool": "pump"
            }
        ];

        console.log(chalk.yellow('Generating transactions...'));

        const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bundledTxArgs)
        });

        if (response.status === 200) {
            const transactions = await response.json();
            let encodedSignedTransactions = [];
            let signatures = [];

            console.log(chalk.yellow('Signing transactions...'));

            for (let i = 0; i < bundledTxArgs.length; i++) {
                const tx = VersionedTransaction.deserialize(new Uint8Array(bs58.decode(transactions[i])));
                if (bundledTxArgs[i].action === "create") {
                    tx.sign([mintKeypair, signerKeyPairs[i]]);
                } else {
                    tx.sign([signerKeyPairs[i]]);
                }
                encodedSignedTransactions.push(bs58.encode(tx.serialize()));
                signatures.push(bs58.encode(tx.signatures[0]));
            }

            console.log(chalk.yellow('Submitting bundle to Jito...'));

            const jitoResponse = await fetch(`https://mainnet.block-engine.jito.wtf/api/v1/bundles`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "sendBundle",
                    "params": [encodedSignedTransactions]
                })
            });

            console.log(chalk.green('\nToken created successfully! 🎉'));
            console.log(chalk.cyan('\n=== Transaction Details ==='));
            for (let i = 0; i < signatures.length; i++) {
                console.log(chalk.white(`Transaction ${i}: `) + 
                    chalk.cyan(`https://solscan.io/tx/${signatures[i]}`));
            }

            return { signatures, mintAddress: mintKeypair.publicKey.toBase58() };
        } else {
            throw new Error(`Failed to generate transactions: ${response.statusText}`);
        }
    } catch (error) {
        console.error(chalk.red('Error creating token:'), error);
        throw error;
    }
}

async function main() {
    try {
        const answers = await inquirer.prompt(updatedQuestions);
        
        // Display the collected information
        console.log('\n');
        console.log(chalk.cyan('=== Token Information ==='));
        console.log(chalk.white('Token Name: ') + chalk.green(answers.tokenName));
        console.log(chalk.white('Token Symbol: ') + chalk.green(answers.tokenSymbol));
        console.log(chalk.white('Description: ') + chalk.green(answers.tokenDescription));
        console.log(chalk.white('X (Twitter): ') + chalk.green(answers.xLink));
        console.log(chalk.white('Telegram: ') + chalk.green(answers.telegramLink));
        console.log(chalk.white('Website: ') + chalk.green(answers.websiteLink));
        console.log(chalk.white('Amount: ') + chalk.green(answers.amount));
        
        // Create the token
        await createTokenBundle(answers);
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 