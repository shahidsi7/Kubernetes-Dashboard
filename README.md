# Kubernetes EKS Cluster and Resource Dashboard

A **comprehensive full-stack web application** designed to simplify the creation, management, and visualization of **AWS EKS (Elastic Kubernetes Service)** clusters and their internal resources.
It provides a **user-friendly graphical interface** to perform complex `eksctl` and `kubectl` operations, making Kubernetes management more accessible.

---

## 🚀 Features

### **EKS Cluster Lifecycle Management**

* Create new EKS clusters with detailed configuration options:

  * Node groups, instance types, volume sizes, IAM/OIDC settings.
* View existing EKS clusters in your AWS account.
* Delete clusters with **real-time progress updates**.
* Securely configure AWS credentials for the session.

### **Comprehensive Kubernetes Dashboard**

* Connect to any managed EKS cluster to **view & manage resources**.
* Namespace-scoped management with dynamic namespace selector.
* **Workloads**: Create/delete/scale Deployments & Pods with detailed configs.
* **Networking**: Manage Services & Ingress for external access.
* **Storage**: Handle PVCs, PVs, StorageClasses (with pending PVC binding).
* **Configuration**: Create/delete ConfigMaps & Secrets directly from UI.

### **Real-time Operations & Monitoring**

* Color-coded **real-time logs** for cluster creation/deletion.
* Live pod logs directly in dashboard.
* One-click **Prometheus & Grafana** deployment with auto service discovery.

### **Advanced Features**

* **Resource Flow Visualization**: Interactive D3.js diagram of Kubernetes relationships.
* **Access Control**: Manage `aws-auth` ConfigMap to map IAM roles to Kubernetes RBAC.
* **Pre-flight Checks**: IAM permission check before cluster creation.

---

## 🛠 Tech Stack

**Backend**: Node.js, Express.js
**Real-time Communication**: WebSockets (`ws` library)
**CLI Interaction**: `child_process` for `eksctl`, `kubectl`, `aws CLI`
**Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript (ESM)
**Visualization**: D3.js
**Kubernetes YAML**: `js-yaml` for dynamic generation

---

## 📦 Prerequisites

Ensure you have these installed:

* [Node.js & npm](https://nodejs.org/)
* [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
* [eksctl](https://eksctl.io/introduction/installation/)
* [kubectl](https://kubernetes.io/docs/tasks/tools/)

---

## ⚙️ Setup & Installation

```bash
# Install dependencies
npm install
```

### AWS Credentials

* Credentials are provided **via UI** for each session (not stored).
* IAM user/role must have permissions for EKS, VPC, EC2, IAM Roles, etc.
* Pre-flight IAM permission check runs before cluster creation.

---

## ▶️ Running the Application

```bash
npm start
```

* Application runs at: **[http://localhost:3000](http://localhost:3000)**
* **EKS Manager UI**: `http://localhost:3000`
* **Kubernetes Dashboard**: `http://localhost:3000/kubernetes-dashboard.html` (after connecting to a cluster)

---

## 📖 How to Use

### 1️⃣ First-Time Setup

* Click **Login to AWS EKS**.
* Enter AWS Access Key, Secret Key, and Region.
* Credentials are session-only.

### 2️⃣ Creating an EKS Cluster

* Click **Create New Cluster**.
* Fill the form (defaults provided but customizable).
* Click **Create Cluster** → view live creation logs.
* Post-creation setup applies StorageClass & AWS Load Balancer Controller (optional).

### 3️⃣ Managing Existing Clusters

* Click **Show Pre-created Clusters**.
* **Use Cluster** → Connect to Kubernetes Dashboard.
* **Delete Cluster** → Real-time deletion logs.

### 4️⃣ Kubernetes Dashboard

* Switch **Namespaces** via dropdown.
* Refresh resources individually.
* Create/Delete/Scale/Log Pods & Deployments.

### 5️⃣ Resource Flow Visualization

* Go to **Resource Flow** tab.
* Interactive D3.js diagram to explore resource relationships.

---

## 📂 Project Structure

```
.
├── server.js                   # Main Express & WebSocket server
├── package.json
├── kubernetesDashboard/
│   ├── public/                 # Frontend static assets
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── components/     
│   │   │   ├── utils/          
│   │   │   ├── dashboard-app.js
│   │   │   └── main-app.js
│   │   ├── index.html          
│   │   └── kubernetes-dashboard.html
│   ├── routes/
│   │   └── kubernetesRoutes.js
│   ├── utils/
│   │   ├── cache.js
│   │   ├── clusterUtils.js
│   │   ├── eksConfigGenerator.js
│   │   ├── kubectlUtils.js
│   │   ├── manifestGenerators.js
│   │   └── validationUtils.js
│   └── websocket/
│       └── kubernetesWsHandlers.js
```


