// public/js/components/dashboard-renderers.js
// This file contains functions responsible for dynamically rendering lists of
// Kubernetes resources (Nodes, Pods, Deployments, Services, PVCs, PVs, StorageClasses)
// on the Kubernetes Dashboard UI.

import { showConfirmModal, showMessage } from '../utils/ui-helpers.js';
import { deletePod, deleteDeployment, deleteService, deletePvc, deleteStorageClass, deleteIngress } from '../utils/api-client.js';

/**
 * Renders the worker nodes list in the UI.
 * @param {Array} nodes - Array of node objects from the API.
 * @param {HTMLElement} workerNodesListElement - The DOM element to render the list into.
 */
export async function renderWorkerNodesList(nodes, workerNodesListElement) {
    if (nodes.length > 0) {
        workerNodesListElement.innerHTML = nodes.map(node => `
            <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                <span class="font-medium text-gray-800">${node.name}</span>
                <span class="text-sm text-gray-600">Status: ${node.status}</span>
            </div>
        `).join('');
    } else {
        workerNodesListElement.innerHTML = '<p class="text-gray-600">No worker nodes found.</p>';
    }
}

/**
 * Renders the pods list in the UI.
 * Attaches event listeners for selection, and detail modals.
 * @param {Array} pods - Array of pod objects from the API.
 * @param {Function} togglePodActionButtons - Callback to enable/disable action buttons based on selection.
 * @param {Function} toggleAllPodCheckboxes - Callback to select/deselect all pods.
 * @param {Function} showPodDetailsModal - Callback to show pod details modal.
 * @param {HTMLElement} podsListElement - The DOM element to render the list into.
 */
export async function renderPodsList(pods, togglePodActionButtons, toggleAllPodCheckboxes, showPodDetailsModal, podsListElement) {
    if (pods.length > 0) {
        let podsHtml = `
            <div class="flex items-center p-2 border-b border-gray-200 bg-gray-100 rounded-t-md">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="selectAllPods" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="font-medium text-gray-800">Select All</span>
                </label>
            </div>
        `;
        podsHtml += pods.map(pod => {
            const containers = pod.spec.containers || [];
            const containerImages = containers.map(c => c.image).join(', ');
            let statusText = pod.status.phase || 'Unknown';

            // Check for CrashLoopBackOff or other specific container states
            if (pod.status.containerStatuses) {
                for (const cs of pod.status.containerStatuses) {
                    if (cs.state && cs.state.waiting && cs.state.waiting.reason === 'CrashLoopBackOff') {
                        statusText = 'CrashLoopBackOff';
                        break;
                    } else if (cs.state && cs.state.waiting && cs.state.waiting.reason === 'ImagePullBackOff') {
                        statusText = 'ImagePullBackOff';
                        break;
                    } else if (cs.state && cs.state.waiting && cs.state.waiting.reason === 'ErrImagePull') {
                        statusText = 'ErrImagePull';
                        break;
                    }
                }
            }

            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" name="selectedPod" value="${pod.metadata.name}" data-namespace="${pod.metadata.namespace}"
                            data-is-managed="${pod.ownerDeploymentName ? 'true' : 'false'}"
                            ${pod.ownerDeploymentName ? `data-owner-deployment="${pod.ownerDeploymentName}"` : ''}
                            class="form-checkbox h-4 w-4 text-blue-600 pod-checkbox">
                        <span class="font-medium text-gray-800">
                            <span class="pod-name-link text-blue-600 hover:underline cursor-pointer"
                                data-name="${pod.metadata.name}" data-namespace="${pod.metadata.namespace || 'default'}">
                                ${pod.metadata.name}
                            </span>
                        </span>
                    </label>
                    <div class="text-sm text-gray-600 flex flex-col items-end">
                        <span>Image: ${containerImages || 'N/A'}</span>
                        <span>Status: <span class="${statusText === 'Running' ? 'text-green-600' : (statusText.includes('Error') || statusText.includes('Crash') ? 'text-red-600' : 'text-yellow-600')}">${statusText}</span></span>
                    </div>
                </div>
            `;
        }).join('');
        podsListElement.innerHTML = podsHtml;

        // Attach event listeners to newly rendered checkboxes
        document.querySelectorAll('.pod-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', togglePodActionButtons);
        });
        document.getElementById('selectAllPods').addEventListener('change', (event) => {
            toggleAllPodCheckboxes(event.target.checked);
        });

        // Attach event listener for pod name links
        document.querySelectorAll('.pod-name-link').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault();
                const podName = event.target.dataset.name;
                const namespace = event.target.dataset.namespace;
                showPodDetailsModal(podName, namespace);
            });
        });

    } else {
        podsListElement.innerHTML = '<p class="text-gray-600">No pods found.</p>';
    }
}

/**
 * Renders the deployments list in the UI.
 * Attaches event listeners for selection and detail modals.
 * @param {Array} deployments - Array of deployment objects from the API.
 * @param {Function} toggleDeploymentActionButtons - Callback to enable/disable action buttons.
 * @param {Function} toggleAllDeploymentCheckboxes - Callback to select/deselect all.
 * @param {Function} showDeploymentDetailsModal - Callback to show deployment details modal.
 * @param {HTMLElement} deploymentsListElement - The DOM element to render the list into.
 */
export async function renderDeploymentsList(deployments, toggleDeploymentActionButtons, toggleAllDeploymentCheckboxes, showDeploymentDetailsModal, deploymentsListElement) {
    if (deployments.length > 0) {
        let deploymentsHtml = `
            <div class="flex items-center p-2 border-b border-gray-200 bg-gray-100 rounded-t-md">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="selectAllDeployments" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="font-medium text-gray-800">Select All</span>
                </label>
            </div>
        `;
        deploymentsHtml += deployments.map(deployment => {
            const containerImage = deployment.spec.template.spec.containers[0]?.image || 'N/A';
            const availableReplicas = deployment.status.availableReplicas || 0;
            const desiredReplicas = deployment.spec.replicas || 0;
            const statusColor = availableReplicas === desiredReplicas && desiredReplicas > 0 ? 'text-green-600' : (availableReplicas > 0 ? 'text-yellow-600' : 'text-red-600');

            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" name="selectedDeployment" value="${deployment.metadata.name}" data-namespace="${deployment.metadata.namespace || 'default'}" data-replicas="${deployment.spec.replicas}" class="form-checkbox h-4 w-4 text-blue-600 deployment-checkbox">
                        <span class="font-medium text-gray-800">
                            <span class="deployment-name-link text-blue-600 hover:underline cursor-pointer"
                                  data-name="${deployment.metadata.name}" data-namespace="${deployment.metadata.namespace || 'default'}">
                                ${deployment.metadata.name}
                            </span>
                        </span>
                    </label>
                    <div class="text-sm text-gray-600 flex flex-col items-end">
                        <span>Replicas: <span class="${statusColor}">${availableReplicas}</span>/${desiredReplicas}</span>
                        <span>Image: ${containerImage}</span>
                    </div>
                </div>
            `;
        }).join('');
        deploymentsListElement.innerHTML = deploymentsHtml;

        // Attach event listeners to newly rendered checkboxes
        document.querySelectorAll('.deployment-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleDeploymentActionButtons);
        });
        document.getElementById('selectAllDeployments').addEventListener('change', (event) => {
            toggleAllDeploymentCheckboxes(event.target.checked);
        });

        // Attach event listener for deployment name links
        document.querySelectorAll('.deployment-name-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const deploymentName = event.target.dataset.name;
                const namespace = event.target.dataset.namespace;
                showDeploymentDetailsModal(deploymentName, namespace);
            });
        });

    } else {
        deploymentsListElement.innerHTML = '<p class="text-gray-600">No deployments found.</p>';
    }
}

/**
 * Renders the services list in the UI.
 * Attaches event listeners for selection and detail modals.
 * @param {Array} services - Array of service objects from the API.
 * @param {Function} toggleServiceActionButtons - Callback to enable/disable action buttons.
 * @param {Function} toggleAllServiceCheckboxes - Callback to select/deselect all.
 * @param {Function} showServiceDetailsModal - Callback to show service details modal.
 * @param {HTMLElement} servicesListElement - The DOM element to render the list into.
 */
export async function renderServicesList(services, toggleServiceActionButtons, toggleAllServiceCheckboxes, showServiceDetailsModal, servicesListElement) {
    if (services.length > 0) {
        let servicesHtml = `
            <div class="flex items-center p-2 border-b border-gray-200 bg-gray-100 rounded-t-md">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="selectAllServices" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="font-medium text-gray-800">Select All</span>
                </label>
            </div>
        `;
        servicesHtml += services.map(svc => {
            const ports = svc.spec.ports?.map(p => `${p.protocol}:${p.port}${p.nodePort ? ` (NodePort: ${p.nodePort})` : ''}`).join(', ') || 'N/A';
            const externalIp = svc.status.loadBalancer?.ingress?.[0]?.ip || svc.status.loadBalancer?.ingress?.[0]?.hostname || 'Pending';

            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" name="selectedService" value="${svc.metadata.name}" data-namespace="${svc.metadata.namespace || 'default'}" class="form-checkbox h-4 w-4 text-blue-600 service-checkbox">
                        <span class="font-medium text-gray-800">
                            <span class="service-name-link text-blue-600 hover:underline cursor-pointer"
                                  data-name="${svc.metadata.name}" data-namespace="${svc.metadata.namespace || 'default'}">
                                ${svc.metadata.name}
                            </span>
                        </span>
                    </label>
                    <div class="text-sm text-gray-600 flex flex-col items-end">
                        <span>Type: ${svc.spec.type}</span>
                        <span>ClusterIP: ${svc.spec.clusterIP || 'N/A'}</span>
                        <span>External IP: ${externalIp}</span>
                        <span>Ports: ${ports}</span>
                    </div>
                </div>
            `;
        }).join('');
        servicesListElement.innerHTML = servicesHtml;

        // Attach event listeners to newly rendered checkboxes
        document.querySelectorAll('.service-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleServiceActionButtons);
        });
        document.getElementById('selectAllServices').addEventListener('change', (event) => {
            toggleAllServiceCheckboxes(event.target.checked);
        });

        // Attach event listener for service name links
        document.querySelectorAll('.service-name-link').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault();
                const serviceName = event.target.dataset.name;
                const namespace = event.target.dataset.namespace;
                showServiceDetailsModal(serviceName, namespace);
            });
        });

    } else {
        servicesListElement.innerHTML = '<p class="text-gray-600">No services found.</p>';
    }
}

/**
 * NEW: Renders the ingresses list in the UI.
 * @param {Array} ingresses - Array of ingress objects from the API.
 * @param {Function} toggleIngressActionButtons - Callback to enable/disable action buttons.
 * @param {Function} toggleAllIngressCheckboxes - Callback to select/deselect all.
 * @param {HTMLElement} ingressesListElement - The DOM element to render the list into.
 */
export async function renderIngressesList(ingresses, toggleIngressActionButtons, toggleAllIngressCheckboxes, ingressesListElement) {
    if (ingresses.length > 0) {
        let ingressesHtml = `
            <div class="flex items-center p-2 border-b border-gray-200 bg-gray-100 rounded-t-md">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="selectAllIngresses" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="font-medium text-gray-800">Select All</span>
                </label>
            </div>
        `;
        ingressesHtml += ingresses.map(ing => {
            const address = ing.status.loadBalancer?.ingress?.[0]?.hostname || ing.status.loadBalancer?.ingress?.[0]?.ip || 'Pending';
            const rules = (ing.spec.rules || []).map(rule => 
                (rule.http?.paths || []).map(path => 
                    `${path.path} -> ${path.backend.service.name}:${path.backend.service.port.number}`
                ).join('<br>')
            ).join('<br>');

            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" name="selectedIngress" value="${ing.metadata.name}" data-namespace="${ing.metadata.namespace || 'default'}" class="form-checkbox h-4 w-4 text-blue-600 ingress-checkbox">
                        <span class="font-medium text-gray-800">${ing.metadata.name}</span>
                    </label>
                    <div class="text-sm text-gray-600 flex flex-col items-end">
                        <span>Address: <a href="http://${address}" target="_blank" class="text-blue-600 hover:underline">${address}</a></span>
                        <span>Rules: ${rules || 'No rules defined'}</span>
                    </div>
                </div>
            `;
        }).join('');
        ingressesListElement.innerHTML = ingressesHtml;

        // Attach event listeners
        document.querySelectorAll('.ingress-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', toggleIngressActionButtons);
        });
        document.getElementById('selectAllIngresses').addEventListener('change', (event) => {
            toggleAllIngressCheckboxes(event.target.checked);
        });
    } else {
        ingressesListElement.innerHTML = '<p class="text-gray-600">No ingresses found.</p>';
    }
}

/**
 * Renders the Persistent Volume Claims list in the UI.
 * Attaches event listeners for selection and detail modals.
 * @param {Array} pvcs - Array of PVC objects from the API.
 * @param {Function} togglePvcActionButtons - Callback to enable/disable action buttons.
 * @param {Function} toggleAllPvcCheckboxes - Callback to select/deselect all.
 * @param {Function} showPvcDetailsModal - Callback to show PVC details modal.
 * @param {HTMLElement} pvcListElement - The DOM element to render the list into.
 */
export async function renderPvcList(pvcs, togglePvcActionButtons, toggleAllPvcCheckboxes, showPvcDetailsModal, pvcListElement) {
    if (pvcs.length > 0) {
        let pvcsHtml = `
            <div class="flex items-center p-2 border-b border-gray-200 bg-gray-100 rounded-t-md">
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="selectAllPvcs" class="form-checkbox h-4 w-4 text-blue-600">
                    <span class="font-medium text-gray-800">Select All</span>
                </label>
            </div>
        `;
        pvcsHtml += pvcs.map(pvc => {
            // NEW: Add a "Bind" button if the PVC is in a 'Pending' state.
            const provisionButton = pvc.status.phase === 'Pending' ? `
                <button class="bind-pvc-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-2 rounded-md text-xs"
                        data-name="${pvc.metadata.name}"
                        data-namespace="${pvc.metadata.namespace || 'default'}"
                        data-size="${pvc.spec.resources.requests.storage}"
                        data-access-modes="${pvc.spec.accessModes.join(',')}">
                    Bind
                </button>
            ` : '';

            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" name="selectedPvc" value="${pvc.metadata.name}" data-namespace="${pvc.metadata.namespace || 'default'}" class="form-checkbox h-4 w-4 text-blue-600 pvc-checkbox">
                        <div class="flex flex-col">
                            <span class="font-medium text-gray-800">
                                <span class="pvc-name-link text-blue-600 hover:underline cursor-pointer"
                                      data-name="${pvc.metadata.name}" data-namespace="${pvc.metadata.namespace || 'default'}">
                                    ${pvc.metadata.name}
                                </span>
                            </span>
                            <div class="text-sm text-gray-600">
                                <span>Status: ${pvc.status.phase}</span> | 
                                <span>Capacity: ${pvc.status.capacity?.storage || 'N/A'}</span> | 
                                <span>Bound PV: ${pvc.spec.volumeName || 'Not Bound'}</span>
                            </div>
                        </div>
                    </div>
                    ${provisionButton}
                </div>
            `;
        }).join('');
        pvcListElement.innerHTML = pvcsHtml;

        document.querySelectorAll('.pvc-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', togglePvcActionButtons);
        });
        document.getElementById('selectAllPvcs').addEventListener('change', (event) => {
            toggleAllPvcCheckboxes(event.target.checked);
        });
        document.querySelectorAll('.pvc-name-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const pvcName = event.target.dataset.name;
                const namespace = event.target.dataset.namespace;
                showPvcDetailsModal(pvcName, namespace);
            });
        });

    } else {
        pvcListElement.innerHTML = '<p class="text-gray-600">No Persistent Volume Claims found.</p>';
    }
}


/**
 * Renders the Persistent Volumes list in the UI.
 * Attaches event listeners for detail modals.
 * @param {Array} pvs - Array of PV objects from the API.
 * @param {Function} showPvDetailsModal - Callback to show PV details modal.
 * @param {HTMLElement} pvListElement - The DOM element to render the list into.
 */
export async function renderPvList(pvs, showPvDetailsModal, pvListElement) {
    if (pvs.length > 0) {
        pvListElement.innerHTML = pvs.map(pv => `
            <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                <span class="font-medium text-gray-800">
                    <span class="pv-name-link text-blue-600 hover:underline cursor-pointer"
                          data-name="${pv.metadata.name}">
                        ${pv.metadata.name}
                    </span>
                </span>
                <div class="text-sm text-gray-600 flex flex-col items-end">
                    <span>Status: ${pv.status.phase}</span>
                    <span>Capacity: ${pv.spec.capacity?.storage || 'N/A'}</span>
                    <span>Claimed By: ${pv.spec.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : 'None'}</span>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.pv-name-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const pvName = event.target.dataset.name;
                showPvDetailsModal(pvName);
            });
        });

    } else {
        pvListElement.innerHTML = '<p class="text-gray-600">No Persistent Volumes found.</p>';
    }
}

/**
 * Renders the StorageClasses list in the UI.
 * Attaches event listeners for deletion and details.
 * @param {Array} storageClasses - Array of StorageClass objects from the API.
 * @param {HTMLElement} storageClassListElement - The DOM element to render the list into.
 * @param {Function} showStorageClassDetailsModal - Callback to show StorageClass details modal.
 */
export async function renderStorageClassList(storageClasses, storageClassListElement, showStorageClassDetailsModal) {
    if (storageClasses.length > 0) {
        storageClassListElement.innerHTML = storageClasses.map(sc => {
            return `
                <div class="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm">
                    <div>
                        <span class="font-medium text-gray-800">
                            <span class="sc-name-link text-blue-600 hover:underline cursor-pointer"
                                  data-name="${sc.metadata.name}">
                                ${sc.metadata.name}
                            </span>
                        </span>
                        <div class="text-sm text-gray-600">
                            <span>Provisioner: ${sc.provisioner}</span><br/>
                        </div>
                    </div>
                    <button class="delete-sc-btn bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded" data-name="${sc.metadata.name}">Delete</button>
                </div>
            `;
        }).join('');
        
        // Attach delete handlers
        document.querySelectorAll('.delete-sc-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = btn.dataset.name;
                showConfirmModal(`Delete StorageClass '${name}'?`, async (confirmed) => {
                    if (!confirmed) {
                        showMessage("StorageClass deletion cancelled.", false);
                        return;
                    }
                    btn.disabled = true;
                    btn.textContent = 'Deleting...';
                    try {
                        const result = await deleteStorageClass(name);
                        showMessage(result.message, false);
                        // Refresh entire dashboard after SC deletion
                        if (window.renderDashboardSectionsBatch) {
                            window.renderDashboardSectionsBatch();
                        }
                    } catch (err) {
                        showMessage(`Error deleting StorageClass: ${err.message}`, true);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Delete';
                    }
                });
            });
        });

        // MODIFIED: Attach event listener for StorageClass name links to call the details modal function.
        document.querySelectorAll('.sc-name-link').forEach(link => {
            link.addEventListener('click', async (event) => {
                event.preventDefault();
                const scName = event.target.dataset.name;
                // Call the function passed from dashboard-app.js
                showStorageClassDetailsModal(scName);
            });
        });
    } else {
        storageClassListElement.innerHTML = '<p class="text-gray-600">No StorageClasses found.</p>';
    }
}
