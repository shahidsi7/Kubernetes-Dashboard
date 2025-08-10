// utils/eksConfigGenerator.js
// This file contains a utility function to generate a complete EKS cluster configuration
// YAML for use with `eksctl create cluster -f`. This approach is more robust than
// command-line flags for complex configurations, especially for IAM and OIDC settings.

/**
 * Generates a complete EKS cluster configuration YAML using the modern iamServiceAccounts and addons approach.
 * @param {object} config - The cluster configuration object from the frontend form.
 * @returns {string} A YAML string representing the eksctl cluster configuration.
 */
function generateEksClusterConfig(config) {
    const {
        clusterName,
        region,
        kubernetesVersion,
        nodeGroupName,
        instanceType,
        desiredCapacity,
        minNodes,
        maxNodes,
        volumeSize,
        volumeType,
        enableSsh,
        sshKeyName,
        enableEbsCsiAccess,
        enableEfsCsiAccess
    } = config;

    // Start building the YAML structure.
    // We explicitly set withOIDC to true. This is essential for creating IAM service accounts later.
    let yamlConfig = `
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: ${clusterName}
  region: ${region}
  version: "${kubernetesVersion}"

iam:
  withOIDC: true`;

    // CRITICAL FIX: The `serviceAccounts` section has been completely removed from this initial config.
    // It will be created in a separate step after the cluster is ready.

    // Define the managed nodegroup
    yamlConfig += `
managedNodeGroups:
  - name: ${nodeGroupName}
    instanceType: ${instanceType}
    desiredCapacity: ${desiredCapacity}
    minSize: ${minNodes}
    maxSize: ${maxNodes}
    volumeSize: ${volumeSize}
    volumeType: ${volumeType}
    ssh:
      allow: ${enableSsh === true}
`;

    if (enableSsh && sshKeyName) {
        yamlConfig += `
      publicKeyName: ${sshKeyName}
`;
    }

    // Define addons directly in the config. This is the modern, reliable way.
    // It ensures eksctl creates the necessary IAM roles and service accounts for them.
    yamlConfig += `
addons:`;
    if (enableEbsCsiAccess) {
        yamlConfig += `
  - name: aws-ebs-csi-driver
    wellKnownPolicies:
      ebsCSIController: true
`;
    }
    if (enableEfsCsiAccess) {
        yamlConfig += `
  - name: aws-efs-csi-driver
    wellKnownPolicies:
      efsCSIController: true
`;
    }
    
    // The vpc-cni addon is still managed by eksctl.
    yamlConfig += `
  - name: vpc-cni
`;

    return yamlConfig;
}

module.exports = {
    generateEksClusterConfig
};
