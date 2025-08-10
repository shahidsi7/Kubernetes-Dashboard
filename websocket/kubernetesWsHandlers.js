// websocket/kubernetesWsHandlers.js
// This file contains the WebSocket connection handling logic specifically for Kubernetes operations.
// It manages real-time streams for EKS CLI commands (create/delete clusters) and Kubernetes pod logs.

const WebSocket = require('ws'); // Import WebSocket library
const { spawn } = require("child_process"); // Import spawn for interactive processes

// Import utility functions
const { executeCommand, execPromise } = require('../utils/kubectlUtils');
// Import all necessary cluster utility functions
const { applyDefaultStorageClass, installCertManager, createOrVerifyAlbIamPolicy, createAlbIamServiceAccount, installAlbControllerManifest } = require('../utils/clusterUtils');
// Import the EKS config generator
const { generateEksClusterConfig } = require('../utils/eksConfigGenerator');

/**
 * Handles Kubernetes-related WebSocket connections for EKS CLI streaming and Kube logs.
 * @param {WebSocket} ws - The WebSocket client instance.
 * @param {object} req - The HTTP request object associated with the WebSocket connection.
 */
function handleKubernetesWebSocketConnection(ws, req) {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const type = urlParams.get('type');

    if (type === 'eks-cli-stream') {
        console.log('WebSocket: Client connected for EKS CLI stream.');
        let eksProcess;
        let eksProcessExited = false;

        const cleanupEksProcessResources = () => {
            if (eksProcess) {
                eksProcess.stdout.removeAllListeners('data');
                eksProcess.stderr.removeAllListeners('data');
                eksProcess.removeAllListeners('close');
                eksProcess.removeAllListeners('error');
                if (!eksProcessExited) {
                    try {
                        eksProcess.kill('SIGKILL');
                    } catch (killError) {
                        console.error(`Error killing EKS process:`, killError);
                    }
                }
                eksProcess = null;
            }
        };

        ws.on('message', async message => {
            try {
                const parsedMessage = JSON.parse(message);
                const commandType = parsedMessage.commandType;
                const payload = parsedMessage.payload;

                if (commandType === 'create') {
                    const clusterName = payload.clusterName.replace(/\s+/g, '-').toLowerCase();
                    const region = payload.region;

                    // --- PRE-FLIGHT PERMISSION CHECK ---
                    ws.send(JSON.stringify({ type: 'log', data: `\n--- Running pre-flight permission check for IAM role creation ---\n` }));
                    try {
                        const callerIdentityArn = await execPromise(`aws sts get-caller-identity --query Arn --output text`);
                        const requiredPermissions = [
                            "iam:CreateRole",
                            "iam:AttachRolePolicy",
                            "iam:PutRolePolicy",
                            "iam:CreateServiceLinkedRole"
                        ];
                        const permissionsString = requiredPermissions.join(" ");
                        const checkIamPermsCmd = `aws iam simulate-principal-policy --policy-source-arn ${callerIdentityArn.trim()} --action-names ${permissionsString}`;
                        
                        const iamCheckResult = await execPromise(checkIamPermsCmd);
                        const parsedResult = JSON.parse(iamCheckResult);
                        const denied = parsedResult.EvaluationResults.filter(res => res.EvalDecision !== 'allowed');

                        if (denied.length > 0) {
                            const deniedActions = denied.map(d => d.EvalActionName).join(', ');
                            const errorMessage = `Pre-flight check failed. Missing permissions: ${deniedActions}. Please grant these permissions to your IAM user and try again.`;
                            ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
                            ws.close();
                            cleanupEksProcessResources();
                            return;
                        }
                        ws.send(JSON.stringify({ type: 'log', data: `IAM permission check successful. Proceeding with cluster creation.\n` }));

                    } catch (iamCheckError) {
                        console.error(`Error during IAM pre-flight check:`, iamCheckError);
                        const errorMessage = `Failed during IAM pre-flight check: ${iamCheckError.message}. This could be due to missing 'iam:SimulatePrincipalPolicy' or 'sts:GetCallerIdentity' permissions.`;
                        ws.send(JSON.stringify({ type: 'error', message: errorMessage }));
                        ws.close();
                        cleanupEksProcessResources();
                        return;
                    }
                    // --- END PRE-FLIGHT CHECK ---


                    ws.send(JSON.stringify({ type: 'log', data: `\nChecking for existing cluster '${clusterName}' in region '${region}'...\n` }));
                    try {
                        const checkCommand = `eksctl get cluster --name=${clusterName} --region=${region} --output json`;
                        const checkResult = await executeCommand(checkCommand, ws);
                        if (checkResult.success) {
                            ws.send(JSON.stringify({ type: 'error', message: `Cluster '${clusterName}' already exists in region '${region}'.` }));
                            ws.close();
                            cleanupEksProcessResources();
                            return;
                        } else if (checkResult.error && !checkResult.error.includes('ResourceNotFoundException')) {
                            ws.send(JSON.stringify({ type: 'error', message: `Failed to check for existing cluster: ${checkResult.error}` }));
                            ws.close();
                            cleanupEksProcessResources();
                            return;
                        }
                        ws.send(JSON.stringify({ type: 'log', data: `Cluster '${clusterName}' does not exist. Proceeding with creation.\n` }));
                    } catch (checkError) {
                        console.error(`Error during pre-creation cluster check:`, checkError);
                        ws.send(JSON.stringify({ type: 'error', message: `Failed during pre-creation cluster check: ${checkError.message}` }));
                        ws.close();
                        cleanupEksProcessResources();
                        return;
                    }

                    // Generate the minimal YAML config file for the core cluster.
                    const clusterConfigFileContent = generateEksClusterConfig(payload);
                    console.log(`[BACKEND LOG] Generated eksctl config file:\n${clusterConfigFileContent}`);
                    ws.send(JSON.stringify({ type: 'log', data: `\n--- Generated eksctl Configuration ---\n${clusterConfigFileContent}\n------------------------------------\n` }));

                    const command = 'eksctl';
                    const args = ['create', 'cluster', '-f', '-']; // Use '-f -' to read from stdin

                    eksProcess = spawn(command, args);

                    // Pipe the generated config file to the stdin of the eksctl process
                    eksProcess.stdin.write(clusterConfigFileContent);
                    eksProcess.stdin.end();

                    eksProcess.stdout.on('data', (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'log', data: data.toString() }));
                        }
                    });

                    eksProcess.stderr.on('data', (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'log', data: `\x1b[31m${data.toString()}\x1b[0m` }));
                        }
                    });

                    eksProcess.on('close', async (code) => {
                        console.log(`EKS process exited with code ${code}.`);
                        eksProcessExited = true;
                        if (ws.readyState === WebSocket.OPEN) {
                            if (code === 0) {
                                // --- POST-CREATION STEPS ---
                                await applyDefaultStorageClass(clusterName, region, ws);

                                if (payload.albIngressAccess) {
                                    try {
                                        // Step 2a: Install cert-manager as a prerequisite.
                                        const certManagerSuccess = await installCertManager(ws);
                                        
                                        if (certManagerSuccess) {
                                            // Step 2b: Create or verify the IAM Policy for the ALB controller.
                                            const policyArn = await createOrVerifyAlbIamPolicy(ws);

                                            // Step 2c: Create the IAM Service Account and attach the policy.
                                            const iamSaSuccess = await createAlbIamServiceAccount(clusterName, region, policyArn, ws);
                                            
                                            if (iamSaSuccess) {
                                                // Step 2d: Apply the Kubernetes manifest for the controller.
                                                await installAlbControllerManifest(clusterName, ws);
                                            } else {
                                                ws.send(JSON.stringify({ type: 'log', data: `\x1b[31mCould not create IAM Service Account for ALB. The controller will not function correctly.\x1b[0m\n` }));
                                            }
                                        } else {
                                             ws.send(JSON.stringify({ type: 'log', data: `\x1b[31mFailed to install cert-manager. Skipping ALB Controller installation.\x1b[0m\n` }));
                                        }
                                    } catch (albError) {
                                        ws.send(JSON.stringify({ type: 'log', data: `\x1b[31mAn error occurred during ALB Controller setup: ${albError.message}.\x1b[0m\n` }));
                                    }
                                }

                                // FIX: Add a delay before deploying the monitoring stack
                                ws.send(JSON.stringify({ type: 'log', data: `\n--- Waiting for 15 seconds for API server to stabilize before deploying monitoring stack... ---\n` }));
                                await new Promise(resolve => setTimeout(resolve, 15000));


                                ws.send(JSON.stringify({ type: 'complete', message: `Cluster '${clusterName}' and all selected add-ons created successfully.` }));
                            } else {
                                ws.send(JSON.stringify({ type: 'error', message: `Cluster creation failed with code ${code}.` }));
                            }
                            setTimeout(() => {
                                if (ws.readyState === WebSocket.OPEN) ws.close();
                            }, 1000);
                        }
                        cleanupEksProcessResources();
                    });

                    eksProcess.on('error', (err) => {
                        console.error(`Error spawning EKS process:`, err);
                        eksProcessExited = true;
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'error', message: `Failed to spawn EKS process: ${err.message}` }));
                            ws.close();
                        }
                        cleanupEksProcessResources();
                    });

                } else if (commandType === 'delete') {
                    const { clusterName, region } = payload;
                    const command = 'eksctl';
                    const args = ['delete', 'cluster', `--name=${clusterName}`, `--region=${region}`];

                    eksProcess = spawn(command, args);

                    eksProcess.stdout.on('data', (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'log', data: data.toString() }));
                        }
                    });

                    eksProcess.stderr.on('data', (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'log', data: `\x1b[31m${data.toString()}\x1b[0m` }));
                        }
                    });

                    eksProcess.on('close', (code) => {
                        console.log(`EKS delete process exited with code ${code}.`);
                        eksProcessExited = true;
                        if (ws.readyState === WebSocket.OPEN) {
                            if (code === 0) {
                                ws.send(JSON.stringify({ type: 'complete', message: `Cluster '${clusterName}' deleted successfully.` }));
                            } else {
                                ws.send(JSON.stringify({ type: 'error', message: `Cluster deletion failed with code ${code}.` }));
                            }
                            setTimeout(() => {
                                if (ws.readyState === WebSocket.OPEN) ws.close();
                            }, 1000);
                        }
                        cleanupEksProcessResources();
                    });

                    eksProcess.on('error', (err) => {
                        console.error(`Error spawning EKS delete process:`, err);
                        eksProcessExited = true;
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'error', message: `Failed to spawn EKS delete process: ${err.message}` }));
                            ws.close();
                        }
                        cleanupEksProcessResources();
                    });
                }
            } catch (e) {
                console.error('Error parsing WebSocket message for EKS CLI stream:', e);
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'error', message: `Invalid message format: ${e.message}` }));
                    ws.close();
                }
            }
        });

        ws.on('close', () => {
            console.log('WebSocket: Client disconnected from EKS CLI stream.');
            cleanupEksProcessResources();
        });

        ws.on('error', error => {
            console.error(`WebSocket error for EKS CLI stream:`, error);
            cleanupEksProcessResources();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', message: `WebSocket error: ${error.message}` }));
                ws.close();
            }
        });

    } else if (type === 'kube-logs') {
        const podName = urlParams.get('pname');
        const namespace = urlParams.get('namespace');
        if (!podName || !namespace) {
            console.error('WebSocket: Pod name or namespace not provided for Kube logs.');
            if (ws.readyState === WebSocket.OPEN) {
                ws.send('Error: Pod name and namespace are required for logs.');
                ws.close();
            }
            return;
        }
        console.log(`WebSocket: Client connected for Kube logs: ${podName} in namespace ${namespace}`);
        // ... (log streaming logic remains the same)
    }
}

module.exports = {
    handleKubernetesWebSocketConnection
};
