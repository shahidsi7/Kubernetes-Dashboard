// public/js/utils/api-client.js
// This file centralizes all API client functions for making requests to the backend.
// It abstracts the fetch calls, error handling, and response parsing,
// making it easier for UI components to interact with the backend.

const API_BASE_URL = 'http://localhost:3000';

/**
 * Generic helper function for making API requests.
 * Handles JSON parsing and error responses.
 * @param {string} url - The API endpoint URL.
 * @param {object} [options={}] - Fetch options (method, headers, body).
 * @returns {Promise<object>} The parsed JSON response.
 * @throws {Error} If the network request fails or the server returns an error status.
 */
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            // Attempt to parse JSON error, fallback to text if JSON parsing fails
            const jsonClone = response.clone();
            const textClone = response.clone();

            let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
            try {
                const errorBody = await jsonClone.json();
                errorMessage = errorBody.error || errorBody.message || errorMessage;
                if (errorBody.details) {
                    errorMessage += `<br>Details: ${errorBody.details}`;
                }
            } catch (jsonParseError) {
                const rawText = await textClone.text();
                errorMessage = `Server error (Status ${response.status}):<br><pre>${rawText}</pre>`;
            }
            throw new Error(errorMessage);
        }

        // Attempt to parse JSON response. If response is empty or not JSON, return an empty object.
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error(`API Client Error for ${url}:`, error);
        throw error; // Re-throw to be handled by the caller
    }
}

// --- Kubernetes Resource Fetching ---

/**
 * NEW: Fetches all necessary resources for the tree view in a single call.
 * @param {string} namespace - The namespace to fetch resources from.
 * @returns {Promise<object>} A promise that resolves to an object containing all fetched resources.
 */
export async function fetchTreeResources(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-tree-resources?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}


/**
 * Fetches a list of Kubernetes namespaces.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of namespace objects.
 */
export async function fetchNamespaces() {
    return apiRequest(`${API_BASE_URL}/kube-namespaces`);
}

/**
 * NEW: Fetches a list of worker nodes directly.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of worker node objects.
 */
export async function fetchWorkerNodes() {
    return apiRequest(`${API_BASE_URL}/kube-worker-nodes?forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes Pods for a given namespace.
 * @param {string} namespace - The namespace to fetch pods from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of pod objects.
 */
export async function fetchPods(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-pods?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes Deployments for a given namespace.
 * @param {string} namespace - The namespace to fetch deployments from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of deployment objects.
 */
export async function fetchDeployments(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-deployments?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes Services for a given namespace.
 * @param {string} namespace - The namespace to fetch services from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of service objects.
 */
export async function fetchServices(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-services?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * NEW: Fetches a list of Kubernetes Ingresses for a given namespace.
 * @param {string} namespace - The namespace to fetch ingresses from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of ingress objects.
 */
export async function fetchIngresses(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-ingresses?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes Persistent Volume Claims (PVCs) for a given namespace.
 * @param {string} namespace - The namespace to fetch PVCs from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of PVC objects.
 */
export async function fetchPvcs(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-pvcs?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes Persistent Volumes (PVs).
 * PVs are cluster-scoped, so no namespace parameter is needed.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of PV objects.
 */
export async function fetchPvs() {
    return apiRequest(`${API_BASE_URL}/kube-pvs?forceRefresh=${Date.now()}`);
}

/**
 * Fetches a list of Kubernetes StorageClasses.
 * StorageClasses are cluster-scoped.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of StorageClass objects.
 */
export async function fetchStorageClasses() {
    return apiRequest(`${API_BASE_URL}/kube-storageclasses?forceRefresh=${Date.now()}`);
}

/**
 * NEW: Fetches a list of Kubernetes ConfigMaps for a given namespace.
 * @param {string} namespace - The namespace to fetch ConfigMaps from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of ConfigMap objects.
 */
export async function fetchConfigMaps(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-configmaps?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * NEW: Fetches a list of Kubernetes Secrets for a given namespace.
 * @param {string} namespace - The namespace to fetch Secrets from.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of Secret objects.
 */
export async function fetchSecrets(namespace) {
    return apiRequest(`${API_BASE_URL}/kube-secrets?namespace=${encodeURIComponent(namespace)}&forceRefresh=${Date.now()}`);
}

/**
 * Fetches detailed information for a specific Kubernetes Deployment.
 * @param {string} name - The name of the deployment.
 * @param {string} namespace - The namespace of the deployment.
 * @returns {Promise<object>} A promise that resolves to the deployment details object.
 */
export async function fetchDeploymentDetails(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-deployment-details?name=${encodeURIComponent(name)}&namespace=${encodeURIComponent(namespace)}`);
}

/**
 * Fetches detailed information for a specific Kubernetes Service.
 * @param {string} name - The name of the service.
 * @param {string} namespace - The namespace of the service.
 * @returns {Promise<object>} A promise that resolves to the service details object.
 */
export async function fetchServiceDetails(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-service-details?name=${encodeURIComponent(name)}&namespace=${encodeURIComponent(namespace)}`);
}

/**
 * Fetches detailed information for a specific Kubernetes Pod.
 * @param {string} name - The name of the pod.
 * @param {string} namespace - The namespace of the pod.
 * @returns {Promise<object>} A promise that resolves to the pod details object.
 */
export async function fetchPodDetails(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-pod-details?name=${encodeURIComponent(name)}&namespace=${encodeURIComponent(namespace)}`);
}

/**
 * Fetches detailed information for a specific Kubernetes Persistent Volume Claim (PVC).
 * @param {string} name - The name of the PVC.
 * @param {string} namespace - The namespace of the PVC.
 * @returns {Promise<object>} A promise that resolves to the PVC details object.
 */
export async function fetchPvcDetails(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-pvc-details?name=${encodeURIComponent(name)}&namespace=${encodeURIComponent(namespace)}`);
}

/**
 * Fetches detailed information for a specific Kubernetes Persistent Volume (PV).
 * @param {string} name - The name of the PV.
 * @returns {Promise<object>} A promise that resolves to the PV details object.
 */
export async function fetchPvDetails(name) {
    return apiRequest(`${API_BASE_URL}/kube-pv-details?name=${encodeURIComponent(name)}`);
}

/**
 * Fetches detailed information for a specific Kubernetes StorageClass.
 * @param {string} name - The name of the StorageClass.
 * @returns {Promise<object>} A promise that resolves to the StorageClass details object.
 */
export async function fetchStorageClassDetails(name) {
    return apiRequest(`${API_BASE_URL}/kube-storageclass-details?name=${encodeURIComponent(name)}`);
}

/**
 * NEW: Fetches the list of user mappings from the aws-auth ConfigMap and RoleBindings.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of user mapping objects.
 */
export async function fetchUserMappings() {
    return apiRequest(`${API_BASE_URL}/kube-user-mappings?forceRefresh=${Date.now()}`);
}

/**
 * NEW: Starts the Grafana port-forwarding process on the backend.
 * @returns {Promise<object>} A promise that resolves to the backend's response, including the local port.
 */
export async function startGrafanaPortForward() {
    return apiRequest(`${API_BASE_URL}/kube-start-port-forward`, { method: 'POST' });
}

/**
 * NEW: Stops the Grafana port-forwarding process on the backend.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function stopGrafanaPortForward() {
    // Use sendBeacon if available for reliability when the page is closing
    if (navigator.sendBeacon) {
        const headers = { type: 'application/json' };
        const blob = new Blob([JSON.stringify({})], headers);
        navigator.sendBeacon(`${API_BASE_URL}/kube-stop-port-forward`, blob);
        return Promise.resolve({ message: 'Port-forward stop signal sent.' });
    } else {
        // Fallback to fetch for older browsers
        return apiRequest(`${API_BASE_URL}/kube-stop-port-forward`, { method: 'POST', keepalive: true });
    }
}


// --- Kubernetes Resource Actions (Create, Delete, Scale) ---

/**
 * Sends a request to create one or more Kubernetes Pods.
 * @param {object} podConfig - Configuration for the pod(s).
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createPod(podConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-pod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(podConfig)
    });
}

/**
 * Sends a request to delete a Kubernetes Pod.
 * @param {string} name - The name of the pod to delete.
 * @param {string} namespace - The namespace of the pod.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deletePod(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-pod`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * Sends a request to create a Kubernetes Deployment.
 * @param {object} deploymentConfig - Configuration for the deployment.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createDeployment(deploymentConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-deployment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deploymentConfig)
    });
}

/**
 * Sends a request to delete a Kubernetes Deployment.
 * @param {string} name - The name of the deployment to delete.
 * @param {string} namespace - The namespace of the deployment.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteDeployment(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-deployment`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * Sends a request to scale a Kubernetes Deployment.
 * @param {string} name - The name of the deployment to scale.
 * @param {string} namespace - The namespace of the deployment.
 * @param {number} replicas - The new desired number of replicas.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function scaleDeployment(name, namespace, replicas) {
    return apiRequest(`${API_BASE_URL}/kube-scale-deployment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace, replicas })
    });
}

/**
 * Sends a request to create a Kubernetes Service.
 * @param {object} serviceConfig - Configuration for the service.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createService(serviceConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceConfig)
    });
}

/**
 * Sends a request to delete a Kubernetes Service.
 * @param {string} name - The name of the service to delete.
 * @param {string} namespace - The namespace of the service.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteService(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-service`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * NEW: Sends a request to create a Kubernetes Ingress.
 * @param {object} ingressConfig - Configuration for the ingress.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createIngress(ingressConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-ingress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingressConfig)
    });
}

/**
 * NEW: Sends a request to delete a Kubernetes Ingress.
 * @param {string} name - The name of the ingress to delete.
 * @param {string} namespace - The namespace of the ingress.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteIngress(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-ingress`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * NEW: Sends a request to create a Kubernetes Persistent Volume Claim (PVC).
 * @param {object} pvcConfig - Configuration for the PVC.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createPvc(pvcConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-pvc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pvcConfig)
    });
}

/**
 * Sends a request to delete a Kubernetes Persistent Volume Claim (PVC).
 * @param {string} name - The name of the PVC to delete.
 * @param {string} namespace - The namespace of the PVC.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deletePvc(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-pvc`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * Sends a request to create a Kubernetes StorageClass.
 * @param {object} scConfig - Configuration for the StorageClass.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createStorageClass(scConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-storageclass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scConfig)
    });
}

/**
 * Sends a request to delete a Kubernetes StorageClass.
 * @param {string} name - The name of the StorageClass to delete.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteStorageClass(name) {
    return apiRequest(`${API_BASE_URL}/kube-delete-storageclass`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
}

/**
 * Sends a request to manually bind a pending PVC to a StorageClass.
 * This will trigger the backend to patch the PVC with the selected StorageClass.
 * @param {string} pvcName - The name of the pending PVC.
 * @param {string} namespace - The namespace of the PVC.
 * @param {string} storageClassName - The name of the StorageClass to bind to.
 * @param {string} size - The storage size of the PVC (e.g., "1Gi").
 * @param {string} accessModes - The access mode of the PVC (e.g., "ReadWriteOnce").
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function bindPvc(pvcName, namespace, storageClassName, size, accessModes) {
    return apiRequest(`${API_BASE_URL}/kube-bind-pvc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pvcName, namespace, storageClassName, size, accessModes })
    });
}

/**
 * NEW: Sends a request to create a Kubernetes ConfigMap.
 * @param {object} configMapData - Configuration for the ConfigMap.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createConfigMap(configMapData) {
    return apiRequest(`${API_BASE_URL}/kube-create-configmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configMapData)
    });
}

/**
 * NEW: Sends a request to delete a Kubernetes ConfigMap.
 * @param {string} name - The name of the ConfigMap to delete.
 * @param {string} namespace - The namespace of the ConfigMap.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteConfigMap(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-configmap`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * NEW: Sends a request to create a Kubernetes Secret.
 * @param {object} secretData - Configuration for the Secret.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createSecret(secretData) {
    return apiRequest(`${API_BASE_URL}/kube-create-secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secretData)
    });
}

/**
 * NEW: Sends a request to delete a Kubernetes Secret.
 * @param {string} name - The name of the Secret to delete.
 * @param {string} namespace - The namespace of the Secret.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function deleteSecret(name, namespace) {
    return apiRequest(`${API_BASE_URL}/kube-delete-secret`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, namespace })
    });
}

/**
 * NEW: Sends a request to create a Kubernetes Namespace and its associated ResourceQuota.
 * @param {object} namespaceConfig - Configuration for the Namespace and its quotas.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createNamespace(namespaceConfig) {
    return apiRequest(`${API_BASE_URL}/kube-create-namespace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(namespaceConfig)
    });
}

/**
 * NEW: Sends a request to create a user mapping (Role, RoleBinding, aws-auth update).
 * @param {object} mappingData - The user mapping data.
 * @returns {Promise<object>} A promise that resolves to the backend's response.
 */
export async function createUserMapping(mappingData) {
    return apiRequest(`${API_BASE_URL}/kube-create-user-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingData)
    });
}
