# README – Despliegue con Helm + ArgoCD - Parcial Patrones Arquitectónicos Avanzados

Juan Diego Martínez
Ricardo Plazas

Este documento explica cómo instalar y gestionar el despliegue completo de la aplicación pedido-app usando Helm y ArgoCD. La aplicación está compuesta por:

* Base de datos: PostgreSQL (chart oficial de Bitnami).
* Backend: Spring Boot.
* Frontend: React/Angular/Vue.

---

## 1. Prerrequisitos

* Kubernetes 1.25+ 
* `kubectl` y `helm` instalados.
* ArgoCD desplegado en el clúster.
* Un controlador de Ingress, se utilizó NGINX.

---

## 2. Estructura del repo

```
charts/
└── pedido-app/
    ├── Chart.yaml
    ├── values.yaml                #valores base
    ├── values-dev.yaml            #valores para entorno dev
    ├── values-prod.yaml           #valores para entorno de producción
    ├── templates/                 #plantillas del chart
    │   ├── ingress.yaml           #rutas frontend/backend
    │   ├── backend/               #manifests backend
    │   ├── frontend/              #manifests frontend
    │   └── secrets.yaml           #secretos de DB
└── environments/
    ├── dev/application.yaml       # definición de aplicación ArgoCD para development
    └── prod/application.yaml      # definición de aplicación ArgoCD  para producción
```

---

## 3. Configuración de valores

### `values.yaml` 

- **Backend**: imagen `tuusuario/pedido-backend:dev`, 1 réplica, puerto 8080.
- **Frontend**: imagen `tuusuario/pedido-frontend:dev`, 1 réplica, puerto 80.
- **Recursos**: definidos con requests/limits para CPU y memoria.
- **HPA backend**: habilitado, escala entre 1 y 5 réplicas con 70% CPU target.
- **DB PostgreSQL**:

  * Usuario: `pedido`.
  * DB: `pedidos`.
  * PVC: `5Gi` con StorageClass `do-block-storage`.
  * Credenciales gestionadas en `db-credentials`.

### `values-dev.yaml`

* **Backend**: `juandi1935/pedido-backend:dev2`.
* **Frontend**: `juandi1935/pedido-frontend:dev`.
* **Ingress host**: `dev.138.197.226.165.sslip.io`.
* **Secret DB**:

  * `postgresPassword: postgres-dev-123`.
  * `userPassword: pedido-dev-123`.

### `values-prod.yaml`

* **Backend**: `juandi1935/pedido-backend:prod`.
* **Frontend**: `juandi1935/pedido-frontend:prod`.
* **Réplicas**: 2 para backend y frontend.
* **Ingress host**: `app.138.197.226.165.sslip.io`.
* **Secret DB**:

  * `postgresPassword: postgres-prod-123`.
  * `userPassword: pedido-prod-123`.

---

## 4. Instalación manual con Helm

### Dev

```bash
kubectl create namespace pedido-app-dev || true
helm dependency update charts/pedido-app
helm upgrade --install pedido-app charts/pedido-app \
  -n pedido-app-dev \
  -f charts/pedido-app/values-dev.yaml
```

### Prod

```bash
kubectl create namespace pedido-app-prod || true
helm dependency update charts/pedido-app
helm upgrade --install pedido-app charts/pedido-app \
  -n pedido-app-prod \
  -f charts/pedido-app/values-prod.yaml
```

### Verificación

```bash
kubectl -n pedido-app-dev get pods,svc,ingress,hpa
```

---

## 5) Configuración de ArgoCD

### Dev (environments/dev/application.yaml)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pedido-app-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/juandmaes1/pedido-app.git
    targetRevision: main
    path: charts/pedido-app
    helm:
      valueFiles:
        - values-dev.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: pedido-app-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Prod (environments/prod/application.yaml)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pedido-app-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/juandmaes1/pedido-app.git
    targetRevision: main
    path: charts/pedido-app
    helm:
      valueFiles:
        - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: pedido-app-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Aplicar en ArgoCD

```bash
kubectl apply -f environments/dev/application.yaml
kubectl apply -f environments/prod/application.yaml
```

---

## 6. Endpoints de acceso

* **Dev**:

  * Frontend: [http://dev.138.197.226.165.sslip.io/](http://dev.138.197.226.165.sslip.io/)
  * Backend: [http://dev.138.197.226.165.sslip.io/api/](http://dev.138.197.226.165.sslip.io/api/)

* **Prod**:

  * Frontend: [http://app.138.197.226.165.sslip.io/](http://app.138.197.226.165.sslip.io/)
  * Backend: [http://app.138.197.226.165.sslip.io/api/](http://app.138.197.226.165.sslip.io/api/)

---

## 7. Persistencia de datos

* Los datos se almacenan en un PVC (`5Gi`) definido en el subchart Bitnami PostgreSQL.
* Los pedidos permanecen tras reinicios de los pods.

---
