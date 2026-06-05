# Azure Deployment Plan

Status: Awaiting Approval

## Goal
- Prepare the existing Hyroglyphis app for deployment to Azure Web App on Azure App Service.
- Keep the existing Azure AI Foundry, Azure OpenAI, and Foundry IQ resources as external dependencies and inject them through App Service settings.

## Mode
- MODIFY existing workspace

## Current App Summary
- Single Node/Express app with a Vite React frontend.
- Development entrypoint is [server.ts](server.ts) and the actual runtime is [server/index.ts](server/index.ts).
- In production mode the server already serves [dist](dist) statically and already listens on `process.env.PORT`.
- Current production risk for App Service is that [package.json](package.json) still starts the app with `tsx server.ts`, which depends on dev-time tooling instead of a compiled production server artifact.

## Working Hypothesis
- The smallest reliable App Service shape is one Linux Node web app that hosts both the API routes and the built SPA.
- A production-safe deployment will require a compiled server runtime, not a `tsx` runtime dependency at startup.
- Existing Azure AI / Foundry endpoints remain external and are passed in through App Service application settings.

## Chosen Recipe
- Azure Developer CLI with `azure.yaml`
- Bicep-backed infrastructure for Azure App Service
- Single `web` service hosted on App Service

## Planned Azure Architecture
- One App Service plan
- One Linux Web App running Node 22 LTS
- Optional Application Insights connection if added later
- Existing external resources referenced through settings:
	- existing Azure AI Foundry project endpoint and key
	- existing Azure OpenAI endpoint and deployments
	- existing Foundry IQ agent name and version

## Planned Repo Changes
- Add App Service and azd configuration files
- Add Bicep for App Service plan and web app
- Add `azure.yaml`
- Make the server buildable for production App Service startup
- Switch production startup away from `tsx server.ts` to a compiled Node entrypoint
- Keep local developer flow intact for `npm run dev`
- Document required app settings for Azure deployment

## Validation Plan
- Verify focused local production build
- Verify compiled server starts with `NODE_ENV=production`
- Update plan status to `Ready for Validation`
- Hand off to Azure validation workflow before any deployment execution

## Azure Context To Confirm Before Execution
- Subscription: likely reuse the current Azure subscription already used in this workspace
- Resource group: likely reuse `m2022artist` unless a dedicated web resource group is preferred
- Region: likely `eastus2` for the web app unless you want a different App Service region

## Open Questions
- Reuse existing resource group `m2022artist` or create a dedicated web app resource group?
- Keep the web app in `eastus2` near the existing Foundry account, or choose another App Service region?
- Preferred App Service SKU: Free/Basic for testing or production-capable SKU now?

## Execution Steps
1. Add a production server build path and stable Node startup command.
2. Add `azure.yaml` and App Service Bicep infrastructure.
3. Add Azure app-setting mapping for existing AI and IQ environment variables.
4. Run local build and production startup verification.
5. Mark plan ready for validation and hand off to Azure validation.
