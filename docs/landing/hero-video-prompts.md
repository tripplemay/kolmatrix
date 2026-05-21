# Hero Video Prompts — KolMatrix Landing Cinematic v2

These are 5 prompt candidates to feed into Runway Gen-3 / Kling / Pika /
(Sora if accessible). The goal: an 8-12 second seamless-loop background
video for the hero section.

## Visual brief (apply to all prompts)

- Aspect ratio: 16:9 (1920×1080 source, will be `object-cover` clipped
  at any screen size)
- Color palette: deep navy background (#0b1326-ish), electric cyan
  (#00E5FF) highlights, purple (#9D50FF) secondary accents
- Mood: cinematic, calm, technical, premium
- Constraints: no humans, no text overlays (we'll lay text on top in
  CSS), no audio, no logos, no fast cuts (the loop runs forever — fast
  cuts become epilepsy hazards), no faces, nothing trademarked
- Loop friendliness: end state should visually return to start state
  so the loop seam is invisible

## Prompt candidates

### 1. Data streams through a globe (most product-aligned)

> Cinematic shot, cyan and purple data streams flowing through a
> stylized 3D globe of Earth, neon highlights, dark space background
> with subtle stars, smooth 8-second seamless loop, 1920×1080, no text,
> no humans, no logos, gentle camera orbit.

### 2. Particle constellation forming a "K" mark (brand-tilted)

> Glowing cyan particles drifting in dark space, slowly converging
> into the abstract silhouette of a stylized letter "K", then
> dispersing back; purple particles in the background; 8-second loop,
> 1920×1080, no text, dark navy backdrop, premium tech feel.

### 3. Neural network nodes pulsing (most "AI" feeling)

> Abstract neural network: glowing cyan nodes connected by thin lines,
> nodes pulse rhythmically with cyan and purple light traveling along
> the connections, dark navy background with subtle grid, smooth
> 10-second seamless loop, 1920×1080, no text, no humans.

### 4. Liquid metal mesh (most "Apple Pro" feeling)

> Cinematic shot of fluid metallic liquid in deep navy and cyan,
> rippling slowly, surface reflects subtle purple highlights, shallow
> depth of field, very smooth 8-second seamless loop, 1920×1080, no
> text, no humans, premium luxury feel.

### 5. Geometric shapes morphing (most "Apple iPhone" feeling)

> Abstract geometric shapes (cubes, spheres, tori) in dark navy with
> cyan and purple gradient lighting, slowly rotating and morphing into
> one another against a deep space background, soft volumetric light,
> 10-second seamless loop, 1920×1080, no text, no humans.

## Deliverables

After picking the best clip(s), encode three files into
`public/landing/hero/`:

| File | Format | Spec |
|---|---|---|
| `hero-loop.mp4` | H.264, yuv420p | ≤8 MB, 8-12 s loop |
| `hero-loop.webm` | VP9 | ≤6 MB, same 8-12 s loop |
| `hero-poster.jpg` | JPEG q80 | First frame of the loop, ≤200 KB |

### Encoding cheatsheet (ffmpeg)

If your AI-generated output is a single .mp4, derive the other two
with:

```bash
# WebM (VP9, faster decoding in Chrome / Firefox)
ffmpeg -i hero-source.mp4 -c:v libvpx-vp9 -b:v 1.5M -an hero-loop.webm

# Re-encode mp4 with size cap
ffmpeg -i hero-source.mp4 -c:v libx264 -crf 26 -preset slow -an -movflags +faststart hero-loop.mp4

# Poster (first frame)
ffmpeg -i hero-source.mp4 -vframes 1 -q:v 4 hero-poster.jpg
```

Verify each is under cap before committing:

```bash
ls -lh public/landing/hero/
```

## Iteration log

Add a row each time you try a prompt:

| Date | Prompt # | Tool | Cost | Result |
|---|---|---|---|---|
|     |          |      |      |        |
