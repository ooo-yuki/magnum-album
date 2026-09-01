# Gallery 42 — spec (P2-2, P2-6)
Source: src/pages/GalleryPage.tsx:1-2570

## Tokens
- see src/lib/galleryTokens.ts:1 — TOKENS (color/radius/shadow/motion/bp)
- motion entranceY 24 stagger 0.12 duration 0.55 ease power2.out — GalleryPage.tsx:791

## Archive
- 350 arts: ARCHIVE_42 210 + WAVE2 140 + BASE 7 = FULL_ARCHIVE — GalleryPage.tsx:180
- REAL_BY_STYLE 3 files map 4 styles — GalleryPage.tsx:31
- Fix soft-404: runtime loop src=REAL_BY_STYLE[style] — GalleryPage.tsx:785, now getRealSrc in galleryTokens.ts
- public/images/gallery-42/ — 6 real files: 42-agit-01.{jpg,800.webp} 42-cyber-01.{jpg,800.webp} 42-memphis-01.{jpg,800.webp}

## GSAP
- entrance y24 stagger 0.12 — GalleryPage.tsx:937
- hover y:-4 tri-shadow — GalleryPage.tsx:859
- lightbox scale 0.82→1 — GalleryPage.tsx:946
- prefers-reduced-motion gate — GalleryPage.tsx:473
- gsap.context cleanup — GalleryPage.tsx:528

## Filters
- 4 styles СССР/Y2K/киберпанк/мемфис + все — GalleryPage.tsx:14
- fixtures FIXTURE_EXPECTED_COUNTS все 350/88/88/87/87 — GalleryPage.tsx:851

## SEO
- GALLERY_SEO jsonLd CollectionPage 350 — GalleryPage.tsx:898

## Roadmap
- Generate unique 800.webp per arch id or use picsum fallback with onError gradient+emoji
- Add CI fs.existsSync check for every src
