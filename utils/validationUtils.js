// utils/validationUtils.js
// This file provides centralized validation functions for incoming request data
// before processing and generating Kubernetes manifests.
// This helps ensure data integrity and provides clear error messages to the client.

/**
 * Validates input data for creating a Kubernetes Pod.
 * @param {object} data - The request body data for pod creation.
 * @param {string} data.name - Pod name.
 * @param {string} data.image - Pod image.
 * @param {number} data.numPods - Number of pods to create.
 * @param {Array<object>} [data.env] - Environment variables.
 * @param {object} [data.labels] - Labels.
 * @param {string} [data.cpuRequest] - CPU request string.
 * @param {string} [data.cpuLimit] - CPU limit string.
 * @param {string} [data.memoryRequest] - Memory request string.
 * @param {string} [data.memoryLimit] - Memory limit string.
 * @param {object} [data.pvc] - PVC configuration.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validatePodInput({ name, image, numPods, env, labels, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'Pod name is required.';
    if (!image || typeof image !== 'string' || !image.trim()) return 'Pod image is required.';
    if (isNaN(numPods) || numPods < 1) return 'A positive number of pods is required.';
    if (env && !Array.isArray(env)) return 'Environment variables must be an array.';
    if (labels && typeof labels !== 'object') return 'Labels must be an object.';

    // MODIFIED: Corrected regex for CPU and Memory validation.
    const cpuRegex = /^(\d+(\.\d+)?|\d+)m?$/; // Allows for '1', '0.5', '100m'
    const memoryRegex = /^\d+(\.\d+)?(E|P|T|G|M|K|Ei|Pi|Ti|Gi|Mi|Ki)?$/; // Allows for standard K8s memory units

    if (cpuRequest && !cpuRegex.test(cpuRequest)) return 'Invalid CPU request format. Use cores (e.g., 0.5, 1) or millicores (e.g., 500m).';
    if (cpuLimit && !cpuRegex.test(cpuLimit)) return 'Invalid CPU limit format. Use cores (e.g., 0.5, 1) or millicores (e.g., 500m).';
    if (memoryRequest && !memoryRegex.test(memoryRequest)) return 'Invalid memory request format. Use units like Ki, Mi, Gi, etc.';
    if (memoryLimit && !memoryRegex.test(memoryLimit)) return 'Invalid memory limit format. Use units like Ki, Mi, Gi, etc.';

    // When attaching an existing PVC, we only need its name and the mount path.
    // The other details (size, access mode) are part of the existing PVC's definition.
    if (pvc) {
        if (!pvc.name || typeof pvc.name !== 'string' || !pvc.name.trim()) return 'A selected PVC Name is required when attaching a volume.';
        if (!pvc.volumeMountPath || typeof pvc.volumeMountPath !== 'string' || !pvc.volumeMountPath.trim()) return 'A Volume Mount Path is required when attaching a volume.';
    }
    return null; // Validation successful
}

/**
 * Validates input data for creating a Kubernetes Deployment.
 * @param {object} data - The request body data for deployment creation.
 * @param {string} data.name - Deployment name.
 * @param {string} data.image - Container image.
 * @param {number} data.replicas - Number of replicas.
 * @param {Array<object>} [data.env] - Environment variables.
 * @param {object} [data.labels] - Labels.
 * @param {string} [data.strategy] - Deployment strategy.
 * @param {string} [data.cpuRequest] - CPU request string.
 * @param {string} [data.cpuLimit] - CPU limit string.
 * @param {string} [data.memoryRequest] - Memory request string.
 * @param {string} [data.memoryLimit] - Memory limit string.
 * @param {object} [data.pvc] - PVC configuration.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateDeploymentInput({ name, image, replicas, env, labels, strategy, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'Deployment name is required.';
    if (!image || typeof image !== 'string' || !image.trim()) return 'Deployment image is required.';
    if (isNaN(replicas) || replicas < 1) return 'A positive number of replicas is required.';
    if (env && !Array.isArray(env)) return 'Environment variables must be an array.';
    if (labels && typeof labels !== 'object') return 'Labels must be an object.';
    if (strategy && !['RollingUpdate', 'Blue/Green'].includes(strategy)) return 'Invalid deployment strategy.';

    // MODIFIED: Corrected regex for CPU and Memory validation.
    const cpuRegex = /^(\d+(\.\d+)?|\d+)m?$/; // Allows for '1', '0.5', '100m'
    const memoryRegex = /^\d+(\.\d+)?(E|P|T|G|M|K|Ei|Pi|Ti|Gi|Mi|Ki)?$/; // Allows for standard K8s memory units

    if (cpuRequest && !cpuRegex.test(cpuRequest)) return 'Invalid CPU request format. Use cores (e.g., 0.5, 1) or millicores (e.g., 500m).';
    if (cpuLimit && !cpuRegex.test(cpuLimit)) return 'Invalid CPU limit format. Use cores (e.g., 0.5, 1) or millicores (e.g., 500m).';
    if (memoryRequest && !memoryRegex.test(memoryRequest)) return 'Invalid memory request format. Use units like Ki, Mi, Gi, etc.';
    if (memoryLimit && !memoryRegex.test(memoryLimit)) return 'Invalid memory limit format. Use units like Ki, Mi, Gi, etc.';

    // When attaching an existing PVC, we only need its name and the mount path.
    if (pvc) {
        if (!pvc.name || typeof pvc.name !== 'string' || !pvc.name.trim()) return 'A selected PVC Name is required when attaching a volume.';
        if (!pvc.volumeMountPath || typeof pvc.volumeMountPath !== 'string' || !pvc.volumeMountPath.trim()) return 'A Volume Mount Path is required when attaching a volume.';
    }
    return null; // Validation successful
}

/**
 * Validates input data for creating a Kubernetes Service.
 * @param {object} data - The request body data for service creation.
 * @param {string} data.deploymentName - Name of the deployment the service targets.
 * @param {string} data.serviceName - Service name.
 * @param {string} data.serviceType - Service type.
 * @param {number} data.appPort - Application port.
 * @param {number} data.targetPort - Target port.
 * @param {string} data.protocol - Protocol.
 * @param {object} data.selector - Selector labels.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateServiceInput({ deploymentName, serviceName, serviceType, appPort, targetPort, protocol, selector }) {
    if (!deploymentName || typeof deploymentName !== 'string' || !deploymentName.trim()) return 'Deployment name is required for service.';
    if (!serviceName || typeof serviceName !== 'string' || !serviceName.trim()) return 'Service name is required.';
    if (!serviceType || typeof serviceType !== 'string' || !['ClusterIP', 'NodePort', 'LoadBalancer'].includes(serviceType)) return 'Invalid service type.';
    if (isNaN(appPort) || appPort < 1 || appPort > 65535) return 'App port is required and must be a valid port number (1-65535).';
    if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) return 'Target port is required and must be a valid port number (1-65535).';
    if (!protocol || typeof protocol !== 'string' || !['TCP', 'UDP'].includes(protocol)) return 'Invalid protocol.';
    if (!selector || typeof selector !== 'object' || Object.keys(selector).length === 0) return 'At least one selector is required for the service.';

    // Basic validation for selector keys/values (Kubernetes label rules)
    for (const key in selector) {
        if (!/^[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?)*\/?[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([-a-zA-Z0-9]*[a-zA-Z0-9])?)*$/.test(key)) {
            return `Invalid selector key format: ${key}`;
        }
        if (typeof selector[key] !== 'string' || !/^[a-zA-Z0-9]([-a-zA-Z0-9._]*[a-zA-Z0-9])?$/.test(selector[key])) {
            return `Invalid selector value format for key ${key}: ${selector[key]}`;
        }
    }
    return null; // Validation successful
}

/**
 * Validates input data for creating a Kubernetes StorageClass.
 * @param {object} data - The request body data for StorageClass creation.
 * @param {string} data.name - StorageClass name.
 * @param {string} data.provisioner - StorageClass provisioner.
 * @param {object} [data.parameters] - Optional parameters.
 * @param {string} [data.reclaimPolicy] - Reclaim policy.
 * @param {string} [data.volumeBindingMode] - Volume binding mode.
 * @param {boolean} [data.allowVolumeExpansion] - Allow volume expansion flag.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateStorageClassInput({ name, provisioner, parameters, reclaimPolicy, volumeBindingMode, allowVolumeExpansion }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'StorageClass name is required.';
    if (!provisioner || typeof provisioner !== 'string' || !provisioner.trim()) return 'StorageClass provisioner is required.';
    if (parameters && typeof parameters !== 'object') return 'StorageClass parameters must be an object.';
    if (reclaimPolicy && !['Delete', 'Retain'].includes(reclaimPolicy)) return 'Invalid reclaim policy. Must be "Delete" or "Retain".';
    if (volumeBindingMode && !['Immediate', 'WaitForFirstConsumer'].includes(volumeBindingMode)) return 'Invalid volume binding mode. Must be "Immediate" or "WaitForFirstConsumer".';
    if (typeof allowVolumeExpansion !== 'boolean' && typeof allowVolumeExpansion !== 'undefined') return 'Allow volume expansion must be a boolean.';

    return null; // Validation successful
}

/**
 * NEW: Validates input data for creating a Kubernetes PersistentVolumeClaim.
 * @param {object} data - The request body data for PVC creation.
 * @param {string} data.name - PVC name.
 * @param {string} data.storageSize - Requested storage size (e.g., "1Gi").
 * @param {string} data.accessMode - Access mode (e.g., "ReadWriteOnce").
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validatePvcInput({ name, storageSize, accessMode }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'PVC name is required.';
    if (!storageSize || typeof storageSize !== 'string' || !storageSize.trim()) return 'PVC storage size is required.';
    if (!accessMode || typeof accessMode !== 'string' || !['ReadWriteOnce', 'ReadOnlyMany', 'ReadWriteMany'].includes(accessMode)) return 'Invalid access mode.';

    // Regex to validate storage size format (e.g., 1Gi, 500Mi, 10T)
    const sizeRegex = /^\d+(\.\d+)?(K|M|G|T|P|E)i?$/;
    if (!sizeRegex.test(storageSize)) {
        return 'Invalid storage size format. Use units like Ki, Mi, Gi, Ti.';
    }

    return null; // Validation successful
}

/**
 * NEW: Validates input data for creating a Kubernetes Ingress.
 * @param {object} data - The request body data for Ingress creation.
 * @param {string} data.name - Ingress name.
 * @param {string} data.serviceName - Name of the backend service.
 * @param {number} data.servicePort - Port of the backend service.
 * @param {string} data.path - The URL path for the rule.
 * @param {string} data.pathType - The path type (e.g., "Prefix").
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateIngressInput({ name, serviceName, servicePort, path, pathType }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'Ingress name is required.';
    if (!serviceName || typeof serviceName !== 'string' || !serviceName.trim()) return 'A target service name is required.';
    if (isNaN(servicePort) || servicePort < 1 || servicePort > 65535) return 'Service port must be a valid port number (1-65535).';
    if (!path || typeof path !== 'string' || !path.trim().startsWith('/')) return 'A valid URL path (starting with /) is required.';
    if (!pathType || !['Prefix', 'Exact', 'ImplementationSpecific'].includes(pathType)) return 'Invalid path type.';
    
    return null; // Validation successful
}

/**
 * NEW: Validates input for creating a ConfigMap.
 * @param {object} data - The request body data for ConfigMap creation.
 * @param {string} data.name - ConfigMap name.
 * @param {object} data.data - Key-value pairs.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateConfigMapInput({ name, data }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'ConfigMap name is required.';
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return 'At least one key-value pair is required for the ConfigMap.';
    for (const key in data) {
        if (!key.trim()) return 'ConfigMap keys cannot be empty.';
        if (typeof data[key] !== 'string') return `Value for key "${key}" must be a string.`;
    }
    return null; // Validation successful
}

/**
 * NEW: Validates input for creating a Secret.
 * @param {object} data - The request body data for Secret creation.
 * @param {string} data.name - Secret name.
 * @param {object} data.data - Key-value pairs.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateSecretInput({ name, data }) {
    if (!name || typeof name !== 'string' || !name.trim()) return 'Secret name is required.';
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return 'At least one key-value pair is required for the Secret.';
     for (const key in data) {
        if (!key.trim()) return 'Secret keys cannot be empty.';
        if (typeof data[key] !== 'string') return `Value for key "${key}" must be a string.`;
    }
    return null; // Validation successful
}

/**
 * NEW: Validates input for creating a Namespace and its ResourceQuota.
 * @param {object} data - The request body data for Namespace creation.
 * @param {string} data.name - Namespace name.
 * @param {object} data.quotas - Key-value pairs for resource quotas.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateNamespaceInput({ name, quotas }) {
    if (!name || typeof name !== 'string' || !/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
        return 'Invalid namespace name. It must consist of lower case alphanumeric characters or "-", and must start and end with an alphanumeric character.';
    }
    if (quotas && typeof quotas !== 'object') {
        return 'Quotas must be an object of key-value pairs.';
    }
    // You can add more specific validation for quota keys and values if needed
    // For example, checking if the keys are valid resource quota types.
    return null; // Validation successful
}

/**
 * NEW: Validates input for creating a user mapping (Role, RoleBinding, and aws-auth update).
 * @param {object} data - The request body data for user mapping.
 * @param {string} data.iamRoleArn - The full AWS IAM Role ARN.
 * @param {string} data.kubernetesUsername - The Kubernetes username to map to.
 * @param {string} data.namespace - The namespace for the permissions.
 * @param {string} data.roleName - The name for the new Kubernetes Role.
 * @param {Array<object>} data.rules - The set of rules for the Role.
 * @returns {string|null} An error message if validation fails, otherwise null.
 */
function validateUserMappingInput({ iamRoleArn, kubernetesUsername, namespace, roleName, rules }) {
    if (!iamRoleArn || !iamRoleArn.trim().startsWith('arn:aws:iam::')) {
        return 'A valid AWS IAM Role ARN is required.';
    }
    if (!kubernetesUsername || !kubernetesUsername.trim()) {
        return 'A Kubernetes Username is required.';
    }
    if (!namespace || !namespace.trim()) {
        return 'A Namespace is required.';
    }
    if (!roleName || !roleName.trim()) {
        return 'A name for the Kubernetes Role (Power) is required.';
    }
    if (!rules || !Array.isArray(rules) || rules.length === 0) {
        return 'At least one permission rule is required for the Role.';
    }
    for (const rule of rules) {
        if (!rule.apiGroups || !Array.isArray(rule.apiGroups)) return 'Each rule must have apiGroups.';
        if (!rule.resources || !Array.isArray(rule.resources) || rule.resources.length === 0) return 'Each rule must have at least one resource.';
        if (!rule.verbs || !Array.isArray(rule.verbs) || rule.verbs.length === 0) return 'Each rule must have at least one verb.';
    }
    return null; // Validation successful
}


module.exports = {
    validatePodInput,
    validateDeploymentInput,
    validateServiceInput,
    validateStorageClassInput,
    validatePvcInput,
    validateIngressInput,
    validateConfigMapInput, // NEW
    validateSecretInput, // NEW
    validateNamespaceInput, // NEW
    validateUserMappingInput // NEW
};
