# Azure App Service

Diese Struktur macht die bestehende Hyroglyphis-App als Linux Azure Web App auf Azure App Service deploybar, ohne die aktuellen Laufzeitdateien hart auf einen bestimmten `package.json`-Scriptnamen festzunageln.

## Enthalten

- `main.bicep`: App Service Plan und Linux Web App
- `main.parameters.example.json`: Beispielparameter fuer den Infrastruktur-Deploy
- `appsettings.example.json`: Vorlage fuer die benoetigten Umgebungsvariablen
- `deploy.ps1`: optionaler Azure-CLI-Deploy fuer Infra, App Settings und Zip-Deploy
- `../../startup.sh`: robuster Startpfad fuer App Service
- `../../azure.yaml`: optionaler `azd`-Einstiegspunkt

## Runtime-Ansatz

Die Web App startet mit `bash startup.sh`.

Das Skript arbeitet in dieser Reihenfolge:

1. Dependencies installieren, falls noch keine `node_modules` vorhanden sind
2. `npm run build` ausfuehren, wenn ein Build-Script existiert
3. bevorzugt `npm run start:prod` starten
4. sonst `npm run start` starten
5. sonst `npm run preview -- --host 0.0.0.0 --port $PORT` starten
6. sonst als letzter Fallback `npx --yes tsx server.ts` starten

Damit bleibt die App-Service-Schiene nutzbar, auch wenn sich deine produktive Startkonvention spaeter noch aendert.

## Azure CLI Deploy

1. Resource Group anlegen

```powershell
az group create -n hyroglyphis-app-rg -l westeurope
```

2. Infrastruktur deployen

```powershell
az deployment group create \
  -g hyroglyphis-app-rg \
  --template-file infra/appservice/main.bicep \
  --parameters @infra/appservice/main.parameters.example.json
```

3. App Settings setzen

```powershell
az webapp config appsettings set \
  -g hyroglyphis-app-rg \
  -n <app-name> \
  --settings @infra/appservice/appsettings.example.json
```

4. Optional alles in einem Schritt deployen

```powershell
pwsh -File infra/appservice/deploy.ps1 \
  -ResourceGroupName hyroglyphis-app-rg \
  -AppName <app-name>
```

## azd

Es gibt einen optionalen `azure.yaml`-Einstiegspunkt im Repo-Root, damit du spaeter auch ueber `azd up` gehen kannst.

## Wichtige Annahme

Der Fallback-Pfad geht davon aus, dass `server.ts` weiterhin der sinnvollste Backend-Einstiegspunkt fuer die App bleibt. Wenn du spaeter einen expliziten Produktions-Entrypoint einfuehrst, reicht es, einen `start`- oder `start:prod`-Script zu pflegen; das Startskript bevorzugt diese automatisch.
