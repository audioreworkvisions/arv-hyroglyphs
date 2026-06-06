---
category: reference
tags: [runtime, iq-context, foundry-iq, schema]
---

# IQ Runtime Context Examples

## Stillframe Create

```json
{
  "mode": "stillframe",
  "renderTarget": "video",
  "purpose": "create",
  "storyTitle": "Xerox Ritual Boogie",
  "sceneTitle": "Wet Copy Body",
  "sceneBeat": "Formgebung aus dem Nichts",
  "prompt": "central black electro-boogie silhouette inside vertical amber window",
  "motion": "one minimal shoulder twitch triggers cyan-magenta misregistered copies",
  "stylePresetIds": ["arv-xerox-ritual-boogie", "arv-stillframe-nocturne"],
  "referenceStyleSummary": "damaged photocopy on black paper, cyan scanner band, magenta copies, hard freeze",
  "continuityNotes": "keep one dominant subject, dark uncluttered background, loop-ready end pose"
}
```

## Remix

```json
{
  "mode": "stillframe",
  "renderTarget": "video",
  "purpose": "remix",
  "storyTitle": "Cyber Monk Street Mural",
  "sceneBeat": "Signal findet Lock",
  "prompt": "dark cyber monk fused with playful graffiti creature mural",
  "referenceStyleSummary": "hooded figure, red-cyan halo, cartoon wall fragments, dark cinematic texture",
  "continuityNotes": "preserve monk as main anchor, keep graffiti secondary, avoid overcrowding"
}
```

## Extend

```json
{
  "mode": "story",
  "renderTarget": "video",
  "purpose": "extend",
  "storyTitle": "Rave Archaeology",
  "sceneIndex": 2,
  "sceneBeat": "Archiv erwacht",
  "prompt": "one cartoon desert rave relic comes alive for one micro gesture",
  "continuityNotes": "same mural texture, same sunset palette, introduce only one new motion mechanism"
}
```
