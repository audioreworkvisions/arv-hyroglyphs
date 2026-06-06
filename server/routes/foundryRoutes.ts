import { Router } from 'express';
import { ARV_CHARACTERS, getCharacter } from '../../lib/arvCharacters';
import type { ARVSatireSketch } from '../../lib/arvTypes';
import { PRESETS } from '../../lib/presets';
import { buildStoryboardRequestPrompt } from '../../lib/promptTemplates';
import { extractPromptCore, withStyleTaste } from '../../lib/styleTaste';
import {
  foundryChat,
  foundryGenerateText,
  foundryImageGenerate,
  foundryVideoCreate,
  foundryVideoDownload,
  foundryVideoEdit,
  foundryVideoExtend,
  foundryVideoRetrieve,
} from '../../services/foundryService';
import { asNonEmptyString, toErrorMessage } from '../utils/http';
import { VIDEO_FAILURE_STATUSES, VIDEO_SUCCESS_STATUSES, sleep } from '../utils/video';
import {
  buildStoryEngineSystemInstruction,
  parseJsonObjectFromModelText,
  sanitizeSatireSketch,
  sanitizeStoryboard,
  sanitizeStoryboardSceneRewrite,
} from '../utils/storyboard';
import { mergeIQSceneContext, normalizeIQBriefForDebug, resolveIQBrief } from '../utils/iq';

const FOUNDRY_VIDEO_POLL_INTERVAL_MS = 4000;
const FOUNDRY_VIDEO_MAX_WAIT_MS = 10 * 60 * 1000;
const SORA_SUPPORTED_VIDEO_SECONDS = [4, 8, 12] as const;
const SORA_DEFAULT_VIDEO_SECONDS = 4;

const normalizeSoraVideoSeconds = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return SORA_DEFAULT_VIDEO_SECONDS;
  }

  return SORA_SUPPORTED_VIDEO_SECONDS.reduce((closest, seconds) => {
    const closestDistance = Math.abs(closest - parsed);
    const secondsDistance = Math.abs(seconds - parsed);
    return secondsDistance < closestDistance ? seconds : closest;
  }, SORA_DEFAULT_VIDEO_SECONDS);
};

export const createFoundryRoutes = () => {
  const router = Router();

  router.post('/api/foundry/chat', async (req, res) => {
    try {
      const { messages, model, temperature, maxTokens } = req.body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages-Array ist erforderlich.' });
      }

      const result = await foundryChat({
        messages,
        model: asNonEmptyString(model) || undefined,
        temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : undefined,
        maxTokens: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : undefined,
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Foundry chat Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry Chat fehlgeschlagen') });
    }
  });

  router.post('/api/foundry/text', async (req, res) => {
    try {
      const { prompt, instructions, model, temperature, maxTokens } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const result = await foundryGenerateText(
        userPrompt,
        asNonEmptyString(instructions) || undefined,
        asNonEmptyString(model) || undefined,
      );

      void temperature;
      void maxTokens;

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Foundry text Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry Textgenerierung fehlgeschlagen') });
    }
  });

  router.post('/api/foundry/storyboard', async (req, res) => {
    try {
      const { prompt, presetId, promptTemplateId, model, storyArcMode } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const preset = asNonEmptyString(presetId)
        ? (PRESETS.find((p) => p.id === presetId) ?? null)
        : null;
      const storyboardPromptDebug = buildStoryboardRequestPrompt(userPrompt, {
        promptTemplateId: asNonEmptyString(promptTemplateId),
      });
      const storyboardPrompt = storyboardPromptDebug.normalizedPrompt || userPrompt;
      const selectedArcMode = storyArcMode === 'cinematic' ? 'cinematic' : 'iconic';
      const systemInstruction = buildStoryEngineSystemInstruction(storyboardPrompt, preset, 'de', selectedArcMode);
      const modelInput = `Erstelle eine Story-Sequenz fuer diese Idee: "${storyboardPrompt}"`;

      const result = await foundryGenerateText(
        modelInput,
        systemInstruction,
        asNonEmptyString(model) || undefined,
      );

      const rawStoryboard = parseJsonObjectFromModelText(result.text);
      const story = sanitizeStoryboard(rawStoryboard, preset, storyboardPrompt, selectedArcMode);

      return res.json({
        success: true,
        model: result.model,
        story,
        debug: {
          storyboardPrompt: storyboardPromptDebug,
          systemInstruction,
          modelInput,
        },
      });
    } catch (error) {
      console.error('Foundry storyboard Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry Storyboard fehlgeschlagen') });
    }
  });

  router.post('/api/foundry/storyboard/regenerate', async (req, res) => {
    try {
      const {
        prompt,
        presetId,
        promptTemplateId,
        model,
        storyArcMode,
        scope,
        currentStory,
        sceneIndex,
        sceneDraftPrompt,
        variationSeed,
      } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      if (!currentStory || !Array.isArray(currentStory.scenes) || currentStory.scenes.length === 0) {
        return res.status(400).json({ error: 'currentStory mit Szenen ist erforderlich.' });
      }

      const preset = asNonEmptyString(presetId)
        ? (PRESETS.find((p) => p.id === presetId) ?? null)
        : null;
      const storyboardPromptDebug = buildStoryboardRequestPrompt(userPrompt, {
        promptTemplateId: asNonEmptyString(promptTemplateId),
      });
      const storyboardPrompt = storyboardPromptDebug.normalizedPrompt || userPrompt;
      const selectedArcMode = storyArcMode === 'cinematic' ? 'cinematic' : 'iconic';
      const selectedScope = scope === 'scene' ? 'scene' : 'story';
      const seed = asNonEmptyString(variationSeed) || `${Date.now()}`;
      const baseInstruction = buildStoryEngineSystemInstruction(storyboardPrompt, preset, 'de', selectedArcMode);

      if (selectedScope === 'scene') {
        const normalizedSceneIndex = Number.isInteger(sceneIndex) ? Number(sceneIndex) : -1;
        const currentScene = currentStory.scenes[normalizedSceneIndex];

        if (!currentScene) {
          return res.status(400).json({ error: 'sceneIndex zeigt auf keine gueltige Szene.' });
        }

        const systemInstruction = [
          baseInstruction,
          'REGENERATIONS-MODUS: Du schreibst genau eine bestehende Storyboard-Szene neu.',
          '- Bewahre die Position der Szene in der Viererstruktur und ihre Beat-Funktion.',
          '- Die neue Szene muss die Geschichte sichtbar weiterfuehren oder bewusst anders abbiegen, statt den alten Text nur umzuformulieren.',
          '- Schreibe neue action-, motionDescription-, continuityNotes- und gifSpecification-Texte.',
          '- Wiederhole weder die bisherige gifSpecification noch die bisherige action wortgleich.',
          '- Antworte ausschliesslich mit JSON in diesem Format: {"action":"...","motionDescription":"...","continuityNotes":"...","gifSpecification":"..."}.',
        ].join('\n\n');

        const modelInput = [
          `Basisidee: "${storyboardPrompt}"`,
          `Variation-Seed: ${seed}`,
          `Aktueller Story-Kontext: ${JSON.stringify(currentStory, null, 2)}`,
          `Neu zu schreibende Szene: ${normalizedSceneIndex + 1}`,
          `Aktueller Szenenentwurf: ${asNonEmptyString(sceneDraftPrompt) || currentScene.finalPrompt || currentScene.gifSpecification}`,
          'Schreibe fuer diese Szene eine neue, deutlich andere und weiterfuehrende Version innerhalb derselben Story-Welt. Gib nur JSON zurueck.',
        ].join('\n\n');

        const result = await foundryGenerateText(
          modelInput,
          systemInstruction,
          asNonEmptyString(model) || undefined,
        );

        const rawScene = parseJsonObjectFromModelText(result.text);
        const scene = sanitizeStoryboardSceneRewrite(rawScene, currentScene, {
          preset,
          sourcePrompt: storyboardPrompt,
          storyArcMode: selectedArcMode,
        });

        return res.json({
          success: true,
          scope: 'scene',
          model: result.model,
          scene,
          ...(result.usage ? { usage: result.usage } : {}),
          debug: {
            storyboardPrompt: storyboardPromptDebug,
            systemInstruction,
            modelInput,
          },
        });
      }

      const systemInstruction = [
        baseInstruction,
        'REGENERATIONS-MODUS: Du schreibst eine neue Folge oder eine klar weitergefuehrte alternative Viererszene innerhalb derselben Story-Welt.',
        '- Jede Neu-Schreibung muss neue Bilder, neue Ereignisse und neue gifSpecifications liefern.',
        '- Fuehre die Geschichte ueber den vorhandenen Stand hinaus oder biege sie in eine frische Richtung, ohne die bisherige Folge nur zu paraphrasieren.',
        '- Halte Weltlogik, Figuren und Ton konsistent, aber mache die Szenen klar anders und weiter.',
        '- Antworte ausschliesslich mit JSON im Storyboard-Schema.',
      ].join('\n\n');

      const modelInput = [
        `Basisidee: "${storyboardPrompt}"`,
        `Variation-Seed: ${seed}`,
        `Bisherige Story als Kontext: ${JSON.stringify(currentStory, null, 2)}`,
        'Schreibe jetzt eine neue, fortlaufende oder alternative Viererszene mit neuen Storyboard-Prompts. Gib nur JSON zurueck.',
      ].join('\n\n');

      const result = await foundryGenerateText(
        modelInput,
        systemInstruction,
        asNonEmptyString(model) || undefined,
      );

      const rawStoryboard = parseJsonObjectFromModelText(result.text);
      const story = sanitizeStoryboard(rawStoryboard, preset, storyboardPrompt, selectedArcMode);

      return res.json({
        success: true,
        scope: 'story',
        model: result.model,
        story,
        ...(result.usage ? { usage: result.usage } : {}),
        debug: {
          storyboardPrompt: storyboardPromptDebug,
          systemInstruction,
          modelInput,
        },
      });
    } catch (error) {
      console.error('Foundry storyboard Regeneration Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry Story-Regeneration fehlgeschlagen') });
    }
  });

  router.post('/api/foundry/sketch', async (req, res) => {
    try {
      const { characterIds, currentSketch, model, variationSeed } = req.body || {};
      const requestedCharacterIds = Array.isArray(characterIds)
        ? characterIds
          .map((value) => asNonEmptyString(value))
          .filter((value): value is string => !!value)
        : [];

      const fallbackCharacterIds = Array.isArray(currentSketch?.characterIds)
        ? currentSketch.characterIds
          .map((value: unknown) => asNonEmptyString(value))
          .filter((value: string | null): value is string => !!value)
        : [];

      const normalizedCharacterIds = Array.from(new Set([
        ...requestedCharacterIds,
        ...fallbackCharacterIds,
        ...ARV_CHARACTERS.map((character) => character.id),
      ]))
        .filter((characterId) => ARV_CHARACTERS.some((character) => character.id === characterId))
        .slice(0, 2);

      if (normalizedCharacterIds.length < 2) {
        return res.status(400).json({ error: 'Mindestens zwei gueltige ARV-Charaktere sind erforderlich.' });
      }

      const selectedCharacters = normalizedCharacterIds
        .map((characterId) => getCharacter(characterId))
        .filter((character): character is NonNullable<ReturnType<typeof getCharacter>> => !!character);

      if (selectedCharacters.length < 2) {
        return res.status(400).json({ error: 'Die gewaehlten ARV-Charaktere konnten nicht geladen werden.' });
      }

      const seed = asNonEmptyString(variationSeed) || `${Date.now()}`;
      const priorSketch = currentSketch && typeof currentSketch === 'object'
        ? currentSketch as Partial<ARVSatireSketch>
        : null;

      const systemInstruction = [
        'Du schreibst einen neuen ARV Satire Sketch auf Deutsch.',
        'Der Sketch soll gruendlich ausgearbeitet sein: klares Setting, deutlicher satirischer Fokus, steigende Absurditaet, saubere Eskalation und trockene Nicht-Aufloesung.',
        'Nutze exakt die vorgegebenen Figuren mit ihrer eigenen Stimme, ihren Eigenheiten und ihren Verhaltensregeln.',
        'Schreibe 8 bis 12 Dialogzeilen. Jede Zeile muss substanziell neu formuliert sein und die Szene weitertragen.',
        'Wenn ein bisheriger Sketch als Kontext mitgeschickt wird, schreibe bewusst eine neue, klar andere Version mit neuer Situation, neuer Argumentationsbewegung und neuen Pointen. Keine Paraphrase.',
        'Antworte ausschliesslich mit JSON in diesem Format: {"title":"...","setting":"...","satireTarget":"...","dialogue":[{"characterId":"...","line":"..."}],"conclusion":"..."}.',
      ].join('\n\n');

      const result = await foundryGenerateText(
        [
          `Variation-Seed: ${seed}`,
          `Gewaehlte Figuren: ${selectedCharacters.map((character) => `${character.name} (${character.id})`).join(', ')}`,
          'Figurenprofil:',
          ...selectedCharacters.map((character) => [
            `${character.name} (${character.id})`,
            `Designation: ${character.designation}`,
            `Voice: ${character.voice}`,
            `Satire-Ziel: ${character.satireTarget}`,
            `Verhaltensregeln: ${character.behaviorRules.join(' | ')}`,
            `Signalvokabular: ${character.vocabulary.slice(0, 8).join(' | ')}`,
            `Sprechformat: ${character.transmissionStyle}`,
          ].join('\n')),
          priorSketch
            ? `Bisheriger Sketch als Kontrastkontext (nicht paraphrasieren): ${JSON.stringify(priorSketch, null, 2)}`
            : 'Es liegt noch kein vorheriger Sketch vor. Schreibe eine vollstaendig neue Szene.',
          'Schreibe jetzt einen neuen, gruendlich ausgearbeiteten ARV-Satire-Sketch, der dieselbe Figurenwelt nutzt, aber frische satirische Dynamik und neue Dialoge bringt. Gib nur JSON zurueck.',
        ].join('\n\n'),
        systemInstruction,
        asNonEmptyString(model) || undefined,
      );

      const rawSketch = parseJsonObjectFromModelText(result.text);
      const sketch = sanitizeSatireSketch(rawSketch, {
        characterIds: normalizedCharacterIds,
        characterLabels: Object.fromEntries(selectedCharacters.map((character) => [character.id, character.name])),
        previousSketch: priorSketch,
      });

      return res.json({
        success: true,
        model: result.model,
        sketch,
        ...(result.usage ? { usage: result.usage } : {}),
      });
    } catch (error) {
      console.error('Foundry sketch Fehler:', error);
      return res.status(500).json({ error: toErrorMessage(error, 'Foundry Sketch-Generierung fehlgeschlagen') });
    }
  });

  router.get('/api/foundry/status', (_req, res) => {
    const hasEndpoint = !!process.env.AZURE_AI_FOUNDRY_ENDPOINT;
    const hasKey = !!process.env.AZURE_AI_FOUNDRY_KEY;
    const model = process.env.AZURE_AI_FOUNDRY_MODEL || 'Phi-4';
    const hasAzureOpenAI =
      !!process.env.AZURE_OPENAI_ENDPOINT && !!process.env.AZURE_OPENAI_KEY;

    return res.json({
      configured: hasEndpoint && hasKey,
      hasEndpoint,
      hasKey,
      defaultModel: model,
      video: {
        configured: hasAzureOpenAI,
        deployment: process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT || 'sora-2',
      },
    });
  });

  router.post('/api/foundry/image', async (req, res) => {
    try {
      const { prompt, model, size, quality } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);

      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const result = await foundryImageGenerate({
        prompt: userPrompt,
        model: asNonEmptyString(model) || undefined,
        size: asNonEmptyString(size) || undefined,
        quality: quality === 'low' || quality === 'medium' || quality === 'high' || quality === 'auto'
          ? quality
          : quality === 'hd'
            ? 'high'
            : 'auto',
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Foundry image Fehler:', error);
      return res.status(500).json({
        error: toErrorMessage(error, 'Foundry Bildgenerierung fehlgeschlagen'),
      });
    }
  });

  router.post('/api/foundry/video', async (req, res) => {
    try {
      const { prompt, presetId, deployment, size, seconds } = req.body || {};
      const userPrompt = asNonEmptyString(prompt);
      const remixVideoId = asNonEmptyString(req.body?.remixVideoId);
      const videoTransform = remixVideoId
        ? (req.body?.videoTransform === 'extend' ? 'extend' : 'remix')
        : null;

      if (!userPrompt) {
        return res.status(400).json({ error: 'prompt ist erforderlich.' });
      }

      const selectedDeployment =
        asNonEmptyString(deployment) ||
        process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT ||
        'sora-2';

      const preset = asNonEmptyString(presetId)
        ? (PRESETS.find((entry) => entry.id === presetId) ?? null)
        : null;
      const promptCore = extractPromptCore(userPrompt) || userPrompt;
      const iqContext = mergeIQSceneContext({
        mode: 'story',
        renderTarget: 'video',
        purpose: videoTransform ?? 'create',
        prompt: promptCore,
        presetId: preset?.id ?? null,
        presetName: preset?.name ?? null,
        stylePresetIds: preset?.id ? [preset.id] : [],
        remixVideoId: remixVideoId ?? null,
      }, req.body?.iqContext);
      const iqBrief = await resolveIQBrief(iqContext);
      const finalPrompt = withStyleTaste(promptCore, {
        preset,
        userStyleContext: iqBrief?.promptBlock ?? null,
      });
      const debug = {
        rawPrompt: userPrompt,
        cleanedPrompt: promptCore,
        finalPrompt,
        presetId: preset?.id ?? null,
        renderMode: videoTransform ?? 'create',
        sourceVideoId: remixVideoId ?? null,
        iqBrief: normalizeIQBriefForDebug(iqBrief),
      };
      const requestedSize = asNonEmptyString(size) || '1280x720';
      const requestedSeconds = normalizeSoraVideoSeconds(seconds);

      let job = videoTransform === 'extend'
        ? await foundryVideoExtend({
            prompt: finalPrompt,
            videoId: remixVideoId!,
            seconds: requestedSeconds,
          })
        : videoTransform === 'remix'
          ? await foundryVideoEdit({
              prompt: finalPrompt,
              videoId: remixVideoId!,
            })
          : await foundryVideoCreate({
            prompt: finalPrompt,
            deployment: selectedDeployment,
            size: requestedSize,
            seconds: requestedSeconds,
          });

      if (!job.id) {
        throw new Error('Azure OpenAI Sora lieferte keine Job-ID zurück.');
      }

      const startedAt = Date.now();

      while (Date.now() - startedAt < FOUNDRY_VIDEO_MAX_WAIT_MS) {
        const status = job.status;

        if (VIDEO_FAILURE_STATUSES.has(status)) {
          return res.status(500).json({
            error: job.error || 'Azure OpenAI Sora Videogenerierung fehlgeschlagen.',
            status,
            videoId: job.id,
            jobId: job.id,
          });
        }

        if (VIDEO_SUCCESS_STATUSES.has(status)) {
          const resolvedVideoId = job.videoId || job.id;

          if (job.videoUrl) {
            return res.json({
              success: true,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoUrl: job.videoUrl,
              deployment: selectedDeployment,
              seconds: requestedSeconds,
              size: requestedSize,
              debug: {
                ...debug,
                resultVideoId: resolvedVideoId,
              },
            });
          }

          try {
            const videoBase64 = await foundryVideoDownload(job.id, selectedDeployment);
            return res.json({
              success: true,
              videoId: resolvedVideoId,
              jobId: job.id,
              status,
              videoBase64,
              deployment: selectedDeployment,
              seconds: requestedSeconds,
              size: requestedSize,
              debug: {
                ...debug,
                resultVideoId: resolvedVideoId,
              },
            });
          } catch {
            await sleep(FOUNDRY_VIDEO_POLL_INTERVAL_MS);
            job = await foundryVideoRetrieve(job.id, selectedDeployment);
            continue;
          }
        }

        await sleep(FOUNDRY_VIDEO_POLL_INTERVAL_MS);
        job = await foundryVideoRetrieve(job.id, selectedDeployment);
      }

      return res.status(504).json({
        error: 'Azure OpenAI Sora Timeout. Bitte mit kürzerem Prompt erneut versuchen.',
        videoId: job.id,
        jobId: job.id,
      });
    } catch (error) {
      console.error('Foundry video Fehler:', error);
      return res.status(500).json({
        error: toErrorMessage(error, 'Foundry Videogenerierung fehlgeschlagen'),
      });
    }
  });

  router.get('/api/foundry/video/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const deployment =
        asNonEmptyString(req.query.deployment as string) ||
        process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT ||
        'sora-2';

      const job = await foundryVideoRetrieve(jobId, deployment);
      return res.json({ success: true, ...job });
    } catch (error) {
      console.error('Foundry video status Fehler:', error);
      return res.status(500).json({
        error: toErrorMessage(error, 'Video-Status-Abruf fehlgeschlagen'),
      });
    }
  });

  return router;
};