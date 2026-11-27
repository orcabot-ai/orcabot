# Whale environment generation

Source: Gemini web image generation, [Cinematic Blue Whale Hero Image](https://gemini.google.com/app/89d4ef2f2b44be20).
Generated on November 27, 2026 (Asia/Shanghai). The downloaded generated artwork is
`whale-original.jpg`, originally `Gemini_Generated_Image_8ybeqk8ybeqk8ybe.jpeg`.
This is AI-generated photographic-style artwork, not a wildlife photograph or a
scientific illustration. It is an image asset, not a pre-rendered website screenshot.
No user data, keys, conversation transcripts or source files were uploaded.

The first result was inspected, then refined for animal shape, scale and open
water. The selected full-size download was inspected before implementation.
Responsive WebP files and a JPEG fallback preserve the original composition;
no replacement logo or code-drawn whale was used. The original Orcabot mark
remains a separate small identity element.

## Initial prompt (verbatim)

Generate an actual high-resolution square hero IMAGE asset for Orcabot, a personal AI assistant that quietly carries entrusted tasks across connected machines and returns useful results. This is an image-generation request: return the generated picture, not HTML, a wireframe, a logo, or a webpage screenshot.

Art direction: a cinematic, believable split-level ocean photograph. A calm real blue whale swims diagonally through luminous deep cobalt and clear turquoise water, fully visible at a natural moderate scale, around 40–50% of the image width. Above the waterline: an expansive pale blue sky, soft clouds and warm sunlight. Below: nuanced natural whale skin, caustics, depth and clean flowing water. Let a few very fine cyan light particles follow a coherent current around and behind the whale—an understated suggestion of perception, connected tasks and quiet intelligence. The emotion is a capable, reassuring companion and freedom from checking on work.

Composition: generous environmental space; whale centered slightly below the middle, head and tail comfortably inside the frame. Calm upper-left sky for a small separately rendered brand mark; brighter luminous center, deeper blue near lower edges. Art-directed editorial photographic realism with restrained futuristic detail. Full bleed, rich tonal depth, natural anatomy.

Do not draw a whale logo, icon, cartoon mascot, rounded-card dashboard, UI controls, typography, watermark, literal neural-network grid, screens, flying whales, whales in clouds, plastic 3D rendering or giant close-up whale. No text anywhere. Produce the picture now.

## Refinement prompt (verbatim)

Refine the generated image once, keeping the split-level sea, blue sky, beautiful lighting and subtle light currents. The animal currently resembles a humpback: replace it with a correctly proportioned BLUE WHALE—long streamlined mottled blue-gray body, flatter narrow smooth head without knobby tubercles, shorter pectoral fins, tiny low dorsal fin far back. Move the camera farther away so the entire whale occupies only about half of the picture width, with ample open ocean around it and no cropped tail. Keep the subject slightly below center so it survives desktop and mobile cover crops. It should feel like a quiet capable companion in an expansive environment, not a giant animal filling the frame. No text, logo or UI. Generate the refined actual image now.

## Shipping derivatives

- `/scenes/whale-ocean-1600.webp`: 1600px, WebP quality84.
- `/scenes/whale-ocean-960.webp`: 960px, WebP quality82.
- `/scenes/whale-ocean-1600.jpg`: 1600px, JPEG fallback quality82.

The image is delivered as a client-rendered `<picture>` / `<img>` with
`fetchPriority="high"`, eager loading, explicit dimensions and a responsive source
list. The entry appears after the existing workspace query; the picture is not
discoverable in the initial HTML shell. No route-global preload is added to unrelated
workbench pages.
Unsupported WebP falls back to JPEG. No unmeasured LCP score is claimed.
