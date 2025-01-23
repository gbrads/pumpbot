import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import clear from 'clear';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Clear the terminal screen
clear();

// Display welcome message
console.log(
    chalk.yellow(
        figlet.textSync('PUMP BOT', { horizontalLayout: 'full' })
    )
);

const questions = [
    {
        type: 'list',
        name: 'action',
        message: chalk.blue('What would you like to do?'),
        choices: [
            'Create Token',
            'Buy Tokens',
            'Sell Tokens',
            'Consolidate SOL',
            'Fund Wallets',
            'Exit'
        ],
        prefix: ''
    }
];

async function runScript(scriptName) {
    return new Promise((resolve, reject) => {
        const scriptPath = join(__dirname, `${scriptName}.js`);
        const child = spawn('node', [scriptPath], {
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Script exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    try {
        const { action } = await inquirer.prompt(questions);
        
        switch (action) {
            case 'Create Token':
                await runScript('createToken');
                break;
            case 'Buy Tokens':
                await runScript('buyBot');
                break;
            case 'Sell Tokens':
                await runScript('sellBot');
                break;
            case 'Consolidate SOL':
                await runScript('consolidate');
                break;
            case 'Fund Wallets':
                await runScript('fundWallets');
                break;
            case 'Exit':
                console.log(chalk.yellow('Goodbye! 👋'));
                process.exit(0);
        }
        
    } catch (error) {
        console.error(chalk.red('An error occurred:'), error);
    }
}

main(); 