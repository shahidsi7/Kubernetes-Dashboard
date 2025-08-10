// utils/kubectlUtils.js
// This file provides utility functions for executing shell commands,
// specifically for kubectl and aws CLI, with promise-based execution,
// retry logic, and centralized error handling.

const { spawn, exec } = require("child_process"); // Import spawn and exec for interactive processes

/**
 * Helper function to execute shell commands with Promises.
 * This function is designed for non-blocking operations and can optionally
 * pipe input to the command's stdin. It now uses `spawn` internally to
 * better handle potentially large outputs and ensure full data capture.
 * @param {string} command - The shell command to execute.
 * @param {object} [options={}] - Options for child_process.spawn.
 * @param {string|null} [options.input=null] - Optional input to pipe to the command's stdin.
 * @returns {Promise<string>} - A promise resolving with the command's stdout.
 * @throws {Error} - Throws an error if the command fails.
 */
function execPromise(command, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`Executing command: ${command}`); // Log the command being executed

        const parts = command.split(/\s+/); // Split command into executable and arguments
        const cmd = parts[0];
        const args = parts.slice(1);

        const childProcess = spawn(cmd, args, options);
        let stdoutBuffer = '';
        let stderrBuffer = '';

        childProcess.stdout.on('data', (data) => {
            stdoutBuffer += data.toString();
        });

        childProcess.stderr.on('data', (data) => {
            stderrBuffer += data.toString();
        });

        // If input is provided, write it to stdin and end the stream
        if (options.input) {
            childProcess.stdin.write(options.input);
            childProcess.stdin.end();
        }

        childProcess.on('close', (code) => {
            // Log raw stdout and stderr for debugging purposes
            if (stdoutBuffer) console.log(`Command stdout for "${command}":\n${stdoutBuffer}`);
            if (stderrBuffer) console.error(`Command stderr for "${command}":\n${stderrBuffer}`);

            if (code === 0) {
                resolve(stdoutBuffer.trim());
            } else {
                const fullError = stderrBuffer || stdoutBuffer || `Command exited with code ${code}`;
                console.error(`execPromise Error for command: ${command}\nStdout: ${stdoutBuffer}\nStderr: ${stderrBuffer}\nExit Code: ${code}`);
                reject(new Error(fullError.trim()));
            }
        });

        childProcess.on('error', (err) => {
            console.error(`execPromise Spawn Error for command: ${command}:`, err);
            reject(new Error(`Failed to execute command "${command}": ${err.message}`));
        });
    });
}

/**
 * Attempts to parse a string as JSON. If parsing fails, it throws a more informative error.
 * It tries to robustly extract JSON content from strings that might contain extraneous output.
 * @param {string} jsonString - The string to parse.
 * @param {string} context - A description of what was being parsed (e.g., "kubectl get pods output").
 * @returns {object} The parsed JSON object.
 * @throws {Error} If the string is not valid JSON or no JSON content can be extracted.
 */
function parseAndHandleJson(jsonString, context = 'JSON parsing') {
    console.log(`Attempting to parse JSON for "${context}". Original raw output length: ${jsonString.length}`);
    console.log(`Original raw output for "${context}":\n--START_RAW_OUTPUT--\n${jsonString}\n--END_RAW_OUTPUT--`);

    let cleanedJsonString = jsonString.trim();

    // More robust regex to find the outermost JSON object or array.
    // This looks for the first '{' or '[' and the last '}' or ']'
    // and captures everything in between, including the brackets themselves.
    const jsonMatch = cleanedJsonString.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);

    if (jsonMatch && jsonMatch[0]) { // jsonMatch[0] is the entire matched string (the JSON content)
        cleanedJsonString = jsonMatch[0];
        console.log(`Extracted JSON for "${context}":\n--START_EXTRACTED_JSON--\n${cleanedJsonString}\n--END_EXTRACTED_JSON--`);
        // Check if there was any leading or trailing non-JSON content
        if (jsonMatch.index > 0 || (jsonMatch.index + jsonMatch[0].length) < jsonString.length) {
            console.warn(`WARNING: Non-JSON content found around JSON for "${context}".`);
        }
    } else {
        // If no JSON structure is found, it's definitely not JSON.
        console.error(`ERROR: No JSON structure found for "${context}". Raw output:\n${jsonString}`);
        throw new Error(`No valid JSON structure found for ${context}. Raw output might be empty or malformed.`);
    }

    try {
        const parsed = JSON.parse(cleanedJsonString);
        console.log(`Successfully parsed JSON for "${context}".`);
        return parsed;
    } catch (e) {
        console.error(`ERROR: Failed to parse JSON for "${context}". Cleaned output:\n${cleanedJsonString}\nOriginal raw output:\n${jsonString}\nError: ${e.message}`);
        throw new Error(`Failed to parse ${context} as JSON. Raw output might be malformed or contain non-JSON data. Details: ${e.message}`);
    }
}


/**
 * Helper function to execute shell commands and stream output to a WebSocket.
 * This function is designed to be used by WebSocket handlers to provide real-time feedback.
 * @param {string} command - The shell command to execute.
 * @param {WebSocket} ws - The WebSocket client to send output to.
 * @param {string|null} input - Optional input to pipe to the command's stdin.
 * @returns {Promise<{success: boolean, output?: string, error?: string}>} - A promise resolving with the command's success status and output/error.
 */
async function executeCommand(command, ws, input = null) {
    return new Promise((resolve) => {
        const parts = command.split(/\s+/); // Split command into executable and arguments
        const cmd = parts[0];
        const args = parts.slice(1);

        // Spawn the child process
        const childProcess = spawn(cmd, args);
        let output = '';
        let errorOutput = '';

        // Pipe input to the child process's stdin if provided
        if (input) {
            childProcess.stdin.write(input);
            childProcess.stdin.end();
        }

        // Collect stdout and stream it to the WebSocket
        childProcess.stdout.on('data', (data) => {
            output += data.toString();
            // Use numerical value for WebSocket.OPEN state (1)
            if (ws.readyState === 1) { // WebSocket.OPEN is 1
                ws.send(JSON.stringify({ type: 'log', data: data.toString() }));
            }
        });

        // Collect stderr and stream it (in red color) to the WebSocket
        childProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            // Use numerical value for WebSocket.OPEN state (1)
            if (ws.readyState === 1) { // WebSocket.OPEN is 1
                ws.send(JSON.stringify({ type: 'log', data: `\x1b[31m${data.toString()}\x1b[0m` })); // Red text for stderr
            }
        });

        // Resolve the promise when the child process closes
        childProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, output: output });
            } else {
                resolve({ success: false, error: errorOutput || `Command exited with code ${code}` });
            }
        });

        // Resolve the promise with an error if the child process encounters an error
        childProcess.on('error', (err) => {
            resolve({ success: false, error: err.message });
        });
    });
}

/**
 * Helper function to execute shell commands with retry logic.
 * Used for operations that might fail transiently, like waiting for K8s API readiness.
 * @param {string} command - The shell command to execute.
 * @param {WebSocket} ws - The WebSocket client to send output to.
 * @param {number} retries - The number of times to retry the command.
 * @param {number} delay - The delay in milliseconds between retries.
 * @param {string|null} input - Optional input to pipe to the command's stdin.
 * @returns {Promise<{success: boolean, output?: string, error?: string}>} - A promise resolving with the command's success status and output/error.
 */
async function executeCommandWithRetry(command, ws, retries = 5, delay = 15000, input = null) {
    for (let i = 0; i < retries; i++) {
        const result = await executeCommand(command, ws, input);
        if (result.success) {
            return result;
        }
        // Send a log message indicating a retry attempt
        // Use numerical value for WebSocket.OPEN state (1)
        if (ws.readyState === 1) { // WebSocket.OPEN is 1
            ws.send(JSON.stringify({ type: 'log', data: `\x1b[33mRetrying command (attempt ${i + 1}/${retries}): ${command}\x1b[0m\n` }));
        }
        // Wait for the specified delay before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    // If all retries fail, return a failure result
    return { success: false, error: `Command failed after ${retries} attempts: ${command}` };
}

/**
 * Helper function to get AWS Account ID using `aws sts get-caller-identity`.
 * @returns {Promise<string>} - A promise resolving with the AWS Account ID.
 * @throws {Error} - Throws an error if fetching the Account ID fails.
 */
async function getAwsAccountId() {
    return new Promise((resolve, reject) => {
        exec('aws sts get-caller-identity --query Account --output text', (err, stdout, stderr) => {
            if (err) {
                console.error(`Error getting AWS Account ID: ${stderr}`);
                reject(new Error(`Failed to get AWS Account ID: ${stderr}`));
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

/**
 * Centralized kubectl error handler.
 * Logs the error and sends an appropriate JSON response to the client.
 * @param {Error} err - The error object.
 * @param {string} [resourceName=''] - The name of the Kubernetes resource involved.
 * @param {string} [action=''] - The action being performed (e.g., 'list pods', 'delete deployment').
 * @param {object|null} [response=null] - The Express response object to send the error to.
 * @returns {string} - A user-friendly error message.
 */
function handleKubectlError(err, resourceName = '', action = '', response = null) {
    const errorMessage = err.message || 'Unknown error';
    const safeMessage = `Failed to ${action} ${resourceName ? `'${resourceName}'` : ''}: ${errorMessage}`;
    console.error(`Kubectl Error during ${action} ${resourceName}:`, err); // Log full error details

    if (response) {
        // If an Express response object is provided, send a 500 status with error details.
        response.status(500).json({ error: safeMessage, details: errorMessage });
    }
    return safeMessage; // Return the safe message for logging or further handling
}

module.exports = {
    execPromise,
    executeCommand,
    executeCommandWithRetry,
    getAwsAccountId,
    handleKubectlError,
    parseAndHandleJson // Export the new helper
};
