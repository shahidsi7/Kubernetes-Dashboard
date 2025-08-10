// public/js/dashboard-app.js
// This script provides the client-side logic for the Kubernetes Dashboard UI (kubernetes-dashboard.html).
// It handles fetching and displaying cluster metrics, resource lists (pods, deployments, services, PVCs, PVs, StorageClasses),
// and interactive actions like creating/deleting resources, scaling deployments, and viewing logs.

// Base URL for API calls to the backend.
const API_BASE_URL = 'http://localhost:3000';

// Import UI helper functions
import { showMessage, showConfirmModal, addDynamicInputField, getSkeletonLoader } from './utils/ui-helpers.js';
// Import resource parsing utilities
import { parseResourceValue, parseCpuQuantity, parseMemoryQuantity } from './utils/resource-parsers.js';
// Import API client functions for making backend requests
import {
    fetchNamespaces, fetchPods, fetchDeployments, fetchServices,
    fetchIngresses, fetchPvcs, fetchPvs, fetchStorageClasses, fetchDeploymentDetails, 
    fetchServiceDetails, fetchPodDetails, fetchPvcDetails, fetchPvDetails, createPod, 
    deletePod, createDeployment, deleteDeployment, scaleDeployment, createService, 
    deleteService, createIngress, deleteIngress, deletePvc, createStorageClass, 
    deleteStorageClass, fetchStorageClassDetails, createPvc, bindPvc, 
    startGrafanaPortForward, stopGrafanaPortForward, fetchConfigMaps, createConfigMap,
    deleteConfigMap, fetchSecrets, createSecret, deleteSecret, createNamespace,
    createUserMapping, fetchUserMappings, fetchWorkerNodes, fetchTreeResources
} from './utils/api-client.js';
// Import functions for rendering various lists on the dashboard
import {
    renderWorkerNodesList, renderPodsList, renderDeploymentsList,
    renderServicesList, renderIngressesList, renderPvcList, renderPvList, 
    renderStorageClassList
} from './components/dashboard-renderers.js';


// UI Elements for counts
const nodesCountElement = document.getElementById('currentNodesCount');
const podsCountElement = document.getElementById('currentPodsCount');
const deploymentsCountElement = document.getElementById('currentDeploymentsCount');
const servicesCountElement = document.getElementById('currentServicesCount');
const ingressesCountElement = document.getElementById('currentIngressesCount');
const pvcCountElement = document.getElementById('currentPvcCount');
const pvCountElement = document.getElementById('currentPvCount');
const configMapCountElement = document.getElementById('currentConfigMapCount');
const secretCountElement = document.getElementById('currentSecretCount');

// NEW: Namespace Selector Element
const namespaceSelect = document.getElementById('namespaceSelect');
const addNamespaceBtn = document.getElementById('addNamespaceBtn'); // NEW

// NEW: Tab Navigation Elements
const overviewTab = document.getElementById('overviewTab');
const resourceFlowTab = document.getElementById('resourceFlowTab');
const accessControlTab = document.getElementById('accessControlTab');
const overviewContent = document.getElementById('overviewContent');
const resourceFlowContent = document.getElementById('resourceFlowContent');
const accessControlContent = document.getElementById('accessControlContent');

// NEW: Resource Flow UI Elements
const treeContainer = document.getElementById('treeContainer');
const tooltip = document.getElementById('tooltip');
const refreshTreeViewBtn = document.getElementById('refreshTreeViewBtn');


// NEW: Access Control UI Elements
const addUserMappingBtn = document.getElementById('addUserMappingBtn');
const userMappingModal = document.getElementById('userMappingModal');
const userMappingForm = document.getElementById('userMappingForm');
const closeUserMappingModalBtn = document.getElementById('closeUserMappingModalBtn');
const mappingNamespaceSelect = document.getElementById('mappingNamespace');
const permissionsContainer = document.getElementById('permissionsContainer');
const addPermissionRuleBtn = document.getElementById('addPermissionRuleBtn');
const userMappingsList = document.getElementById('userMappingsList');
const refreshUserMappingsBtn = document.getElementById('refreshUserMappingsBtn');

// UI Elements for lists
const workerNodesListElement = document.getElementById('workerNodesList');
const podsListElement = document.getElementById('podsList');
const createPodBtn = document.getElementById('createPodBtn');
const deleteSelectedPodBtn = document.getElementById('deleteSelectedPodBtn');
const viewPodLogsBtn = document.getElementById('viewPodLogsBtn');

// UI Elements for Create Pod Modal
const createPodModal = document.getElementById('createPodModal');
const createPodForm = document.getElementById('createPodForm');
const podNameInput = document.getElementById('podName');
const podImageInput = document.getElementById('podImage');
const numPodsInput = document.getElementById('numPods');
const podCommandInput = document.getElementById('podCommand');
const podCpuRequestInput = document.getElementById('podCpuRequest');
const podCpuLimitInput = document.getElementById('podCpuLimit');
const podMemoryRequestInput = document.getElementById('podMemoryRequest');
const podMemoryLimitInput = document.getElementById('podMemoryLimit');
const envVarsContainer = document.getElementById('envVarsContainer');
const addEnvVarBtn = document.getElementById('addEnvVarBtn');
const labelsContainer = document.getElementById('labelsContainer');
const addLabelBtn = document.getElementById('addLabelBtn');
const closeCreatePodModalBtn = document.getElementById('closeCreatePodModalBtn');
const podEnvFromContainer = document.getElementById('podEnvFromContainer');
const podAddEnvFromConfigMapBtn = document.getElementById('podAddEnvFromConfigMapBtn');
const podAddEnvFromSecretBtn = document.getElementById('podAddEnvFromSecretBtn');


// MODIFIED: UI Elements for Pod PVC
const enablePodPvcCheckbox = document.getElementById('enablePodPvc');
const podPvcFieldsDiv = document.getElementById('podPvcFields');
const podPvcSelect = document.getElementById('podPvcSelect'); // Changed from input to select
const podVolumeMountPathInput = document.getElementById('podVolumeMountPath');
const podVolumeSubPathInput = document.getElementById('podVolumeSubPath');


// UI Elements for Deployment Management
const createDeploymentBtn = document.getElementById('createDeploymentBtn');
const deploymentsListElement = document.getElementById('deploymentsList');
const deleteSelectedDeploymentsBtn = document.getElementById('deleteSelectedDeploymentsBtn');
const exposeDeploymentBtn = document.getElementById('exposeDeploymentBtn');
const scaleDeploymentBtn = document.getElementById('scaleDeploymentBtn');
const createDeploymentModal = document.getElementById('createDeploymentModal');
const createDeploymentForm = document.getElementById('createDeploymentForm');
const deploymentNameInput = document.getElementById('deploymentName');
const deploymentImageInput = document.getElementById('deploymentImage');
const deploymentReplicasInput = document.getElementById('deploymentReplicas');
const deploymentCpuRequestInput = document.getElementById('deploymentCpuRequest');
const deploymentCpuLimitInput = document.getElementById('deploymentCpuLimit');
const deploymentMemoryRequestInput = document.getElementById('deploymentMemoryRequest');
const deploymentMemoryLimitInput = document.getElementById('deploymentMemoryLimit');
const deploymentEnvVarsContainer = document.getElementById('deploymentEnvVarsContainer');
const addDeploymentEnvVarBtn = document.getElementById('addDeploymentEnvVarBtn');
const deploymentLabelsContainer = document.getElementById('deploymentLabelsContainer');
const addDeploymentLabelBtn = document.getElementById('addDeploymentLabelBtn');
const deploymentStrategySelect = document.getElementById('deploymentStrategy');
const deploymentEnvFromContainer = document.getElementById('deploymentEnvFromContainer');
const deploymentAddEnvFromConfigMapBtn = document.getElementById('deploymentAddEnvFromConfigMapBtn');
const deploymentAddEnvFromSecretBtn = document.getElementById('deploymentAddEnvFromSecretBtn');


// MODIFIED: UI Elements for Deployment PVC
const enableDeploymentPvcCheckbox = document.getElementById('enableDeploymentPvc');
const deploymentPvcFieldsDiv = document.getElementById('deploymentPvcFields');
const deploymentPvcSelect = document.getElementById('deploymentPvcSelect'); // Changed from input to select
const deploymentVolumeMountPathInput = document.getElementById('deploymentVolumeMountPath');
const deploymentVolumeSubPathInput = document.getElementById('deploymentVolumeSubPath');


// UI Elements for Service Management
const servicesListElement = document.getElementById('servicesList');
const deleteSelectedServicesBtn = document.getElementById('deleteSelectedServicesBtn');

// NEW: UI Elements for Ingress Management
const ingressesListElement = document.getElementById('ingressesList');
const createIngressBtn = document.getElementById('createIngressBtn');
const deleteSelectedIngressesBtn = document.getElementById('deleteSelectedIngressesBtn');
const createIngressModal = document.getElementById('createIngressModal');
const createIngressForm = document.getElementById('createIngressForm');
const ingressNameInput = document.getElementById('ingressName');
const ingressServiceSelect = document.getElementById('ingressServiceSelect');
const ingressServicePortInput = document.getElementById('ingressServicePort');
const ingressPathInput = document.getElementById('ingressPath');
const ingressPathTypeSelect = document.getElementById('ingressPathType');
const closeCreateIngressModalBtn = document.getElementById('closeCreateIngressModalBtn');


// UI Elements for PVC/PV Management
const pvcListElement = document.getElementById('pvcList');
const pvListElement = document.getElementById('pvList');
const createPvcBtn = document.getElementById('createPvcBtn'); // NEW: Create PVC button
const deleteSelectedPvcBtn = document.getElementById('deleteSelectedPvcBtn');

// NEW: UI Elements for Create PVC Modal
const createPvcModal = document.getElementById('createPvcModal');
const createPvcForm = document.getElementById('createPvcForm');
const newPvcNameInput = document.getElementById('newPvcName');
const newPvcStorageSizeInput = document.getElementById('newPvcStorageSize');
const newPvcAccessModeSelect = document.getElementById('newPvcAccessMode');
const newPvcStorageClassSelect = document.getElementById('newPvcStorageClass');
const closeCreatePvcModalBtn = document.getElementById('closeCreatePvcModalBtn');

// NEW: UI Elements for Bind PVC Modal
const bindPvcModal = document.getElementById('bindPvcModal');
const bindPvcNameSpan = document.getElementById('bindPvcName');
const bindPvcForm = document.getElementById('bindPvcForm');
const bindPvcNamespaceInput = document.getElementById('bindPvcNamespace');
const bindPvcSizeInput = document.getElementById('bindPvcSize');
const bindPvcAccessModesInput = document.getElementById('bindPvcAccessModes');
const bindPvcStorageClassSelect = document.getElementById('bindPvcStorageClassSelect');
const closeBindPvcModalBtn = document.getElementById('closeBindPvcModalBtn');


// UI Elements for Deployment Details Modal
const deploymentDetailsModal = document.getElementById('deploymentDetailsModal');
const detailsDeploymentName = document.getElementById('detailsDeploymentName');
const deploymentDetailsContent = document.getElementById('deploymentDetailsContent');
const closeDeploymentDetailsModalBtn = document.getElementById('closeDeploymentDetailsModalBtn');

// UI Elements for Scale Deployment Modal
const scaleDeploymentModal = document.getElementById('scaleDeploymentModal');
const scaleDeploymentName = document.getElementById('scaleDeploymentName');
const scaleDeploymentNamespace = document.getElementById('scaleDeploymentNamespace');
const currentReplicasInput = document.getElementById('currentReplicas');
const newReplicasInput = document.getElementById('newReplicas');
const scaleDeploymentForm = document.getElementById('scaleDeploymentForm');
const closeScaleDeploymentModalBtn = document.getElementById('closeScaleDeploymentModalBtn');

// UI Elements for Expose Service Modal
const exposeServiceModal = document.getElementById('exposeServiceModal');
const exposeServiceForm = document.getElementById('exposeServiceForm');
const serviceDeploymentNameInput = document.getElementById('serviceDeploymentName');
const serviceNameInput = document.getElementById('serviceName');
const serviceTypeSelect = document.getElementById('serviceType');
const appPortInput = document.getElementById('appPort');
const targetPortInput = document.getElementById('targetPort');
const protocolSelect = document.getElementById('protocol');
const serviceSelectorContainer = document.getElementById('serviceSelectorContainer');
const addServiceSelectorBtn = document.getElementById('addServiceSelectorBtn');
const closeExposeServiceModalBtn = document.getElementById('closeExposeServiceModalBtn');

// UI Elements for Service Details Modal
const serviceDetailsModal = document.getElementById('serviceDetailsModal');
const detailsServiceName = document.getElementById('detailsServiceName');
const serviceDetailsContent = document.getElementById('serviceDetailsContent');
const closeServiceDetailsModalBtn = document.getElementById('closeServiceDetailsModalBtn');

// UI Elements for Pod Details Modal
const podDetailsModal = document.getElementById('podDetailsModal');
const detailsPodName = document.getElementById('detailsPodName');
const podDetailsContent = document.getElementById('podDetailsContent');
const closePodDetailsModalBtn = document.getElementById('closePodDetailsModalBtn');

// Pod Logs Modal Elements
const podLogsModal = document.getElementById('podLogsModal');
const logsPodName = document.getElementById('logsPodName');
const podLogsOutput = document.getElementById('podLogsOutput');
const closePodLogsModalBtn = document.getElementById('closePodLogsModalBtn');
let podLogsWs = null; // WebSocket for logs

// PVC Details Modal Elements
const pvcDetailsModal = document.getElementById('pvcDetailsModal');
const detailsPvcName = document.getElementById('detailsPvcName');
const pvcDetailsContent = document.getElementById('pvcDetailsContent');
const closePvcDetailsModalBtn = document.getElementById('closePvcDetailsModalBtn');

// PV Details Modal Elements
const pvDetailsModal = document.getElementById('pvDetailsModal');
const detailsPvName = document.getElementById('detailsPvName');
const pvDetailsContent = document.getElementById('pvDetailsContent');
const closePvDetailsModalBtn = document.getElementById('closePvDetailsModalBtn');

// StorageClass Management
const storageClassListElement = document.getElementById('storageClassList');
const openCreateStorageClassModalBtn = document.getElementById('openCreateStorageClassModalBtn');
const createStorageClassModal = document.getElementById('createStorageClassModal');
const closeCreateStorageClassModalBtn = document.getElementById('closeCreateStorageClassModalBtn');
const createStorageClassForm = document.getElementById('createStorageClassForm');
const cancelCreateStorageClassBtn = document.getElementById('cancelCreateStorageClassBtn');
const addScParameterBtn = document.getElementById('addScParameterBtn');
const scParametersContainer = document.getElementById('scParametersContainer');

// NEW: StorageClass Details Modal Elements
const storageClassDetailsModal = document.getElementById('storageClassDetailsModal');
const detailsStorageClassName = document.getElementById('detailsStorageClassName');
const storageClassDetailsContent = document.getElementById('storageClassDetailsContent');
const closeStorageClassDetailsModalBtn = document.getElementById('closeStorageClassDetailsModalBtn');

// NEW: ConfigMap and Secret UI Elements
const configMapListElement = document.getElementById('configMapList');
const createConfigMapBtn = document.getElementById('createConfigMapBtn');
const deleteSelectedConfigMapBtn = document.getElementById('deleteSelectedConfigMapBtn');
const createConfigMapModal = document.getElementById('createConfigMapModal');
const createConfigMapForm = document.getElementById('createConfigMapForm');
const configMapNameInput = document.getElementById('configMapName');
const configMapDataContainer = document.getElementById('configMapDataContainer');
const addConfigMapDataBtn = document.getElementById('addConfigMapDataBtn');
const closeCreateConfigMapModalBtn = document.getElementById('closeCreateConfigMapModalBtn');

const secretListElement = document.getElementById('secretList');
const createSecretBtn = document.getElementById('createSecretBtn');
const deleteSelectedSecretBtn = document.getElementById('deleteSelectedSecretBtn');
const createSecretModal = document.getElementById('createSecretModal');
const createSecretForm = document.getElementById('createSecretForm');
const secretNameInput = document.getElementById('secretName');
const secretDataContainer = document.getElementById('secretDataContainer');
const addSecretDataBtn = document.getElementById('addSecretDataBtn');
const closeCreateSecretModalBtn = document.getElementById('closeCreateSecretModalBtn');

// NEW: Namespace Creation Modal Elements
const createNamespaceModal = document.getElementById('createNamespaceModal');
const createNamespaceForm = document.getElementById('createNamespaceForm');
const namespaceNameInput = document.getElementById('namespaceName');
const closeCreateNamespaceModalBtn = document.getElementById('closeCreateNamespaceModalBtn');

// NEW: Refresh Buttons for individual sections
const refreshNodesBtn = document.getElementById('refreshNodesBtn');
const refreshPodsBtn = document.getElementById('refreshPodsBtn');
const refreshDeploymentsBtn = document.getElementById('refreshDeploymentsBtn');
const refreshServicesBtn = document.getElementById('refreshServicesBtn');
const refreshIngressesBtn = document.getElementById('refreshIngressesBtn');
const refreshPvcBtn = document.getElementById('refreshPvcBtn');
const refreshPvBtn = document.getElementById('refreshPvBtn');
const refreshStorageClassesBtn = document.getElementById('refreshStorageClassesBtn');
const refreshConfigMapsBtn = document.getElementById('refreshConfigMapsBtn');
const refreshSecretsBtn = document.getElementById('refreshSecretsBtn');

// NEW: Grafana Dashboard Button
const grafanaDashboardBtn = document.getElementById('grafanaDashboardBtn');

// --- Event Listeners for Modals and Dynamic Fields ---

// Open/close StorageClass modal logic
openCreateStorageClassModalBtn.addEventListener('click', () => {
    createStorageClassModal.classList.remove('hidden');
});
closeCreateStorageClassModalBtn.addEventListener('click', () => {
    createStorageClassModal.classList.add('hidden');
    createStorageClassForm.reset();
    scParametersContainer.innerHTML = ''; // Clear dynamic fields
});
cancelCreateStorageClassBtn.addEventListener('click', () => {
    createStorageClassModal.classList.add('hidden');
    createStorageClassForm.reset();
    scParametersContainer.innerHTML = ''; // Clear dynamic fields
});

// Add parameter row for StorageClass form
addScParameterBtn.addEventListener('click', () => {
    addDynamicInputField(scParametersContainer, 'scParameter', 'Parameter');
});

// Handle StorageClass creation form submission
createStorageClassForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = createStorageClassForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    try {
        const name = document.getElementById('scName').value.trim();
        const provisioner = document.getElementById('scProvisioner').value.trim();
        const reclaimPolicy = document.getElementById('scReclaimPolicy').value.trim();
        const volumeBindingMode = document.getElementById('scVolumeBindingMode').value.trim();
        const allowVolumeExpansion = document.getElementById('scAllowVolumeExpansion').checked;

        // Gather parameters from dynamic fields
        const parameters = {};
        scParametersContainer.querySelectorAll('div.flex').forEach(div => {
            const key = div.querySelector('input[name="scParameterKey"]').value.trim(); // Corrected name attribute
            const value = div.querySelector('input[name="scParameterValue"]').value.trim(); // Corrected name attribute
            if (key) parameters[key] = value;
        });

        const body = {
            name,
            provisioner,
            parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
            reclaimPolicy: reclaimPolicy || undefined,
            volumeBindingMode: volumeBindingMode || undefined,
            allowVolumeExpansion
        };

        const result = await createStorageClass(body); // Call API client function
        showMessage(result.message, false);
        createStorageClassModal.classList.add('hidden');
        createStorageClassForm.reset();
        scParametersContainer.innerHTML = '';
        // Granular refresh: Only refresh storage classes list
        refreshStorageClassesSection(); // Changed to granular refresh

    } catch (err) {
        showMessage(`Error creating StorageClass: ${err.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});


// --- Create Pod Modal Logic ---
createPodBtn.addEventListener('click', () => {
    createPodForm.reset(); // Clear form fields
    numPodsInput.value = 1; // Reset numPods to 1
    podImageInput.value = 'nginx:latest'; // Set default image
    podCommandInput.value = ''; // Clear command input
    podCpuRequestInput.value = ''; // Clear resource inputs
    podCpuLimitInput.value = '';
    podMemoryRequestInput.value = '';
    podMemoryLimitInput.value = '';
    envVarsContainer.innerHTML = ''; // Clear existing env vars
    labelsContainer.innerHTML = ''; // Clear existing labels
    podEnvFromContainer.innerHTML = ''; // NEW: Clear envFrom selections

    // Clear and hide PVC fields
    enablePodPvcCheckbox.checked = false;
    podPvcFieldsDiv.classList.add('hidden');
    podVolumeMountPathInput.value = '';
    podVolumeSubPathInput.value = '';

    createPodModal.classList.remove('hidden'); // Show the modal
});

closeCreatePodModalBtn.addEventListener('click', () => {
    createPodModal.classList.add('hidden');
});

// MODIFIED: Toggle PVC fields visibility and populate dropdown for Pods
enablePodPvcCheckbox.addEventListener('change', async () => {
    if (enablePodPvcCheckbox.checked) {
        podPvcFieldsDiv.classList.remove('hidden');
        podPvcSelect.required = true;
        podVolumeMountPathInput.required = true;

        // Fetch and populate available PVCs
        podPvcSelect.innerHTML = '<option>Loading PVCs...</option>';
        const currentNamespace = namespaceSelect ? namespaceSelect.value : 'default';
        try {
            const pvcs = await fetchPvcs(currentNamespace);
            // MODIFIED: Filter for PVCs that are 'Bound' or 'Pending'
            const availablePvcs = pvcs.filter(pvc => pvc.status.phase === 'Bound' || pvc.status.phase === 'Pending');
            if (availablePvcs.length > 0) {
                podPvcSelect.innerHTML = availablePvcs.map(pvc => `<option value="${pvc.metadata.name}">${pvc.metadata.name} (${pvc.spec.resources.requests.storage})</option>`).join('');
            } else {
                podPvcSelect.innerHTML = '<option value="">No available PVCs found in this namespace</option>';
            }
        } catch (error) {
            showMessage(`Error fetching PVCs: ${error.message}`, true);
            podPvcSelect.innerHTML = '<option value="">Error loading PVCs</option>';
        }

    } else {
        podPvcFieldsDiv.classList.add('hidden');
        podPvcSelect.required = false;
        podVolumeMountPathInput.required = false;
    }
});

addEnvVarBtn.addEventListener('click', () => {
    addDynamicInputField(envVarsContainer, 'env', 'Environment Variable');
});

addLabelBtn.addEventListener('click', () => {
    addDynamicInputField(labelsContainer, 'label', 'Label');
});

createPodForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = createPodForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';

    try {
        const podName = podNameInput.value.trim();
        const podImage = podImageInput.value.trim();
        const numPods = parseInt(numPodsInput.value, 10);
        const podCommand = podCommandInput.value.trim();
        const currentNamespace = namespaceSelect ? namespaceSelect.value : 'default';

        const cpuRequest = parseResourceValue(podCpuRequestInput.value, 'cpu');
        const cpuLimit = parseResourceValue(podCpuLimitInput.value, 'cpu');
        const memoryRequest = parseResourceValue(podMemoryRequestInput.value, 'memory');
        const memoryLimit = parseResourceValue(podMemoryLimitInput.value, 'memory');

        const envVars = [];
        envVarsContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
            const key = div.querySelector('input[name="envKey"]').value.trim();
            const value = div.querySelector('input[name="envValue"]').value.trim();
            if (key && value) {
                envVars.push({ name: key, value: value });
            }
        });

        const labels = {};
        labelsContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
            const key = div.querySelector('input[name="labelKey"]').value.trim();
            const value = div.querySelector('input[name="labelValue"]').value.trim();
            if (key && value) {
                labels[key] = value;
            }
        });

        // NEW: Gather envFrom selections
        const envFrom = [];
        podEnvFromContainer.querySelectorAll('select').forEach(select => {
            if (select.value) {
                envFrom.push({
                    type: select.dataset.type,
                    name: select.value
                });
            }
        });

        // MODIFIED: Logic to attach an existing PVC
        let pvc = null;
        if (enablePodPvcCheckbox.checked) {
            const pvcName = podPvcSelect.value;
            const volumeMountPath = podVolumeMountPathInput.value.trim();
            const volumeSubPath = podVolumeSubPathInput.value.trim();

            if (!pvcName || !volumeMountPath) {
                showMessage("An existing PVC and a Volume Mount Path are required when attaching a volume.", true);
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }

            pvc = {
                name: pvcName, // This is now the name of the existing PVC
                volumeMountPath: volumeMountPath,
                volumeSubPath: volumeSubPath || undefined
            };
        }

        showMessage(`Creating ${numPods} pod(s) with prefix '${podName}' in namespace '${currentNamespace}'...`, false);
        createPodModal.classList.add('hidden');

        const result = await createPod({
            name: podName,
            image: podImage,
            env: envVars,
            envFrom: envFrom, // NEW
            labels: labels,
            numPods: numPods,
            command: podCommand,
            cpuRequest: cpuRequest,
            cpuLimit: cpuLimit,
            memoryRequest: memoryRequest,
            memoryLimit: memoryLimit,
            pvc: pvc, // This object now references an existing PVC
            namespace: currentNamespace
        });
        showMessage(result.message, false);

    } catch (err) {
        showMessage(`Error creating pod(s): ${err.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        refreshPodsSection();
    }
});

// --- Delete Pod Logic ---
deleteSelectedPodBtn.addEventListener('click', async () => {
    const selectedPods = document.querySelectorAll('input[name="selectedPod"]:checked');
    const podsToDelete = Array.from(selectedPods).map(checkbox => ({
        name: checkbox.value,
        namespace: checkbox.dataset.namespace || 'default',
        isManaged: checkbox.dataset.isManaged === 'true',
        ownerDeploymentName: checkbox.dataset.ownerDeployment
    }));

    if (podsToDelete.length === 0) {
        showMessage("Please select at least one pod to delete.", true);
        return;
    }

    const message = `Are you sure you want to delete ${podsToDelete.length} selected pod(s)? This action cannot be undone. If pods are managed by a Deployment, they may be recreated automatically.`;

    showConfirmModal(message, async (confirmed) => {
        if (!confirmed) {
            showMessage("Pod deletion cancelled.", false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;
        let results = [];

        for (const pod of podsToDelete) {
            showMessage(`Deleting pod '${pod.name}' in namespace '${pod.namespace}'...`, false);
            try {
                const result = await deletePod(pod.name, pod.namespace); // Call API client function
                results.push(`Successfully deleted pod '${pod.name}'.`);
                successCount++;
            } catch (error) {
                results.push(`Error deleting pod '${pod.name}': ${error.message}`);
                failureCount++;
            }
        }

        if (failureCount > 0) {
            showMessage(`Pod deletion completed with ${successCount} successes and ${failureCount} failures:<br>${results.join('<br>')}`, true);
        } else {
            showMessage(`Successfully deleted ${successCount} pod(s).`, false);
        }

        refreshPodsSection();
    });
});


// --- Deployment Modal Logic ---
createDeploymentBtn.addEventListener('click', () => {
    createDeploymentForm.reset();
    deploymentReplicasInput.value = 1;
    deploymentImageInput.value = 'nginx:latest';
    deploymentCpuRequestInput.value = '';
    deploymentCpuLimitInput.value = '';
    deploymentMemoryRequestInput.value = '';
    deploymentMemoryLimitInput.value = '';
    deploymentEnvVarsContainer.innerHTML = '';
    deploymentLabelsContainer.innerHTML = '';
    deploymentEnvFromContainer.innerHTML = ''; // NEW: Clear envFrom selections
    enableDeploymentPvcCheckbox.checked = false;
    deploymentPvcFieldsDiv.classList.add('hidden');
    deploymentVolumeMountPathInput.value = '';
    deploymentVolumeSubPathInput.value = '';
    createDeploymentModal.classList.remove('hidden');
});

document.getElementById('closeCreateDeploymentModalBtn').addEventListener('click', () => {
    createDeploymentModal.classList.add('hidden');
});

// MODIFIED: Toggle PVC fields visibility and populate dropdown for Deployments
enableDeploymentPvcCheckbox.addEventListener('change', async () => {
    if (enableDeploymentPvcCheckbox.checked) {
        deploymentPvcFieldsDiv.classList.remove('hidden');
        deploymentPvcSelect.required = true;
        deploymentVolumeMountPathInput.required = true;

        // Fetch and populate available PVCs
        deploymentPvcSelect.innerHTML = '<option>Loading PVCs...</option>';
        const currentNamespace = namespaceSelect ? namespaceSelect.value : 'default';
        try {
            const pvcs = await fetchPvcs(currentNamespace);
            // MODIFIED: Filter for PVCs that are 'Bound' or 'Pending'
            const availablePvcs = pvcs.filter(pvc => pvc.status.phase === 'Bound' || pvc.status.phase === 'Pending');
            if (availablePvcs.length > 0) {
                deploymentPvcSelect.innerHTML = availablePvcs.map(pvc => `<option value="${pvc.metadata.name}">${pvc.metadata.name} (${pvc.spec.resources.requests.storage})</option>`).join('');
            } else {
                deploymentPvcSelect.innerHTML = '<option value="">No available PVCs found in this namespace</option>';
            }
        } catch (error) {
            showMessage(`Error fetching PVCs: ${error.message}`, true);
            deploymentPvcSelect.innerHTML = '<option value="">Error loading PVCs</option>';
        }

    } else {
        deploymentPvcFieldsDiv.classList.add('hidden');
        deploymentPvcSelect.required = false;
        deploymentVolumeMountPathInput.required = false;
    }
});

addDeploymentEnvVarBtn.addEventListener('click', () => {
    addDynamicInputField(deploymentEnvVarsContainer, 'deployEnv', 'Deployment Env Var');
});

addDeploymentLabelBtn.addEventListener('click', () => {
    addDynamicInputField(deploymentLabelsContainer, 'deployLabel', 'Deployment Label');
});

createDeploymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = createDeploymentForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';

    try {
        const deploymentName = deploymentNameInput.value.trim();
        const deploymentImage = deploymentImageInput.value.trim();
        const replicas = parseInt(deploymentReplicasInput.value, 10);
        const deploymentStrategy = deploymentStrategySelect.value;
        const currentNamespace = namespaceSelect ? namespaceSelect.value : 'default';

        const cpuRequest = parseResourceValue(deploymentCpuRequestInput.value, 'cpu');
        const cpuLimit = parseResourceValue(deploymentCpuLimitInput.value, 'cpu');
        const memoryRequest = parseResourceValue(deploymentMemoryRequestInput.value, 'memory');
        const memoryLimit = parseResourceValue(deploymentMemoryLimitInput.value, 'memory');

        const envVars = [];
        deploymentEnvVarsContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
            const key = div.querySelector('input[name="deployEnvKey"]').value.trim();
            const value = div.querySelector('input[name="deployEnvValue"]').value.trim();
            if (key && value) {
                envVars.push({ name: key, value: value });
            }
        });

        const labels = {};
        deploymentLabelsContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
            const key = div.querySelector('input[name="deployLabelKey"]').value.trim();
            const value = div.querySelector('input[name="deployLabelValue"]').value.trim();
            if (key && value) {
                labels[key] = value;
            }
        });

        // NEW: Gather envFrom selections
        const envFrom = [];
        deploymentEnvFromContainer.querySelectorAll('select').forEach(select => {
            if (select.value) {
                envFrom.push({
                    type: select.dataset.type,
                    name: select.value
                });
            }
        });

        // MODIFIED: Logic to attach an existing PVC
        let pvc = null;
        if (enableDeploymentPvcCheckbox.checked) {
            const pvcName = deploymentPvcSelect.value;
            const volumeMountPath = deploymentVolumeMountPathInput.value.trim();
            const volumeSubPath = deploymentVolumeSubPathInput.value.trim();

            if (!pvcName || !volumeMountPath) {
                showMessage("An existing PVC and a Volume Mount Path are required when attaching a volume.", true);
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }

            pvc = {
                name: pvcName,
                volumeMountPath: volumeMountPath,
                volumeSubPath: volumeSubPath || undefined
            };
        }

        showMessage(`Creating deployment '${deploymentName}' with ${replicas} replicas in namespace '${currentNamespace}'...`, false);
        createDeploymentModal.classList.add('hidden');

        const result = await createDeployment({
            name: deploymentName,
            image: deploymentImage,
            replicas: replicas,
            env: envVars,
            envFrom: envFrom, // NEW
            labels: labels,
            strategy: deploymentStrategy,
            cpuRequest: cpuRequest,
            cpuLimit: cpuLimit,
            memoryRequest: memoryRequest,
            memoryLimit: memoryLimit,
            pvc: pvc,
            namespace: currentNamespace
        });
        showMessage(result.message, false);

    } catch (error) {
        showMessage(`Error creating deployment: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        refreshDeploymentsSection();
    }
});

// Event listener for deleting selected deployments
deleteSelectedDeploymentsBtn.addEventListener('click', async () => {
    const selectedDeployments = document.querySelectorAll('input[name="selectedDeployment"]:checked');
    const deploymentsToDelete = Array.from(selectedDeployments).map(checkbox => ({
        name: checkbox.value,
        namespace: checkbox.dataset.namespace || 'default'
    }));

    if (deploymentsToDelete.length === 0) {
        showMessage("Please select at least one deployment to delete.", true);
        return;
    }

    const message = `Are you sure you want to delete ${deploymentsToDelete.length} selected deployment(s)? This action cannot be undone.`;

    showConfirmModal(message, async (confirmed) => {
        if (!confirmed) {
            showMessage("Deployment deletion cancelled.", false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;
        let results = [];

        for (const deployment of deploymentsToDelete) {
            showMessage(`Deleting deployment '${deployment.name}' in namespace '${deployment.namespace}'...`, false);
            try {
                const result = await deleteDeployment(deployment.name, deployment.namespace);
                results.push(`Successfully deleted deployment '${deployment.name}'.`);
                successCount++;
            } catch (error) {
                results.push(`Failed to delete deployment '${deployment.name}': ${error.message}`);
                failureCount++;
            }
        }

        if (failureCount > 0) {
            showMessage(`Deployment deletion completed with ${successCount} successes and ${failureCount} failures:<br>${results.join('<br>')}`, true);
        } else {
            showMessage(`Successfully deleted ${successCount} deployment(s).`, false);
        }

        refreshDeploymentsSection();
    });
});

// Function to toggle delete, expose, and scale buttons based on deployment selection
function toggleDeploymentActionButtons() {
    const selectedDeployments = document.querySelectorAll('input[name="selectedDeployment"]:checked');
    const anyDeploymentSelected = selectedDeployments.length > 0;
    const exactlyOneDeploymentSelected = selectedDeployments.length === 1;

    deleteSelectedDeploymentsBtn.disabled = !anyDeploymentSelected;
    exposeDeploymentBtn.disabled = !exactlyOneDeploymentSelected;
    scaleDeploymentBtn.disabled = !exactlyOneDeploymentSelected;
}

// Function to toggle all deployment checkboxes
function toggleAllDeploymentCheckboxes(isChecked) {
    const checkboxes = document.querySelectorAll('.deployment-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    toggleDeploymentActionButtons();
}

// Event listener for deployment name links to show details
document.querySelectorAll('.deployment-name-link').forEach(link => {
    link.addEventListener('click', async (event) => {
        event.preventDefault();
        const deploymentName = event.target.dataset.name;
        const namespace = event.target.dataset.namespace;
        showDeploymentDetailsModal(deploymentName, namespace);
    });
});

/**
 * Formats deployment details into a human-readable HTML string.
 * @param {object} data - The raw deployment JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatDeploymentDetails(data) {
    const metadata = data.metadata || {};
    const spec = data.spec || {};
    const status = data.status || {};
    const containers = spec.template?.spec?.containers || [];
    const volumes = spec.template?.spec?.volumes || [];
    const conditions = status.conditions || [];

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>Namespace:</strong> ${metadata.namespace || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Spec</h4>
        <p><strong>Replicas:</strong> ${spec.replicas || 'N/A'}</p>
        <p><strong>Strategy:</strong> ${spec.strategy?.type || 'N/A'}</p>
        <p><strong>Selector:</strong> ${Object.entries(spec.selector?.matchLabels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Containers</h5>
        ${containers.length > 0 ? containers.map(c => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${c.name || 'N/A'}</p>
                <p><strong>Image:</strong> ${c.image || 'N/A'}</p>
                <p><strong>Ports:</strong> ${c.ports?.map(p => `${p.containerPort}/${p.protocol}`).join(', ') || 'None'}</p>
                <p><strong>Environment Variables:</strong> ${c.env?.map(e => `${e.name}=${e.value}`).join(', ') || 'None'}</p>
                <p><strong>CPU Requests:</strong> ${c.resources?.requests?.cpu || 'None'}</p>
                <p><strong>CPU Limits:</strong> ${c.resources?.limits?.cpu || 'None'}</p>
                <p><strong>Memory Requests:</strong> ${c.resources?.requests?.memory || 'None'}</p>
                <p><strong>Memory Limits:</strong> ${c.resources?.limits?.memory || 'None'}</p>
                <p><strong>Volume Mounts:</strong> ${c.volumeMounts?.map(vm => `${vm.name} at ${vm.mountPath}`).join(', ') || 'None'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No containers defined.</p>'}

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Volumes</h5>
        ${volumes.length > 0 ? volumes.map(v => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${v.name || 'N/A'}</p>
                ${v.persistentVolumeClaim ? `<p><strong>PVC:</strong> ${v.persistentVolumeClaim.claimName}</p>` : ''}
                ${v.configMap ? `<p><strong>ConfigMap:</strong> ${v.configMap.name}</p>` : ''}
                ${v.secret ? `<p><strong>Secret:</strong> ${v.secret.secretName}</p>` : ''}
                ${v.emptyDir ? `<p><strong>Type:</strong> EmptyDir</p>` : ''}
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No volumes defined.</p>'}


        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Status</h4>
        <p><strong>Available Replicas:</strong> ${status.availableReplicas || 0}</p>
        <p><strong>Ready Replicas:</strong> ${status.readyReplicas || 0}</p>
        <p><strong>Updated Replicas:</strong> ${status.updatedReplicas || 0}</p>
        <p><strong>Observed Generation:</strong> ${status.observedGeneration || 'N/A'}</p>
        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Conditions</h5>
        ${conditions.length > 0 ? conditions.map(cond => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Type:</strong> ${cond.type || 'N/A'}</p>
                <p><strong>Status:</strong> ${cond.status || 'N/A'}</p>
                <p><strong>Reason:</strong> ${cond.reason || 'N/A'}</p>
                <p><strong>Message:</strong> ${cond.message || 'N/A'}</p>
                <p><strong>Last Transition Time:</strong> ${new Date(cond.lastTransitionTime).toLocaleString() || 'N/A'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No conditions reported.</p>'}
    `;
    return html;
}

async function showDeploymentDetailsModal(deploymentName, namespace) {
    detailsDeploymentName.textContent = deploymentName;
    deploymentDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    deploymentDetailsModal.classList.remove('hidden');

    try {
        const deploymentData = await fetchDeploymentDetails(deploymentName, namespace);
        deploymentDetailsContent.innerHTML = formatDeploymentDetails(deploymentData);
    } catch (error) {
        console.error('Error fetching deployment details:', error);
        deploymentDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching deployment details for ${deploymentName}: ${error.message}`, true);
    }
}

// Event listener for closing the deployment details modal
closeDeploymentDetailsModalBtn.addEventListener('click', () => {
    deploymentDetailsModal.classList.add('hidden');
});

// --- Scale Deployment Logic ---
scaleDeploymentBtn.addEventListener('click', async () => {
    const selectedDeployment = document.querySelector('input[name="selectedDeployment"]:checked');
    if (selectedDeployment) {
        const deploymentName = selectedDeployment.value;
        const namespace = selectedDeployment.dataset.namespace || 'default';
        const currentReplicas = parseInt(selectedDeployment.dataset.replicas, 10);

        scaleDeploymentName.textContent = deploymentName;
        scaleDeploymentNamespace.value = namespace; // Hidden field to pass namespace
        currentReplicasInput.value = currentReplicas;
        newReplicasInput.value = currentReplicas; // Pre-fill new replicas with current
        scaleDeploymentModal.classList.remove('hidden');
    } else {
        showMessage("Please select a deployment to scale.", true);
    }
});

closeScaleDeploymentModalBtn.addEventListener('click', () => {
    scaleDeploymentModal.classList.add('hidden');
});

scaleDeploymentForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const deploymentName = scaleDeploymentName.textContent.trim();
    const namespace = scaleDeploymentNamespace.value.trim();
    const newReplicas = parseInt(newReplicasInput.value, 10);

    if (isNaN(newReplicas) || newReplicas < 0) {
        showMessage("New desired replicas must be a non-negative integer.", true);
        return;
    }

    showMessage(`Scaling deployment '${deploymentName}' to ${newReplicas} replicas in namespace '${namespace}'...`, false);
    scaleDeploymentModal.classList.add('hidden');

    try {
        const result = await scaleDeployment(deploymentName, namespace, newReplicas);
        showMessage(result.message, false);
        setTimeout(() => {
            refreshDeploymentsSection();
        }, 2000);

    } catch (error) {
        console.error('Error scaling deployment:', error);
        showMessage(`Error scaling deployment: ${error.message}`, true);
    }
});


// --- Service Management Logic ---
exposeDeploymentBtn.addEventListener('click', async () => {
    const selectedDeployment = document.querySelector('input[name="selectedDeployment"]:checked');
    if (selectedDeployment) {
        const deploymentName = selectedDeployment.value;
        const namespace = selectedDeployment.dataset.namespace || 'default';

        serviceDeploymentNameInput.value = deploymentName;
        serviceNameInput.value = `${deploymentName}-service`;
        serviceTypeSelect.value = 'ClusterIP';
        appPortInput.value = '80';
        targetPortInput.value = '80';
        protocolSelect.value = 'TCP';
        serviceSelectorContainer.innerHTML = '';

        try {
            const deploymentDetails = await fetchDeploymentDetails(deploymentName, namespace);

            if (deploymentDetails.spec.selector && deploymentDetails.spec.selector.matchLabels) {
                const labels = deploymentDetails.spec.selector.matchLabels;
                for (const key in labels) {
                    addDynamicInputField(serviceSelectorContainer, 'serviceSelector', 'Selector', key, labels[key]);
                }
            } else {
                showMessage(`Could not fetch labels for deployment '${deploymentName}'. Please add selectors manually.`, true);
                addDynamicInputField(serviceSelectorContainer, 'serviceSelector', 'Selector');
            }
        } catch (error) {
            console.error('Error fetching deployment labels for service:', error);
            showMessage(`Error fetching deployment labels: ${error.message}. Please add selectors manually.`, true);
            addDynamicInputField(serviceSelectorContainer, 'serviceSelector', 'Selector');
        }

        exposeServiceModal.classList.remove('hidden');
    } else {
        showMessage("Please select a deployment to expose.", true);
    }
});

closeExposeServiceModalBtn.addEventListener('click', () => {
    exposeServiceModal.classList.add('hidden');
});

addServiceSelectorBtn.addEventListener('click', () => {
    addDynamicInputField(serviceSelectorContainer, 'serviceSelector', 'Selector');
});

exposeServiceForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const deploymentName = serviceDeploymentNameInput.value.trim();
    const serviceName = serviceNameInput.value.trim();
    const serviceType = serviceTypeSelect.value;
    const appPort = parseInt(appPortInput.value, 10);
    const targetPort = parseInt(targetPortInput.value, 10);
    const protocol = protocolSelect.value;
    const currentNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    const selector = {};
    serviceSelectorContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
        const key = div.querySelector('input[name="serviceSelectorKey"]').value.trim();
        const value = div.querySelector('input[name="serviceSelectorValue"]').value.trim();
        if (key && value) {
            selector[key] = value;
        }
    });

    if (!serviceName || !serviceType || isNaN(appPort) || isNaN(targetPort) || !protocol || Object.keys(selector).length === 0) {
        showMessage("All service fields (including at least one selector) are required.", true);
        return;
    }

    showMessage(`Exposing deployment '${deploymentName}' as service '${serviceName}' in namespace '${currentNamespace}'...`, false);
    exposeServiceModal.classList.add('hidden');

    try {
        const result = await createService({
            deploymentName,
            serviceName,
            serviceType,
            appPort,
            targetPort,
            protocol,
            selector,
            namespace: currentNamespace
        });
        showMessage(result.message, false);
        refreshServicesSection();

    } catch (error) {
        console.error('Error creating service:', error);
        showMessage(`Error creating service: ${error.message}`, true);
    }
});

// Function to toggle delete button based on service selection
function toggleServiceActionButtons() {
    const anyServiceSelected = document.querySelectorAll('input[name="selectedService"]:checked').length > 0;
    deleteSelectedServicesBtn.disabled = !anyServiceSelected;
}

// Function to toggle all service checkboxes
function toggleAllServiceCheckboxes(isChecked) {
    const checkboxes = document.querySelectorAll('.service-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    toggleServiceActionButtons();
}

// Event listener for deleting selected services
deleteSelectedServicesBtn.addEventListener('click', async () => {
    const selectedServices = document.querySelectorAll('input[name="selectedService"]:checked');
    const servicesToDelete = Array.from(selectedServices).map(checkbox => ({
        name: checkbox.value,
        namespace: checkbox.dataset.namespace || 'default'
    }));

    if (servicesToDelete.length === 0) {
        showMessage("Please select at least one service to delete.", true);
        return;
    }

    const message = `Are you sure you want to delete ${servicesToDelete.length} selected service(s)? This action cannot be undone.`;

    showConfirmModal(message, async (confirmed) => {
        if (!confirmed) {
            showMessage("Service deletion cancelled.", false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;
        let results = [];

        for (const svc of servicesToDelete) {
            showMessage(`Deleting service '${svc.name}' in namespace '${svc.namespace}'...`, false);
            try {
                const result = await deleteService(svc.name, svc.namespace);
                results.push(`Successfully deleted service '${svc.name}'.`);
                successCount++;
            } catch (error) {
                results.push(`Failed to delete service '${svc.name}': ${error.message}`);
                failureCount++;
            }
        }

        if (failureCount > 0) {
            showMessage(`Service deletion completed with ${successCount} successes and ${failureCount} failures:<br>${results.join('<br>')}`, true);
        } else {
            showMessage(`Successfully deleted ${successCount} service(s).`, false);
        }

        refreshServicesSection();
    });
});

/**
 * Formats service details into a human-readable HTML string.
 * @param {object} data - The raw service JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatServiceDetails(data) {
    const metadata = data.metadata || {};
    const spec = data.spec || {};
    const status = data.status || {};
    const ports = spec.ports || [];
    const ingress = status.loadBalancer?.ingress || [];

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>Namespace:</strong> ${metadata.namespace || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Spec</h4>
        <p><strong>Type:</strong> ${spec.type || 'N/A'}</p>
        <p><strong>Cluster IP:</strong> ${spec.clusterIP || 'N/A'}</p>
        <p><strong>Session Affinity:</strong> ${spec.sessionAffinity || 'None'}</p>
        <p><strong>External Traffic Policy:</strong> ${spec.externalTrafficPolicy || 'None'}</p>
        <p><strong>Selector:</strong> ${Object.entries(spec.selector || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Ports</h5>
        ${ports.length > 0 ? ports.map(p => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${p.name || 'N/A'}</p>
                <p><strong>Protocol:</strong> ${p.protocol || 'N/A'}</p>
                <p><strong>Port:</strong> ${p.port || 'N/A'}</p>
                <p><strong>Target Port:</strong> ${p.targetPort || 'N/A'}</p>
                <p><strong>Node Port:</strong> ${p.nodePort || 'N/A'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No ports defined.</p>'}

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Status</h4>
        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">LoadBalancer Ingress</h5>
        ${ingress.length > 0 ? ingress.map(i => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                ${i.ip ? `<p><strong>IP:</strong> ${i.ip}</p>` : ''}
                ${i.hostname ? `<p><strong>Hostname:</strong> ${i.hostname}</p>` : ''}
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No LoadBalancer Ingress.</p>'}
    `;
    return html;
}

async function showServiceDetailsModal(serviceName, namespace) {
    detailsServiceName.textContent = serviceName;
    serviceDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    serviceDetailsModal.classList.remove('hidden');

    try {
        const serviceData = await fetchServiceDetails(serviceName, namespace);
        serviceDetailsContent.innerHTML = formatServiceDetails(serviceData);
    } catch (error) {
        console.error('Error fetching service details:', error);
        serviceDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching service details for ${serviceName}: ${error.message}`, true);
    }
}

// Event listener for closing the service details modal
closeServiceDetailsModalBtn.addEventListener('click', () => {
    serviceDetailsModal.classList.add('hidden');
});

/**
 * Formats pod details into a human-readable HTML string.
 * @param {object} data - The raw pod JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatPodDetails(data) {
    const metadata = data.metadata || {};
    const spec = data.spec || {};
    const status = data.status || {};
    const containers = spec.containers || [];
    const initContainers = spec.initContainers || [];
    const volumes = spec.volumes || [];
    const conditions = status.conditions || [];
    const containerStatuses = status.containerStatuses || [];

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>Namespace:</strong> ${metadata.namespace || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Spec</h4>
        <p><strong>Node Name:</strong> ${spec.nodeName || 'N/A'}</p>
        <p><strong>Service Account Name:</strong> ${spec.serviceAccountName || 'N/A'}</p>
        <p><strong>Restart Policy:</strong> ${spec.restartPolicy || 'N/A'}</p>
        <p><strong>DNS Policy:</strong> ${spec.dnsPolicy || 'N/A'}</p>
        <p><strong>Host Network:</strong> ${spec.hostNetwork ? 'Yes' : 'No'}</p>

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Containers</h5>
        ${containers.length > 0 ? containers.map(c => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${c.name || 'N/A'}</p>
                <p><strong>Image:</strong> ${c.image || 'N/A'}</p>
                <p><strong>Ports:</strong> ${c.ports?.map(p => `${p.containerPort}/${p.protocol}`).join(', ') || 'None'}</p>
                <p><strong>Command:</strong> ${c.command?.join(' ') || 'None'}</p>
                <p><strong>Args:</strong> ${c.args?.join(' ') || 'None'}</p>
                <p><strong>Environment Variables:</strong> ${c.env?.map(e => `${e.name}=${e.value}`).join(', ') || 'None'}</p>
                <p><strong>CPU Requests:</strong> ${c.resources?.requests?.cpu || 'None'}</p>
                <p><strong>CPU Limits:</strong> ${c.resources?.limits?.cpu || 'None'}</p>
                <p><strong>Memory Requests:</strong> ${c.resources?.requests?.memory || 'None'}</p>
                <p><strong>Memory Limits:</strong> ${c.resources?.limits?.memory || 'None'}</p>
                <p><strong>Volume Mounts:</strong> ${c.volumeMounts?.map(vm => `${vm.name} at ${vm.mountPath}${vm.subPath ? ` (subPath: ${vm.subPath})` : ''}`).join(', ') || 'None'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No containers defined.</p>'}

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Init Containers</h5>
        ${initContainers.length > 0 ? initContainers.map(c => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${c.name || 'N/A'}</p>
                <p><strong>Image:</strong> ${c.image || 'N/A'}</p>
                <p><strong>Command:</strong> ${c.command?.join(' ') || 'None'}</p>
                <p><strong>Args:</strong> ${c.args?.join(' ') || 'None'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No init containers defined.</p>'}

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Volumes</h5>
        ${volumes.length > 0 ? volumes.map(v => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${v.name || 'N/A'}</p>
                ${v.persistentVolumeClaim ? `<p><strong>PVC:</strong> ${v.persistentVolumeClaim.claimName}</p>` : ''}
                ${v.configMap ? `<p><strong>ConfigMap:</strong> ${v.configMap.name}</p>` : ''}
                ${v.secret ? `<p><strong>Secret:</strong> ${v.secret.secretName}</p>` : ''}
                ${v.emptyDir ? `<p><strong>Type:</strong> EmptyDir</p>` : ''}
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No volumes defined.</p>'}

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Status</h4>
        <p><strong>Phase:</strong> ${status.phase || 'N/A'}</p>
        <p><strong>Host IP:</strong> ${status.hostIP || 'N/A'}</p>
        <p><strong>Pod IP:</strong> ${status.podIP || 'N/A'}</p>
        <p><strong>QoS Class:</strong> ${status.qosClass || 'N/A'}</p>
        <p><strong>Start Time:</strong> ${new Date(status.startTime).toLocaleString() || 'N/A'}</p>

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Conditions</h5>
        ${conditions.length > 0 ? conditions.map(cond => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Type:</strong> ${cond.type || 'N/A'}</p>
                <p><strong>Status:</strong> ${cond.status || 'N/A'}</p>
                <p><strong>Reason:</strong> ${cond.reason || 'N/A'}</p>
                <p><strong>Message:</strong> ${cond.message || 'N/A'}</p>
                <p><strong>Last Transition Time:</strong> ${new Date(cond.lastTransitionTime).toLocaleString() || 'N/A'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No conditions reported.</p>'}

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Container Statuses</h5>
        ${containerStatuses.length > 0 ? containerStatuses.map(cs => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Name:</strong> ${cs.name || 'N/A'}</p>
                <p><strong>Ready:</strong> ${cs.ready ? 'Yes' : 'No'}</p>
                <p><strong>Restart Count:</strong> ${cs.restartCount || 0}</p>
                <p><strong>Image:</strong> ${cs.image || 'N/A'}</p>
                <p><strong>Image ID:</strong> ${cs.imageID || 'N/A'}</p>
                <p><strong>State:</strong> ${Object.keys(cs.state || {}).join(', ') || 'N/A'}</p>
                ${cs.state?.running ? `<p class="ml-4">Running since: ${new Date(cs.state.running.startedAt).toLocaleString()}</p>` : ''}
                ${cs.state?.waiting ? `<p class="ml-4">Waiting Reason: ${cs.state.waiting.reason || 'N/A'}</p><p class="ml-4">Message: ${cs.state.waiting.message || 'N/A'}</p>` : ''}
                ${cs.state?.terminated ? `<p class="ml-4">Terminated Reason: ${cs.state.terminated.reason || 'N/A'}</p><p class="ml-4">Exit Code: ${cs.state.terminated.exitCode || 'N/A'}</p><p class="ml-4">Finished At: ${new Date(cs.state.terminated.finishedAt).toLocaleString() || 'N/A'}</p>` : ''}
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No container statuses reported.</p>'}
    `;
    return html;
}

async function showPodDetailsModal(podName, namespace) {
    detailsPodName.textContent = podName;
    podDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    podDetailsModal.classList.remove('hidden');

    try {
        const podDetails = await fetchPodDetails(podName, namespace);
        podDetailsContent.innerHTML = formatPodDetails(podDetails);
    } catch (error) {
        console.error('Error fetching pod details:', error);
        podDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching pod details for ${podName}: ${error.message}`, true);
    }
}

// Event listener for closing the pod details modal
closePodDetailsModalBtn.addEventListener('click', () => {
    podDetailsModal.classList.add('hidden');
});

// --- Pod Logs Functionality ---
viewPodLogsBtn.addEventListener('click', () => {
    const selectedPod = document.querySelector('input[name="selectedPod"]:checked');
    if (selectedPod) {
        const podName = selectedPod.value;
        const namespace = selectedPod.dataset.namespace || 'default';
        showPodLogsModal(podName, namespace);
    } else {
        showMessage("Please select a pod to view logs.", true);
    }
});

function showPodLogsModal(podName, namespace) {
    logsPodName.textContent = podName;
    podLogsOutput.textContent = 'Fetching logs...';
    podLogsModal.classList.remove('hidden');

    if (podLogsWs) {
        podLogsWs.close();
    }

    podLogsWs = new WebSocket(`ws://localhost:3000?type=kube-logs&pname=${encodeURIComponent(podName)}&namespace=${encodeURIComponent(namespace)}`);

    podLogsWs.onopen = () => {
        podLogsOutput.textContent = `--- Connected to logs for ${podName} ---\n`;
    };

    podLogsWs.onmessage = (event) => {
        const msg = event.data;
        podLogsOutput.textContent += msg;
        podLogsOutput.scrollTop = podLogsOutput.scrollHeight;
    };

    podLogsWs.onclose = () => {
        podLogsOutput.textContent += `\n--- Log stream ended for ${podName} ---\n`;
        podLogsOutput.scrollTop = podLogsOutput.scrollHeight;
        podLogsWs = null;
    };

    podLogsWs.onerror = (error) => {
        console.error('Pod Logs WebSocket error:', error);
        podLogsOutput.textContent += `\n--- Log stream error: ${error.message} ---\n`;
        podLogsOutput.scrollTop = podLogsOutput.scrollHeight;
        showMessage(`Error streaming logs for ${podName}: ${error.message}`, true);
    };
}

closePodLogsModalBtn.addEventListener('click', () => {
    if (podLogsWs) {
        podLogsWs.close();
    }
    podLogsModal.classList.add('hidden');
    podLogsOutput.textContent = '';
});

// --- Persistent Volume Claim (PVC) and Persistent Volume (PV) Management ---

// NEW: Create PVC Modal Logic
createPvcBtn.addEventListener('click', async () => {
    createPvcForm.reset();
    newPvcStorageSizeInput.value = '1Gi';
    newPvcAccessModeSelect.value = 'ReadWriteOnce';
    
    // Fetch and populate StorageClasses
    newPvcStorageClassSelect.innerHTML = '<option value="">Loading StorageClasses...</option>';
    try {
        const storageClasses = await fetchStorageClasses();
        if (storageClasses.length > 0) {
            newPvcStorageClassSelect.innerHTML = '<option value="">-- None (uses default) --</option>' + 
                storageClasses.map(sc => `<option value="${sc.metadata.name}">${sc.metadata.name}</option>`).join('');
        } else {
            newPvcStorageClassSelect.innerHTML = '<option value="">No StorageClasses found</option>';
        }
    } catch (error) {
        showMessage(`Error fetching StorageClasses: ${error.message}`, true);
        newPvcStorageClassSelect.innerHTML = '<option value="">Error loading</option>';
    }

    createPvcModal.classList.remove('hidden');
});

closeCreatePvcModalBtn.addEventListener('click', () => {
    createPvcModal.classList.add('hidden');
});

createPvcForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = createPvcForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';

    try {
        const name = newPvcNameInput.value.trim();
        const storageSize = newPvcStorageSizeInput.value.trim();
        const accessMode = newPvcAccessModeSelect.value;
        const storageClassName = newPvcStorageClassSelect.value;
        const namespace = namespaceSelect.value;

        const result = await createPvc({
            name,
            storageSize,
            accessMode,
            storageClassName: storageClassName || undefined, // Send undefined if empty
            namespace
        });

        showMessage(result.message, false);
        createPvcModal.classList.add('hidden');
        refreshPvcPvSection();

    } catch (error) {
        showMessage(`Error creating PVC: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});


function togglePvcActionButtons() {
    const anyPvcSelected = document.querySelectorAll('input[name="selectedPvc"]:checked').length > 0;
    deleteSelectedPvcBtn.disabled = !anyPvcSelected;
}

function toggleAllPvcCheckboxes(isChecked) {
    const checkboxes = document.querySelectorAll('.pvc-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    togglePvcActionButtons();
}

deleteSelectedPvcBtn.addEventListener('click', async () => {
    const selectedPvc = document.querySelectorAll('input[name="selectedPvc"]:checked');
    const pvcsToDelete = Array.from(selectedPvc).map(checkbox => ({
        name: checkbox.value,
        namespace: checkbox.dataset.namespace || 'default'
    }));

    if (pvcsToDelete.length === 0) {
        showMessage("Please select at least one PVC to delete.", true);
        return;
    }

    const message = `Are you sure you want to delete ${pvcsToDelete.length} selected PVC(s)? This action cannot be undone.`;

    showConfirmModal(message, async (confirmed) => {
        if (!confirmed) {
            showMessage("PVC deletion cancelled.", false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;
        let results = [];

        for (const pvc of pvcsToDelete) {
            showMessage(`Deleting PVC '${pvc.name}' in namespace '${pvc.namespace}'...`, false);
            try {
                const result = await deletePvc(pvc.name, pvc.namespace);
                results.push(`Successfully deleted PVC '${pvc.name}'.`);
                successCount++;
            } catch (error) {
                results.push(`Error deleting PVC '${pvc.name}': ${error.message}`);
                failureCount++;
            }
        }

        if (failureCount > 0) {
            showMessage(`PVC deletion completed with ${successCount} successes and ${failureCount} failures:<br>${results.join('<br>')}`, true);
        } else {
            showMessage(`Successfully deleted ${successCount} PVC(s).`, false);
        }

        refreshPvcPvSection();
    });
});

/**
 * Formats PVC details into a human-readable HTML string.
 * @param {object} data - The raw PVC JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatPvcDetails(data) {
    const metadata = data.metadata || {};
    const spec = data.spec || {};
    const status = data.status || {};
    const conditions = status.conditions || [];

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>Namespace:</strong> ${metadata.namespace || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Spec</h4>
        <p><strong>Access Modes:</strong> ${spec.accessModes?.join(', ') || 'N/A'}</p>
        <p><strong>Storage Class Name:</strong> ${spec.storageClassName || 'N/A'}</p>
        <p><strong>Volume Name (Bound PV):</strong> ${spec.volumeName || 'None'}</p>
        <p><strong>Volume Mode:</strong> ${spec.volumeMode || 'N/A'}</p>
        <p><strong>Requested Storage:</strong> ${spec.resources?.requests?.storage || 'N/A'}</p>
        <p><strong>Selector:</strong> ${Object.entries(spec.selector?.matchLabels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Status</h4>
        <p><strong>Phase:</strong> ${status.phase || 'N/A'}</p>
        <p><strong>Capacity:</strong> ${status.capacity?.storage || 'N/A'}</p>
        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Conditions</h5>
        ${conditions.length > 0 ? conditions.map(cond => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>Type:</strong> ${cond.type || 'N/A'}</p>
                <p><strong>Status:</strong> ${cond.status || 'N/A'}</p>
                <p><strong>Reason:</strong> ${cond.reason || 'N/A'}</p>
                <p><strong>Message:</strong> ${cond.message || 'N/A'}</p>
                <p><strong>Last Transition Time:</strong> ${new Date(cond.lastTransitionTime).toLocaleString() || 'N/A'}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No conditions reported.</p>'}
    `;
    return html;
}

async function showPvcDetailsModal(pvcName, namespace) {
    detailsPvcName.textContent = pvcName;
    pvcDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    pvcDetailsModal.classList.remove('hidden');

    try {
        const pvcData = await fetchPvcDetails(pvcName, namespace);
        pvcDetailsContent.innerHTML = formatPvcDetails(pvcData);
    } catch (error) {
        console.error('Error fetching PVC details:', error);
        pvcDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching PVC details for ${pvcName}: ${error.message}`, true);
    }
}

closePvcDetailsModalBtn.addEventListener('click', () => {
    pvcDetailsModal.classList.add('hidden');
});

// NEW: Event delegation for the "Bind" button on the PVC list
pvcListElement.addEventListener('click', async (event) => {
    if (event.target.classList.contains('bind-pvc-btn')) {
        const button = event.target;
        const pvcName = button.dataset.name;
        const namespace = button.dataset.namespace;
        const size = button.dataset.size;
        const accessModes = button.dataset.accessModes;

        // Populate the modal with the PVC's data
        bindPvcNameSpan.textContent = pvcName;
        bindPvcNamespaceInput.value = namespace;
        bindPvcSizeInput.value = size;
        bindPvcAccessModesInput.value = accessModes;

        // Fetch and populate StorageClasses
        bindPvcStorageClassSelect.innerHTML = '<option value="">Loading StorageClasses...</option>';
        try {
            const storageClasses = await fetchStorageClasses();
            if (storageClasses.length > 0) {
                bindPvcStorageClassSelect.innerHTML = storageClasses.map(sc => `<option value="${sc.metadata.name}">${sc.metadata.name}</option>`).join('');
            } else {
                bindPvcStorageClassSelect.innerHTML = '<option value="">No StorageClasses found</option>';
            }
        } catch (error) {
            showMessage(`Error fetching StorageClasses: ${error.message}`, true);
            bindPvcStorageClassSelect.innerHTML = '<option value="">Error loading</option>';
        }

        bindPvcModal.classList.remove('hidden');
    }
});

// NEW: Event listener for closing the Bind PVC modal
closeBindPvcModalBtn.addEventListener('click', () => {
    bindPvcModal.classList.add('hidden');
});

// NEW: Event listener for submitting the Bind PVC form
bindPvcForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = bindPvcForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Binding...';

    try {
        const pvcName = bindPvcNameSpan.textContent;
        const namespace = bindPvcNamespaceInput.value;
        const size = bindPvcSizeInput.value;
        const accessModes = bindPvcAccessModesInput.value;
        const storageClassName = bindPvcStorageClassSelect.value;

        if (!storageClassName) {
            showMessage('Please select a StorageClass.', true);
            return;
        }

        const result = await bindPvc(pvcName, namespace, storageClassName, size, accessModes);
        showMessage(result.message, false);
        bindPvcModal.classList.add('hidden');
        refreshPvcPvSection();

    } catch (error) {
        showMessage(`Error binding PVC: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});


/**
 * Formats PV details into a human-readable HTML string.
 * @param {object} data - The raw PV JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatPvDetails(data) {
    const metadata = data.metadata || {};
    const spec = data.spec || {};
    const status = data.status || {};

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Spec</h4>
        <p><strong>Capacity:</strong> ${spec.capacity?.storage || 'N/A'}</p>
        <p><strong>Access Modes:</strong> ${spec.accessModes?.join(', ') || 'N/A'}</p>
        <p><strong>Persistent Volume Reclaim Policy:</strong> ${spec.persistentVolumeReclaimPolicy || 'N/A'}</p>
        <p><strong>Storage Class Name:</strong> ${spec.storageClassName || 'N/A'}</p>
        <p><strong>Volume Mode:</strong> ${spec.volumeMode || 'N/A'}</p>
        <p><strong>Claim Ref:</strong> ${spec.claimRef ? `${spec.claimRef.namespace}/${spec.claimRef.name}` : 'None'}</p>
        ${spec.mountOptions?.length > 0 ? `<p><strong>Mount Options:</strong> ${spec.mountOptions.join(', ')}</p>` : ''}
        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Source</h5>
        ${spec.awsElasticBlockStore ? `<div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
            <p><strong>Type:</strong> AWS EBS</p>
            <p><strong>Volume ID:</strong> ${spec.awsElasticBlockStore.volumeID || 'N/A'}</p>
            <p><strong>Filesystem Type:</strong> ${spec.awsElasticBlockStore.fsType || 'N/A'}</p>
            <p><strong>Read Only:</strong> ${spec.awsElasticBlockStore.readOnly ? 'Yes' : 'No'}</p>
        </div>` : ''}
        ${spec.hostPath ? `<div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
            <p><strong>Type:</strong> HostPath</p>
            <p><strong>Path:</strong> ${spec.hostPath.path || 'N/A'}</p>
        </div>` : ''}
        ${spec.nfs ? `<div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
            <p><strong>Type:</strong> NFS</p>
            <p><strong>Server:</strong> ${spec.nfs.server || 'N/A'}</p>
            <p><strong>Path:</strong> ${spec.nfs.path || 'N/A'}</p>
            <p><strong>Read Only:</strong> ${spec.nfs.readOnly ? 'Yes' : 'No'}</p>
        </div>` : ''}
        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Status</h4>
        <p><strong>Phase:</strong> ${status.phase || 'N/A'}</p>
        <p><strong>Reason:</strong> ${status.reason || 'N/A'}</p>
        <p><strong>Message:</strong> ${status.message || 'N/A'}</p>
    `;
    return html;
}

async function showPvDetailsModal(pvName) {
    detailsPvName.textContent = pvName;
    pvDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    pvDetailsModal.classList.remove('hidden');

    try {
        const pvData = await fetchPvDetails(pvName);
        pvDetailsContent.innerHTML = formatPvDetails(pvData);
    } catch (error) {
        console.error('Error fetching PV details:', error);
        pvDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching PV details for ${pvName}: ${error.message}`, true);
    }
}

closePvDetailsModalBtn.addEventListener('click', () => {
    pvDetailsModal.classList.add('hidden');
});

/**
 * Formats StorageClass details into a human-readable HTML string.
 * @param {object} data - The raw StorageClass JSON data.
 * @returns {string} Formatted HTML string.
 */
function formatStorageClassDetails(data) {
    const metadata = data.metadata || {};
    const parameters = data.parameters || {};

    let html = `
        <h4 class="text-lg font-semibold text-gray-800 mb-2">Metadata</h4>
        <p><strong>Name:</strong> ${metadata.name || 'N/A'}</p>
        <p><strong>UID:</strong> ${metadata.uid || 'N/A'}</p>
        <p><strong>Creation Timestamp:</strong> ${new Date(metadata.creationTimestamp).toLocaleString() || 'N/A'}</p>
        <p><strong>Labels:</strong> ${Object.entries(metadata.labels || {}).map(([key, value]) => `${key}=${value}`).join(', ') || 'None'}</p>
        <p><strong>Annotations:</strong> ${Object.entries(metadata.annotations || {}).map(([key, value]) => `${key}=${value}`).join('<br>') || 'None'}</p>

        <h4 class="text-lg font-semibold text-gray-800 mt-4 mb-2">Details</h4>
        <p><strong>Provisioner:</strong> ${data.provisioner || 'N/A'}</p>
        <p><strong>Reclaim Policy:</strong> ${data.reclaimPolicy || 'N/A'}</p>
        <p><strong>Volume Binding Mode:</strong> ${data.volumeBindingMode || 'N/A'}</p>
        <p><strong>Allow Volume Expansion:</strong> ${typeof data.allowVolumeExpansion === 'boolean' ? (data.allowVolumeExpansion ? 'Yes' : 'No') : 'N/A'}</p>

        <h5 class="text-md font-semibold text-gray-700 mt-3 mb-1">Parameters</h5>
        ${Object.keys(parameters).length > 0 ? Object.entries(parameters).map(([key, value]) => `
            <div class="ml-4 p-2 border border-gray-200 rounded-md bg-gray-100 mb-2">
                <p><strong>${key}:</strong> ${value}</p>
            </div>
        `).join('') : '<p class="ml-4 text-gray-600">No parameters defined.</p>'}
    `;
    return html;
}

async function showStorageClassDetailsModal(scName) {
    detailsStorageClassName.textContent = scName;
    storageClassDetailsContent.innerHTML = '<p class="text-gray-600">Loading details...</p>';
    storageClassDetailsModal.classList.remove('hidden');

    try {
        const scData = await fetchStorageClassDetails(scName);
        storageClassDetailsContent.innerHTML = formatStorageClassDetails(scData);
    } catch (error) {
        console.error('Error fetching StorageClass details:', error);
        storageClassDetailsContent.innerHTML = `<p class="text-red-600">Failed to load details: ${error.message}</p>`;
        showMessage(`Error fetching StorageClass details for ${scName}: ${error.message}`, true);
    }
}

// NEW: Event listener for closing the StorageClass details modal
closeStorageClassDetailsModalBtn.addEventListener('click', () => {
    storageClassDetailsModal.classList.add('hidden');
});


// Debounce function to limit how often a function is called
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

// --- Namespace Management ---
// Function to render the namespace dropdown
async function renderNamespacesDropdown() {
    if (!namespaceSelect) {
        console.warn("Namespace select element not found. Skipping namespace dropdown rendering.");
        return;
    }
    try {
        const namespaces = await fetchNamespaces();

        namespaceSelect.innerHTML = '';
        if (namespaces.length === 0) {
            const option = document.createElement('option');
            option.value = 'default';
            option.textContent = 'default (No namespaces found)';
            option.selected = true;
            namespaceSelect.appendChild(option);
            namespaceSelect.disabled = true;
            showMessage('No Kubernetes namespaces found. Please ensure your cluster is running and kubectl is configured.', true);
        } else {
            namespaces.forEach(ns => {
                const option = document.createElement('option');
                option.value = ns.metadata.name;
                option.textContent = ns.metadata.name;
                if (ns.metadata.name === 'default') {
                    option.selected = true;
                }
                namespaceSelect.appendChild(option);
            });
            namespaceSelect.disabled = false;
        }

        namespaceSelect.addEventListener('change', () => {
            // When namespace changes, refresh the content of the currently active tab
            if (!overviewContent.classList.contains('hidden')) {
                renderDashboardSectionsBatch();
            } else if (!resourceFlowContent.classList.contains('hidden')) {
                renderTreeView();
            }
        });


    } catch (err) {
        console.error('Error fetching namespaces:', err);
        showMessage(`Error loading namespaces: ${err.message}`, true);
        namespaceSelect.innerHTML = '<option value="default">default (Error loading others)</option>';
        namespaceSelect.disabled = true;
    }
}

// --- Individual Fetch and Render Functions for each resource type ---

// REWRITTEN: fetchAndRenderWorkerNodes
// This function now uses the new, direct API endpoint.
async function fetchAndRenderWorkerNodes() {
    workerNodesListElement.innerHTML = getSkeletonLoader('rect', 4);
    nodesCountElement.textContent = '...';
    
    try {
        const workerNodes = await fetchWorkerNodes(); // Use the new API client function

        nodesCountElement.textContent = workerNodes.length;
        if (workerNodes.length > 0) {
            renderWorkerNodesList(workerNodes, workerNodesListElement);
        } else {
            workerNodesListElement.innerHTML = '<p class="text-gray-600">No worker nodes found.</p>';
        }
    } catch (err) {
        showMessage(`Error loading worker nodes: ${err.message}`, true);
        workerNodesListElement.innerHTML = '<p class="text-red-600">Failed to load worker nodes.</p>';
        nodesCountElement.textContent = 'Error';
    }
}


async function fetchAndRenderPods() {
    podsListElement.innerHTML = getSkeletonLoader('rect', 4);
    podsCountElement.textContent = '...';
    const selectedNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    try {
        const pods = await fetchPods(selectedNamespace);
        podsCountElement.textContent = pods.length;
        if (pods.length > 0) {
            renderPodsList(pods, togglePodActionButtons, toggleAllPodCheckboxes, showPodDetailsModal, podsListElement);
        } else {
            podsListElement.innerHTML = '<p class="text-gray-600">No pods found in this namespace.</p>';
        }
    } catch (err) {
        showMessage(`Error loading pods: ${err.message}`, true);
        podsListElement.innerHTML = '<p class="text-red-600">Failed to load pods.</p>';
        podsCountElement.textContent = 'Error';
    }
}

// Function to toggle delete, view logs, and open CLI buttons based on pod selection
function togglePodActionButtons() {
    const selectedPods = document.querySelectorAll('input[name="selectedPod"]:checked');
    const anyPodSelected = selectedPods.length > 0;
    const exactlyOnePodSelected = selectedPods.length === 1;

    deleteSelectedPodBtn.disabled = !anyPodSelected;
    viewPodLogsBtn.disabled = !exactlyOnePodSelected;
}

// Function to toggle all pod checkboxes
function toggleAllPodCheckboxes(isChecked) {
    const checkboxes = document.querySelectorAll('.pod-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    togglePodActionButtons();
}


async function fetchAndRenderDeployments() {
    deploymentsListElement.innerHTML = getSkeletonLoader('rect', 3);
    deploymentsCountElement.textContent = '...';
    const selectedNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    try {
        const deployments = await fetchDeployments(selectedNamespace);
        deploymentsCountElement.textContent = deployments.length;
        if (deployments.length > 0) {
            renderDeploymentsList(deployments, toggleDeploymentActionButtons, toggleAllDeploymentCheckboxes, showDeploymentDetailsModal, deploymentsListElement);
        } else {
            deploymentsListElement.innerHTML = '<p class="text-gray-600">No deployments found in this namespace.</p>';
        }
    } catch (err) {
        showMessage(`Error loading deployments: ${err.message}`, true);
        deploymentsListElement.innerHTML = '<p class="text-red-600">Failed to load deployments.</p>';
        deploymentsCountElement.textContent = 'Error';
    }
}

async function fetchAndRenderServices() {
    servicesListElement.innerHTML = getSkeletonLoader('rect', 3);
    servicesCountElement.textContent = '...';
    const selectedNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    try {
        const services = await fetchServices(selectedNamespace);
        servicesCountElement.textContent = services.length;
        if (services.length > 0) {
            renderServicesList(services, toggleServiceActionButtons, toggleAllServiceCheckboxes, showServiceDetailsModal, servicesListElement);
        } else {
            servicesListElement.innerHTML = '<p class="text-gray-600">No services found in this namespace.</p>';
        }
    } catch (err) {
        showMessage(`Error loading services: ${err.message}`, true);
        servicesListElement.innerHTML = '<p class="text-red-600">Failed to load services.</p>';
        servicesCountElement.textContent = 'Error';
    }
}

// NEW: Function to fetch and render Ingresses
async function fetchAndRenderIngresses() {
    ingressesListElement.innerHTML = getSkeletonLoader('rect', 2);
    ingressesCountElement.textContent = '...';
    const selectedNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    try {
        const ingresses = await fetchIngresses(selectedNamespace);
        ingressesCountElement.textContent = ingresses.length;
        if (ingresses.length > 0) {
            renderIngressesList(ingresses, toggleIngressActionButtons, toggleAllIngressCheckboxes, ingressesListElement);
        } else {
            ingressesListElement.innerHTML = '<p class="text-gray-600">No ingresses found in this namespace.</p>';
        }
    } catch (err) {
        showMessage(`Error loading ingresses: ${err.message}`, true);
        ingressesListElement.innerHTML = '<p class="text-red-600">Failed to load ingresses.</p>';
        ingressesCountElement.textContent = 'Error';
    }
}


async function fetchAndRenderPvc() {
    pvcListElement.innerHTML = getSkeletonLoader('rect', 3);
    pvcCountElement.textContent = '...';
    const selectedNamespace = namespaceSelect ? namespaceSelect.value : 'default';

    try {
        const pvcs = await fetchPvcs(selectedNamespace);
        pvcCountElement.textContent = pvcs.length;
        if (pvcs.length > 0) {
            renderPvcList(pvcs, togglePvcActionButtons, toggleAllPvcCheckboxes, showPvcDetailsModal, pvcListElement);
        } else {
            pvcListElement.innerHTML = '<p class="text-gray-600">No Persistent Volume Claims found in this namespace.</p>';
        }
    } catch (err) {
        showMessage(`Error loading PVCs: ${err.message}`, true);
        pvcListElement.innerHTML = '<p class="text-red-600">Failed to load PVCs.</p>';
        pvcCountElement.textContent = 'Error';
    }
}

async function fetchAndRenderPv() {
    pvListElement.innerHTML = getSkeletonLoader('rect', 3);
    pvCountElement.textContent = '...';

    try {
        const pvs = await fetchPvs();
        pvCountElement.textContent = pvs.length;
        if (pvs.length > 0) {
            renderPvList(pvs, showPvDetailsModal, pvListElement);
        } else {
            pvListElement.innerHTML = '<p class="text-gray-600">No Persistent Volumes found.</p>';
        }
    } catch (err) {
        showMessage(`Error loading PVs: ${err.message}`, true);
        pvListElement.innerHTML = '<p class="text-red-600">Failed to load PVs.</p>';
        pvCountElement.textContent = 'Error';
    }
}

async function fetchAndRenderStorageClasses() {
    storageClassListElement.innerHTML = getSkeletonLoader('rect', 2);

    try {
        const storageClasses = await fetchStorageClasses();
        if (storageClasses.length > 0) {
            renderStorageClassList(storageClasses, storageClassListElement, showStorageClassDetailsModal);
        } else {
            storageClassListElement.innerHTML = '<p class="text-gray-600">No StorageClasses found.</p>';
        }
    } catch (err) {
        showMessage(`Error loading StorageClasses: ${err.message}`, true);
        storageClassListElement.innerHTML = '<p class="text-red-600">Failed to load StorageClasses.</p>';
    }
}

// --- Granular Refresh Functions ---

async function refreshPodsSection() {
    await fetchAndRenderPods();
    showMessage('Pods section refreshed.', false);
}

async function refreshNodesSection() {
    await fetchAndRenderWorkerNodes();
    showMessage('Worker Nodes section refreshed.', false);
}

async function refreshDeploymentsSection() {
    await fetchAndRenderDeployments();
    await fetchAndRenderPods(); // Pods might change when deployments are updated
    showMessage('Deployments section refreshed.', false);
}

async function refreshServicesSection() {
    await fetchAndRenderServices();
    showMessage('Services section refreshed.', false);
}

// NEW: Granular refresh for Ingresses
async function refreshIngressesSection() {
    await fetchAndRenderIngresses();
    showMessage('Ingresses section refreshed.', false);
}

async function refreshPvcPvSection() {
    await fetchAndRenderPvc();
    await fetchAndRenderPv();
    showMessage('PVCs and PVs sections refreshed.', false);
}

async function refreshStorageClassesSection() {
    await fetchAndRenderStorageClasses();
    showMessage('StorageClasses section refreshed.', false);
}

// NEW: Granular refresh for ConfigMaps and Secrets
async function refreshConfigManagementSection() {
    await fetchAndRenderConfigMaps();
    await fetchAndRenderSecrets();
    showMessage('Configuration Management section refreshed.', false);
}


// --- Optimized Dashboard Load ---
async function renderDashboardSectionsBatch() {
    workerNodesListElement.innerHTML = getSkeletonLoader('rect', 4);
    podsListElement.innerHTML = getSkeletonLoader('rect', 4);
    deploymentsListElement.innerHTML = getSkeletonLoader('rect', 3);
    servicesListElement.innerHTML = getSkeletonLoader('rect', 3);
    ingressesListElement.innerHTML = getSkeletonLoader('rect', 2);
    pvcListElement.innerHTML = getSkeletonLoader('rect', 3);
    pvListElement.innerHTML = getSkeletonLoader('rect', 3);
    storageClassListElement.innerHTML = getSkeletonLoader('rect', 2);
    configMapListElement.innerHTML = getSkeletonLoader('rect', 2); // NEW
    secretListElement.innerHTML = getSkeletonLoader('rect', 2); // NEW
    nodesCountElement.textContent = '...';
    podsCountElement.textContent = '...';
    deploymentsCountElement.textContent = '...';
    servicesCountElement.textContent = '...';
    ingressesCountElement.textContent = '...';
    pvcCountElement.textContent = '...';
    pvCountElement.textContent = '...';
    configMapCountElement.textContent = '...'; // NEW
    secretCountElement.textContent = '...'; // NEW

    try {
        // Fetch cluster-scoped resources first
        await fetchAndRenderWorkerNodes();
        await fetchAndRenderPv();
        await fetchAndRenderStorageClasses();

        // Fetch namespace-scoped resources
        await fetchAndRenderPods();
        await fetchAndRenderDeployments();
        await fetchAndRenderServices();
        await fetchAndRenderIngresses();
        await fetchAndRenderPvc();
        await fetchAndRenderConfigMaps(); // NEW
        await fetchAndRenderSecrets(); // NEW
    } catch (error) {
        console.error("Error during sequential dashboard rendering:", error);
        showMessage(`Error loading dashboard sections: ${error.message}`, true);
    }
}

// --- Initial dashboard load and event listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    await renderNamespacesDropdown();
    renderDashboardSectionsBatch();

    window.renderDashboardSectionsBatch = renderDashboardSectionsBatch;
    window.showStorageClassDetailsModal = showStorageClassDetailsModal;

    // --- Grafana URL Handling ---
    if (grafanaDashboardBtn) {
        grafanaDashboardBtn.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevent default link behavior
            const originalText = grafanaDashboardBtn.innerHTML;
            grafanaDashboardBtn.innerHTML = '<span>Connecting...</span>';
            grafanaDashboardBtn.disabled = true;

            try {
                const result = await startGrafanaPortForward();
                showMessage(result.message, false);
                const grafanaUrl = `http://localhost:${result.port}`;
                window.open(grafanaUrl, '_blank'); // Open in new tab
            } catch (error) {
                showMessage(`Failed to connect to Grafana: ${error.message}`, true);
            } finally {
                grafanaDashboardBtn.innerHTML = originalText;
                grafanaDashboardBtn.disabled = false;
            }
        });
    }

    // Add a listener to stop port-forwarding when the user leaves the page
    window.addEventListener('beforeunload', () => {
        stopGrafanaPortForward();
    });

    if (refreshNodesBtn) {
        refreshNodesBtn.addEventListener('click', refreshNodesSection);
    }
    if (refreshPodsBtn) {
        refreshPodsBtn.addEventListener('click', refreshPodsSection);
    }
    if (refreshDeploymentsBtn) {
        refreshDeploymentsBtn.addEventListener('click', refreshDeploymentsSection);
    }
    if (refreshServicesBtn) {
        refreshServicesBtn.addEventListener('click', refreshServicesSection);
    }
    if (refreshIngressesBtn) { 
        refreshIngressesBtn.addEventListener('click', refreshIngressesSection);
    }
    if (refreshPvcBtn) {
        refreshPvcBtn.addEventListener('click', refreshPvcPvSection);
    }
    if (refreshPvBtn) {
        refreshPvBtn.addEventListener('click', refreshPvcPvSection);
    }
    if (refreshStorageClassesBtn) {
        refreshStorageClassesBtn.addEventListener('click', refreshStorageClassesSection);
    }
    if (refreshConfigMapsBtn) {
        refreshConfigMapsBtn.addEventListener('click', refreshConfigManagementSection);
    }
    if (refreshSecretsBtn) {
        refreshSecretsBtn.addEventListener('click', refreshConfigManagementSection);
    }
});

// --- NEW: ConfigMap and Secret Logic ---

// --- ConfigMap ---
async function fetchAndRenderConfigMaps() {
    configMapListElement.innerHTML = getSkeletonLoader('rect', 2);
    configMapCountElement.textContent = '...';
    const namespace = namespaceSelect.value;
    try {
        const configMaps = await fetchConfigMaps(namespace);
        configMapCountElement.textContent = configMaps.length;
        renderConfigMapsList(configMaps, configMapListElement);
    } catch (err) {
        showMessage(`Error loading ConfigMaps: ${err.message}`, true);
        configMapListElement.innerHTML = '<p class="text-red-600">Failed to load ConfigMaps.</p>';
        configMapCountElement.textContent = 'Error';
    }
}

function renderConfigMapsList(configMaps, container) {
    if (configMaps.length > 0) {
        container.innerHTML = configMaps.map(cm => `
            <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="selectedConfigMap" value="${cm.metadata.name}" data-namespace="${cm.metadata.namespace}" class="form-checkbox h-4 w-4 text-blue-600 configmap-checkbox">
                    <span class="font-medium text-gray-800">${cm.metadata.name}</span>
                </label>
                <span class="text-sm text-gray-600">${Object.keys(cm.data || {}).length} keys</span>
            </div>
        `).join('');
        document.querySelectorAll('.configmap-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleConfigMapActionButtons);
        });
    } else {
        container.innerHTML = '<p class="text-gray-600">No ConfigMaps found.</p>';
    }
    toggleConfigMapActionButtons();
}

function toggleConfigMapActionButtons() {
    const anySelected = document.querySelectorAll('input[name="selectedConfigMap"]:checked').length > 0;
    deleteSelectedConfigMapBtn.disabled = !anySelected;
}

createConfigMapBtn.addEventListener('click', () => {
    createConfigMapForm.reset();
    configMapDataContainer.innerHTML = '';
    addDynamicInputField(configMapDataContainer, 'configMapData', 'Data');
    createConfigMapModal.classList.remove('hidden');
});

closeCreateConfigMapModalBtn.addEventListener('click', () => createConfigMapModal.classList.add('hidden'));
addConfigMapDataBtn.addEventListener('click', () => addDynamicInputField(configMapDataContainer, 'configMapData', 'Data'));

createConfigMapForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = configMapNameInput.value.trim();
    const namespace = namespaceSelect.value;
    const data = {};
    configMapDataContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
        const key = div.querySelector('input[name="configMapDataKey"]').value.trim();
        const value = div.querySelector('input[name="configMapDataValue"]').value.trim();
        if (key) data[key] = value;
    });

    try {
        const result = await createConfigMap({ name, data, namespace });
        showMessage(result.message, false);
        createConfigMapModal.classList.add('hidden');
        refreshConfigManagementSection();
    } catch (err) {
        showMessage(`Error creating ConfigMap: ${err.message}`, true);
    }
});

deleteSelectedConfigMapBtn.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('input[name="selectedConfigMap"]:checked'));
    if (selected.length === 0) return;
    const toDelete = selected.map(cb => ({ name: cb.value, namespace: cb.dataset.namespace }));
    
    showConfirmModal(`Delete ${toDelete.length} ConfigMap(s)?`, async (confirmed) => {
        if (!confirmed) return;
        for (const cm of toDelete) {
            try {
                await deleteConfigMap(cm.name, cm.namespace);
                showMessage(`Deleted ConfigMap '${cm.name}'.`, false);
            } catch (err) {
                showMessage(`Error deleting '${cm.name}': ${err.message}`, true);
            }
        }
        refreshConfigManagementSection();
    });
});

// --- Secret ---
async function fetchAndRenderSecrets() {
    secretListElement.innerHTML = getSkeletonLoader('rect', 2);
    secretCountElement.textContent = '...';
    const namespace = namespaceSelect.value;
    try {
        const secrets = await fetchSecrets(namespace);
        secretCountElement.textContent = secrets.length;
        renderSecretsList(secrets, secretListElement);
    } catch (err) {
        showMessage(`Error loading Secrets: ${err.message}`, true);
        secretListElement.innerHTML = '<p class="text-red-600">Failed to load Secrets.</p>';
        secretCountElement.textContent = 'Error';
    }
}

function renderSecretsList(secrets, container) {
    if (secrets.length > 0) {
        container.innerHTML = secrets.map(s => `
            <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" name="selectedSecret" value="${s.metadata.name}" data-namespace="${s.metadata.namespace}" class="form-checkbox h-4 w-4 text-blue-600 secret-checkbox">
                    <span class="font-medium text-gray-800">${s.metadata.name}</span>
                </label>
                <span class="text-sm text-gray-600">${s.type}</span>
            </div>
        `).join('');
        document.querySelectorAll('.secret-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleSecretActionButtons);
        });
    } else {
        container.innerHTML = '<p class="text-gray-600">No Secrets found.</p>';
    }
    toggleSecretActionButtons();
}

function toggleSecretActionButtons() {
    const anySelected = document.querySelectorAll('input[name="selectedSecret"]:checked').length > 0;
    deleteSelectedSecretBtn.disabled = !anySelected;
}

createSecretBtn.addEventListener('click', () => {
    createSecretForm.reset();
    secretDataContainer.innerHTML = '';
    addDynamicInputField(secretDataContainer, 'secretData', 'Data');
    createSecretModal.classList.remove('hidden');
});

closeCreateSecretModalBtn.addEventListener('click', () => createSecretModal.classList.add('hidden'));
addSecretDataBtn.addEventListener('click', () => addDynamicInputField(secretDataContainer, 'secretData', 'Data'));

createSecretForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = secretNameInput.value.trim();
    const namespace = namespaceSelect.value;
    const data = {};
    secretDataContainer.querySelectorAll('.flex.space-x-2.items-center').forEach(div => {
        const key = div.querySelector('input[name="secretDataKey"]').value.trim();
        const value = div.querySelector('input[name="secretDataValue"]').value.trim();
        if (key) data[key] = value;
    });

    try {
        const result = await createSecret({ name, data, namespace });
        showMessage(result.message, false);
        createSecretModal.classList.add('hidden');
        refreshConfigManagementSection();
    } catch (err) {
        showMessage(`Error creating Secret: ${err.message}`, true);
    }
});

deleteSelectedSecretBtn.addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('input[name="selectedSecret"]:checked'));
    if (selected.length === 0) return;
    const toDelete = selected.map(cb => ({ name: cb.value, namespace: cb.dataset.namespace }));

    showConfirmModal(`Delete ${toDelete.length} Secret(s)?`, async (confirmed) => {
        if (!confirmed) return;
        for (const s of toDelete) {
            try {
                await deleteSecret(s.name, s.namespace);
                showMessage(`Deleted Secret '${s.name}'.`, false);
            } catch (err) {
                showMessage(`Error deleting '${s.name}': ${err.message}`, true);
            }
        }
        refreshConfigManagementSection();
    });
});


// --- NEW: envFrom Logic ---
async function addEnvFrom(type, container) {
    const namespace = namespaceSelect.value;
    let resources = [];
    try {
        if (type === 'configMap') {
            resources = await fetchConfigMaps(namespace);
        } else {
            resources = await fetchSecrets(namespace);
        }
    } catch (err) {
        showMessage(`Error fetching ${type}s: ${err.message}`, true);
        return;
    }

    if (resources.length === 0) {
        showMessage(`No ${type}s found in namespace '${namespace}'. Please create one first.`, true);
        return;
    }

    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'flex space-x-2 items-center';
    const selectId = `${type}-${Date.now()}`;
    
    let optionsHtml = '<option value="">-- Select a ' + type + ' --</option>';
    optionsHtml += resources.map(r => `<option value="${r.metadata.name}">${r.metadata.name}</option>`).join('');

    wrapperDiv.innerHTML = `
        <select data-type="${type}" id="${selectId}" class="flex-1 p-2 border border-gray-300 rounded-md text-sm">
            ${optionsHtml}
        </select>
        <button type="button" class="remove-field-btn bg-red-500 hover:bg-red-600 text-white p-1 rounded-md text-sm">Remove</button>
    `;
    wrapperDiv.querySelector('.remove-field-btn').addEventListener('click', () => wrapperDiv.remove());
    container.appendChild(wrapperDiv);
}

podAddEnvFromConfigMapBtn.addEventListener('click', () => addEnvFrom('configMap', podEnvFromContainer));
podAddEnvFromSecretBtn.addEventListener('click', () => addEnvFrom('secret', podEnvFromContainer));
deploymentAddEnvFromConfigMapBtn.addEventListener('click', () => addEnvFrom('configMap', deploymentEnvFromContainer));
deploymentAddEnvFromSecretBtn.addEventListener('click', () => addEnvFrom('secret', deploymentEnvFromContainer));


// --- NEW: Ingress Management Logic ---

// Function to toggle delete button based on ingress selection
function toggleIngressActionButtons() {
    const anyIngressSelected = document.querySelectorAll('input[name="selectedIngress"]:checked').length > 0;
    deleteSelectedIngressesBtn.disabled = !anyIngressSelected;
}

// Function to toggle all ingress checkboxes
function toggleAllIngressCheckboxes(isChecked) {
    const checkboxes = document.querySelectorAll('.ingress-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    toggleIngressActionButtons();
}

// Event listener for Create Ingress button
createIngressBtn.addEventListener('click', async () => {
    createIngressForm.reset();
    ingressPathInput.value = '/';
    ingressPathTypeSelect.value = 'Prefix';

    // Fetch and populate services for the dropdown
    ingressServiceSelect.innerHTML = '<option value="">Loading services...</option>';
    const currentNamespace = namespaceSelect.value;
    try {
        const services = await fetchServices(currentNamespace);
        if (services.length > 0) {
            ingressServiceSelect.innerHTML = services.map(svc => `<option value="${svc.metadata.name}">${svc.metadata.name}</option>`).join('');
        } else {
            ingressServiceSelect.innerHTML = '<option value="">No services found in this namespace</option>';
        }
    } catch (error) {
        showMessage(`Error fetching services: ${error.message}`, true);
        ingressServiceSelect.innerHTML = '<option value="">Error loading services</option>';
    }

    createIngressModal.classList.remove('hidden');
});

// Event listener for closing the Create Ingress modal
closeCreateIngressModalBtn.addEventListener('click', () => {
    createIngressModal.classList.add('hidden');
});

// Event listener for Create Ingress form submission
createIngressForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = createIngressForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';

    try {
        const name = ingressNameInput.value.trim();
        const serviceName = ingressServiceSelect.value;
        const servicePort = parseInt(ingressServicePortInput.value, 10);
        const path = ingressPathInput.value.trim();
        const pathType = ingressPathTypeSelect.value;
        const namespace = namespaceSelect.value;

        const result = await createIngress({ name, serviceName, servicePort, path, pathType, namespace });
        showMessage(result.message, false);
        createIngressModal.classList.add('hidden');
        refreshIngressesSection();

    } catch (error) {
        showMessage(`Error creating ingress: ${error.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
});

// Event listener for deleting selected ingresses
deleteSelectedIngressesBtn.addEventListener('click', async () => {
    const selectedIngresses = document.querySelectorAll('input[name="selectedIngress"]:checked');
    const ingressesToDelete = Array.from(selectedIngresses).map(checkbox => ({
        name: checkbox.value,
        namespace: checkbox.dataset.namespace || 'default'
    }));

    if (ingressesToDelete.length === 0) {
        showMessage("Please select at least one ingress to delete.", true);
        return;
    }

    const message = `Are you sure you want to delete ${ingressesToDelete.length} selected ingress(es)? This action cannot be undone.`;

    showConfirmModal(message, async (confirmed) => {
        if (!confirmed) {
            showMessage("Ingress deletion cancelled.", false);
            return;
        }

        let successCount = 0;
        let failureCount = 0;
        let results = [];

        for (const ing of ingressesToDelete) {
            showMessage(`Deleting ingress '${ing.name}' in namespace '${ing.namespace}'...`, false);
            try {
                const result = await deleteIngress(ing.name, ing.namespace);
                results.push(`Successfully deleted ingress '${ing.name}'.`);
                successCount++;
            } catch (error) {
                results.push(`Error deleting ingress '${ing.name}': ${error.message}`);
                failureCount++;
            }
        }

        if (failureCount > 0) {
            showMessage(`Ingress deletion completed with ${successCount} successes and ${failureCount} failures:<br>${results.join('<br>')}`, true);
        } else {
            showMessage(`Successfully deleted ${successCount} ingress(es).`, false);
        }

        refreshIngressesSection();
    });
});

// --- NEW: Namespace Creation Logic ---
addNamespaceBtn.addEventListener('click', () => {
    createNamespaceForm.reset();
    createNamespaceModal.classList.remove('hidden');
});

closeCreateNamespaceModalBtn.addEventListener('click', () => {
    createNamespaceModal.classList.add('hidden');
});

createNamespaceForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = createNamespaceForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        const name = namespaceNameInput.value.trim();
        const quotas = {};
        const inputs = createNamespaceForm.querySelectorAll('input[name]');
        inputs.forEach(input => {
            if (input.name !== 'namespaceName' && input.value.trim()) {
                quotas[input.name] = input.value.trim();
            }
        });

        const result = await createNamespace({ name, quotas });
        showMessage(result.message, false);
        createNamespaceModal.classList.add('hidden');
        await renderNamespacesDropdown(); // Refresh the dropdown
        namespaceSelect.value = name; // Select the new namespace
        renderDashboardSectionsBatch(); // Refresh the whole dashboard

    } catch (err) {
        showMessage(`Error creating namespace: ${err.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create';
    }
});

// --- NEW: Access Control Logic ---

// Tab switching logic
overviewTab.addEventListener('click', (e) => {
    e.preventDefault();
    overviewTab.classList.add('text-blue-600', 'border-blue-600');
    overviewTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    resourceFlowTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    resourceFlowTab.classList.remove('text-blue-600', 'border-blue-600');
    accessControlTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    accessControlTab.classList.remove('text-blue-600', 'border-blue-600');
    
    overviewContent.classList.remove('hidden');
    resourceFlowContent.classList.add('hidden');
    accessControlContent.classList.add('hidden');
});

resourceFlowTab.addEventListener('click', (e) => {
    e.preventDefault();
    resourceFlowTab.classList.add('text-blue-600', 'border-blue-600');
    resourceFlowTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    overviewTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    overviewTab.classList.remove('text-blue-600', 'border-blue-600');
    accessControlTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    accessControlTab.classList.remove('text-blue-600', 'border-blue-600');

    resourceFlowContent.classList.remove('hidden');
    overviewContent.classList.add('hidden');
    accessControlContent.classList.add('hidden');
    renderTreeView(); // Fetch and render the tree view when the tab is clicked
});


accessControlTab.addEventListener('click', (e) => {
    e.preventDefault();
    accessControlTab.classList.add('text-blue-600', 'border-blue-600');
    accessControlTab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    overviewTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    overviewTab.classList.remove('text-blue-600', 'border-blue-600');
    resourceFlowTab.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
    resourceFlowTab.classList.remove('text-blue-600', 'border-blue-600');

    accessControlContent.classList.remove('hidden');
    overviewContent.classList.add('hidden');
    resourceFlowContent.classList.add('hidden');
    fetchAndRenderUserMappings(); // Fetch mappings when tab is clicked
});

refreshUserMappingsBtn.addEventListener('click', fetchAndRenderUserMappings);

// Open user mapping modal
addUserMappingBtn.addEventListener('click', async () => {
    userMappingForm.reset();
    permissionsContainer.innerHTML = '';
    addPermissionRule(); // Add one rule by default

    // Populate namespace dropdown in the modal
    mappingNamespaceSelect.innerHTML = '<option>Loading namespaces...</option>';
    try {
        const namespaces = await fetchNamespaces();
        if (namespaces.length > 0) {
            mappingNamespaceSelect.innerHTML = namespaces.map(ns => `<option value="${ns.metadata.name}">${ns.metadata.name}</option>`).join('');
        } else {
            mappingNamespaceSelect.innerHTML = '<option value="">No namespaces found</option>';
        }
    } catch (error) {
        showMessage(`Error fetching namespaces: ${error.message}`, true);
        mappingNamespaceSelect.innerHTML = '<option value="">Error loading</option>';
    }

    userMappingModal.classList.remove('hidden');
});

closeUserMappingModalBtn.addEventListener('click', () => {
    userMappingModal.classList.add('hidden');
});

addPermissionRuleBtn.addEventListener('click', addPermissionRule);

// Function to add a new permission rule row to the form
function addPermissionRule() {
    const ruleDiv = document.createElement('div');
    ruleDiv.className = 'grid grid-cols-3 gap-2 p-2 border-t';
    ruleDiv.innerHTML = `
        <input type="text" name="resources" placeholder="Resources (e.g., pods,deployments)" class="p-1 border rounded-md text-sm col-span-3" required />
        <div class="col-span-3 grid grid-cols-5 gap-1">
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="get"> get</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="list"> list</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="watch"> watch</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="create"> create</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="update"> update</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="patch"> patch</label>
            <label class="flex items-center space-x-1 text-sm"><input type="checkbox" name="verb" value="delete"> delete</label>
        </div>
        <button type="button" class="remove-rule-btn bg-red-500 text-white p-1 rounded-md text-xs col-start-3 justify-self-end">Remove Rule</button>
    `;
    ruleDiv.querySelector('.remove-rule-btn').addEventListener('click', () => ruleDiv.remove());
    permissionsContainer.appendChild(ruleDiv);
}

// Handle user mapping form submission
userMappingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = userMappingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        const iamRoleArn = document.getElementById('iamRoleArn').value.trim();
        const kubernetesUsername = document.getElementById('kubernetesUsername').value.trim();
        const namespace = document.getElementById('mappingNamespace').value;
        const roleName = document.getElementById('roleName').value.trim();

        const rules = [];
        permissionsContainer.querySelectorAll('.grid.grid-cols-3').forEach(ruleDiv => {
            const resources = ruleDiv.querySelector('input[name="resources"]').value.split(',').map(r => r.trim()).filter(Boolean);
            const verbs = Array.from(ruleDiv.querySelectorAll('input[name="verb"]:checked')).map(cb => cb.value);
            if (resources.length > 0 && verbs.length > 0) {
                rules.push({
                    apiGroups: [""], // Assuming core API group for simplicity
                    resources: resources,
                    verbs: verbs
                });
            }
        });

        const mappingData = { iamRoleArn, kubernetesUsername, namespace, roleName, rules };
        
        const result = await createUserMapping(mappingData);
        showMessage(result.message, false);
        userMappingModal.classList.add('hidden');
        fetchAndRenderUserMappings(); // Refresh the list after creation

    } catch (err) {
        showMessage(`Error creating user mapping: ${err.message}`, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Mapping';
    }
});

// Function to fetch and render user mappings
async function fetchAndRenderUserMappings() {
    userMappingsList.innerHTML = getSkeletonLoader('rect', 3);
    try {
        const mappings = await fetchUserMappings();
        renderUserMappingsList(mappings);
    } catch (err) {
        showMessage(`Error fetching user mappings: ${err.message}`, true);
        userMappingsList.innerHTML = '<p class="text-red-600">Failed to load user mappings.</p>';
    }
}

// Function to render the list of user mappings
function renderUserMappingsList(mappings) {
    if (!mappings || mappings.length === 0) {
        userMappingsList.innerHTML = '<p class="text-gray-600">No user mappings found.</p>';
        return;
    }

    const html = mappings.map(mapping => `
        <div class="p-4 border rounded-md bg-white shadow-sm">
            <div class="font-bold text-gray-800">${mapping.kubernetesUsername}</div>
            <div class="text-sm text-gray-600 truncate">IAM Role: ${mapping.iamRoleArn}</div>
            <div class="mt-2 text-sm">
                <strong class="text-gray-700">Permissions:</strong>
                ${mapping.bindings.length > 0 ? mapping.bindings.map(b => `
                    <div class="ml-4 mt-1">
                        <span class="font-semibold">${b.role}</span> in <span class="font-semibold">${b.namespace}</span>
                    </div>
                `).join('') : '<span class="text-gray-500 ml-2">No roles bound.</span>'}
            </div>
        </div>
    `).join('');

    userMappingsList.innerHTML = html;
}

// --- NEW: D3.js Tree Visualization Logic ---

/**
 * Fetches data and renders the D3.js tree view.
 */
async function renderTreeView() {
    treeContainer.innerHTML = '<p class="text-center p-8">Loading resource map...</p>';
    const namespace = namespaceSelect.value;

    try {
        const data = await fetchTreeResources(namespace);
        const treeData = transformDataForTree(data, namespace);
        drawTree(treeData);
    } catch (error) {
        showMessage(`Error loading resource flow: ${error.message}`, true);
        treeContainer.innerHTML = `<p class="text-center p-8 text-red-500">Failed to load resource map: ${error.message}</p>`;
    }
}

refreshTreeViewBtn.addEventListener('click', renderTreeView);

/**
 * Transforms the flat list of resources from the API into a hierarchical structure for D3.
 * @param {object} data - The raw data from the /kube-tree-resources endpoint.
 * @param {string} namespace - The currently selected namespace.
 * @returns {object} A hierarchical data object for the D3 tree.
 */
function transformDataForTree(data, namespace) {
    const { nodes, pods, deployments, services, ingresses, pvcs, pvs, secrets, configmaps } = data;

    const masterNode = nodes.find(n => n.metadata.labels['node-role.kubernetes.io/master'] !== undefined || n.metadata.labels['node-role.kubernetes.io/control-plane'] !== undefined);
    const workerNodes = nodes.filter(n => !n.metadata.labels['node-role.kubernetes.io/master'] && !n.metadata.labels['node-role.kubernetes.io/control-plane']);

    const root = {
        name: masterNode ? masterNode.metadata.name : "Cluster",
        type: "master",
        details: `K8s Version: ${masterNode?.status.nodeInfo.kubeletVersion || 'N/A'}\nOS: ${masterNode?.status.nodeInfo.osImage || 'N/A'}`,
        children: []
    };

    // Helper to check if a deployment's labels are a subset of a service's selector
    const isServiceSelectorMatch = (selector, podLabels) => {
        if (!selector || !podLabels || Object.keys(selector).length === 0) return false;
        for (const key in selector) {
            if (podLabels[key] !== selector[key]) {
                return false;
            }
        }
        return true;
    };

    workerNodes.forEach(wn => {
        const workerNode = {
            name: wn.metadata.name,
            type: "worker",
            details: `Status: ${wn.status.conditions.find(c => c.type === 'Ready').status}\nPod CIDR: ${wn.spec.podCIDR}`,
            children: []
        };
        root.children.push(workerNode);

        // 1. Process all pods and their volumes/envFrom, and group them by deployment
        const deploymentPods = new Map(); // Map<deploymentName, podNode[]>
        const standalonePods = [];

        pods.filter(p => p.spec.nodeName === wn.metadata.name).forEach(p => {
            const owner = p.metadata.ownerReferences ? p.metadata.ownerReferences[0] : null;
            const podNode = {
                name: p.metadata.name,
                type: 'pod',
                details: `Status: ${p.status.phase}\nIP: ${p.status.podIP || 'N/A'}`,
                children: []
            };
            
            const attachedResources = new Set();

            // Attach volumes (PVCs, ConfigMaps, Secrets) to the pod
            (p.spec.volumes || []).forEach(v => {
                if (v.persistentVolumeClaim) {
                    const pvc = pvcs.find(pvc => pvc.metadata.name === v.persistentVolumeClaim.claimName);
                    if (pvc && !attachedResources.has(pvc.metadata.name)) {
                        const pv = pvs.find(pv => pv.metadata.name === pvc.spec.volumeName);
                        podNode.children.push({
                            name: pvc.metadata.name,
                            type: 'pvc',
                            details: `Status: ${pvc.status.phase}\nSize: ${pvc.spec.resources.requests.storage}`,
                            children: pv ? [{ name: pv.metadata.name, type: 'pv', details: `Capacity: ${pv.spec.capacity.storage}\nReclaim Policy: ${pv.spec.persistentVolumeReclaimPolicy}` }] : []
                        });
                        attachedResources.add(pvc.metadata.name);
                    }
                }
                if (v.configMap && !attachedResources.has(v.configMap.name)) {
                    podNode.children.push({ name: v.configMap.name, type: 'configmap', details: 'Mounted as Volume' });
                    attachedResources.add(v.configMap.name);
                }
                if (v.secret && !attachedResources.has(v.secret.secretName)) {
                    podNode.children.push({ name: v.secret.secretName, type: 'secret', details: 'Mounted as Volume' });
                    attachedResources.add(v.secret.secretName);
                }
            });
            
            // Attach envFrom and env.valueFrom (ConfigMaps, Secrets) to the pod
            (p.spec.containers || []).forEach(c => {
                // Check envFrom
                (c.envFrom || []).forEach(ef => {
                    if (ef.configMapRef && !attachedResources.has(ef.configMapRef.name)) {
                        podNode.children.push({ name: ef.configMapRef.name, type: 'configmap', details: 'Used as envFrom' });
                        attachedResources.add(ef.configMapRef.name);
                    }
                    if (ef.secretRef && !attachedResources.has(ef.secretRef.name)) {
                        podNode.children.push({ name: ef.secretRef.name, type: 'secret', details: 'Used as envFrom' });
                        attachedResources.add(ef.secretRef.name);
                    }
                });

                // Check env with valueFrom
                (c.env || []).forEach(e => {
                    if (e.valueFrom) {
                        if (e.valueFrom.configMapKeyRef && !attachedResources.has(e.valueFrom.configMapKeyRef.name)) {
                            podNode.children.push({ name: e.valueFrom.configMapKeyRef.name, type: 'configmap', details: `Used in env var: ${e.name}` });
                            attachedResources.add(e.valueFrom.configMapKeyRef.name);
                        }
                        if (e.valueFrom.secretKeyRef && !attachedResources.has(e.valueFrom.secretKeyRef.name)) {
                            podNode.children.push({ name: e.valueFrom.secretKeyRef.name, type: 'secret', details: `Used in env var: ${e.name}` });
                            attachedResources.add(e.valueFrom.secretKeyRef.name);
                        }
                    }
                });
            });


            if (owner && owner.kind === 'ReplicaSet') {
                const deploymentName = owner.name.split('-').slice(0, -1).join('-');
                if (!deploymentPods.has(deploymentName)) {
                    deploymentPods.set(deploymentName, []);
                }
                deploymentPods.get(deploymentName).push(podNode);
            } else {
                standalonePods.push(podNode);
            }
        });

        // 2. Create deployment nodes and attach their pods
        const deploymentNodes = new Map(); // Map<deploymentName, deploymentNode>
        deployments.forEach(d => {
            const depNode = {
                name: d.metadata.name,
                type: 'deployment',
                details: `Replicas: ${d.status.readyReplicas || 0}/${d.spec.replicas}\nImage: ${d.spec.template.spec.containers[0].image}`,
                podLabels: d.spec.template.metadata.labels,
                children: deploymentPods.get(d.metadata.name) || []
            };
            deploymentNodes.set(d.metadata.name, depNode);
        });

        // 3. Create service nodes and attach matching deployments
        const serviceNodes = new Map(); // Map<serviceName, serviceNode>
        const matchedDeployments = new Set();
        services.forEach(s => {
            const svcNode = {
                name: s.metadata.name,
                type: 'service',
                details: `Type: ${s.spec.type}\nClusterIP: ${s.spec.clusterIP}`,
                children: []
            };
            
            deploymentNodes.forEach((depNode, depName) => {
                if (isServiceSelectorMatch(s.spec.selector, depNode.podLabels)) {
                    svcNode.children.push(depNode);
                    matchedDeployments.add(depName);
                }
            });
            serviceNodes.set(s.metadata.name, svcNode);
        });

        // 4. Create ingress nodes and attach them to services
        ingresses.forEach(i => {
            (i.spec.rules || []).forEach(rule => {
                (rule.http?.paths || []).forEach(path => {
                    const serviceName = path.backend.service.name;
                    if (serviceNodes.has(serviceName)) {
                        const ingressNode = {
                            name: i.metadata.name,
                            type: 'ingress',
                            details: `Host: ${rule.host || 'any'}\nPath: ${path.path}\n-> ${serviceName}:${path.backend.service.port.number}`,
                            children: [serviceNodes.get(serviceName)] // Service becomes a child of Ingress
                        };
                         // Add the ingress to the worker node's children
                        workerNode.children.push(ingressNode);
                        // Remove the service from the map so it's not added twice
                        serviceNodes.delete(serviceName);
                    }
                });
            });
        });

        // 5. Add remaining services (not behind an ingress) to the worker node
        serviceNodes.forEach(svcNode => {
            workerNode.children.push(svcNode);
        });
        
        // 6. Add remaining deployments (not matched by any service) to the worker node
        deploymentNodes.forEach((depNode, depName) => {
            if (!matchedDeployments.has(depName)) {
                workerNode.children.push(depNode);
            }
        });

        // 7. Add standalone pods to the worker node
        workerNode.children.push(...standalonePods);
    });

    return root;
}

/**
 * Renders the D3.js tree visualization.
 * @param {object} treeData - The hierarchical data for the tree.
 */
function drawTree(treeData) {
    treeContainer.innerHTML = ''; // Clear previous tree

    const width = treeContainer.clientWidth;
    const height = treeContainer.clientHeight;

    const svg = d3.select(treeContainer).append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(d3.zoom().on("zoom", (event) => g.attr("transform", event.transform)))
        .append("g");

    const g = svg.append("g").attr("transform", "translate(120, 0)"); // Increased left margin for root node text

    const tree = d3.tree().size([height, width - 300]); // Adjusted width for deeper trees
    const root = d3.hierarchy(treeData);
    
    let i = 0;
    root.each(d => d.id = i++);

    root.x0 = height / 2;
    root.y0 = 0;

    // Collapse after the second level for a cleaner initial view
    root.descendants().forEach(d => {
        if(d.depth > 1) {
            d._children = d.children;
            d.children = null;
        }
    });

    update(root);

    function update(source) {
        const duration = 250;
        const nodes = root.descendants();
        const links = root.links();

        tree(root);

        const node = g.selectAll("g.node")
            .data(nodes, d => d.id);

        // Enter any new nodes at the parent's previous position.
        const nodeEnter = node.enter().append("g")
            .attr("class", d => `node node--${d.data.type}`)
            .attr("transform", `translate(${source.y0},${source.x0})`)
            .on("click", (event, d) => {
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
            })
            .on("mouseover", (event, d) => {
                tooltip.style("opacity", .9)
                       .html(`<strong>${d.data.name}</strong><br/>Type: ${d.data.type}<br/><hr/>${(d.data.details || '').replace(/\n/g, '<br/>')}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 15) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("opacity", 0);
            });

        nodeEnter.append("circle")
            .attr("r", 1e-6);

        nodeEnter.append("text")
            .attr("x", d => d.children || d._children ? -13 : 13)
            .attr("dy", ".35em")
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => d.data.name)
            .style("fill-opacity", 1e-6);

        // Transition nodes to their new position.
        const nodeUpdate = node.merge(nodeEnter).transition()
            .duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select("circle")
            .attr("r", 10)
            .style("fill", d => d._children ? null : "#fff"); // Color is handled by CSS classes

        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select("circle").attr("r", 1e-6);
        nodeExit.select("text").style("fill-opacity", 1e-6);

        // Update the links…
        const link = g.selectAll("path.link")
            .data(links, d => d.target.id);

        // Enter any new links at the parent's previous position.
        const linkEnter = link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal().x(d => source.y0).y(d => source.x0));

        // Transition links to their new position.
        link.merge(linkEnter).transition()
            .duration(duration)
            .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", d3.linkHorizontal().x(d => source.y).y(d => source.x))
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }
}
