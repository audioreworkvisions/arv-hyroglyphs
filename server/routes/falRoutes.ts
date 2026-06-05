import { Router } from 'express';
import { fal } from '@fal-ai/client';
import { extractPromptCore, withStyleTaste } from '../../lib/styleTaste';

export const createFalRoutes = () => {
  const router = Router();

  router.post('/api/generate-fal-video', async (req, res) => {
    try {
      const { prompt, model } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const falKey = process.env.FAL_KEY;
      if (!falKey) {
        return res.status(400).json({ error: 'FAL_KEY environment variable is missing. Please add it to your environment.' });
      }

      fal.config({
        credentials: falKey,
      });

      let endpoint = 'fal-ai/wan/v2.2-5b/text-to-video/fast-wan';
      if (model === 'pixverse') endpoint = 'fal-ai/pixverse/v5.5/text-to-video';
      if (model === 'kling') endpoint = 'fal-ai/kling-video/v3/standard/text-to-video';
      if (model === 'vidu') endpoint = 'fal-ai/vidu/q3/text-to-video';

      const finalPrompt = withStyleTaste(extractPromptCore(prompt) || prompt);

      console.log(`Generating video with Fal AI (${model || 'wan'})... Prompt: ${finalPrompt.substring(0, 50)}...`);

      const result = await fal.subscribe(endpoint as any, {
        input: {
          prompt: finalPrompt,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });

      console.log('Fal AI generation finished.');

      const falData = result.data as any;
      const videoUrl = falData?.video?.url || falData?.url;

      if (!videoUrl) {
        throw new Error('Video URL not found in Fal AI response.');
      }

      return res.json({ success: true, videoUrl });
    } catch (error: any) {
      console.error('Error generating video with Fal AI:', error);
      let errorMessage = error.message || 'An error occurred during Fal AI generation';
      if (error.status === 403 || errorMessage.includes('Forbidden')) {
        errorMessage = 'Fal AI API Key is invalid or unauthorized. Please check your FAL_KEY in the settings and ensure your account is active/has credits.';
      }
      return res.status(500).json({ error: errorMessage });
    }
  });

  return router;
};