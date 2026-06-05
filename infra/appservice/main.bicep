targetScope = 'resourceGroup'

@description('Azure region for the App Service resources.')
param location string = resourceGroup().location

@description('Globally unique Web App name.')
param appName string

@description('App Service plan name.')
param appServicePlanName string = '${appName}-plan'

@allowed([
  'B1'
  'B2'
  'B3'
  'P1v3'
  'P2v3'
  'P3v3'
])
@description('SKU for the Linux App Service plan.')
param skuName string = 'B1'

@description('Instance count for the App Service plan.')
param workerCount int = 1

@description('Node runtime version for App Service.')
param nodeRuntime string = '22-lts'

@description('Health check path for the web app.')
param healthCheckPath string = '/'

@description('Enable Always On for the web app.')
param alwaysOn bool = true

@description('Optional extra application settings.')
param appSettings object = {}

@description('Optional tag overrides.')
param tags object = {}

var defaultTags = {
  app: 'hyroglyphis'
  environment: 'prod'
  host: 'azure-app-service'
}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  tags: union(defaultTags, tags)
  sku: {
    name: skuName
    capacity: workerCount
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  tags: union(defaultTags, tags)
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      appCommandLine: 'bash startup.sh'
      alwaysOn: alwaysOn
      ftpsState: 'Disabled'
      healthCheckPath: healthCheckPath
      http20Enabled: true
      linuxFxVersion: 'NODE|${nodeRuntime}'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false
      webSocketsEnabled: true
    }
  }
}

resource webAppSettings 'Microsoft.Web/sites/config@2023-12-01' = {
  name: 'appsettings'
  parent: webApp
  properties: union({
    APP_SERVICE_SERVER_ENTRY: 'server.ts'
    NODE_ENV: 'production'
    SCM_DO_BUILD_DURING_DEPLOYMENT: 'true'
    WEBSITE_NODE_DEFAULT_VERSION: '~22'
    WEBSITES_ENABLE_APP_SERVICE_STORAGE: 'true'
  }, appSettings)
}

output appName string = webApp.name
output appUrl string = 'https://${webApp.properties.defaultHostName}'
output principalId string = webApp.identity.principalId
output planName string = appServicePlan.name
