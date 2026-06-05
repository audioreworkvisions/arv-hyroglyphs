/**
 * Azure AI Foundry Inference Service
 *
 * Chat/Text  → @azure-rest/ai-inference  /chat/completions
 * Image      → @azure-rest/ai-inference  /image/generations
 * Video      → Azure OpenAI REST API     /openai/deployments/{deploy}/videos/generations
 *
 * Erforderliche Umgebungsvariablen (.env.local):
 *   AZURE_AI_FOUNDRY_ENDPOINT       – z.B. https://<project>.inference.ai.azure.com
 *   AZURE_AI_FOUNDRY_KEY            – API-Schlüssel (AI Foundry Portal)
 *   AZURE_AI_FOUNDRY_MODEL          – (optional) Standard-Textmodell, z.B. "Phi-4"
 *   AZURE_AI_FOUNDRY_API_VERSION    – (optional) API-Version für den Inference-Client, falls der Endpoint den SDK-Default nicht unterstützt
 *   AZURE_AI_FOUNDRY_IMAGE_MODEL    – (optional) Standard-Bildmodell, z.B. "dall-e-3"
 *
 *   AZURE_OPENAI_ENDPOINT           – z.B. https://<resource>.openai.azure.com
 *   AZURE_OPENAI_KEY                – API-Schlüssel (Azure OpenAI Resource)
 *   AZURE_OPENAI_STORYBOARD_MODEL   – (optional) Deployment-Name für Azure OpenAI / AI Project Chat-Fallbacks
 *   AZURE_OPENAI_VIDEO_DEPLOYMENT   – Deployment-Name für Sora, z.B. "sora-2"
 *   AZURE_OPENAI_API_VERSION        – (optional) Default: "2025-04-01-preview"
 */

import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import OpenAI from "openai";

export interface FoundryChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface FoundryChatOptions {
  model?: string;
  messages: FoundryChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface FoundryChatResult {
  text: string;
  model: string;
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}

const trimEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const getFoundryApiVersion = (): string | undefined =>
  trimEnv(process.env.AZURE_AI_FOUNDRY_API_VERSION);

const getOpenAITextModel = (): string =>
  trimEnv(process.env.OPENAI_TEXT_MODEL) || "gpt-4.1-mini";

const getOpenAIStoryboardModel = (): string =>
  trimEnv(process.env.OPENAI_STORYBOARD_MODEL) || getOpenAITextModel();

const getAzureProjectFallbackModel = (preferredModel?: string): string =>
  trimEnv(process.env.AZURE_OPENAI_STORYBOARD_MODEL)
  || trimEnv(process.env.AZURE_OPENAI_TEXT_MODEL)
  || trimEnv(process.env.AZURE_OPENAI_COMPLETIONS_MODEL)
  || getOpenAIStoryboardModel()
  || preferredModel
  || "gpt-4.1-mini";

const getFoundryClient = (apiVersion = getFoundryApiVersion()) => {
  const endpoint = trimEnv(process.env.AZURE_AI_FOUNDRY_ENDPOINT);
  const apiKey = trimEnv(process.env.AZURE_AI_FOUNDRY_KEY);

  if (!endpoint) {
    throw new Error(
      "AZURE_AI_FOUNDRY_ENDPOINT fehlt. Bitte in .env.local eintragen."
    );
  }
  if (!apiKey) {
    throw new Error(
      "AZURE_AI_FOUNDRY_KEY fehlt. Bitte in .env.local eintragen."
    );
  }

  return ModelClient(
    endpoint,
    new AzureKeyCredential(apiKey),
    apiVersion ? { apiVersion } : undefined,
  );
};

const getAzureProjectCompletionsClient = (): OpenAI | null => {
  const endpoint = trimEnv(process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT);
  const apiKey = trimEnv(process.env.AZURE_AI_FOUNDRY_KEY)
    || trimEnv(process.env.AZURE_OPENAI_COMPLETIONS_KEY);

  if (!endpoint || !apiKey) {
    return null;
  }

  return new OpenAI({
    baseURL: endpoint.replace(/\/$/, ""),
    apiKey,
  });
};

const extractFoundryErrorMessage = (response: { body?: any; status: string | number }) => {
  const errBody = response.body as any;
  return (
    errBody?.error?.message
    || errBody?.message
    || `Foundry API Fehler: HTTP ${response.status}`
  );
};

const isUnsupportedApiVersionError = (message: string) =>
  /api version not supported/i.test(message);

const isUnsupportedMaxTokensError = (message: string) =>
  /unsupported parameter:\s*'max_tokens'.*max_completion_tokens/i.test(message);

const prefersMaxCompletionTokens = (modelName: string) =>
  /(^|[^a-z])gpt-5([.-]|$)|(^|[^a-z])gpt-5\.2([.-]|$)|(^|[^a-z])gpt-5\.2-chat([.-]|$)/i.test(modelName);

const isUnsupportedTemperatureError = (message: string) =>
  /unsupported value:\s*'temperature'.*only the default \(1\) value is supported/i.test(message);

const buildChatTokenLimitOptions = (modelName: string, maxTokens?: number) => {
  const tokenLimit = maxTokens ?? 2048;
  return prefersMaxCompletionTokens(modelName)
    ? { max_completion_tokens: tokenLimit }
    : { max_tokens: tokenLimit };
};

const buildChatSamplingOptions = (
  modelName: string,
  temperature?: number,
  topP?: number,
) => {
  if (prefersMaxCompletionTokens(modelName)) {
    return {};
  }

  return {
    temperature: temperature ?? 0.7,
    top_p: topP ?? 1,
  };
};

const getOpenAIMessageText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        if (entry && typeof entry === "object" && "text" in entry && typeof entry.text === "string") {
          return entry.text;
        }

        return "";
      })
      .join("");
  }

  return "";
};

const tryAzureProjectChatFallback = async (
  options: FoundryChatOptions,
): Promise<FoundryChatResult | null> => {
  const client = getAzureProjectCompletionsClient();
  if (!client) {
    return null;
  }

  const preferredModel = trimEnv(options.model);
  const modelCandidates = Array.from(new Set([
    getAzureProjectFallbackModel(preferredModel),
    preferredModel,
    trimEnv(process.env.AZURE_OPENAI_STORYBOARD_MODEL),
    trimEnv(process.env.AZURE_OPENAI_TEXT_MODEL),
    trimEnv(process.env.AZURE_OPENAI_COMPLETIONS_MODEL),
    getOpenAIStoryboardModel(),
    getOpenAITextModel(),
  ].filter((value): value is string => !!value)));

  let lastError: unknown = null;

  for (const modelName of modelCandidates) {
    try {
      const response = await client.chat.completions.create({
        model: modelName,
        messages: options.messages.map((message) => ({
          role: message.role === "system" ? "developer" : message.role,
          content: message.content,
        })) as any,
        ...buildChatSamplingOptions(modelName, options.temperature, options.topP),
        ...buildChatTokenLimitOptions(modelName, options.maxTokens),
      });

      const choice = response.choices?.[0];

      return {
        text: getOpenAIMessageText(choice?.message?.content),
        model: modelName,
        finishReason: choice?.finish_reason ?? null,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
      };
    } catch (error) {
      lastError = error;

      const message = error instanceof Error ? error.message : String(error);
      if (!/deployment.*does not exist/i.test(message)) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    throw new Error(
      `${lastError.message} Setze fuer den Azure-Project-Fallback ein gueltiges Deployment in AZURE_OPENAI_STORYBOARD_MODEL oder AZURE_OPENAI_TEXT_MODEL.`,
    );
  }

  return null;
};

const getDefaultModel = (): string =>
  process.env.AZURE_AI_FOUNDRY_MODEL || "Phi-4";

export async function foundryChat(
  options: FoundryChatOptions
): Promise<FoundryChatResult> {
  const configuredApiVersion = getFoundryApiVersion();
  const client = getFoundryClient(configuredApiVersion);
  const modelName = options.model || getDefaultModel();

  const response = await client.path("/chat/completions").post({
    body: {
      model: modelName,
      messages: options.messages,
      ...buildChatSamplingOptions(modelName, options.temperature, options.topP),
      ...buildChatTokenLimitOptions(modelName, options.maxTokens),
    },
  });

  if (isUnexpected(response)) {
    const message = extractFoundryErrorMessage(response);

    if (
      isUnsupportedApiVersionError(message)
      || isUnsupportedMaxTokensError(message)
      || isUnsupportedTemperatureError(message)
    ) {
      const fallbackResult = await tryAzureProjectChatFallback(options);
      if (fallbackResult) {
        return fallbackResult;
      }

      const versionHint = configuredApiVersion
        ? ` AZURE_AI_FOUNDRY_API_VERSION ist aktuell auf "${configuredApiVersion}" gesetzt.`
        : ' Das installierte SDK verwendet standardmaessig api-version "2024-05-01-preview".';

      const parameterHint = isUnsupportedMaxTokensError(message)
        ? ' Das Zielmodell erwartet max_completion_tokens statt max_tokens.'
        : isUnsupportedTemperatureError(message)
          ? ' Das Zielmodell erlaubt keine benutzerdefinierte temperature und erwartet den Defaultwert.'
          : '';

      throw new Error(
        `${message}.${versionHint}${parameterHint} Setze in .env.local eine vom Endpoint unterstuetzte AZURE_AI_FOUNDRY_API_VERSION oder konfiguriere AZURE_EXISTING_AIPROJECT_ENDPOINT fuer den OpenAI-kompatiblen Fallback.`,
      );
    }

    throw new Error(message);
  }

  const choice = response.body.choices?.[0];
  const usage = response.body.usage;

  return {
    text: choice?.message?.content ?? "",
    model: modelName,
    finishReason: choice?.finish_reason ?? null,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : null,
  };
}

export async function foundryGenerateText(
  prompt: string,
  systemInstruction?: string,
  model?: string
): Promise<FoundryChatResult> {
  const messages: FoundryChatMessage[] = [];

  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  messages.push({ role: "user", content: prompt });

  return foundryChat({ model, messages });
}

// ── Image Generation ─────────────────────────────────────────────────────────

export interface FoundryImageOptions {
  prompt: string;
  model?: string;
  size?: string;
  quality?: "standard" | "hd";
  n?: number;
}

export interface FoundryImageResult {
  imageData: string;   // base64 data URL (data:image/png;base64,...)
  model: string;
  revisedPrompt?: string;
}

export async function foundryImageGenerate(
  options: FoundryImageOptions
): Promise<FoundryImageResult> {
  const apiKey =
    process.env.AZURE_OPENAI_KEY ||
    process.env.AZURE_AI_FOUNDRY_KEY ||
    '';

  if (!apiKey) throw new Error("AZURE_OPENAI_KEY fehlt. Bitte in .env.local eintragen.");

  // ── Prefer the AI Foundry /openai/v1/ endpoint if present ──────────────
  // The newer Azure AI Foundry API does not use /deployments/{name}/ in the URL;
  // instead the model is passed in the request body.
  const aiProjectEndpoint = (
    process.env.AZURE_EXISTING_AIPROJECT_ENDPOINT || ''
  ).trim().replace(/\/$/, '');

  const legacyEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();
  const deployment =
    options.model ||
    process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT ||
    'dall-e-3';
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

  // Detect AI Foundry format: base URL already contains /openai/v1
  const useFoundryFormat =
    aiProjectEndpoint.includes('/openai/v1') && !!aiProjectEndpoint;

  let url: string;
  let requestBody: Record<string, unknown>;

  if (useFoundryFormat) {
    // New format: model in body, no deployment in URL
    url = `${aiProjectEndpoint}/images/generations`;
    requestBody = {
      model: deployment,
      prompt: options.prompt,
      n: options.n ?? 1,
      size: options.size ?? '1024x1024',
      quality: options.quality ?? 'standard',
      response_format: 'b64_json',
    };
  } else {
    // Legacy format: deployment in URL path
    if (!legacyEndpoint) throw new Error("AZURE_OPENAI_ENDPOINT fehlt. Bitte in .env.local eintragen.");
    url = `${legacyEndpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/images/generations?api-version=${apiVersion}`;
    requestBody = {
      prompt: options.prompt,
      n: options.n ?? 1,
      size: options.size ?? '1024x1024',
      quality: options.quality ?? 'standard',
      response_format: 'b64_json',
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Azure OpenAI Image-Fehler: HTTP ${res.status}`;
    throw new Error(msg);
  }

  const item = data?.data?.[0];
  if (!item) throw new Error("Azure OpenAI lieferte keine Bilddaten zurück.");

  let imageData: string;
  if (item.b64_json) {
    imageData = `data:image/png;base64,${item.b64_json}`;
  } else if (item.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Bild-Download fehlgeschlagen: ${imgRes.statusText}`);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    const ct  = imgRes.headers.get("content-type") || "image/png";
    imageData = `data:${ct};base64,${buf.toString("base64")}`;
  } else {
    throw new Error("Azure OpenAI Image-Response enthielt weder b64_json noch url.");
  }

  return {
    imageData,
    model: deployment,
    revisedPrompt: item.revised_prompt ?? undefined,
  };
}

// ── Video Generation (Azure OpenAI) ──────────────────────────────────────────

export interface FoundryVideoOptions {
  prompt: string;
  deployment?: string;
  size?: string;
  seconds?: number;
}

export interface FoundryVideoEditOptions {
  prompt: string;
  videoId: string;
}

export interface FoundryVideoExtendOptions {
  prompt: string;
  videoId: string;
  seconds?: number;
}

export interface FoundryVideoJob {
  id: string;
  status: string;
  videoUrl?: string;
  videoBase64?: string;
  error?: string;
}

const getAzureVideoEndpointAndKey = (): { endpoint: string; apiKey: string; model: string } => {
  const endpoint = process.env.AZURE_VIDEO_ENDPOINT;
  const apiKey   = process.env.AZURE_VIDEO_KEY || process.env.AZURE_OPENAI_KEY;
  const model    = process.env.AZURE_VIDEO_MODEL || "sora-2";

  if (!endpoint) throw new Error("AZURE_VIDEO_ENDPOINT fehlt. Bitte in .env.local eintragen.");
  if (!apiKey)   throw new Error("AZURE_VIDEO_KEY fehlt. Bitte in .env.local eintragen.");

  return { endpoint: endpoint.replace(/\/$/, ""), apiKey, model };
};

const azureVideoHeaders = (apiKey: string): HeadersInit => ({
  "api-key": apiKey,
  "Content-Type": "application/json",
});

const normalizeAzureVideoSeconds = (seconds?: number): string | undefined => {
  if (!(seconds && seconds > 0)) {
    return undefined;
  }

  const rounded = Math.round(seconds);
  const allowed = [4, 8, 12];
  const nearest = allowed.reduce((current, candidate) => (
    Math.abs(candidate - rounded) < Math.abs(current - rounded) ? candidate : current
  ));

  return String(nearest);
};

export async function foundryVideoCreate(
  options: FoundryVideoOptions
): Promise<FoundryVideoJob> {
  const { endpoint, apiKey, model } = getAzureVideoEndpointAndKey();

  // Azure /openai/v1/videos: model+seconds(string) im Body, api-key Header
  const body: Record<string, unknown> = {
    prompt: options.prompt,
    model: options.deployment || model,
  };
  if (options.size) body.size = options.size;
  const normalizedSeconds = normalizeAzureVideoSeconds(options.seconds);
  if (normalizedSeconds) {
    body.seconds = normalizedSeconds;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: azureVideoHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Azure Video-Fehler: HTTP ${res.status}`;
    throw new Error(msg);
  }

  return {
    id: data.id ?? "",
    status: (data.status ?? "").toLowerCase(),
    videoUrl: data.result?.url ?? data.url ?? undefined,
    error: data.error?.message ?? undefined,
  };
}

export async function foundryVideoEdit(
  options: FoundryVideoEditOptions
): Promise<FoundryVideoJob> {
  const { endpoint, apiKey } = getAzureVideoEndpointAndKey();
  const videoId = options.videoId.trim();

  if (!videoId) {
    throw new Error("videoId ist fuer Video-Edits erforderlich.");
  }

  const res = await fetch(`${endpoint}/edits`, {
    method: "POST",
    headers: azureVideoHeaders(apiKey),
    body: JSON.stringify({
      video: { id: videoId },
      prompt: options.prompt,
    }),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Azure Video-Edit-Fehler: HTTP ${res.status}`;
    throw new Error(msg);
  }

  return {
    id: data.id ?? "",
    status: (data.status ?? "").toLowerCase(),
    videoUrl: data.result?.url ?? data.url ?? undefined,
    error: data.error?.message ?? undefined,
  };
}

export async function foundryVideoExtend(
  options: FoundryVideoExtendOptions
): Promise<FoundryVideoJob> {
  const { endpoint, apiKey } = getAzureVideoEndpointAndKey();
  const videoId = options.videoId.trim();

  if (!videoId) {
    throw new Error("videoId ist fuer Video-Extensions erforderlich.");
  }

  const normalizedSeconds = normalizeAzureVideoSeconds(options.seconds);
  const body: Record<string, unknown> = {
    video: { id: videoId },
    prompt: options.prompt,
  };

  if (normalizedSeconds) {
    body.seconds = normalizedSeconds;
  }

  const res = await fetch(`${endpoint}/extensions`, {
    method: "POST",
    headers: azureVideoHeaders(apiKey),
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Azure Video-Extension-Fehler: HTTP ${res.status}`;
    throw new Error(msg);
  }

  return {
    id: data.id ?? "",
    status: (data.status ?? "").toLowerCase(),
    videoUrl: data.result?.url ?? data.url ?? undefined,
    error: data.error?.message ?? undefined,
  };
}

export async function foundryVideoRetrieve(
  jobId: string,
  _deployment?: string
): Promise<FoundryVideoJob> {
  const { endpoint, apiKey } = getAzureVideoEndpointAndKey();
  const url = `${endpoint}/${jobId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "api-key": apiKey },
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Azure Video-Abruf-Fehler: HTTP ${res.status}`;
    throw new Error(msg);
  }

  return {
    id: data.id ?? jobId,
    status: (data.status ?? "").toLowerCase(),
    videoUrl: data.result?.url ?? data.url ?? undefined,
    error: data.error?.message ?? undefined,
  };
}

export async function foundryVideoDownload(
  jobId: string,
  _deployment?: string
): Promise<string> {
  const { endpoint, apiKey } = getAzureVideoEndpointAndKey();
  const url = `${endpoint}/${jobId}/content`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "api-key": apiKey },
  });

  if (!res.ok) {
    throw new Error(`Azure Video-Download fehlgeschlagen: HTTP ${res.status}`);
  }

  const ct = res.headers.get("content-type") || "video/mp4";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${ct};base64,${buf.toString("base64")}`;
}
