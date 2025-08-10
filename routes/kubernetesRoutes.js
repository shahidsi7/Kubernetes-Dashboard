// routes/kubernetesRoutes.js
// This file defines all Express API routes related to Kubernetes and AWS EKS management.
// It uses utility functions from the 'utils' directory to perform shell commands,
// generate manifests, and handle errors.

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process'); // Import spawn for port-forwarding
const yaml = require('js-yaml'); // NEW: Add js-yaml for parsing the aws-auth configmap

// Import utility functions for interacting with kubectl and eksctl
const { execPromise, handleKubectlError, parseAndHandleJson, getAwsAccountId } = require('../utils/kubectlUtils'); // Added getAwsAccountId
// Import manifest generation utilities
const { generatePVCYaml, generatePodYaml, generateDeploymentYaml, generateServiceYaml, generateStorageClassYaml, generateIngressYaml, generateConfigMapYaml, generateSecretYaml, generateNamespaceYaml, generateResourceQuotaYaml, generateRoleYaml, generateRoleBindingYaml } = require('../utils/manifestGenerators');
// Import validation utilities
const { validatePodInput, validateDeploymentInput, validateServiceInput, validateStorageClassInput, validatePvcInput, validateIngressInput, validateConfigMapInput, validateSecretInput, validateNamespaceInput, validateUserMappingInput } = require('../utils/validationUtils');
// Import caching utility
const { getCachedData, setCacheData } = require('../utils/cache');

// Define cache TTLs for different data types (in milliseconds)
const CACHE_TTLS = {
    NODES: 30 * 1000, // 30 seconds for nodes
    PODS: 30 * 1000, // 30 seconds
    DEPLOYMENTS: 30 * 1000,
    SERVICES: 30 * 1000,
    INGRESSES: 30 * 1000,
    PVCS: 30 * 1000,
    PVS: 30 * 1000,
    STORAGE_CLASSES: 30 * 1000,
    CONFIG_MAPS: 30 * 1000, // NEW
    SECRETS: 30 * 1000, // NEW
    NAMESPACES: 60 * 1000, // Namespaces change less frequently
    EKS_CLUSTERS: 60 * 1000, // EKS cluster list
    TREE_VIEW: 15 * 1000 // 15 seconds for the tree view data
};

// --- Frontend UI Routes ---

// Serve the main Kubernetes Management UI
router.get("/", function(request, response) {
    response.sendFile(__dirname + "/../public/index.html");
});

// Serve the Kubernetes Dashboard UI
router.get("/kubernetes-dashboard", function(request, response) {
    response.sendFile(__dirname + "/../public/kubernetes-dashboard.html");
});

// --- AWS EKS Configuration and Cluster Management API Endpoints ---

// Endpoint to configure AWS credentials
router.post("/eks-configure-aws", async (request, response) => {
    const { accessKeyId, secretAccessKey, region } = request.body;

    if (!accessKeyId || !secretAccessKey || !region) {
        return response.status(400).json({ error: "AWS Access Key ID, Secret Access Key, and Region are required." });
    }

    // Configure AWS CLI with the provided credentials using execPromise
    const configureCommands = [
        `aws configure set aws_access_key_id ${accessKeyId}`,
        `aws configure set aws_secret_access_key ${secretAccessKey}`,
        `aws configure set default.region ${region}`,
        `aws configure set default.output json`
    ];

    try {
        // Execute all configure commands sequentially
        for (const cmd of configureCommands) {
            await execPromise(cmd);
        }

        // Step 2: Verify credentials by getting caller identity using execPromise
        const stsStdout = await execPromise('aws sts get-caller-identity');
        // No need to parse stsStdout, just checking for success

        // Step 3: Verify eksctl is installed and configured correctly using execPromise
        const eksctlStdout = await execPromise('eksctl version');

        response.status(200).json({ message: `AWS credentials configured and eksctl verified successfully. eksctl version: ${eksctlStdout.trim()}` });
    } catch (err) {
        console.error(`AWS configuration or verification error: ${err.message}`);
        // Attempt to clear potentially bad credentials if any step fails
        await execPromise(`aws configure set aws_access_key_id "" && aws configure set aws_secret_access_key "" && aws configure set default.region ""`).catch(clearErr => {
            console.error("Error attempting to clear AWS credentials:", clearErr.message);
        });
        // Provide a more specific error message based on the failure
        if (err.message.includes('InvalidClientTokenId') || err.message.includes('AuthFailure')) {
            return response.status(401).json({ error: `Invalid AWS credentials. Please check your Access Key ID and Secret Access Key. Details: ${err.message}`, details: err.message });
        } else if (err.message.includes('eksctl version')) {
            return response.status(500).json({ error: `eksctl is not installed or configured correctly. Please ensure it's in your PATH. Details: ${err.message}`, details: err.message });
        } else {
            return response.status(500).json({ error: `Failed to configure AWS CLI or verify setup: ${err.message}`, details: err.message });
        }
    }
});

// Endpoint to check if AWS credentials are configured and valid
router.get("/eks-check-connection", async (request, response) => {
    try {
        // Attempt a simple eksctl command to verify configuration using execPromise
        await execPromise('eksctl get clusters --output json');
        response.status(200).json({ connected: true, message: "Connected to eksctl successfully." });
    } catch (err) {
        console.error(`eksctl connection check failed: ${err.message}`);
        // Return 401 if connection fails, indicating a credential/configuration issue
        response.status(401).json({ connected: false, error: `Not connected to EKS: ${err.message.trim()}` });
    }
});

// Endpoint to list EKS clusters
router.get("/eks-list-clusters", async (request, response) => {
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = 'eks-clusters';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.EKS_CLUSTERS, forceRefresh);

    if (cachedData) {
        console.log("Serving EKS clusters from cache.");
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('eksctl get clusters --output json');
        const clusters = parseAndHandleJson(stdout, 'eksctl get clusters output');
        const dataToCache = Array.isArray(clusters) ? clusters : [clusters]; // Ensure it's an array
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'EKS clusters', 'list', response);
    }
});

// Endpoint to get details of a specific EKS cluster
router.get("/eks-cluster-details", async (request, response) => {
    const { clusterName, region } = request.query;
    if (!clusterName || !region) {
        return response.status(400).json({ error: "Cluster name and region are required to get details." });
    }

    const cacheKey = `eks-cluster-details-${clusterName}-${region}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.EKS_CLUSTERS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving EKS cluster details for ${clusterName} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `aws eks describe-cluster --name ${clusterName} --region ${region}`;
    try {
        const stdout = await execPromise(command);
        const details = parseAndHandleJson(stdout, `aws eks describe-cluster ${clusterName} output`);
        setCacheData(cacheKey, details);
        response.status(200).json(details);
    } catch (err) {
        handleKubectlError(err, clusterName, 'get cluster details', response);
    }
});

// Endpoint to initiate EKS cluster creation (now just sends a success response for WebSocket to pick up)
router.post("/eks-create-cluster", (request, response) => {
    response.status(200).json({ message: "Initiating cluster creation via WebSocket stream." });
});

// Endpoint to initiate EKS cluster deletion (now just sends a success response for WebSocket to pick up)
router.post("/eks-delete-cluster", (request, response) => {
    response.status(200).json({ message: "Initiating cluster deletion via WebSocket stream." });
});

// Endpoint to clear AWS credentials
router.post("/eks-clear-credentials", async (request, response) => {
    const unsetKeys = [
        "aws_access_key_id",
        "aws_secret_access_key",
        "default.region",
        "default.output"
    ];

    let errorMessages = [];

    for (const key of unsetKeys) {
        try {
            // Using execPromise for clearing credentials
            await execPromise(`aws configure set ${key} ""`);
        } catch (e) {
            console.error(`Error clearing AWS credential ${key}: ${e.message}`);
            errorMessages.push(`Failed to clear ${key}: ${e.message}`);
        }
    }

    if (errorMessages.length > 0) {
        return response.status(500).json({
            error: `Failed to clear some AWS credentials. Details: ${errorMessages.join('; ')}`
        });
    } else {
        response.status(200).json({ message: "AWS credentials cleared successfully." });
    }
});

// --- Kubernetes Resource Management API Endpoints ---

// NEW: Endpoint to get all resources for the tree view
router.get("/kube-tree-resources", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `tree-view-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.TREE_VIEW, forceRefresh);

    if (cachedData) {
        console.log(`Serving tree view resources for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const commands = {
            nodes: 'kubectl get nodes -o json',
            pods: `kubectl get pods -n ${namespace} -o json`,
            deployments: `kubectl get deployments -n ${namespace} -o json`,
            services: `kubectl get services -n ${namespace} -o json`,
            ingresses: `kubectl get ingresses -n ${namespace} -o json`,
            pvcs: `kubectl get pvc -n ${namespace} -o json`,
            pvs: 'kubectl get pv -o json',
            secrets: `kubectl get secrets -n ${namespace} -o json`,
            configmaps: `kubectl get configmaps -n ${namespace} -o json`
        };

        const promises = Object.entries(commands).map(async ([key, cmd]) => {
            try {
                const stdout = await execPromise(cmd);
                return { key, data: parseAndHandleJson(stdout, `kubectl get ${key}`).items };
            } catch (error) {
                // If a resource type is not found, return an empty array instead of failing the whole request
                if (error.message.includes('NotFound') || error.message.includes('no resources found')) {
                    console.warn(`No resources of type '${key}' found in namespace '${namespace}'.`);
                    return { key, data: [] };
                }
                // For other errors, re-throw to be caught by the outer try-catch
                throw new Error(`Failed to fetch ${key}: ${error.message}`);
            }
        });

        const results = await Promise.all(promises);
        const allData = results.reduce((acc, { key, data }) => {
            acc[key] = data;
            return acc;
        }, {});

        setCacheData(cacheKey, allData);
        response.status(200).json(allData);

    } catch (err) {
        handleKubectlError(err, 'all resources for tree view', 'list', response);
    }
});


// NEW, SIMPLIFIED ENDPOINT for fetching only worker nodes
router.get("/kube-worker-nodes", async (request, response) => {
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = 'worker-nodes';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.NODES, forceRefresh);

    if (cachedData) {
        console.log("Serving worker nodes from cache.");
        return response.status(200).json(cachedData);
    }

    try {
        const nodesOutput = await execPromise('kubectl get nodes -o json');
        const nodesResult = parseAndHandleJson(nodesOutput, 'kubectl get nodes output');
        const nodesData = nodesResult?.items || [];

        const workerNodes = [];
        nodesData.forEach(node => {
            const isMaster = (node.metadata.labels['node-role.kubernetes.io/control-plane'] !== undefined) ||
                             (node.metadata.labels['node-role.kubernetes.io/master'] !== undefined);

            if (!isMaster) {
                const nodeInfo = {
                    name: node.metadata.name,
                    type: 'worker',
                    status: node.status.conditions.find(cond => cond.type === 'Ready')?.status || 'Unknown',
                    version: node.status.nodeInfo.kubeletVersion || 'N/A',
                };
                workerNodes.push(nodeInfo);
            }
        });

        setCacheData(cacheKey, workerNodes);
        response.status(200).json(workerNodes);
    } catch (error) {
        handleKubectlError(error, 'worker nodes', 'list', response);
    }
});

// Endpoint to set kubectl context for a selected cluster
router.post("/eks-set-context", async (request, response) => {
    const { clusterName, region } = request.body;
    if (!clusterName || !region) {
        return response.status(400).json({ error: "Cluster name and region are required to set context." });
    }

    const command = `eksctl utils write-kubeconfig --cluster ${clusterName} --region ${region}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `kubectl context set to cluster '${clusterName}' successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, clusterName, 'set kubectl context', response);
    }
});

// NEW: Endpoint to deploy AWS EBS CSI Driver
router.post("/kube-deploy-ebs-csi", async (request, response) => {
    const { clusterName, region } = request.body;
    if (!clusterName || !region) {
        return response.status(400).json({ error: "Cluster name and region are required for EBS CSI deployment." });
    }

    try {
        const accountId = await getAwsAccountId();
        const ebsCsiRoleArn = `arn:aws:iam::${accountId}:role/AmazonEKS_EBS_CSI_Driver_Role`; // Common role for EBS CSI
        const command = `eksctl create addon --name aws-ebs-csi-driver --cluster ${clusterName} --region ${region} --service-account-role-arn ${ebsCsiRoleArn}`;
        const stdout = await execPromise(command);
        response.status(200).json({ message: "AWS EBS CSI Driver deployed successfully.", output: stdout });
    } catch (err) {
        handleKubectlError(err, 'AWS EBS CSI Driver', 'deploy', response);
    }
});

// NEW: Endpoint to deploy AWS EFS CSI Driver
router.post("/kube-deploy-efs-csi", async (request, response) => {
    const { clusterName, region } = request.body;
    if (!clusterName || !region) {
        return response.status(400).json({ error: "Cluster name and region are required for EFS CSI deployment." });
    }

    try {
        const accountId = await getAwsAccountId();
        // Create IAM Service Account for EFS CSI Driver
        const efsSaCommand = `eksctl create iamserviceaccount --name efs-csi-controller-sa --namespace kube-system --cluster ${clusterName} --region ${region} --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy --approve --override-existing-serviceaccounts`;
        await execPromise(efsSaCommand);

        // Deploy EFS CSI Driver components
        const efsCsiRoleName = `eksctl-${clusterName}-addon-iamserviceaccount-kube-system-efs-csi-controller-sa`; // eksctl generates this name
        const efsCsiRoleArn = `arn:aws:iam::${accountId}:role/${efsCsiRoleName}`;
        const efsDeployCommand = `eksctl create addon --name aws-efs-csi-driver --cluster ${clusterName} --region ${region} --service-account-role-arn ${efsCsiRoleArn}`;
        const stdout = await execPromise(efsDeployCommand);
        response.status(200).json({ message: "AWS EFS CSI Driver deployed successfully.", output: stdout });
    } catch (err) {
        handleKubectlError(err, 'AWS EFS CSI Driver', 'deploy', response);
    }
});

// *** FIX: Removed the /kube-deploy-metrics-server endpoint ***
// This is no longer needed as eksctl installs it as a managed addon by default.

// NEW: Endpoint to deploy Prometheus (kept for manual deployment via dashboard)
router.post("/kube-deploy-prometheus", async (request, response) => {
    const prometheusManifest = `
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: prometheus
  namespace: monitoring
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus
rules:
- apiGroups: [""]
  resources:
  - nodes
  - nodes/proxy
  - services
  - endpoints
  - pods
  - configmaps # Added configmaps for Prometheus to read its own config
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions"]
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources:
  - configmaps
  verbs: ["get"] # Ensure Prometheus can get configmaps
- apiGroups:
  - networking.k8s.io
  resources:
  - ingresses
  verbs: ["get", "list", "watch"]
- nonResourceURLs: ["/metrics"] # Allow access to /metrics endpoint
  verbs: ["get"]
- apiGroups: [""]
  resources: ["nodes/metrics", "nodes/proxy"] # Allow access to node metrics via proxy
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus
subjects:
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: prometheus
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config # Added ConfigMap for Prometheus configuration
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s # Set the scrape interval to every 15 seconds.
    scrape_configs:
      - job_name: 'kubernetes-nodes'
        # Scrape config for nodes (kubelet) via Kubernetes API proxy
        kubernetes_sd_configs:
          - role: node
        scheme: https
        tls_config:
          insecure_skip_verify: true # WARNING: For production, use proper certs and CA bundle
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)
          - target_label: __address__
            replacement: kubernetes.default.svc:443 # Use Kubernetes API for secure scraping
          - source_labels: [__meta_kubernetes_node_name]
            regex: (.+)
            target_label: __metrics_path__
            replacement: /api/v1/nodes/$1/proxy/metrics # Scrape kubelet metrics
      - job_name: 'kubernetes-cadvisor'
        # Scrape config for cAdvisor (exposed by kubelet) via Kubernetes API proxy
        kubernetes_sd_configs:
          - role: node
        scheme: https
        tls_config:
          insecure_skip_verify: true # WARNING: For production, use proper certs and CA bundle
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)
          - target_label: __address__
            replacement: kubernetes.default.svc:443 # Use Kubernetes API for secure scraping
          - source_labels: [__meta_kubernetes_node_name]
            regex: (.+)
            target_label: __metrics_path__
            replacement: /api/v1/nodes/$1/proxy/metrics/cadvisor # Scrape cAdvisor metrics
      - job_name: 'kubernetes-pods'
        # Scrape config for pods based on annotations
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
          - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
            action: replace
            regex: ([^:]+)(?::\d+)?;(\d+)
            replacement: $1:$2
            target_label: __address__
          - action: labelmap
            regex: __meta_kubernetes_pod_label_(.+)
          - source_labels: [__meta_kubernetes_namespace]
            action: replace
            target_label: kubernetes_namespace
          - source_labels: [__meta_kubernetes_pod_name]
            action: replace
            target_label: kubernetes_pod_name
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus-deployment
  namespace: monitoring
  labels:
    app: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      serviceAccountName: prometheus
      containers:
      - name: prometheus
        image: prom/prometheus:v2.47.0 # Use a specific version
        args:
        - "--config.file=/etc/prometheus/prometheus.yml"
        - "--storage.tsdb.path=/prometheus"
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config-volume
          mountPath: /etc/prometheus/
        - name: prometheus-storage-volume
          mountPath: /prometheus
      volumes:
      - name: prometheus-config-volume
        configMap:
          name: prometheus-config
      - name: prometheus-storage-volume
        emptyDir: {} # For persistent storage, use a PersistentVolumeClaim here
---
apiVersion: v1
kind: Service
metadata:
  name: prometheus-service
  namespace: monitoring
  labels:
    app: prometheus
spec:
  selector:
    app: prometheus
  ports:
    - protocol: TCP
      port: 9090
      targetPort: 9090
  type: ClusterIP # Use ClusterIP, Grafana will connect to this
`;

    try {
        const stdout = await execPromise(`kubectl apply -f -`, { input: prometheusManifest });
        response.status(200).json({ message: "Prometheus deployed successfully.", output: stdout });
    } catch (err) {
        handleKubectlError(err, 'Prometheus', 'deploy', response);
    }
});

// MODIFIED: Endpoint to deploy Grafana with a separate NLB service
router.post("/kube-deploy-grafana", async (request, response) => {
    const grafanaManifest = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: grafana
  namespace: monitoring
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana-deployment
  namespace: monitoring
  labels:
    app: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      serviceAccountName: grafana
      containers:
      - name: grafana
        image: grafana/grafana:10.4.3 # Use a specific version
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_USER
          value: admin
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: admin # Consider using Kubernetes Secrets for production
        volumeMounts:
        - name: grafana-storage
          mountPath: /var/lib/grafana
      volumes:
      - name: grafana-storage
        emptyDir: {} # For persistent storage, use a PersistentVolumeClaim here
---
# This service is for internal cluster communication (e.g., Prometheus scraping if needed)
apiVersion: v1
kind: Service
metadata:
  name: grafana-service
  namespace: monitoring
  labels:
    app: grafana
spec:
  selector:
    app: grafana
  ports:
    - protocol: TCP
      port: 3000
      targetPort: 3000
  type: ClusterIP
---
# This service creates a dedicated Network Load Balancer (NLB) for external access
apiVersion: v1
kind: Service
metadata:
  name: grafana-nlb-service
  namespace: monitoring
  annotations:
    # This annotation specifies that we want an NLB, not an ALB
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    # This annotation tells the NLB to target the pod IP directly, not the NodePort
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
spec:
  # This policy helps make health checks from the NLB more reliable
  externalTrafficPolicy: Cluster
  selector:
    app: grafana
  ports:
    - protocol: TCP
      port: 80 # The NLB will listen on port 80
      targetPort: 3000 # Forward traffic to Grafana's container port
  type: LoadBalancer
`;

    const grafanaDatasourceConfig = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  prometheus.yaml: |
    apiVersion: 1
    datasources:
      - name: Prometheus
        type: prometheus
        url: http://prometheus-service.monitoring.svc.cluster.local:9090 # Internal cluster service name
        access: proxy
        isDefault: true
        version: 1
        editable: true
`;

    try {
        // Apply Grafana deployment and service
        await execPromise(`kubectl apply -f -`, { input: grafanaManifest });
        // After Grafana deployment, apply the datasource config
        const stdout = await execPromise(`kubectl apply -f -`, { input: grafanaDatasourceConfig });
        response.status(200).json({ message: "Grafana and data source deployed successfully.", output: stdout });
    } catch (err) {
        handleKubectlError(err, 'Grafana', 'deploy', response);
    }
});


// Endpoint to get the number of Kubernetes Nodes
router.get("/kube-nodes-count", async (request, response) => {
    const cacheKey = 'nodes-count';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.NODES, request.query.forceRefresh);

    if (cachedData) {
        console.log("Serving node count from cache.");
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('kubectl get nodes -o json');
        const nodes = parseAndHandleJson(stdout, 'kubectl get nodes output');
        const dataToCache = { count: nodes.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'nodes', 'get count', response);
    }
});

// Endpoint to get the number of Kubernetes Pods
router.get("/kube-pods-count", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const cacheKey = `pods-count-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PODS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving pod count for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get pods -o json --namespace=${namespace}`);
        const pods = parseAndHandleJson(stdout, `kubectl get pods in namespace ${namespace} output`);
        const dataToCache = { count: pods.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'pods', 'get count', response);
    }
});

// NEW: Endpoint to list Kubernetes Pods
router.get("/kube-pods", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `pods-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PODS, forceRefresh);

    if (cachedData) {
        console.log(`Serving pod list for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get pods -o json --namespace=${namespace}`);
        const pods = parseAndHandleJson(stdout, `kubectl get pods in namespace ${namespace} output`);
        setCacheData(cacheKey, pods.items);
        response.status(200).json(pods.items);
    } catch (err) {
        handleKubectlError(err, 'pods', 'list', response);
    }
});


// MODIFIED: Endpoint to create a Kubernetes Pod
router.post("/kube-create-pod", async (request, response) => {
    const { name, image, env, envFrom, labels, numPods, cpuRequest, cpuLimit, memoryRequest, memoryLimit, command: podCommand, pvc, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    const validationError = validatePodInput({ name, image, numPods, env, labels, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc });
    if (validationError) {
        return response.status(400).json({ error: validationError });
    }

    // MODIFIED: Allow pod creation with a 'Pending' PVC for WaitForFirstConsumer mode.
    if (pvc && pvc.name) {
        try {
            const pvcStdout = await execPromise(`kubectl get pvc ${pvc.name} --namespace=${namespace} -o json`);
            const pvcDetails = parseAndHandleJson(pvcStdout, 'PVC details');
            const pvcStatus = pvcDetails.status.phase;
            // Only fail if the PVC is in a definitive failure state, not 'Pending' or 'Bound'.
            if (pvcStatus !== 'Bound' && pvcStatus !== 'Pending') {
                return response.status(400).json({ error: `The selected PersistentVolumeClaim '${pvc.name}' is not in a usable state. Current state: '${pvcStatus}'.` });
            }
        } catch (err) {
            return response.status(404).json({ error: `The selected PersistentVolumeClaim '${pvc.name}' was not found in the '${namespace}' namespace.` });
        }
    }

    let successMessages = [];
    let errorMessages = [];

    for (let i = 0; i < numPods; i++) {
        const podManifest = generatePodYaml({ name, image, env, envFrom, labels, podCommand, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }, namespace, i);
        try {
            const stdout = await execPromise(`kubectl apply -f -`, { input: podManifest });
            successMessages.push(`Pod '${name}-${i}' created successfully.`);
        } catch (err) {
            const safeMessage = handleKubectlError(err, `${name}-${i}`, 'create pod');
            errorMessages.push(safeMessage);
        }
    }

    if (errorMessages.length > 0) {
        return response.status(500).json({
            error: `Failed to create some pods. Details: ${errorMessages.join('; ')}`,
            success: successMessages.join('; ')
        });
    } else {
        response.status(200).json({ message: `Successfully created ${numPods} pod(s).`, output: successMessages.join('; ') });
    }
});

// Endpoint to delete a Kubernetes Pod
router.delete("/kube-delete-pod", async (request, response) => {
    const { name, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Pod name is required for deletion." });
    }

    const command = `kubectl delete pod ${name} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `Pod '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete pod', response);
    }
});

// MODIFIED: Endpoint to create a Kubernetes Deployment
router.post("/kube-create-deployment", async (request, response) => {
    const { name, image, replicas, env, envFrom, labels, strategy, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    const validationError = validateDeploymentInput({ name, image, replicas, env, labels, strategy, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc });
    if (validationError) {
        return response.status(400).json({ error: validationError });
    }

    // MODIFIED: Allow deployment creation with a 'Pending' PVC for WaitForFirstConsumer mode.
    if (pvc && pvc.name) {
        try {
            const pvcStdout = await execPromise(`kubectl get pvc ${pvc.name} --namespace=${namespace} -o json`);
            const pvcDetails = parseAndHandleJson(pvcStdout, 'PVC details');
            const pvcStatus = pvcDetails.status.phase;
            // Only fail if the PVC is in a definitive failure state, not 'Pending' or 'Bound'.
            if (pvcStatus !== 'Bound' && pvcStatus !== 'Pending') {
                return response.status(400).json({ error: `The selected PersistentVolumeClaim '${pvc.name}' is not in a usable state. Current state: '${pvcStatus}'.` });
            }
        } catch (err) {
            return response.status(404).json({ error: `The selected PersistentVolumeClaim '${pvc.name}' was not found in the '${namespace}' namespace.` });
        }
    }

    const deploymentManifest = generateDeploymentYaml({ name, image, replicas, env, envFrom, labels, strategy, cpuRequest, cpuLimit, memoryRequest, memoryLimit, pvc }, namespace);
    try {
        const stdout = await execPromise(`kubectl apply -f -`, { input: deploymentManifest });
        response.status(200).json({ message: `Deployment '${name}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create deployment', response);
    }
});

// Endpoint to get the number of Kubernetes Deployments
router.get("/kube-deployments-count", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const cacheKey = `deployments-count-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.DEPLOYMENTS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving deployment count for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get deployments -o json --namespace=${namespace}`);
        const deployments = parseAndHandleJson(stdout, `kubectl get deployments in namespace ${namespace} output`);
        const dataToCache = { count: deployments.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'deployments', 'get count', response);
    }
});

// Endpoint to list Kubernetes Deployments
router.get("/kube-deployments", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `deployments-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.DEPLOYMENTS, forceRefresh);

    if (cachedData) {
        console.log(`Serving deployment list for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get deployments -o json --namespace=${namespace}`);
        const deployments = parseAndHandleJson(stdout, `kubectl get deployments in namespace ${namespace} output`);
        setCacheData(cacheKey, deployments.items);
        response.status(200).json(deployments.items);
    } catch (err) {
        handleKubectlError(err, 'deployments', 'list', response);
    }
});

// Endpoint to get details of a specific Kubernetes Deployment
router.get("/kube-deployment-details", async (request, response) => {
    const { name, namespace: reqNamespace } = request.query;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Deployment name is required to get details." });
    }

    const cacheKey = `deployment-details-${namespace}-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.DEPLOYMENTS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving deployment details for ${name} in ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get deployment ${name} --namespace=${namespace} -o json`;
    try {
        const stdout = await execPromise(command);
        const deploymentDetails = parseAndHandleJson(stdout, `kubectl get deployment ${name} output`);
        setCacheData(cacheKey, deploymentDetails);
        response.status(200).json(deploymentDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get deployment details', response);
    }
});

// Endpoint to delete a Kubernetes Deployment
router.delete("/kube-delete-deployment", async (request, response) => {
    const { name, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Deployment name is required for deletion." });
    }

    const command = `kubectl delete deployment ${name} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `Deployment '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete deployment', response);
    }
});

// Endpoint to scale a Kubernetes Deployment
router.post("/kube-scale-deployment", async (request, response) => {
    const { name, namespace: reqNamespace, replicas } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name || typeof replicas === 'undefined' || replicas < 0) {
        return response.status(400).json({ error: "Deployment name and a non-negative number of replicas are required for scaling." });
    }

    const command = `kubectl scale deployment ${name} --replicas=${replicas} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `Deployment '${name}' scaled to ${replicas} replicas successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'scale deployment', response);
    }
});

// Endpoint to create a Kubernetes Service
router.post("/kube-create-service", async (request, response) => {
    const { deploymentName, serviceName, serviceType, appPort, targetPort, protocol, selector, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    const validationError = validateServiceInput({ deploymentName, serviceName, serviceType, appPort, targetPort, protocol, selector });
    if (validationError) {
        return response.status(400).json({ error: validationError });
    }

    const serviceManifest = generateServiceYaml({ deploymentName, serviceName, serviceType, appPort, targetPort, protocol, selector }, namespace);
    try {
        const stdout = await execPromise(`kubectl apply -f -`, { input: serviceManifest });
        response.status(200).json({ message: `Service '${serviceName}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, serviceName, 'create service', response);
    }
});

// Endpoint to get the number of Kubernetes Services
router.get("/kube-services-count", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const cacheKey = `services-count-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.SERVICES, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving service count for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get services -o json --namespace=${namespace}`);
        const services = parseAndHandleJson(stdout, `kubectl get services in namespace ${namespace} output`);
        const dataToCache = { count: services.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'services', 'get count', response);
    }
});

// Endpoint to list Kubernetes Services
router.get("/kube-services", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `services-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.SERVICES, forceRefresh);

    if (cachedData) {
        console.log(`Serving service list for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get services -o json --namespace=${namespace}`);
        const services = parseAndHandleJson(stdout, `kubectl get services in namespace ${namespace} output`);
        setCacheData(cacheKey, services.items);
        response.status(200).json(services.items);
    } catch (err) {
        handleKubectlError(err, 'services', 'list', response);
    }
});

// Endpoint to get details of a specific Kubernetes Service
router.get("/kube-service-details", async (request, response) => {
    const { name, namespace: reqNamespace } = request.query;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Service name is required to get details." });
    }

    const cacheKey = `service-details-${namespace}-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.SERVICES, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving service details for ${name} in ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get service ${name} --namespace=${namespace} -o json`;
    try {
        const stdout = await execPromise(command);
        const serviceDetails = parseAndHandleJson(stdout, `kubectl get service ${name} output`);
        setCacheData(cacheKey, serviceDetails);
        response.status(200).json(serviceDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get service details', response);
    }
});

// Endpoint to delete a Kubernetes Service
router.delete("/kube-delete-service", async (request, response) => {
    const { name, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Service name is required for deletion." });
    }

    const command = `kubectl delete service ${name} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `Service '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete service', response);
    }
});

// --- NEW: Ingress Management Endpoints ---

// Endpoint to list Kubernetes Ingresses
router.get("/kube-ingresses", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `ingresses-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.INGRESSES, forceRefresh);

    if (cachedData) {
        console.log(`Serving ingress list for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get ingress -o json --namespace=${namespace}`);
        const ingresses = parseAndHandleJson(stdout, `kubectl get ingress in namespace ${namespace} output`);
        setCacheData(cacheKey, ingresses.items);
        response.status(200).json(ingresses.items);
    } catch (err) {
        handleKubectlError(err, 'ingresses', 'list', response);
    }
});

// Endpoint to create a Kubernetes Ingress
router.post("/kube-create-ingress", async (request, response) => {
    const { name, serviceName, servicePort, path, pathType, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    const validationError = validateIngressInput({ name, serviceName, servicePort, path, pathType });
    if (validationError) {
        return response.status(400).json({ error: validationError });
    }

    const ingressManifest = generateIngressYaml({ name, serviceName, servicePort, path, pathType }, namespace);
    try {
        const stdout = await execPromise(`kubectl apply -f -`, { input: ingressManifest });
        response.status(200).json({ message: `Ingress '${name}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create ingress', response);
    }
});

// Endpoint to delete a Kubernetes Ingress
router.delete("/kube-delete-ingress", async (request, response) => {
    const { name, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Ingress name is required for deletion." });
    }

    const command = `kubectl delete ingress ${name} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `Ingress '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete ingress', response);
    }
});


// Endpoint to get details of a specific Kubernetes Pod
router.get("/kube-pod-details", async (request, response) => {
    const { name, namespace: reqNamespace } = request.query;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "Pod name is required to get details." });
    }

    const cacheKey = `pod-details-${namespace}-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PODS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving pod details for ${name} in ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get pod ${name} --namespace=${namespace} -o json`;
    try {
        const stdout = await execPromise(command);
        const podDetails = parseAndHandleJson(stdout, `kubectl get pod ${name} output`);
        setCacheData(cacheKey, podDetails);
        response.status(200).json(podDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get pod details', response);
    }
});

// Endpoint to get the number of Kubernetes PVCs
router.get("/kube-pvcs-count", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const cacheKey = `pvcs-count-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVCS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving PVC count for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get pvc -o json --namespace=${namespace}`);
        const pvcs = parseAndHandleJson(stdout, `kubectl get pvc in namespace ${namespace} output`);
        const dataToCache = { count: pvcs.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'PVCs', 'get count', response);
    }
});

// Endpoint to list Kubernetes PVCs
router.get("/kube-pvcs", async (request, response) => {
    const namespace = request.query.namespace || 'default';
    const forceRefresh = request.query.forceRefresh;
    const cacheKey = `pvcs-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVCS, forceRefresh);

    if (cachedData) {
        console.log(`Serving PVC list for namespace ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get pvc -o json --namespace=${namespace}`);
        const pvcs = parseAndHandleJson(stdout, `kubectl get pvc in namespace ${namespace} output`);
        setCacheData(cacheKey, pvcs.items);
        response.status(200).json(pvcs.items);
    } catch (err) {
        handleKubectlError(err, 'PVCs', 'list', response);
    }
});

// NEW: Endpoint to create a standalone PVC
router.post("/kube-create-pvc", async (request, response) => {
    const { name, storageSize, accessMode, storageClassName, namespace } = request.body;

    const validationError = validatePvcInput({ name, storageSize, accessMode });
    if (validationError) {
        return response.status(400).json({ error: validationError });
    }

    try {
        const pvcManifest = generatePVCYaml({ name, storageSize, accessMode, storageClassName }, namespace);
        const stdout = await execPromise(`kubectl apply -f -`, { input: pvcManifest });
        response.status(200).json({ message: `PVC '${name}' created successfully in namespace '${namespace}'.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create PVC', response);
    }
});

// NEW & FIXED: Endpoint to get details of a specific Kubernetes PVC
router.get("/kube-pvc-details", async (request, response) => {
    const { name, namespace: reqNamespace } = request.query;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "PVC name is required to get details." });
    }

    const cacheKey = `pvc-details-${namespace}-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVCS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving PVC details for ${name} in ${namespace} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get pvc ${name} --namespace=${namespace} -o json`;
    try {
        const stdout = await execPromise(command);
        const pvcDetails = parseAndHandleJson(stdout, `kubectl get pvc ${name} output`);
        setCacheData(cacheKey, pvcDetails);
        response.status(200).json(pvcDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get PVC details', response);
    }
});

// NEW & FIXED: Endpoint to delete a Kubernetes PVC
router.delete("/kube-delete-pvc", async (request, response) => {
    const { name, namespace: reqNamespace } = request.body;
    const namespace = reqNamespace || 'default';

    if (!name) {
        return response.status(400).json({ error: "PVC name is required for deletion." });
    }

    const command = `kubectl delete pvc ${name} --namespace=${namespace}`;
    try {
        const stdout = await execPromise(command);
        response.status(200).json({ message: `PVC '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete PVC', response);
    }
});


// Endpoint to get the number of Kubernetes PVs
router.get("/kube-pvs-count", async (request, response) => {
    const cacheKey = 'pvs-count';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVS, request.query.forceRefresh);

    if (cachedData) {
        console.log("Serving PV count from cache.");
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('kubectl get pv -o json');
        const pvs = parseAndHandleJson(stdout, 'kubectl get pv output');
        const dataToCache = { count: pvs.items.length };
        setCacheData(cacheKey, dataToCache);
        response.status(200).json(dataToCache);
    } catch (err) {
        handleKubectlError(err, 'PVs', 'get count', response);
    }
});

// Endpoint to list Kubernetes PVs
router.get("/kube-pvs", async (request, response) => {
    const cacheKey = 'pvs-list';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVS, request.query.forceRefresh);

    if (cachedData) {
        console.log("Serving PV list from cache.");
        return response.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('kubectl get pv -o json');
        const pvs = parseAndHandleJson(stdout, 'kubectl get pv output');
        setCacheData(cacheKey, pvs.items);
        response.status(200).json(pvs.items);
    } catch (err) {
        handleKubectlError(err, 'PVs', 'list', response);
    }
});

// Endpoint to get details of a specific Kubernetes PV
router.get("/kube-pv-details", async (request, response) => {
    const { name } = request.query;
    if (!name) {
        return response.status(400).json({ error: "PV name is required to get details." });
    }

    const cacheKey = `pv-details-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.PVS, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving PV details for ${name} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get pv ${name} -o json`;
    try {
        const stdout = await execPromise(command);
        const pvDetails = parseAndHandleJson(stdout, `kubectl get pv ${name} output`);
        setCacheData(cacheKey, pvDetails);
        response.status(200).json(pvDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get PV details', response);
    }
});

// Endpoint to manually provision a PV for a pending PVC by recreating it
router.post("/kube-bind-pvc", async (request, response) => {
    const { pvcName, namespace, storageClassName, size, accessModes } = request.body;

    if (!pvcName || !namespace || !storageClassName || !size || !accessModes) {
        return response.status(400).json({ error: "PVC name, namespace, StorageClass name, size, and access modes are required." });
    }

    try {
        try {
            await execPromise(`kubectl delete pvc ${pvcName} --namespace=${namespace}`);
        } catch (err) {
            if (!err.message.includes('NotFound') && !err.message.includes('not found')) {
                throw err;
            }
            console.log(`PVC '${pvcName}' not found, proceeding to create a new one.`);
        }

        const newPvcData = {
            name: pvcName,
            storageSize: size,
            accessMode: accessModes,
            storageClassName: storageClassName
        };
        const newPvcManifest = generatePVCYaml(newPvcData, namespace);
        const stdout = await execPromise(`kubectl apply -f -`, { input: newPvcManifest });

        response.status(200).json({ message: `PVC '${pvcName}' was recreated with StorageClass '${storageClassName}' to initiate provisioning.`, output: stdout });

    } catch (err) {
        const errorMessage = `Failed to re-provision PVC '${pvcName}'. The operation involves deleting and recreating the PVC. Please check the cluster state manually. Error details: ${err.message}`;
        handleKubectlError(new Error(errorMessage), pvcName, 're-provision PVC', response);
    }
});


// List StorageClasses
router.get('/kube-storageclasses', async (req, res) => {
    const cacheKey = 'storage-classes-list';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.STORAGE_CLASSES, req.query.forceRefresh);

    if (cachedData) {
        console.log("Serving StorageClasses list from cache.");
        return res.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('kubectl get storageclass -o json');
        const scs = parseAndHandleJson(stdout, 'kubectl get storageclass output');
        setCacheData(cacheKey, scs.items);
        res.status(200).json(scs.items);
    } catch (err) {
        handleKubectlError(err, '', 'list storageclasses', res);
    }
});

// NEW: Endpoint to get details of a specific Kubernetes StorageClass
router.get("/kube-storageclass-details", async (request, response) => {
    const { name } = request.query;
    if (!name) {
        return response.status(400).json({ error: "StorageClass name is required to get details." });
    }

    const cacheKey = `storageclass-details-${name}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.STORAGE_CLASSES, request.query.forceRefresh);

    if (cachedData) {
        console.log(`Serving StorageClass details for ${name} from cache.`);
        return response.status(200).json(cachedData);
    }

    const command = `kubectl get storageclass ${name} -o json`;
    try {
        const stdout = await execPromise(command);
        const scDetails = parseAndHandleJson(stdout, `kubectl get storageclass ${name} output`);
        setCacheData(cacheKey, scDetails);
        response.status(200).json(scDetails);
    } catch (err) {
        handleKubectlError(err, name, 'get StorageClass details', response);
    }
});


// Create StorageClass
router.post('/kube-create-storageclass', async (req, res) => {
    const { name, provisioner, parameters, reclaimPolicy, volumeBindingMode, allowVolumeExpansion } = req.body;

    const validationError = validateStorageClassInput({ name, provisioner });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    const scYaml = generateStorageClassYaml({ name, provisioner, parameters, reclaimPolicy, volumeBindingMode, allowVolumeExpansion });
    try {
        const stdout = await execPromise('kubectl apply -f -', { input: scYaml });
        res.status(200).json({ message: `StorageClass '${name}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create storageclass', res);
    }
});

// Delete StorageClass
router.delete('/kube-delete-storageclass', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'StorageClass name is required for deletion.' });
    }
    const command = `kubectl delete storageclass ${name}`;
    try {
        const stdout = await execPromise(command);
        res.status(200).json({ message: `StorageClass '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete storageclass', res);
    }
});

// Endpoint to list Kubernetes Namespaces
router.get('/kube-namespaces', async (req, res) => {
    const cacheKey = 'namespaces-list';
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.NAMESPACES, req.query.forceRefresh);

    if (cachedData) {
        console.log("Serving namespaces list from cache.");
        return res.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise('kubectl get namespaces -o json');
        const namespaces = parseAndHandleJson(stdout, 'kubectl get namespaces output');
        setCacheData(cacheKey, namespaces.items);
        res.status(200).json(namespaces.items);
    } catch (err) {
        handleKubectlError(err, '', 'list namespaces', res);
    }
});

// --- NEW: Namespace with ResourceQuota Endpoint ---
router.post('/kube-create-namespace', async (req, res) => {
    const { name, quotas } = req.body;

    const validationError = validateNamespaceInput({ name, quotas });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // First, create the namespace
        const namespaceManifest = generateNamespaceYaml(name);
        await execPromise('kubectl apply -f -', { input: namespaceManifest });

        // Then, if quotas are provided, create the ResourceQuota
        const resourceQuotaManifest = generateResourceQuotaYaml(name, quotas);
        if (resourceQuotaManifest) {
            await execPromise('kubectl apply -f -', { input: resourceQuotaManifest });
            res.status(201).json({ message: `Namespace '${name}' and its ResourceQuota created successfully.` });
        } else {
            res.status(201).json({ message: `Namespace '${name}' created successfully without a ResourceQuota.` });
        }
    } catch (err) {
        // If namespace creation fails, we don't proceed. If quota fails, the namespace is already created.
        handleKubectlError(err, name, 'create namespace or resource quota', res);
    }
});


// --- NEW: ConfigMap and Secret Endpoints ---

// List ConfigMaps
router.get('/kube-configmaps', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    const cacheKey = `configmaps-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.CONFIG_MAPS, req.query.forceRefresh);

    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get configmap -n ${namespace} -o json`);
        const configmaps = parseAndHandleJson(stdout, 'kubectl get configmap output');
        setCacheData(cacheKey, configmaps.items);
        res.status(200).json(configmaps.items);
    } catch (err) {
        handleKubectlError(err, 'ConfigMaps', 'list', res);
    }
});

// Create ConfigMap
router.post('/kube-create-configmap', async (req, res) => {
    const { name, data, namespace } = req.body;
    const validationError = validateConfigMapInput({ name, data });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }
    const manifest = generateConfigMapYaml({ name, data }, namespace);
    try {
        const stdout = await execPromise('kubectl apply -f -', { input: manifest });
        res.status(201).json({ message: `ConfigMap '${name}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create ConfigMap', res);
    }
});

// Delete ConfigMap
router.delete('/kube-delete-configmap', async (req, res) => {
    const { name, namespace } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'ConfigMap name is required.' });
    }
    try {
        const stdout = await execPromise(`kubectl delete configmap ${name} -n ${namespace}`);
        res.status(200).json({ message: `ConfigMap '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete ConfigMap', res);
    }
});

// List Secrets
router.get('/kube-secrets', async (req, res) => {
    const namespace = req.query.namespace || 'default';
    const cacheKey = `secrets-list-${namespace}`;
    const cachedData = getCachedData(cacheKey, CACHE_TTLS.SECRETS, req.query.forceRefresh);

    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        const stdout = await execPromise(`kubectl get secret -n ${namespace} -o json`);
        const secrets = parseAndHandleJson(stdout, 'kubectl get secret output');
        setCacheData(cacheKey, secrets.items);
        res.status(200).json(secrets.items);
    } catch (err) {
        handleKubectlError(err, 'Secrets', 'list', res);
    }
});

// Create Secret
router.post('/kube-create-secret', async (req, res) => {
    const { name, data, namespace } = req.body;
    const validationError = validateSecretInput({ name, data });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }
    const manifest = generateSecretYaml({ name, data }, namespace);
    try {
        const stdout = await execPromise('kubectl apply -f -', { input: manifest });
        res.status(201).json({ message: `Secret '${name}' created successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'create Secret', res);
    }
});

// Delete Secret
router.delete('/kube-delete-secret', async (req, res) => {
    const { name, namespace } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Secret name is required.' });
    }
    try {
        const stdout = await execPromise(`kubectl delete secret ${name} -n ${namespace}`);
        res.status(200).json({ message: `Secret '${name}' deleted successfully.`, output: stdout });
    } catch (err) {
        handleKubectlError(err, name, 'delete Secret', res);
    }
});

// --- NEW: User Access Mapping Endpoint ---
router.post('/kube-create-user-mapping', async (req, res) => {
    const { iamRoleArn, kubernetesUsername, namespace, roleName, rules } = req.body;

    // 1. Validate Input
    const validationError = validateUserMappingInput({ iamRoleArn, kubernetesUsername, namespace, roleName, rules });
    if (validationError) {
        return res.status(400).json({ error: validationError });
    }

    try {
        // 2. Get and Update aws-auth ConfigMap
        console.log("Fetching aws-auth ConfigMap...");
        const awsAuthCmd = 'kubectl get configmap aws-auth -n kube-system -o yaml';
        const awsAuthYaml = await execPromise(awsAuthCmd);
        const awsAuthConfig = yaml.load(awsAuthYaml);

        // Ensure mapRoles array exists
        if (!awsAuthConfig.data.mapRoles) {
            awsAuthConfig.data.mapRoles = '[]'; // Initialize as a string containing an empty YAML array
        }
        
        let mapRoles = yaml.load(awsAuthConfig.data.mapRoles);
        if (!Array.isArray(mapRoles)) mapRoles = []; // Ensure it's an array

        // Check if the role ARN already exists to prevent duplicates
        const roleExists = mapRoles.some(role => role.rolearn === iamRoleArn);
        if (!roleExists) {
            mapRoles.push({
                rolearn: iamRoleArn,
                username: kubernetesUsername,
                groups: ['system:authenticated']
            });
            awsAuthConfig.data.mapRoles = yaml.dump(mapRoles);
            
            // Apply the updated ConfigMap
            console.log("Applying updated aws-auth ConfigMap...");
            const updatedAwsAuthYaml = yaml.dump(awsAuthConfig);
            await execPromise('kubectl apply -f -', { input: updatedAwsAuthYaml });
        } else {
            console.log(`IAM Role ARN ${iamRoleArn} already exists in aws-auth ConfigMap. Skipping update.`);
        }

        // 3. Create Kubernetes Role
        console.log(`Creating Role '${roleName}' in namespace '${namespace}'...`);
        const roleManifest = generateRoleYaml({ name: roleName, namespace, rules });
        await execPromise('kubectl apply -f -', { input: roleManifest });

        // 4. Create Kubernetes RoleBinding
        const roleBindingName = `${kubernetesUsername}-${roleName}-binding`;
        console.log(`Creating RoleBinding '${roleBindingName}'...`);
        const roleBindingManifest = generateRoleBindingYaml({
            name: roleBindingName,
            namespace,
            roleName,
            userName: kubernetesUsername
        });
        await execPromise('kubectl apply -f -', { input: roleBindingManifest });

        res.status(201).json({ message: `User mapping for '${kubernetesUsername}' created successfully.` });

    } catch (err) {
        handleKubectlError(err, kubernetesUsername, 'create user mapping', res);
    }
});

// NEW: Endpoint to list user mappings
router.get('/kube-user-mappings', async (req, res) => {
    try {
        // 1. Get and parse aws-auth ConfigMap
        const awsAuthYaml = await execPromise('kubectl get configmap aws-auth -n kube-system -o yaml');
        const awsAuthConfig = yaml.load(awsAuthYaml);
        const mapRoles = yaml.load(awsAuthConfig.data.mapRoles || '[]');

        // 2. Get all RoleBindings in the cluster
        const roleBindingsJson = await execPromise('kubectl get rolebindings --all-namespaces -o json');
        const roleBindings = parseAndHandleJson(roleBindingsJson, 'kubectl get rolebindings').items;

        // 3. Correlate the data
        const userMappings = mapRoles.map(role => {
            const bindings = roleBindings.filter(rb =>
                rb.subjects.some(s => s.kind === 'User' && s.name === role.username)
            );
            return {
                iamRoleArn: role.rolearn,
                kubernetesUsername: role.username,
                bindings: bindings.map(b => ({
                    namespace: b.metadata.namespace,
                    role: b.roleRef.name,
                    roleBindingName: b.metadata.name
                }))
            };
        });

        res.status(200).json(userMappings);
    } catch (err) {
        // Handle case where aws-auth configmap might not exist yet or has no roles
        if (err.message.includes('not found') || err.message.includes('cannot read properties of null')) {
            return res.status(200).json([]); // Return empty array if no mappings exist
        }
        handleKubectlError(err, 'user mappings', 'list', res);
    }
});


// MODIFIED: Endpoint to get Grafana LoadBalancer URL from the new NLB service
router.get('/kube-get-grafana-url', async (req, res) => {
    try {
        // Target the new NLB service specifically
        const command = `kubectl get service grafana-nlb-service --namespace=monitoring -o json`;
        const stdout = await execPromise(command);
        const serviceDetails = parseAndHandleJson(stdout, 'Grafana NLB service details');
        
        const ingress = serviceDetails.status?.loadBalancer?.ingress?.[0];
        if (ingress) {
            const url = ingress.hostname || ingress.ip;
            if (url) {
                // The NLB listens on port 80, so the URL is simpler
                return res.status(200).json({ url: `http://${url}` });
            }
        }
        // If no URL is found yet, send a 202 Accepted to indicate it's still processing
        res.status(202).json({ message: 'Grafana LoadBalancer is not yet available.' });
    } catch (err) {
        // Use 404 if the service is not found, which is a common case during provisioning
        if (err.message.toLowerCase().includes('not found')) {
            return res.status(404).json({ error: 'Grafana NLB service not found. It may still be deploying.' });
        }
        handleKubectlError(err, 'grafana-nlb-service', 'get details', res);
    }
});

// NEW: Endpoint to start port-forwarding for Grafana
router.post('/kube-start-port-forward', (req, res) => {
    // Check if a port-forward process is already running
    if (req.app.locals.portForwardProcess) {
        console.log('Port-forwarding is already active.');
        return res.status(200).json({ message: 'Port-forwarding already active.', port: 8080 });
    }

    const localPort = 8080;
    const target = 'service/grafana-service';
    const targetPort = 3000;
    const namespace = 'monitoring';

    const args = ['port-forward', '--namespace', namespace, target, `${localPort}:${targetPort}`];
    const portForward = spawn('kubectl', args);

    req.app.locals.portForwardProcess = portForward;

    portForward.stdout.on('data', (data) => {
        console.log(`Port-forward stdout: ${data}`);
        // Once we get the "Forwarding from..." message, we know it's ready.
        if (!res.headersSent && data.toString().includes('Forwarding from')) {
            res.status(200).json({ message: 'Port-forwarding started successfully.', port: localPort });
        }
    });

    portForward.stderr.on('data', (data) => {
        console.error(`Port-forward stderr: ${data}`);
        // If an error occurs before we send a success response
        if (!res.headersSent) {
            res.status(500).json({ error: `Failed to start port-forwarding: ${data}` });
        }
        // Clean up on error
        req.app.locals.portForwardProcess = null;
    });

    portForward.on('close', (code) => {
        console.log(`Port-forward process exited with code ${code}`);
        req.app.locals.portForwardProcess = null; // Clear the stored process
    });

    portForward.on('error', (err) => {
        console.error('Failed to start port-forward process.', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to spawn kubectl port-forward process.' });
        }
        req.app.locals.portForwardProcess = null;
    });
});

// NEW: Endpoint to stop port-forwarding
router.post('/kube-stop-port-forward', (req, res) => {
    const portForwardProcess = req.app.locals.portForwardProcess;
    if (portForwardProcess) {
        console.log('Stopping port-forward process.');
        portForwardProcess.kill('SIGTERM'); // Send termination signal
        req.app.locals.portForwardProcess = null;
        res.status(200).json({ message: 'Port-forwarding stopped.' });
    } else {
        res.status(200).json({ message: 'No active port-forwarding process to stop.' });
    }
});


// Health check endpoint
router.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

module.exports = router;
