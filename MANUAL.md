# Project Manual

This manual explains how to run and use the OpenShift Explorer backend.

## Overview
This backend exposes OpenShift cluster data through REST endpoints by calling the `oc` CLI. It is intended to be used by a frontend that needs namespaces, deployments, pods, usage metrics, and logs.

## Requirements
- Node.js 18+
- OpenShift CLI (`oc`) installed
- Valid `oc` login (cluster credentials)

## Setup
1. Ensure `oc` is available on PATH.
2. Log in to your cluster: `oc login ...`
3. Install Node.js dependencies.

## Run
- Start the server with Node.
- Default port is 3001 (override with `PORT`).

## Health checks
- `/health` returns a basic JSON response and does not call `oc`.
- `/api/health` runs `oc whoami` and returns `ok: true` when logged in.

## API reference

### GET /api/namespaces
Returns all OpenShift projects (namespaces).

### GET /api/projects/:project/deployments
Returns deployments for the project.

### GET /api/projects/:project/deployments/:deployment
Returns containers and update strategy for a deployment.

### GET /api/projects/:project/deployments/:deployment/pods
Returns pods that match the deployment selector.

### GET /api/projects/:project/pods-usage
Returns CPU and memory usage for pods using `oc adm top`.

### GET /api/projects/:project/pods/:pod/logs
Returns the last 100 lines of pod logs.

### PATCH /api/projects/:project/deployments/:deployment/strategy
Updates deployment strategy.

Body examples:
- Rolling update:
	- `type: "RollingUpdate"`
	- `maxSurge: "25%"`
	- `maxUnavailable: "25%"`
- Recreate:
	- `type: "Recreate"`

## Operational notes
- Commands time out after 8 seconds.
- Errors from `oc` are returned as 500 responses.
- The patch endpoint writes a temporary JSON file in the project folder.

## Troubleshooting
- If `/api/health` fails, confirm `oc whoami` works in the same terminal session.
- If usage is empty, ensure cluster metrics are enabled and you have access to `oc adm top`.
