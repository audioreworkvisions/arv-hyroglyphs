<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8caab209-84f2-4639-bb6e-d5b8cb0b4a95

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure your keys in [.env.local](.env.local):
   - `API_KEY` for Gemini Veo / story generation
   - `FAL_KEY` for Wan 2.2 (Fal AI)
   - `OPENAI_API_KEY` for OpenAI text, image, and video endpoints
   - Optional model overrides: `OPENAI_TEXT_MODEL`, `OPENAI_STORYBOARD_MODEL`, `OPENAI_IMAGE_MODEL`, `OPENAI_VIDEO_MODEL`
3. Run the app:
   `npm run dev`

## OpenAI Integration

The app includes server-backed OpenAI endpoints using the official OpenAI Node SDK:

- `POST /api/openai/text` for text generation / prompt refinement
- `POST /api/openai/storyboard` for multi-scene storyboard generation
- `POST /api/openai/image` for image generation
- `POST /api/openai/video` for video generation (polled until terminal state)

In the UI you can use:

- `OpenAI Tools` in Single mode for prompt refinement and image generation
- `OpenAI Video` as a video model option in Single mode
- In Story mode, choose storyboard engine (`Gemini` or `OpenAI`) independently from the video model (`Veo`, `Wan`, `OpenAI Video`)
