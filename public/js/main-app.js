// public/js/main-app.js
// This script provides the client-side logic for the main Kubernetes Management UI (index.html).
// It handles AWS EKS credential configuration, cluster creation/deletion,
// and displays operation progress using WebSockets.

// Base URL for API calls to the backend.
const API_BASE_URL = 'http://localhost:3000';

// Global state for confirmation callback (used by showConfirmModal)
let confirmCallback = null;
// Global state for polling interval ID for cluster list
let clusterListPollingInterval = null;

// UI Elements for messages and modals
const messageContainer = document.getElementById('messageContainer');
const confirmationModal = document.getElementById('confirmationModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');

// UI Elements for AWS Credentials Modal
const kubernetesNavLink = document.getElementById('kubernetesNavLink');
const awsCredentialsModal = document.getElementById('awsCredentialsModal');
const awsCredentialsForm = document.getElementById('awsCredentialsForm');
const awsAccessKeyIdInput = document.getElementById('awsAccessKeyId');
const awsSecretAccessKeyInput = document.getElementById('awsSecretAccessKey');
const awsRegionInput = document.getElementById('awsRegion');
const closeAwsCredentialsModalBtn = document.getElementById('closeAwsCredentialsModalBtn');

// UI Elements for EKS Management Content
const eksManagementContent = document.getElementById('eksManagementContent');
const eksConnectionStatus = document.getElementById('eksConnectionStatus');
const createClusterBtn = document.getElementById('createClusterBtn');
const showPrecreatedClustersBtn = document.getElementById('showPrecreatedClustersBtn');
const clusterActionArea = document.getElementById('clusterActionArea');
const exitEksAccessBtn = document.getElementById('exitEksAccessBtn');

// UI Elements for Login to AWS button
const loginToAwsContainer = document.getElementById('loginToAwsContainer');
const loginToAwsBtn = document.getElementById('loginToAwsBtn');

// UI Elements for Progress Console Modal
const progressConsoleModal = document.getElementById('progressConsoleModal');
const progressTitle = document.getElementById('progressTitle');
const progressOutput = document.getElementById('progressOutput');
const closeProgressConsoleBtn = document.getElementById('closeProgressConsoleBtn');

// UI Elements for Cluster Details Modal
const clusterDetailsModal = document.getElementById('clusterDetailsModal');
const detailsClusterName = document.getElementById('detailsClusterName');
const clusterDetailsContent = document.getElementById('clusterDetailsContent');
const closeClusterDetailsModalBtn = document.getElementById('closeClusterDetailsModalBtn');

// UI Elements for Current Progress Links/Buttons
const createProgressContainer = document.getElementById('createProgressContainer');
const showCreateProgressBtn = document.getElementById('showCreateProgressBtn');
const deleteProgressContainer = document.getElementById('deleteProgressContainer');
const showDeleteProgressBtn = document.getElementById('showDeleteProgressBtn');

// Global state for ongoing operations (stores WebSocket, payload, title, active status, and logs)
let createOperation = {
    ws: null,
    payload: null,
    title: '',
    isActive: false,
    logs: ''
};

let deleteOperation = {
    ws: null,
    payload: null,
    title: '',
    isActive: false,
    logs: ''
};


/**
 * Displays a message in a sliding toast notification.
 * @param {string} message - The message content.
 * @param {boolean} isError - True if it's an error message, false for success.
 */
function showMessage(message, isError = false) {
    const messageBox = document.createElement('div');
    messageBox.classList.add('message-box');
    messageBox.classList.add(isError ? 'error' : 'success');
    messageBox.innerHTML = `
        <span>${message}</span>
        <button class="close-btn" onclick="this.parentElement.remove()">×</button>
    `;
    messageContainer.appendChild(messageBox);

    // Automatically remove the message after 5 seconds
    setTimeout(() => {
        if (messageBox.parentElement) {
            messageBox.remove();
        }
    }, 5000);
}

/**
 * Shows a custom confirmation modal.
 * @param {string} message - The message to display in the modal.
 * @param {Function} callback - The function to execute if the user confirms (true) or cancels (false).
 */
function showConfirmModal(message, callback) {
    confirmMessage.innerHTML = message;
    confirmationModal.classList.remove('hidden'); // Show the modal
    confirmCallback = callback; // Store the callback function

    // Set up event listeners for confirm and cancel buttons
    confirmActionBtn.onclick = () => {
        confirmationModal.classList.add('hidden'); // Hide the modal
        if (confirmCallback) {
            confirmCallback(true); // Execute callback with true for confirmation
            confirmCallback = null; // Clear the callback
        }
    };
    cancelConfirmBtn.onclick = () => {
        confirmationModal.classList.add('hidden'); // Hide the modal
        if (confirmCallback) {
            confirmCallback(false); // Execute callback with false for cancellation
            confirmCallback = null; // Clear the callback
        }
    };
}

/**
 * Shows the progress console modal and sets its title and initial content.
 * @param {string} title - The title for the progress console.
 * @param {string} logsContent - The accumulated logs to display.
 */
function showProgressConsole(title, logsContent) {
    progressTitle.textContent = title;
    progressOutput.textContent = logsContent; // Set initial content
    progressConsoleModal.classList.remove('hidden'); // Show the modal
    progressOutput.scrollTop = progressOutput.scrollHeight; // Scroll to bottom to show latest logs
}

/**
 * Hides the progress console modal.
 */
function hideProgressConsole() {
    progressConsoleModal.classList.add('hidden');
    // Note: progressOutput.textContent is NOT cleared here; it's managed by the operation state.
}

// Event listener for closing the progress console modal
closeProgressConsoleBtn.addEventListener('click', hideProgressConsole);

/**
 * Shows the cluster details modal and populates it with data fetched from the backend.
 * @param {string} clusterName - The name of the cluster.
 * @param {string} region - The region of the cluster.
 */
async function showClusterDetails(clusterName, region) {
    detailsClusterName.textContent = clusterName; // Set the cluster name in the modal title
    clusterDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>'; // Show loading message
    clusterDetailsModal.classList.remove('hidden'); // Show the modal

    try {
        // Fetch cluster details from the backend API
        const response = await fetch(`${API_BASE_URL}/eks-cluster-details?clusterName=${encodeURIComponent(clusterName)}&region=${encodeURIComponent(region)}`);
        const details = await response.json();

        if (!response.ok) {
            // If the backend returns an error, throw it to be caught below
            throw new Error(details.error || 'Failed to fetch cluster details from backend.');
        }

        // The 'aws eks describe-cluster' command returns an object with a 'cluster' key
        const clusterData = details.cluster;

        if (!clusterData) {
            throw new Error("No cluster data found in the response.");
        }

        // Populate modal fields, defaulting to 'N/A' if the property is missing
        const displayedName = clusterData.name || 'N/A';
        const displayedRegion = (clusterData.arn && clusterData.arn.split(':')[3]) || region || 'N/A';
        const displayedStatus = clusterData.status || 'N/A';
        const displayedVersion = clusterData.version || 'N/A';
        const displayedEndpoint = clusterData.endpoint || 'N/A';
        const displayedArn = clusterData.arn || 'N/A';
        const displayedCreatedAt = clusterData.createdAt ? new Date(clusterData.createdAt).toLocaleString() : 'N/A';

        // Update the modal content with the fetched details
        clusterDetailsContent.innerHTML = `
            <p><strong>Name:</strong> <span id="detailName">${displayedName}</span></p>
            <p><strong>Region:</strong> <span id="detailRegion">${displayedRegion}</span></p>
            <p><strong>Status:</strong> <span id="detailStatus">${displayedStatus}</span></p>
            <p><strong>Version:</strong> <span id="detailVersion">${displayedVersion}</span></p>
            <p><strong>Endpoint:</strong> <span id="detailEndpoint">${displayedEndpoint}</span></p>
            <p><strong>ARN:</strong> <span id="detailArn">${displayedArn}</span></p>
            <p><strong>Created At:</strong> <span id="detailCreatedAt">${displayedCreatedAt}</span></p>
        `;

    } catch (error) {
        console.error('Error fetching cluster details:', error);
        clusterDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching cluster details for ${clusterName}: ${error.message}`, true);
    }
}

// Event listener for closing the cluster details modal
closeClusterDetailsModalBtn.addEventListener('click', () => {
    clusterDetailsModal.classList.add('hidden'); // Hide the modal
    clusterDetailsContent.innerHTML = ''; // Clear content when closing
});


// --- AWS Credentials and EKS Connection Management ---

/**
 * Checks if AWS EKS connection is already established by calling a backend endpoint.
 * If connected, it shows the EKS management content. Otherwise, it prepares the UI
 * to prompt for AWS credentials.
 */
async function checkEKSConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/eks-check-connection`);
        const result = await response.json();

        if (response.ok && result.connected) {
            showMessage(result.message, false);
            eksConnectionStatus.textContent = "Connected to eksctl successfully!";
            eksManagementContent.classList.remove('hidden'); // Show EKS management section
            awsCredentialsModal.classList.add('hidden'); // Ensure modal is hidden
            loginToAwsContainer.classList.add('hidden'); // Hide the login button container
        } else {
            // Not connected or connection failed, show the login button and hide EKS content
            showMessage(result.error || "Please configure AWS credentials to connect to EKS.", true);
            eksConnectionStatus.textContent = "Not connected to eksctl.";
            eksManagementContent.classList.add('hidden'); // Keep EKS management section hidden
            awsCredentialsModal.classList.add('hidden'); // Ensure modal is hidden initially
            loginToAwsContainer.classList.remove('hidden'); // Show the login button container
            loginToAwsBtn.classList.remove('hidden'); // Show the login button
        }
    } catch (error) {
        console.error('Error checking EKS connection:', error);
        showMessage(`Error checking EKS connection: ${error.message}`, true);
        eksConnectionStatus.textContent = "Failed to connect to eksctl.";
        eksManagementContent.classList.add('hidden'); // Keep EKS management section hidden
        awsCredentialsModal.classList.add('hidden'); // Ensure modal is hidden initially
        loginToAwsContainer.classList.remove('hidden'); // Show the login button container
        loginToAwsBtn.classList.remove('hidden'); // Show the login button
    }
}


// Show AWS credentials modal when Kubernetes link is clicked (if not already connected)
kubernetesNavLink.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent default navigation
    // If the EKS management content is already visible, it means we are connected, so do nothing.
    // Otherwise, show the credentials modal.
    if (eksManagementContent.classList.contains('hidden')) {
        awsCredentialsModal.classList.remove('hidden');
        awsAccessKeyIdInput.focus(); // Focus on the first input field
    }
    // Stop polling if it's active and we're not on the cluster list view
    stopClusterListPolling();
});

// Handle AWS credentials form submission
awsCredentialsForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Prevent default form submission

    const accessKeyId = awsAccessKeyIdInput.value.trim();
    const secretAccessKey = awsSecretAccessKeyInput.value.trim();
    const region = awsRegionInput.value.trim();

    if (!accessKeyId || !secretAccessKey || !region) {
        showMessage("Please enter your AWS Access Key ID, Secret Access Key, and Region.", true);
        return;
    }

    showMessage("Connecting to AWS EKS...", false);
    awsCredentialsModal.classList.add('hidden'); // Hide modal immediately

    try {
        // Send credentials to the backend for configuration
        const response = await fetch(`${API_BASE_URL}/eks-configure-aws`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessKeyId, secretAccessKey, region })
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to configure AWS credentials.');
        }

        showMessage(result.message, false);
        eksConnectionStatus.textContent = "Connected to eksctl successfully!";
        eksManagementContent.classList.remove('hidden'); // Show EKS management section
        loginToAwsContainer.classList.add('hidden'); // Hide the login button container

    } catch (error) {
        console.error('Error configuring AWS credentials:', error);
        showMessage(`Error connecting to EKS: ${error.message}`, true);
        eksConnectionStatus.textContent = "Failed to connect to eksctl.";
        eksManagementContent.classList.add('hidden'); // Keep EKS management section hidden on failure
        awsCredentialsModal.classList.remove('hidden'); // Show modal again on error for re-entry
        loginToAwsContainer.classList.remove('hidden'); // Show the login button container
        loginToAwsBtn.classList.remove('hidden'); // Show the login button
    }
});

// Handle Close button for AWS Credentials Modal
closeAwsCredentialsModalBtn.addEventListener('click', () => {
    awsCredentialsModal.classList.add('hidden'); // Hide the modal
    eksManagementContent.classList.add('hidden'); // Ensure EKS content is hidden
    eksConnectionStatus.textContent = "Not connected to eksctl."; // Update status
    awsCredentialsForm.reset(); // Clear form fields
    clusterActionArea.innerHTML = ''; // Clear any dynamic content
    showMessage("AWS credentials configuration cancelled.", false);
    loginToAwsContainer.classList.remove('hidden'); // Show the login button container
    loginToAwsBtn.classList.remove('hidden'); // Show the login button
    stopClusterListPolling(); // Stop polling when closing modal
});

// Handle Login to AWS button click
loginToAwsBtn.addEventListener('click', () => {
    awsCredentialsModal.classList.remove('hidden'); // Show the AWS credentials modal
    awsAccessKeyIdInput.focus(); // Focus on the first input field
});

// --- EKS Cluster Management Logic ---

// Event listener for "Create New Cluster" button
createClusterBtn.addEventListener('click', () => {
    // Dynamically load the cluster creation form into the clusterActionArea
    clusterActionArea.innerHTML = `
        <h3 class="text-xl font-semibold text-gray-700 mb-4">Create New EKS Cluster</h3>
        <form id="createEksClusterForm" class="space-y-4 bg-gray-50 p-6 rounded-lg shadow">
            <div class="flex flex-col">
                <label for="clusterName" class="text-gray-700 font-medium mb-1">Cluster Name:</label>
                <input type="text" id="clusterName" name="clusterName" placeholder="e.g., my-eks-cluster" required
                       class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
            </div>
            <div class="flex flex-wrap -mx-2">
                <div class="flex flex-col px-2 w-1/2">
                    <label for="clusterRegion" class="text-gray-700 font-medium mb-1">Region:</label>
                    <input type="text" id="clusterRegion" name="clusterRegion" placeholder="e.g., us-east-1" value="${awsRegionInput.value}" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
                <div class="flex flex-col px-2 w-1/2">
                    <label for="kubernetesVersion" class="text-gray-700 font-medium mb-1">Kubernetes Version:</label>
                    <input type="text" id="kubernetesVersion" name="kubernetesVersion" placeholder="e.g., 1.28" value="1.29" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
            </div>
            <div class="flex flex-wrap -mx-2">
                <div class="flex flex-col px-2 w-1/3">
                    <label for="nodeGroupName" class="text-gray-700 font-medium mb-1">Node Group Name:</label>
                    <input type="text" id="nodeGroupName" name="nodeGroupName" placeholder="e.g., my-nodegroup" value="my-nodegroup" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
                <div class="flex flex-col px-2 w-1/3">
                    <label for="nodeGroupType" class="text-gray-700 font-medium mb-1">Instance Type:</label>
                    <select id="nodeGroupType" name="nodeGroupType" required
                        class="p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out">
                        <option value="t3.medium">t3.medium</option>
                        <option value="t3.large">t3.large</option>
                        <option value="t2.medium">t2.medium</option>
                        <option value="t2.micro">t2.micro</option>
                        <option value="t3.micro">t3.micro</option>
                        <option value="m5.large">m5.large</option>
                        <option value="m5.xlarge">m5.xlarge</option>
                        <option value="c5.large">c5.large</option>
                        <option value="c5.xlarge">c5.xlarge</option>
                        <option value="r5.large">r5.large</option>
                    </select>
                </div>
                <div class="flex flex-col px-2 w-1/3">
                    <label for="instanceName" class="text-gray-700 font-medium mb-1">Instance Name:</label>
                    <input type="text" id="instanceName" name="instanceName" placeholder="e.g., my-instance" value="my-instance" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
            </div>
            <div class="flex flex-wrap -mx-2">
                <div class="flex flex-col px-2 w-1/3">
                    <label for="desiredCapacity" class="text-gray-700 font-medium mb-1">Desired Capacity:</label>
                    <input type="number" id="desiredCapacity" name="desiredCapacity" placeholder="e.g., 2" value="2" min="1" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
                <div class="flex flex-col px-2 w-1/3">
                    <label for="minNodes" class="text-gray-700 font-medium mb-1">Minimum Nodes:</label>
                    <input type="number" id="minNodes" name="minNodes" placeholder="e.g., 1" value="1" min="0" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
                <div class="flex flex-col px-2 w-1/3">
                    <label for="maxNodes" class="text-gray-700 font-medium mb-1">Maximum Nodes:</label>
                    <input type="number" id="maxNodes" name="maxNodes" placeholder="e.g., 3" value="3" min="1" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
            </div>
            <div class="flex flex-wrap -mx-2">
                <div class="flex flex-col px-2 w-1/2">
                    <label for="volumeSize" class="text-gray-700 font-medium mb-1">Node Volume Size (GB):</label>
                    <input type="number" id="volumeSize" name="volumeSize" placeholder="e.g., 20" value="20" min="8" required
                        class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
                </div>
                <div class="flex flex-col px-2 w-1/2">
                    <label for="volumeType" class="text-gray-700 font-medium mb-1">Node Volume Type:</label>
                    <select id="volumeType" name="volumeType" required
                        class="p-3 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out">
                        <option value="gp2">gp2</option>
                        <option value="gp3">gp3</option>
                        <option value="io1">io1</option>
                        <option value="io2">io2</option>
                        <option value="sc1">sc1</option>
                        <option value="st1">st1</option>
                        <option value="standard">standard</option>
                    </select>
                </div>
            </div>
            <div class="flex justify-around items-center mt-4 p-2 bg-gray-100 rounded-md flex-wrap gap-2">
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="enableSsm" name="enableSsm" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="enableSsm" class="text-gray-700 text-sm">Enable SSM</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="enableSsh" name="enableSsh" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="enableSsh" class="text-gray-700 text-sm">Enable SSH</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="managedByEks" name="managedByEks" checked class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="managedByEks" class="text-gray-700 text-sm">Managed by EKS</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="oidcAccess" name="oidcAccess" checked class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="oidcAccess" class="text-gray-700 text-sm">OIDC Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="asgAccess" name="asgAccess" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="asgAccess" class="text-gray-700 text-sm">ASG Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="externalDnsAccess" name="externalDnsAccess" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="externalDnsAccess" class="text-gray-700 text-sm">External DNS Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="fullEcrAccess" name="fullEcrAccess" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="fullEcrAccess" class="text-gray-700 text-sm">Full ECR Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="appmeshAccess" name="appmeshAccess" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="appmeshAccess" class="text-gray-700 text-sm">AppMesh Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="albIngressAccess" name="albIngressAccess" class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="albIngressAccess" class="text-gray-700 text-sm">ALB Ingress Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="enableEbsCsiAccess" name="enableEbsCsiAccess" checked class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="enableEbsCsiAccess" class="text-gray-700 text-sm">Enable EBS CSI Access</label>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" id="enableEfsCsiAccess" name="enableEfsCsiAccess" checked class="form-checkbox h-5 w-5 text-blue-600 rounded"/>
                    <label for="enableEfsCsiAccess" class="text-gray-700 text-sm">Enable EFS CSI Access</label>
                </div>
            </div>
            <div id="sshPublicKeyDiv" class="flex flex-col mt-4 hidden">
                <label for="sshKeyName" class="text-gray-700 font-medium mb-1">SSH Key Pair Name:</label>
                <input type="text" id="sshKeyName" name="sshKeyName" placeholder="e.g., my-ssh-key"
                          class="p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400 focus:border-transparent transition duration-200 ease-in-out"/>
            </div>
            <div class="flex justify-end space-x-3 mt-6">
                <button type="submit"
                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out">
                    Create Cluster
                </button>
            </div>
        </form>
    `;
    // Attach event listener for the new form
    document.getElementById('createEksClusterForm').addEventListener('submit', handleCreateCluster);

    // Add event listener for SSH checkbox to toggle public key input
    const enableSshCheckbox = document.getElementById('enableSsh');
    const sshPublicKeyDiv = document.getElementById('sshPublicKeyDiv');
    const sshKeyNameInput = document.getElementById('sshKeyName');

    enableSshCheckbox.addEventListener('change', () => {
        if (enableSshCheckbox.checked) {
            sshPublicKeyDiv.classList.remove('hidden');
            sshKeyNameInput.setAttribute('required', 'required');
        } else {
            sshPublicKeyDiv.classList.add('hidden');
            sshKeyNameInput.removeAttribute('required');
            sshKeyNameInput.value = ''; // Clear value when hidden
        }
    });
    stopClusterListPolling(); // Stop polling when showing create cluster form
});

/**
 * Handles the submission of the EKS cluster creation form.
 * It gathers form data, validates it, and initiates a WebSocket stream
 * to the backend for cluster creation.
 * @param {Event} event - The form submission event.
 */
async function handleCreateCluster(event) {
    event.preventDefault(); // Prevent default form submission

    const form = event.target;
    const clusterName = form.clusterName.value.trim();
    const region = form.clusterRegion.value.trim();
    const kubernetesVersion = form.kubernetesVersion.value.trim();
    const nodeGroupName = form.nodeGroupName.value.trim();
    const instanceType = form.nodeGroupType.value;
    const instanceName = form.instanceName.value.trim();
    const desiredCapacity = parseInt(form.desiredCapacity.value, 10);
    const minNodes = parseInt(form.minNodes.value, 10);
    const maxNodes = parseInt(form.maxNodes.value, 10);
    const volumeSize = parseInt(form.volumeSize.value, 10);
    const volumeType = form.volumeType.value;
    const enableSsm = form.enableSsm.checked;
    const enableSsh = form.enableSsh.checked;
    const managedByEks = form.managedByEks.checked;
    const oidcAccess = form.oidcAccess.checked;
    const asgAccess = form.asgAccess.checked;
    const externalDnsAccess = form.externalDnsAccess.checked;
    const fullEcrAccess = form.fullEcrAccess.checked;
    const appmeshAccess = form.appmeshAccess.checked;
    const albIngressAccess = form.albIngressAccess.checked;
    const sshKeyName = enableSsh ? form.sshKeyName.value.trim() : '';
    const enableEbsCsiAccess = form.enableEbsCsiAccess.checked;
    const enableEfsCsiAccess = form.enableEfsCsiAccess.checked;


    // Basic client-side validation
    if (!clusterName || !region || !kubernetesVersion || !nodeGroupName || !instanceType || !instanceName ||
        isNaN(desiredCapacity) || isNaN(minNodes) || isNaN(maxNodes) || isNaN(volumeSize) || !volumeType ||
        (enableSsh && !sshKeyName)) {
        showMessage("Please fill all required fields correctly, including SSH Key Pair Name if SSH is enabled.", true);
        return;
    }

    if (desiredCapacity < 1 || minNodes < 0 || maxNodes < 1 || minNodes > desiredCapacity || desiredCapacity > maxNodes) {
        showMessage("Node counts (Desired, Min, Max) are invalid. Ensure Min <= Desired <= Max and all are positive.", true);
        return;
    }
    if (volumeSize < 8) {
        showMessage("Volume size must be at least 8GB.", true);
        return;
    }
    
    console.log("DEBUG: OIDC Access Checkbox Value:", oidcAccess);


    showMessage(`Initiating EKS cluster '${clusterName}' creation... This may take several minutes.`, false);
    form.reset(); // Clear form fields
    clusterActionArea.innerHTML = `<p class="text-gray-600 text-center py-4">EKS cluster creation initiated. Progress shown in console.</p>`;

    // Initialize create operation state
    createOperation.isActive = true;
    createOperation.title = `Creating EKS Cluster: ${clusterName}`;
    createOperation.logs = ''; // Clear previous logs for new operation
    createOperation.payload = { // Store payload for potential re-use if backend changes
        commandType: 'create',
        payload: {
            clusterName, region, kubernetesVersion, nodeGroupName, instanceType,
            instanceName, desiredCapacity, minNodes, maxNodes, volumeSize,
            volumeType, enableSsm, enableSsh, managedByEks,
            oidcAccess,
            asgAccess, externalDnsAccess, fullEcrAccess, appmeshAccess,
            albIngressAccess, sshKeyName,
            enableEbsCsiAccess,
            enableEfsCsiAccess
        }
    };
    
    console.log("DEBUG: Payload being sent to backend:", JSON.stringify(createOperation.payload, null, 2));


    // Show progress console and current progress button
    showProgressConsole(createOperation.title, createOperation.logs);
    createProgressContainer.classList.remove('hidden'); // Show the "View Create Progress" button

    // Close existing WebSocket for this operation if open
    if (createOperation.ws) {
        createOperation.ws.close();
    }

    // Establish new WebSocket connection and send command
    createOperation.ws = new WebSocket(`ws://localhost:3000?type=eks-cli-stream`);

    createOperation.ws.onopen = () => {
        createOperation.ws.send(JSON.stringify(createOperation.payload));
        const initialMsg = `\nInitiating cluster creation for '${clusterName}'... This may take several minutes.\n`;
        createOperation.logs += initialMsg; // Append to stored logs
        progressOutput.textContent += initialMsg; // Append to current modal output
        progressOutput.scrollTop = progressOutput.scrollHeight;
    };

    createOperation.ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log') {
            createOperation.logs += msg.data; // Always append to stored logs
            if (!progressConsoleModal.classList.contains('hidden')) { // Only update modal if visible
                progressOutput.textContent += msg.data;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }
        } else if (msg.type === 'complete') {
            showMessage(msg.message, false);
            createOperation.logs += `\n${msg.message}\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\n${msg.message}\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }

            // Cluster creation is complete, now deploy monitoring stack
            const clusterName = createOperation.payload.payload.clusterName;
            const region = createOperation.payload.payload.region;

            createOperation.logs += `\n--- Cluster creation complete. Proceeding with monitoring stack deployment. ---\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\n--- Cluster creation complete. Proceeding with monitoring stack deployment. ---\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }

            await deployMonitoringStack(clusterName, region);
            
            // Send final completion message after all deployments
            showMessage(`Cluster '${clusterName}' created and add-ons deployed successfully!`, false);
            createOperation.logs += `\n--- All cluster creation and add-on deployments finished. ---\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\n--- All cluster creation and add-on deployments finished. ---\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }
            
            // Clear operation state and hide button on completion
            createOperation.isActive = false;
            createOperation.ws.close(); // Explicitly close WS
            createOperation.ws = null;
            createOperation.payload = null;
            createOperation.title = '';
            createProgressContainer.classList.add('hidden');

            // Refresh cluster list after successful creation and switch to list view
            await fetchExistingClusters(); // Await to ensure list is fetched
            showPrecreatedClustersBtn.click(); // Programmatically click to show updated list

        } else if (msg.type === 'error') {
            showMessage(`Operation failed: ${msg.message}`, true);
            createOperation.logs += `\n${msg.message}\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\n${msg.message}\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }

            // Clear operation state and hide button on error
            createOperation.isActive = false;
            createOperation.ws.close(); // Explicitly close WS
            createOperation.ws = null;
            createOperation.payload = null;
            createOperation.title = '';
            createProgressContainer.classList.add('hidden');
        }
    };

    createOperation.ws.onclose = () => {
        const closeMsg = `\n--- Create Operation Stream Ended ---\n`;
        createOperation.logs += closeMsg;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += closeMsg;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        // If isActive is still true, it means the connection closed unexpectedly.
        // The backend will terminate the process.
        if (createOperation.isActive) {
            showMessage("Create operation stream disconnected unexpectedly. Check logs for final status.", true);
        }
    };

    createOperation.ws.onerror = (error) => {
        console.error('Create WebSocket error:', error);
        const errorMsg = `\nWebSocket Error during create: ${error.message}\n`;
        createOperation.logs += errorMsg;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += errorMsg;
            progressOutput.scrollTop = progressOutput.output.scrollHeight;
        }
        showMessage('WebSocket connection error during EKS create operation.', true);
        
        // Clear operation state and hide button on error
        createOperation.isActive = false;
        createOperation.ws = null;
        createOperation.payload = null;
        createOperation.title = '';
        createProgressContainer.classList.add('hidden');
    };
}

/**
 * Deploys CSI drivers (EBS and EFS) by making API calls to the backend.
 * @param {string} clusterName - The name of the cluster.
 * @param {string} region - The region of the cluster.
 */
// REMOVED: This function is no longer needed as CSI drivers are installed via eksctl addons.
// async function deployCsiDrivers(clusterName, region) { ... }


/**
 * Attempts to retrieve the Grafana LoadBalancer URL by polling the backend.
 * @returns {Promise<string|null>} The Grafana LoadBalancer URL or null if not found after attempts.
 */
async function getGrafanaLoadBalancerUrl() {
    const maxAttempts = 20; // 20 retries * 15 seconds = 5 minutes total
    const pollInterval = 15000; // 15 seconds
    const progressIndicator = '.';
    let progressDots = '';

    const initialMessage = `\nWaiting for Grafana LoadBalancer URL (up to ${maxAttempts * pollInterval / 1000 / 60} minutes)`;
    createOperation.logs += initialMessage;
    if (!progressConsoleModal.classList.contains('hidden')) {
        progressOutput.textContent += initialMessage;
        progressOutput.scrollTop = progressOutput.scrollHeight;
    }

    for (let i = 0; i < maxAttempts; i++) {
        try {
            // MODIFIED: Target the new /kube-get-grafana-url endpoint
            const response = await fetch(`${API_BASE_URL}/kube-get-grafana-url`);
            const data = await response.json();

            if (response.ok && data.url) {
                const successMessage = `\nGrafana URL found: ${data.url}\n`;
                createOperation.logs += successMessage;
                 if (!progressConsoleModal.classList.contains('hidden')) {
                    progressOutput.textContent += successMessage;
                    progressOutput.scrollTop = progressOutput.scrollHeight;
                }
                return data.url;
            }
            // If the backend returns 202 or 404, it's still pending, so we continue.
        } catch (error) {
            // Log other errors but don't stop polling
            console.error(`Error polling for Grafana URL (attempt ${i + 1}):`, error);
        }
        
        // Update progress indicator
        progressDots += progressIndicator;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += progressIndicator;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval)); // Wait before next attempt
    }
    
    const timeoutMessage = `\n\x1b[31mTimed out waiting for Grafana LoadBalancer URL.\x1b[0m\n`;
    createOperation.logs += timeoutMessage;
    if (!progressConsoleModal.classList.contains('hidden')) {
        progressOutput.textContent += timeoutMessage;
        progressOutput.scrollTop = progressOutput.scrollHeight;
    }
    return null; // Return null if URL not found after all attempts
}


/**
 * Deploys the monitoring stack (Prometheus and Grafana) by making API calls to the backend.
 * @param {string} clusterName - The name of the cluster (for context, though not directly used in current manifests).
 * @param {string} region - The region of the cluster (for context).
 */
async function deployMonitoringStack(clusterName, region) {
    createOperation.logs += `\n--- Deploying Monitoring Stack (Prometheus, Grafana) ---\n`;
    if (!progressConsoleModal.classList.contains('hidden')) {
        progressOutput.textContent += `\n--- Deploying Monitoring Stack (Prometheus, Grafana) ---\n`;
        progressOutput.scrollTop = progressOutput.scrollHeight;
    }

    try {
        // Deploy Prometheus
        createOperation.logs += `\nDeploying Prometheus...\n`;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += `\nDeploying Prometheus...\n`;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        let prometheusResult = await fetch(`${API_BASE_URL}/kube-deploy-prometheus`, { method: 'POST' });
        let prometheusData = await prometheusResult.json();
        if (!prometheusResult.ok) throw new Error(prometheusData.error);
        createOperation.logs += `Prometheus: ${prometheusData.message || prometheusData.output}\n`;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += `Prometheus: ${prometheusData.message || prometheusData.output}\n`;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for Prometheus to settle

        // Deploy Grafana
        createOperation.logs += `\nDeploying Grafana...\n`;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += `\nDeploying Grafana...\n`;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        let grafanaResult = await fetch(`${API_BASE_URL}/kube-deploy-grafana`, { method: 'POST' });
        let grafanaData = await grafanaResult.json();
        if (!grafanaResult.ok) throw new Error(grafanaData.error);
        createOperation.logs += `Grafana: ${grafanaData.message || grafanaData.output}\n`;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += `Grafana: ${grafanaData.message || grafanaData.output}\n`;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Attempt to retrieve Grafana URL
        const grafanaUrl = await getGrafanaLoadBalancerUrl();

        if (grafanaUrl) {
            // MODIFIED: The URL from the new endpoint already includes http://
            createOperation.logs += `\nGrafana is accessible at ${grafanaUrl} (admin/admin).\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\nGrafana is accessible at ${grafanaUrl} (admin/admin).\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }
            showMessage(`Grafana deployed! Access at ${grafanaUrl} (admin/admin)`, false);
        } else {
            // MODIFIED: Updated the manual check command to point to the correct service
            createOperation.logs += `\n\x1b[31mCould not automatically determine Grafana URL after multiple attempts. Check 'kubectl get svc -n monitoring grafana-nlb-service'.\x1b[0m\n`;
            if (!progressConsoleModal.classList.contains('hidden')) {
                progressOutput.textContent += `\n\x1b[31mCould not automatically determine Grafana URL after multiple attempts. Check 'kubectl get svc -n monitoring grafana-nlb-service'.\x1b[0m\n`;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            }
            showMessage("Monitoring stack deployed, but could not determine Grafana URL.", true);
        }

    } catch (error) {
        const errorMessage = `Failed to deploy monitoring stack: ${error.message}`;
        createOperation.logs += `\x1b[31m${errorMessage}\x1b[0m\n`;
        if (!progressConsoleModal.classList.contains('hidden')) {
            progressOutput.textContent += `\x1b[31m${errorMessage}\x1b[0m\n`;
            progressOutput.scrollTop = progressOutput.scrollHeight;
        }
        showMessage(errorMessage, true);
    }
}


// Event listener for "Show Pre-created Clusters" button
showPrecreatedClustersBtn.addEventListener('click', () => {
    fetchExistingClusters(); // Fetch and display clusters
    startClusterListPolling(); // Start polling for updates
});

/**
 * Fetches and displays a list of existing EKS clusters.
 * It populates a table with cluster names and regions, and sets up
 * action buttons (Use Cluster, Delete Cluster).
 */
async function fetchExistingClusters() {
    clusterActionArea.innerHTML = `
        <h3 class="text-xl font-semibold text-gray-700 mb-4">Select Existing EKS Cluster</h3>
        <div id="existingClustersList" class="bg-gray-50 p-6 rounded-lg shadow">
            <p class="text-gray-600">Loading existing clusters...</p>
        </div>
        <div class="flex justify-end space-x-3 mt-6">
            <button id="useSelectedClusterBtn" disabled
                    class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                Use Cluster
            </button>
            <button id="deleteSelectedClusterBtn" disabled
                    class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed">
                Delete Cluster
            </button>
        </div>
    `;
    const existingClustersListDiv = document.getElementById('existingClustersList');
    const useSelectedClusterBtn = document.getElementById('useSelectedClusterBtn');
    const deleteSelectedClusterBtn = document.getElementById('deleteSelectedClusterBtn');

    try {
        // Fetch cluster list from the backend API
        const response = await fetch(`${API_BASE_URL}/eks-list-clusters`);
        const clusters = await response.json();

        if (!response.ok) {
            throw new Error(clusters.error || 'Failed to fetch EKS clusters.');
        }

        if (!Array.isArray(clusters) || clusters.length === 0) {
            existingClustersListDiv.innerHTML = '<p class="text-gray-600">No EKS clusters found in this region.</p>';
            useSelectedClusterBtn.disabled = true;
            deleteSelectedClusterBtn.disabled = true;
            return;
        }

        // Build the HTML table for clusters
        let tableHtml = `
            <table class="kube-table">
                <thead>
                    <tr>
                        <th class="w-1/12">Select</th>
                        <th class="w-5/12">Name</th>
                        <th class="w-6/12">Region</th>
                    </tr>
                </thead>
                <tbody>
        `;
        clusters.forEach(cluster => {
            const clusterName = cluster.Name || 'N/A';
            const clusterRegion = cluster.Region || 'N/A';
            const clusterStatus = cluster.Status || 'N/A'; // Assuming 'Status' is available

            tableHtml += `
                <tr class="border-b border-gray-200 hover:bg-gray-50">
                    <td class="w-1/12"><input type="radio" name="selectedCluster" value="${clusterName}" data-region="${clusterRegion}" onchange="toggleClusterActionButtons()"></td>
                    <td class="w-5/12"><span class="cluster-name-link text-blue-600 hover:underline cursor-pointer" data-cluster-name="${encodeURIComponent(clusterName)}" data-cluster-region="${encodeURIComponent(clusterRegion)}">${clusterName}</span></td>
                    <td class="w-6/12">${clusterRegion} (${clusterStatus})</td>
                </tr>
            `;
        });
        tableHtml += `</tbody></table>`;
        existingClustersListDiv.innerHTML = tableHtml;
        toggleClusterActionButtons(); // Initialize button state based on selection
    } catch (error) {
        console.error('Error fetching existing clusters:', error);
        existingClustersListDiv.innerHTML = `<p class="text-red-600">Failed to load clusters: ${error.message}</p>`;
        showMessage(`Error loading clusters: ${error.message}`, true);
        useSelectedClusterBtn.disabled = true;
        deleteSelectedClusterBtn.disabled = true;
    }
}

/**
 * Toggles the disabled state of "Use Cluster" and "Delete Cluster" buttons
 * based on whether a cluster radio button is selected.
 */
function toggleClusterActionButtons() {
    const selectedCluster = document.querySelector('input[name="selectedCluster"]:checked');
    const useSelectedClusterBtn = document.getElementById('useSelectedClusterBtn');
    const deleteSelectedClusterBtn = document.getElementById('deleteSelectedClusterBtn');

    if (useSelectedClusterBtn) {
        useSelectedClusterBtn.disabled = !selectedCluster;
    }
    if (deleteSelectedClusterBtn) {
        deleteSelectedClusterBtn.disabled = !selectedCluster;
    }
}

/**
 * Starts polling the backend for cluster list updates at a regular interval.
 */
function startClusterListPolling() {
    stopClusterListPolling(); // Clear any existing interval to prevent multiple polls
    clusterListPollingInterval = setInterval(fetchExistingClusters, 10000); // Poll every 10 seconds
    console.log("Started polling for cluster list updates.");
}

/**
 * Stops the ongoing polling for cluster list updates.
 */
function stopClusterListPolling() {
    if (clusterListPollingInterval) {
        clearInterval(clusterListPollingInterval);
        clusterListPollingInterval = null;
        console.log("Stopped polling for cluster list updates.");
    }
}

// Event listener for the "Use Cluster" and "Delete Cluster" buttons (delegated since they're added dynamically)
clusterActionArea.addEventListener('click', async (event) => {
    if (event.target && event.target.id === 'useSelectedClusterBtn') {
        const selectedClusterRadio = document.querySelector('input[name="selectedCluster"]:checked');
        if (selectedClusterRadio) {
            const clusterName = selectedClusterRadio.value;
            const region = selectedClusterRadio.dataset.region; // Get region from data attribute

            if (!region || region.trim() === '' || region === 'N/A') {
                showMessage("Error: Region information is missing for the selected cluster. Cannot set kubectl context.", true);
                return;
            }

            showMessage(`Setting kubectl context for cluster '${clusterName}'...`, false);
            stopClusterListPolling(); // Stop polling when using a cluster (navigating away)

            try {
                // Send request to backend to set kubectl context
                const response = await fetch(`${API_BASE_URL}/eks-set-context`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clusterName, region })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to set kubectl context.');
                }
                showMessage(result.message, false);
                // Redirect to the dashboard page after successful context setting
                window.location.href = '/kubernetes-dashboard.html';
            } catch (error) {
                console.error('Error setting kubectl context:', error);
                showMessage(`Error setting context: ${error.message}`, true);
                // If setting context fails, restart polling if we're still on the list view
                if (clusterActionArea.innerHTML.includes('existingClustersList')) {
                    startClusterListPolling();
                }
            }
        } else {
            showMessage("Please select a cluster to use.", true);
        }
    } else if (event.target && event.target.id === 'deleteSelectedClusterBtn') {
        const selectedClusterRadio = document.querySelector('input[name="selectedCluster"]:checked');
        if (selectedClusterRadio) {
            const clusterName = selectedClusterRadio.value;
            const region = selectedClusterRadio.dataset.region;
            
            if (!region || region.trim() === '' || region === 'N/A') {
                showMessage("Error: Region information is missing for the selected cluster. Cannot delete cluster.", true);
                return;
            }

            // Initialize delete operation state
            deleteOperation.isActive = true;
            deleteOperation.title = `Deleting EKS Cluster: ${clusterName}`;
            deleteOperation.logs = ''; // Clear previous logs for new operation
            deleteOperation.payload = { // Store payload
                commandType: 'delete',
                payload: { clusterName, region }
            };

            // Show progress console and current progress button
            showProgressConsole(deleteOperation.title, deleteOperation.logs);
            deleteProgressContainer.classList.remove('hidden'); // Show the "View Delete Progress" button
            stopClusterListPolling(); // Stop polling during deletion operation

            // Close existing WebSocket for this operation if open
            if (deleteOperation.ws) {
                deleteOperation.ws.close();
            }

            // Establish new WebSocket connection and send command
            deleteOperation.ws = new WebSocket(`ws://localhost:3000?type=eks-cli-stream`);

            deleteOperation.ws.onopen = () => {
                deleteOperation.ws.send(JSON.stringify(deleteOperation.payload));
                const initialMsg = `\nInitiating cluster deletion for '${clusterName}'... This may take several minutes.\n`;
                deleteOperation.logs += initialMsg;
                progressOutput.textContent += initialMsg;
                progressOutput.scrollTop = progressOutput.scrollHeight;
            };

            deleteOperation.ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.type === 'log') {
                    deleteOperation.logs += msg.data;
                    if (!progressConsoleModal.classList.contains('hidden')) {
                        progressOutput.textContent += msg.data;
                        progressOutput.scrollTop = progressOutput.scrollHeight;
                    }
                } else if (msg.type === 'complete') {
                    showMessage(msg.message, false);
                    deleteOperation.logs += `\n${msg.message}\n`;
                    if (!progressConsoleModal.classList.contains('hidden')) {
                        progressOutput.textContent += `\n${msg.message}\n`;
                        progressOutput.scrollTop = progressOutput.scrollHeight;
                    }
                    // Clear operation state and hide button on completion
                    deleteOperation.isActive = false;
                    deleteOperation.ws.close(); // Explicitly close WS
                    deleteOperation.ws = null;
                    deleteOperation.payload = null;
                    deleteOperation.title = '';
                    deleteProgressContainer.classList.add('hidden');
                    // Clear Grafana URL from local storage on cluster deletion
                    localStorage.removeItem('grafanaDashboardUrl');
                    showMessage('Grafana URL cleared from local storage.', false);
                    // Refresh cluster list after successful deletion and switch to list view
                    setTimeout(async () => {
                        await fetchExistingClusters();
                        showPrecreatedClustersBtn.click(); // Programmatically click to show updated list
                    }, 5000); // 5-second delay
                } else if (msg.type === 'error') {
                    showMessage(`Operation failed: ${msg.message}`, true);
                    deleteOperation.logs += `\n${msg.message}\n`;
                    if (!progressConsoleModal.classList.contains('hidden')) {
                        progressOutput.textContent += `\n${msg.message}\n`;
                        progressOutput.scrollTop = progressOutput.scrollTop;
                    }

                    // Clear operation state and hide button on error
                    deleteOperation.isActive = false;
                    deleteOperation.ws.close(); // Explicitly close WS
                    deleteOperation.ws = null;
                    deleteOperation.payload = null;
                    deleteOperation.title = '';
                    deleteProgressContainer.classList.add('hidden');
                }
            };

            deleteOperation.ws.onclose = () => {
                const closeMsg = `\n--- Delete Operation Stream Ended ---\n`;
                deleteOperation.logs += closeMsg;
                if (!progressConsoleModal.classList.contains('hidden')) {
                    progressOutput.textContent += closeMsg;
                    progressOutput.scrollTop = progressOutput.scrollHeight;
                }
                if (deleteOperation.isActive) {
                    showMessage("Delete operation stream disconnected unexpectedly. Check logs for final status.", true);
                }
            };

            deleteOperation.ws.onerror = (error) => {
                console.error('Delete WebSocket error:', error);
                const errorMsg = `\nWebSocket Error during delete: ${error.message}\n`;
                deleteOperation.logs += errorMsg;
                if (!progressConsoleModal.classList.contains('hidden')) {
                    progressOutput.textContent += errorMsg;
                    progressOutput.scrollTop = progressOutput.scrollHeight;
                }
                showMessage('WebSocket connection error during EKS delete operation.', true);

                // Clear operation state and hide button on error
                deleteOperation.isActive = false;
                deleteOperation.ws = null;
                deleteOperation.payload = null;
                deleteOperation.title = '';
                deleteProgressContainer.classList.add('hidden');
            };
        } else {
            showMessage("Please select a cluster to delete.", true);
        }
    }
});

// Delegate click event for cluster name links to show details
clusterActionArea.addEventListener('click', (event) => {
    if (event.target && event.target.classList.contains('cluster-name-link')) {
        event.preventDefault(); // Prevent default link behavior
        const clusterName = decodeURIComponent(event.target.dataset.clusterName);
        const region = decodeURIComponent(event.target.dataset.clusterRegion);
        showClusterDetails(clusterName, region);
        stopClusterListPolling(); // Stop polling when showing cluster details
    }
});

// Event listener for the "View Create Progress" button
showCreateProgressBtn.addEventListener('click', () => {
    if (createOperation.isActive) {
        showProgressConsole(createOperation.title, createOperation.logs);
    } else {
        showMessage("No active cluster creation in progress.", true);
        createProgressContainer.classList.add('hidden'); // Ensure button is hidden if no active op
    }
});

// Event listener for the "View Delete Progress" button
showDeleteProgressBtn.addEventListener('click', () => {
    if (deleteOperation.isActive) {
        showProgressConsole(deleteOperation.title, deleteOperation.logs);
    } else {
        showMessage("No active cluster deletion in progress.", true);
        deleteProgressContainer.classList.add('hidden'); // Ensure button is hidden if no active op
    }
});


// Handle Exit EKS Access button click
exitEksAccessBtn.addEventListener('click', async () => {
    showConfirmModal("Are you sure you want to exit EKS access? This will clear your AWS credentials for this session.", async (confirmed) => {
        if (!confirmed) {
            showMessage("Logout cancelled.", false);
            return;
        }

        showMessage("Clearing AWS credentials...", false);
        try {
            // Send request to backend to clear AWS credentials
            const response = await fetch(`${API_BASE_URL}/eks-clear-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to clear AWS credentials.');
            }
            showMessage(result.message, false);
            // Reset UI to initial state (show login modal, hide EKS content)
            eksManagementContent.classList.add('hidden');
            awsCredentialsModal.classList.add('hidden'); // Ensure modal is hidden
            awsCredentialsForm.reset(); // Clear form fields
            eksConnectionStatus.textContent = "Not connected to eksctl.";
            clusterActionArea.innerHTML = ''; // Clear any dynamic content
            loginToAwsContainer.classList.remove('hidden'); // Show the login button container
            loginToAwsBtn.classList.remove('hidden'); // Show the login button
            stopClusterListPolling(); // Stop polling on logout
            
            // Also hide the progress buttons and clear their states
            createProgressContainer.classList.add('hidden');
            deleteProgressContainer.classList.add('hidden');
            createOperation = { ws: null, payload: null, title: '', isActive: false, logs: '' };
            deleteOperation = { ws: null, payload: null, title: '', isActive: false, logs: '' };
            // Clear Grafana URL from local storage on logout
            localStorage.removeItem('grafanaDashboardUrl');
            showMessage('Grafana URL cleared from local storage.', false);

        } catch (error) {
            console.error('Error clearing AWS credentials:', error);
            showMessage(`Error during logout: ${error.message}`, true);
        }
    });
});


// Initial setup on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initially hide the EKS management content and the login button container
    eksManagementContent.classList.add('hidden');
    loginToAwsContainer.classList.add('hidden'); // Hide container by default
    createProgressContainer.classList.add('hidden'); // Ensure progress buttons are hidden on load
    deleteProgressContainer.classList.add('hidden'); // Ensure progress buttons are hidden on load
    // Check EKS connection status on page load
    checkEKSConnection();
});
