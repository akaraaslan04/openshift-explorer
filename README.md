# OpenShift Explorer Backend

Small Express backend that exposes OpenShift `oc` data through a REST API. It provides namespaces, deployments, pod details, usage, logs, and deployment update strategy endpoints.

## Features
- Health checks
- Namespaces (projects) listing
- Deployments listing and details
- Pods listing and usage metrics
- Pod logs
- Update deployment strategy (RollingUpdate/Recreate)

## Requirements
- Node.js 18+
- OpenShift CLI (`oc`) installed and authenticated

## Quick start
1. Install dependencies.
2. Start the server.
3. Call the API endpoints.

The server listens on port 3001 by default (configure with `PORT`).

## Environment
- PORT: HTTP port for the backend (default: 3001)

## API endpoints
- GET /health
- GET /api/health
- GET /api/namespaces
- GET /api/projects/:project/deployments
- GET /api/projects/:project/deployments/:deployment
- GET /api/projects/:project/deployments/:deployment/pods
- GET /api/projects/:project/pods-usage
- GET /api/projects/:project/pods/:pod/logs
- PATCH /api/projects/:project/deployments/:deployment/strategy

## Project structure
- [index_b.js](index_b.js)
- [App.js](App.js)

## Notes
- The backend shells out to `oc` commands. Ensure `oc` is on PATH and logged in.
- `/api/health` requires `oc whoami` to succeed.
