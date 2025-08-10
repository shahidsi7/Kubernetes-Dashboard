// utils/manifestGenerators.js
// This file contains helper functions responsible for generating Kubernetes YAML manifests
// for various resource types (Pods, Deployments, Services, PVCs, StorageClasses).
// It abstracts away the YAML structure, allowing other parts of the application
// to focus on the data.

/**
 * Normalizes resource values (CPU and Memory) to Kubernetes-compatible formats.
 * - CPU: Converts decimal (e.g., "0.5") to millicores (e.g., "500m") if no unit is specified.
 * - Memory: Appends "Mi" (mebibytes) if no unit (Mi, Gi, M, G) is specified.
 * @param {string} value - The resource value string from the frontend.
 * @param {'cpu'|'memory'} type - The type of resource ('cpu' or 'memory').
 * @returns {string|undefined} The normalized resource string or undefined if input is invalid/empty.
 */
function normalizeResourceValue(value, type) {
    if (!value || value.trim() === '') {
        return undefined; // Return undefined to omit from YAML if empty
    }
    const trimmedValue = value.trim();

    if (type === 'cpu') {
        // If it already has 'm' suffix, return as is
        if (trimmedValue.endsWith('m')) {
            return trimmedValue;
        }
        // If it's a number (integer or float) without 'm' suffix
        if (/^\d+(\.\d+)?$/.test(trimmedValue)) {
            const floatValue = parseFloat(trimmedValue);
            // If it's a float, convert to millicores
            if (trimmedValue.includes('.')) {
                return `${Math.round(floatValue * 1000)}m`;
            }
            // If it's a whole number, assume it's cores.
            // User must explicitly use 'm' for millicores if they intend a whole number as millicores (e.g., "500m").
            return trimmedValue;
        }
        // For any other format, return undefined
        return undefined;
    } else if (type === 'memory') {
        // Check if it's a number without any common memory suffixes
        if (/^\d+$/.test(trimmedValue)) {
            return `${trimmedValue}Mi`; // Default to MiB
        }
        // Check for common Kubernetes memory units
        const memoryUnits = ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'E', 'P', 'T', 'G', 'M', 'K'];
        const unitRegex = new RegExp(`^\\d+(${memoryUnits.join('|')})$`);
        if (unitRegex.test(trimmedValue)) {
            return trimmedValue;
        }
        // For any other format, return undefined
        return undefined;
    }
    return undefined;
}

/**
 * Generates a Kubernetes PersistentVolumeClaim (PVC) YAML manifest.
 * @param {object} pvc - PVC configuration object.
 * @param {string} pvc.name - Name of the PVC.
 * @param {string} pvc.storageSize - Requested storage size (e.g., "1Gi", "500Mi").
 * @param {string} pvc.accessMode - Access mode (e.g., "ReadWriteOnce", "ReadOnlyMany").
 * @param {string} [pvc.storageClassName] - Optional storage class name.
 * @param {string} namespace - Namespace for the PVC.
 * @returns {string} The YAML manifest for the PVC.
 */
function generatePVCYaml(pvc, namespace) {
    // Sanitize PVC name to be lowercase and conform to DNS-1035 label rules
    const sanitizedPvcName = pvc.name.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/^-+|-+$/g, '');

    let pvcYaml = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${sanitizedPvcName}
  namespace: ${namespace}
spec:
  accessModes:
    - ${pvc.accessMode}
  resources:
    requests:
      storage: ${pvc.storageSize}`;
    if (pvc.storageClassName) {
        pvcYaml += `
  storageClassName: ${pvc.storageClassName}`;
    }
    return pvcYaml;
}

/**
 * Generates a Kubernetes Pod YAML manifest.
 * @param {object} podConfig - Pod configuration object.
 * @param {string} podConfig.name - Base name for the pod(s).
 * @param {string} podConfig.image - Container image to use.
 * @param {Array<object>} [podConfig.env] - Array of environment variables ({name, value}).
 * @param {Array<object>} [podConfig.envFrom] - Array of envFrom sources ({type, name}).
 * @param {object} [podConfig.labels] - Object of labels ({key: value}).
 * @param {string} [podConfig.command] - Optional command to run in the container.
 * @param {string} [podConfig.cpuRequest] - CPU request (e.g., "100m", "0.5").
 * @param {string} [podConfig.cpuLimit] - CPU limit (e.g., "200m", "1").
 * @param {string} [podConfig.memoryRequest] - Memory request (e.g., "64Mi", "0.1Gi").
 * @param {string} [podConfig.memoryLimit] - Memory limit (e.g., "128Mi", "0.2Gi").
 * @param {object} [podConfig.pvc] - Reference to an existing PVC for volume mount.
 * @param {string} podConfig.pvc.name - Name of the existing PVC to mount.
 * @param {string} podConfig.pvc.volumeMountPath - Path inside the container to mount the volume.
 * @param {string} [podConfig.pvc.volumeSubPath] - Subpath within the volume.
 * @param {string} namespace - Namespace for the pod.
 * @param {number} index - Index for unique pod naming (for multiple pods).
 * @returns {string} The YAML manifest for the pod.
 */
function generatePodYaml({ name, image, env, envFrom, labels, command: podCommand, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }, namespace, index) {
    // Sanitize pod name and container name to be lowercase and conform to RFC 1123
    const sanitizedPodNameBase = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    const uniquePodName = `${sanitizedPodNameBase}-${index}`;
    const sanitizedContainerName = `${uniquePodName}-container`.replace(/[^a-z0-9-]/g, '-');

    let podYaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${uniquePodName}
  namespace: ${namespace}
  labels:
    app: ${sanitizedPodNameBase}`; // Use sanitized base name for app label
    if (labels && Object.keys(labels).length > 0) {
        for (const key in labels) {
            podYaml += `
    ${key}: "${labels[key]}"`;
        }
    }
    podYaml += `
spec:
  securityContext:
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
  containers:
  - name: ${sanitizedContainerName}
    image: ${image}`;
    
    const command = podCommand || 'sleep 3600';
    const escapedCommand = command.replace(/"/g, '\\"');
    podYaml += `
    command: ["/bin/sh", "-c"]
    args: ["${escapedCommand}"]`;
    

    let envSectionYaml = '';
    if (env && env.length > 0) {
        envSectionYaml += `
    env:`;
        env.forEach(e => {
            envSectionYaml += `
    - name: ${e.name}
      value: "${e.value}"`;
        });
    }

    if (envFrom && envFrom.length > 0) {
        envSectionYaml += `
    envFrom:`;
        envFrom.forEach(e => {
            if (e.type === 'configMap') {
                envSectionYaml += `
    - configMapRef:
        name: ${e.name}`;
            } else if (e.type === 'secret') {
                envSectionYaml += `
    - secretRef:
        name: ${e.name}`;
            }
        });
    }
    podYaml += envSectionYaml;


    // Add normalized resource requests and limits
    const normalizedCpuRequest = normalizeResourceValue(cpuRequest, 'cpu');
    const normalizedMemoryRequest = normalizeResourceValue(memoryRequest, 'memory');
    const normalizedCpuLimit = normalizeResourceValue(cpuLimit, 'cpu');
    const normalizedMemoryLimit = normalizeResourceValue(memoryLimit, 'memory');

    if (normalizedCpuRequest || normalizedMemoryRequest || normalizedCpuLimit || normalizedMemoryLimit) {
        podYaml += `
    resources:`;
        if (normalizedCpuRequest || normalizedMemoryRequest) {
            podYaml += `
      requests:`;
            if (normalizedCpuRequest) podYaml += `
        cpu: ${normalizedCpuRequest}`;
            if (normalizedMemoryRequest) podYaml += `
        memory: ${normalizedMemoryRequest}`;
        }
        if (normalizedCpuLimit || normalizedMemoryLimit) {
            podYaml += `
      limits:`;
            if (normalizedCpuLimit) podYaml += `
        cpu: ${normalizedCpuLimit}`;
            if (normalizedMemoryLimit) podYaml += `
        memory: ${normalizedMemoryLimit}`;
        }
    }

    // MODIFIED: Add volume and volumeMount by referencing an existing PVC
    if (pvc && pvc.name && pvc.volumeMountPath) {
        const volumeName = `${pvc.name}-volume`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        podYaml += `
    volumeMounts:
    - name: ${volumeName}
      mountPath: ${pvc.volumeMountPath}`;
        if (pvc.volumeSubPath) {
            podYaml += `
      subPath: ${pvc.volumeSubPath}`;
        }
        podYaml += `
  volumes:
  - name: ${volumeName}
    persistentVolumeClaim:
      claimName: ${pvc.name}`;
    }
    return podYaml;
}

/**
 * Generates a Kubernetes Deployment YAML manifest.
 * @param {object} deploymentConfig - Deployment configuration object.
 * @param {string} deploymentConfig.name - Name of the deployment.
 * @param {string} deploymentConfig.image - Container image to use.
 * @param {number} deploymentConfig.replicas - Number of desired replicas.
 * @param {Array<object>} [deploymentConfig.env] - Array of environment variables ({name, value}).
 * @param {Array<object>} [deploymentConfig.envFrom] - Array of envFrom sources ({type, name}).
 * @param {object} [deploymentConfig.labels] - Object of labels ({key: value}).
 * @param {string} deploymentConfig.strategy - Deployment strategy ("RollingUpdate" or "Blue/Green").
 * @param {string} [deploymentConfig.cpuRequest] - CPU request.
 * @param {string} [deploymentConfig.cpuLimit] - CPU limit.
 * @param {string} [deploymentConfig.memoryRequest] - Memory request.
 * @param {string} [deploymentConfig.memoryLimit] - Memory limit.
 * @param {object} [deploymentConfig.pvc] - Reference to an existing PVC for volume mount.
 * @param {string} deploymentConfig.pvc.name - Name of the existing PVC to mount.
 * @param {string} deploymentConfig.pvc.volumeMountPath - Path inside the container to mount the volume.
 * @param {string} [deploymentConfig.pvc.volumeSubPath] - Subpath within the volume.
 * @param {string} namespace - Namespace for the deployment.
 * @returns {string} The YAML manifest for the deployment.
 */
function generateDeploymentYaml({ name, image, replicas, env, envFrom, labels, strategy, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }, namespace) {
    // Sanitize deployment name and container name to be lowercase and conform to RFC 1123
    const sanitizedDeploymentName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    const sanitizedContainerName = `${sanitizedDeploymentName}-container`.replace(/[^a-z0-9-]/g, '-');

    const podLabels = { app: sanitizedDeploymentName };
    if (labels && Object.keys(labels).length > 0) {
        Object.assign(podLabels, labels);
    }
    if (strategy === 'Blue/Green') {
        podLabels.version = 'green'; // Add version label for Blue/Green strategy
    }
    const labelsYaml = Object.entries(podLabels)
        .map(([key, value]) => `          ${key}: "${value}"`)
        .join('\n');

    let envSectionYaml = '';
    if ((env && env.length > 0) || (envFrom && envFrom.length > 0)) {
        envSectionYaml += `
        env:`;
        if (env && env.length > 0) {
            env.forEach(e => {
                envSectionYaml += `
        - name: ${e.name}
          value: "${e.value}"`;
            });
        }
    }

    if (envFrom && envFrom.length > 0) {
        envSectionYaml += `
        envFrom:`;
        envFrom.forEach(e => {
            if (e.type === 'configMap') {
                envSectionYaml += `
        - configMapRef:
            name: ${e.name}`;
            } else if (e.type === 'secret') {
                envSectionYaml += `
        - secretRef:
            name: ${e.name}`;
            }
        });
    }


    const normalizedCpuRequest = normalizeResourceValue(cpuRequest, 'cpu');
    const normalizedMemoryRequest = normalizeResourceValue(memoryRequest, 'memory');
    const normalizedCpuLimit = normalizeResourceValue(cpuLimit, 'cpu');
    const normalizedMemoryLimit = normalizeResourceValue(memoryLimit, 'memory');

    let resourcesYaml = '';
    const hasRequests = normalizedCpuRequest || normalizedMemoryRequest;
    const hasLimits = normalizedCpuLimit || normalizedMemoryLimit;
    if (hasRequests || hasLimits) {
        resourcesYaml += `
        resources:`;
        if (hasRequests) {
            resourcesYaml += `
          requests:`;
            if (normalizedCpuRequest) resourcesYaml += `
            cpu: ${normalizedCpuRequest}`;
            if (normalizedMemoryRequest) resourcesYaml += `
            memory: ${normalizedMemoryRequest}`;
        }
        if (hasLimits) {
            resourcesYaml += `
          limits:`;
            if (normalizedCpuLimit) resourcesYaml += `
            cpu: ${normalizedCpuLimit}`;
            if (normalizedMemoryLimit) resourcesYaml += `
            memory: ${normalizedMemoryLimit}`;
        }
    }

    let volumesYaml = '';
    let volumeMountsYaml = '';
    // MODIFIED: If an existing PVC is referenced, add volume mount and volume reference
    if (pvc && pvc.name && pvc.volumeMountPath) {
        const volumeName = `${pvc.name}-volume`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        volumesYaml = `
      volumes:
      - name: ${volumeName}
        persistentVolumeClaim:
          claimName: ${pvc.name}`;
        volumeMountsYaml = `
        volumeMounts:
        - name: ${volumeName}
          mountPath: ${pvc.volumeMountPath}`;
        if (pvc.volumeSubPath) {
            volumeMountsYaml += `
          subPath: ${pvc.volumeSubPath}`;
        }
    }

    let deploymentStrategyYaml = '';
    if (strategy === 'RollingUpdate') {
        deploymentStrategyYaml = `
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 25%
      maxSurge: 25%`;
    } else if (strategy === 'Blue/Green') {
        deploymentStrategyYaml = `
  strategy:
    type: Recreate`; // Blue/Green often uses Recreate or a custom controller
    }

    let deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${sanitizedDeploymentName}
  namespace: ${namespace}
  labels:
    app: ${sanitizedDeploymentName}`;
    if (strategy === 'Blue/Green') deploymentYaml += `
    version: green`; // Add version label to deployment metadata too
    deploymentYaml += `
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${sanitizedDeploymentName}`;
    if (strategy === 'Blue/Green') deploymentYaml += `
      version: green`;
    deploymentYaml += `
  template:
    metadata:
      labels:
${labelsYaml}
    spec:
      containers:
      - name: ${sanitizedContainerName}
        image: ${image}
        ports:
        - containerPort: 80
${envSectionYaml}${resourcesYaml}${volumeMountsYaml}
      restartPolicy: Always`; // Added restart policy for robustness
    if (volumesYaml) deploymentYaml += volumesYaml;
    if (deploymentStrategyYaml) deploymentYaml += `
${deploymentStrategyYaml}`;

    return deploymentYaml;
}

/**
 * Generates a Kubernetes Service YAML manifest.
 * @param {object} serviceConfig - Service configuration object.
 * @param {string} serviceConfig.deploymentName - Name of the deployment the service targets (for labels).
 * @param {string} serviceConfig.serviceName - Name of the service.
 * @param {string} serviceConfig.serviceType - Type of service (ClusterIP, NodePort, LoadBalancer).
 * @param {number} serviceConfig.appPort - The target port on the pods.
 * @param {number} serviceConfig.targetPort - The port the service exposes.
 * @param {string} serviceConfig.protocol - Protocol (TCP, UDP).
 * @param {object} serviceConfig.selector - Selector labels to match pods.
 * @param {string} namespace - Namespace for the service.
 * @returns {string} The YAML manifest for the service.
 */
function generateServiceYaml({ deploymentName, serviceName, serviceType, appPort, targetPort, protocol, selector }, namespace) {
    // Sanitize serviceName to be lowercase and conform to DNS-1035 label rules
    const sanitizedServiceName = serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    // Sanitize deploymentName for use in labels
    const sanitizedDeploymentName = deploymentName.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');

    const selectorYaml = Object.entries(selector)
        .map(([key, value]) => `    ${key}: "${value}"`)
        .join('\n');

    let servicePortsYaml = `
  ports:
    - protocol: ${protocol}
      port: ${targetPort}
      targetPort: ${appPort}`;

    const serviceYaml = `
apiVersion: v1
kind: Service
metadata:
  name: ${sanitizedServiceName}
  namespace: ${namespace}
  labels:
    app: ${sanitizedDeploymentName}
spec:
  selector:
${selectorYaml}
  type: ${serviceType}
${servicePortsYaml}
`;
    return serviceYaml;
}

/**
 * Generates a Kubernetes StorageClass YAML manifest.
 * @param {object} scConfig - StorageClass configuration object.
 * @param {string} scConfig.name - Name of the StorageClass.
 * @param {string} scConfig.provisioner - Provisioner name (e.g., "kubernetes.io/aws-ebs").
 * @param {object} [scConfig.parameters] - Optional parameters for the provisioner.
 * @param {string} [scConfig.reclaimPolicy] - Reclaim policy (Delete or Retain).
 * @param {string} [scConfig.volumeBindingMode] - Volume binding mode (Immediate or WaitForFirstConsumer).
 * @param {boolean} [scConfig.allowVolumeExpansion] - Whether volume expansion is allowed.
 * @returns {string} The YAML manifest for the StorageClass.
 */
function generateStorageClassYaml({ name, provisioner, parameters, reclaimPolicy, volumeBindingMode, allowVolumeExpansion }) {
    // Sanitize StorageClass name to be lowercase and conform to DNS-1035 label rules
    const sanitizedScName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');

    let scYaml = `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ${sanitizedScName}
provisioner: ${provisioner}`;

    if (parameters && typeof parameters === 'object' && Object.keys(parameters).length > 0) {
        scYaml += '\nparameters:';
        for (const [key, value] of Object.entries(parameters)) {
            scYaml += `\n  ${key}: "${value}"`;
        }
    }
    if (reclaimPolicy) scYaml += `\nreclaimPolicy: ${reclaimPolicy}`;
    if (volumeBindingMode) scYaml += `\nvolumeBindingMode: ${volumeBindingMode}`;
    if (typeof allowVolumeExpansion === 'boolean') scYaml += `\nallowVolumeExpansion: ${allowVolumeExpansion}`;

    return scYaml;
}

/**
 * NEW: Generates a Kubernetes Ingress YAML manifest for an AWS ALB.
 * @param {object} ingressConfig - Ingress configuration object.
 * @param {string} ingressConfig.name - Name of the Ingress resource.
 * @param {string} ingressConfig.serviceName - Name of the backend service to target.
 * @param {number} ingressConfig.servicePort - Port of the backend service.
 * @param {string} ingressConfig.path - The URL path for the rule.
 * @param {string} ingressConfig.pathType - The path type (e.g., "Prefix", "Exact").
 * @param {string} namespace - Namespace for the Ingress.
 * @returns {string} The YAML manifest for the Ingress.
 */
function generateIngressYaml({ name, serviceName, servicePort, path, pathType }, namespace) {
    // Sanitize Ingress name
    const sanitizedIngressName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');

    const ingressYaml = `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${sanitizedIngressName}
  namespace: ${namespace}
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
spec:
  rules:
  - http:
      paths:
      - path: ${path}
        pathType: ${pathType}
        backend:
          service:
            name: ${serviceName}
            port:
              number: ${servicePort}
`;
    return ingressYaml;
}

/**
 * NEW: Generates a Kubernetes ConfigMap YAML manifest.
 * @param {object} config - ConfigMap configuration object.
 * @param {string} config.name - Name of the ConfigMap.
 * @param {object} config.data - Key-value pairs.
 * @param {string} namespace - Namespace for the ConfigMap.
 * @returns {string} The YAML manifest for the ConfigMap.
 */
function generateConfigMapYaml({ name, data }, namespace) {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    let dataYaml = '';
    for (const key in data) {
        // Simple YAML indentation for key-value pairs
        dataYaml += `  ${key}: "${data[key]}"\n`;
    }

    return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${sanitizedName}
  namespace: ${namespace}
data:
${dataYaml}`;
}

/**
 * NEW: Generates a Kubernetes Secret YAML manifest.
 * @param {object} config - Secret configuration object.
 * @param {string} config.name - Name of the Secret.
 * @param {object} config.data - Key-value pairs (will be base64 encoded).
 * @param {string} namespace - Namespace for the Secret.
 * @returns {string} The YAML manifest for the Secret.
 */
function generateSecretYaml({ name, data }, namespace) {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    let dataYaml = '';
    for (const key in data) {
        // Base64 encode the value for the Secret manifest
        const encodedValue = btoa(data[key]);
        dataYaml += `  ${key}: ${encodedValue}\n`;
    }

    return `apiVersion: v1
kind: Secret
metadata:
  name: ${sanitizedName}
  namespace: ${namespace}
type: Opaque
data:
${dataYaml}`;
}

/**
 * NEW: Generates a Kubernetes Namespace YAML manifest.
 * @param {string} name - The name for the Namespace.
 * @returns {string} The YAML manifest for the Namespace.
 */
function generateNamespaceYaml(name) {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    return `apiVersion: v1
kind: Namespace
metadata:
  name: ${sanitizedName}
`;
}

/**
 * NEW: Generates a Kubernetes ResourceQuota YAML manifest.
 * @param {string} namespace - The namespace for the ResourceQuota.
 * @param {object} quotas - An object of key-value pairs for the resource quotas.
 * @returns {string} The YAML manifest for the ResourceQuota.
 */
function generateResourceQuotaYaml(namespace, quotas) {
    const sanitizedNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    let hardQuotasYaml = '';
    for (const key in quotas) {
        if (quotas[key]) { // Only add quota if value is provided
             hardQuotasYaml += `    ${key}: ${quotas[key]}\n`;
        }
    }

    if (!hardQuotasYaml) {
        return null; // Return null if no quotas are specified
    }

    return `apiVersion: v1
kind: ResourceQuota
metadata:
  name: ${sanitizedNamespace}-quota
  namespace: ${sanitizedNamespace}
spec:
  hard:
${hardQuotasYaml.slice(0, -1)}`; // Remove trailing newline
}


/**
 * NEW: Generates a Kubernetes Role YAML manifest.
 * @param {object} config - Role configuration object.
 * @param {string} config.name - Name of the Role.
 * @param {string} config.namespace - Namespace for the Role.
 * @param {Array<object>} config.rules - Array of rule objects.
 * @returns {string} The YAML manifest for the Role.
 */
function generateRoleYaml({ name, namespace, rules }) {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    let rulesYaml = '';
    rules.forEach(rule => {
        rulesYaml += `
- apiGroups: ["${rule.apiGroups.join('", "')}"]
  resources: ["${rule.resources.join('", "')}"]
  verbs: ["${rule.verbs.join('", "')}"]`;
    });

    return `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${sanitizedName}
  namespace: ${namespace}
rules:${rulesYaml}
`;
}

/**
 * NEW: Generates a Kubernetes RoleBinding YAML manifest.
 * @param {object} config - RoleBinding configuration object.
 * @param {string} config.name - Name of the RoleBinding.
 * @param {string} config.namespace - Namespace for the RoleBinding.
 * @param {string} config.roleName - Name of the Role to bind to.
 * @param {string} config.userName - The Kubernetes username to bind the role to.
 * @returns {string} The YAML manifest for the RoleBinding.
 */
function generateRoleBindingYaml({ name, namespace, roleName, userName }) {
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9-.]/g, '-').replace(/^-+|-+$/g, '');
    return `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${sanitizedName}
  namespace: ${namespace}
subjects:
- kind: User
  name: ${userName}
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: ${roleName}
  apiGroup: rbac.authorization.k8s.io
`;
}


module.exports = {
    generatePVCYaml,
    generatePodYaml,
    generateDeploymentYaml,
    generateServiceYaml,
    generateStorageClassYaml,
    generateIngressYaml,
    generateConfigMapYaml, // NEW
    generateSecretYaml, // NEW
    normalizeResourceValue,
    generateNamespaceYaml, // NEW
    generateResourceQuotaYaml, // NEW
    generateRoleYaml, // NEW
    generateRoleBindingYaml // NEW
};
