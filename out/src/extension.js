"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const rest_1 = require("@octokit/rest");
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const yaml = __importStar(require("js-yaml"));
const child_process_1 = require("child_process");
const jsdom_1 = require("jsdom");
// Load environment variables from .env file
dotenv.config();
const PARTICIPANT_ID = 'ai-ops';
const LANGUAGE_MODEL_ID = 'copilot-gpt-3.5-turbo';
function activate(context) {
    //for status button to open browser.
    context.subscriptions.push(vscode.commands.registerCommand('extension.openUrl', async (url) => {
        vscode.env.openExternal(vscode.Uri.parse(url));
    }));
    const handler = async (request, context, stream, token) => {
        const envs = vscode.workspace.getConfiguration('environments');
        const GHAPIKey = envs.get('token') ?? '';
        const octokit = new rest_1.Octokit({
            auth: GHAPIKey,
        });
        const GHRepo = envs.get('repo') ?? '';
        const GHOrg = envs.get('org') ?? '';
        if (request.command == 'scan') {
            console.log('Running SAST Scan');
            console.log("STREAM", stream);
            stream.progress('Kicking off your SAST scan on branch X...');
            //kickoff SAST scan.
            // Return status of workflow
            // update window when complete..
            return { metadata: { command: 'scan' } };
        }
        else if (request.command == 'status') {
            console.log('Getting status of workflow');
            stream.progress('Getting status of workflow...');
            const parts = request.prompt.split(' ');
            const workflowFileName = parts[0];
            async function getWorkflowStatus() {
                try {
                    const { data } = await octokit.actions.listWorkflowRunsForRepo({
                        owner: GHOrg,
                        repo: GHRepo,
                        workflow_id: "deploy-azure.yml" // hard coded value for easy demo.
                    });
                    stream.progress('Status of ' + workflowFileName + ' retrieved...');
                    // if data.workflow_runs[0].conclusion is null, then set it to equal 'In Progress'
                    if (data.workflow_runs[0].conclusion === null) {
                        data.workflow_runs[0].conclusion = 'In Progress';
                    }
                    const status = `**${data.workflow_runs[0].display_title}**\n\nStatus - _${data.workflow_runs[0].conclusion}_`;
                    console.log(status);
                    //conclusion
                    // Set a 3-second timeout before pushing status to chat
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    //push status to chat;
                    stream.markdown(status);
                    // stream button that directs to workflow run
                    const command = {
                        command: 'extension.openUrl',
                        title: 'View Workflow Run',
                        arguments: [data.workflow_runs[0].html_url]
                    };
                    stream.button(command);
                    return { metadata: { command: 'status' } };
                }
                catch (err) {
                    console.error(err);
                }
            }
            // Await the getWorkflowStatus function
            await getWorkflowStatus();
            return { metadata: { command: 'status' } };
        }
        else if (request.command == 'deploy') {
            console.log('Deploying branch');
            stream.progress('Deploying branch...');
            const parts = request.prompt.split(' ');
            const branchName = parts[0];
            //@ai-ops /deploy azure-deploy ai-ops-development
            // remove /n if it exists on parts[1]
            if (parts[1].includes('\n')) {
                parts[1] = parts[1].replace('\n', '');
            }
            const environment = parts[1];
            const { data } = await octokit.actions.createWorkflowDispatch({
                owner: 'octodemo',
                repo: 'universe-recap',
                workflow_id: 'deploy-azure.yml',
                ref: branchName,
                inputs: {
                    environment: environment,
                    branch: branchName
                }
            });
            // Return status of workflow
            return { metadata: { command: 'deploy' } };
        }
        else if (request.command == 'orderFreePizzaToDesk') {
            console.log('Ordering free pizza to desk');
            stream.progress('Nice try...');
            // Return status of workflow
            return { metadata: { command: 'orderFreePizzaToDesk' } };
        }
        else if (request.command == 'TCDValidator') {
            console.log('Checking for test.yml');
            stream.progress('Checking for test.yml...');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                stream.markdown('No workspace folder is open.');
                return { metadata: { command: 'TCDValidator' } };
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const filePath = path.join(workspacePath, 'test.yml');
            if (fs.existsSync(filePath)) {
                console.log('test.yml found');
                const fileContents = fs.readFileSync(filePath, 'utf-8');
                const yamlData = yaml.load(fileContents);
                const requiredAttributes = ['appId', 'appName', 'appEnv'];
                const missingAttributes = requiredAttributes.filter(attr => !yamlData.hasOwnProperty(attr));
                if (missingAttributes.length > 0) {
                    const response = missingAttributes.map(attr => `| Pipeline  | ${attr} not present |`).join('\n');
                    stream.markdown(`| Step | Status |\n|------|--------|\n${response}`);
                }
                else {
                    stream.markdown(`| Step   | Status                        |\n|--------|-------------------------------|\n| Pipeline | All required attributes are present |`);
                }
            }
            else {
                console.log('test.yml not found');
                const selection = await vscode.window.showInformationMessage('test.yml not found. Would you like to create it?', 'Yes', 'No');
                if (selection === 'Yes') {
                    const sampleData = {
                        appId: 'your-app-id',
                        appName: 'your-app-name',
                        appEnv: 'your-app-env'
                    };
                    fs.writeFileSync(filePath, yaml.dump(sampleData), 'utf-8');
                    stream.markdown('test.yml has been created with sample attributes.');
                }
                else {
                    stream.markdown('No file was created.');
                }
            }
            return { metadata: { command: 'TCDValidator' } };
        }
        else if (request.command == 'TCDtester') {
            console.log('Running ./gradlew test jacocoTestReport...');
            stream.progress('Running ./gradlew test jacocoTestReport...');
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                stream.markdown('No workspace folder is open.');
                return { metadata: { command: 'TCDtester' } };
            }
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const gradleProcess = (0, child_process_1.exec)('./gradlew test jacocoTestReport', { cwd: workspacePath });
            if (gradleProcess.stdout) {
                gradleProcess.stdout.on('data', (data) => {
                    stream.markdown(data.toString());
                });
            }
            if (gradleProcess.stderr) {
                gradleProcess.stderr.on('data', (data) => {
                    stream.markdown(`Error: ${data.toString()}`);
                });
            }
            gradleProcess.on('close', async (code) => {
                try {
                    if (code === 0) {
                        //await stream.markdown('Gradle process completed successfully.');
                        await console.info('Gradle process completed successfully.');
                    }
                    else {
                        //await stream.markdown(`Gradle process exited with code ${code}`);
                        await console.info(`Gradle process exited with code ${code}`);
                    }
                    //stream.progress('testing1 jacocoTestReport...');
                    // Once the process is complete, parse the generated HTML report
                    const reportPath = path.join(workspacePath, 'build/reports/jacoco/index.html');
                    if (fs.existsSync(reportPath)) {
                        const data = await fs.promises.readFile(reportPath, 'utf-8');
                        const dom = new jsdom_1.JSDOM(data);
                        const document = dom.window.document;
                        const coverageElement = document.querySelector('tfoot .ctr2');
                        const coverageSummary = coverageElement?.textContent?.trim() || '';
                        //await stream.markdown(`**Code Coverage Summary:**\n${coverageSummary}`);
                        await console.info(`**Code Coverage Summary:**\n${coverageSummary}`);
                    }
                    else {
                        //await stream.markdown('Code coverage report not found.');
                        await console.info('Code coverage report not found.');
                    }
                }
                catch (err) {
                    //await stream.markdown(`Error processing coverage report: ${(err as Error).message}`);
                    await console.info(`Error processing coverage report: ${err.message}`);
                }
            });
            return { metadata: { command: 'TCDtester' } };
        }
        else {
            const messages = [
                new vscode.LanguageModelChatSystemMessage('Your AIOps assistant can Deploy a branch, Check the tests, Generate tests,Get the status of a workflow or perform a SAST Scan! '),
                new vscode.LanguageModelChatUserMessage(request.prompt),
            ];
            const chatResponse = await vscode.lm.sendChatRequest(LANGUAGE_MODEL_ID, messages, {}, token);
            for await (const fragment of chatResponse.stream) {
                // Process the output from the language model
                stream.markdown(fragment);
            }
            return { metadata: { command: '' } };
        }
    };
    // Chat participants appear as top-level options in the chat input
    // when you type `@`, and can contribute sub-commands in the chat input
    // that appear when you type `/`.
    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'github.png');
    participant.followupProvider = {
        provideFollowups(result, context, token) {
            return [
                {
                    prompt: 'Use AIOps to perform operations on your workspace.',
                    label: vscode.l10n.t('Deploy,Test, Status, Scan'),
                    command: 'explain',
                },
            ];
        },
    };
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map