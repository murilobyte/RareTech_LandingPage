# Rare Tech — Landing Page

Single page estática, sem build step. HTML + CSS + JS puro.

## Estrutura

```
index.html                 markup e SEO (o logo do header é SVG inline, para trocar de cor por seção)
css/styles.css             tokens, layout, responsivo e reduced-motion
js/main.js                 Lenis + GSAP/ScrollTrigger
src/font/                  DM Sans variável (self-hosted)
src/svg/                   globo pixelado do hero (world.svg), wordmark do rodapé (logo2.svg)
                           e o favicon vetorial (favicon.svg)
favicon.ico                16/32/48px, gerado a partir de src/svg/favicon.svg
apple-touch-icon.png       180px sem alfa (o iOS aplica a própria máscara arredondada)
vercel.json                cleanUrls + cache dos assets
```

Os três formatos de ícone saem da mesma arte. Se `src/svg/favicon.svg` mudar, é preciso
regerar `favicon.ico` e `apple-touch-icon.png` — qualquer conversor de SVG para ICO/PNG serve.

`src/svg/logo1.svg` e `src/svg/card.svg` não são carregados em runtime — o logo do header
está inline no HTML e a forma entalhada do card é reproduzida com `clip-path`. Ficam no
repositório como fonte de design.

## Dependências

Só três, todas por CDN (nenhuma instalação, nenhum `node_modules`):

- GSAP 3.12.5 + ScrollTrigger — revelações, pin e scrub
- Lenis 1.1.18 — scroll suave

DM Mono vem do Google Fonts; DM Sans é self-hosted em `src/font/`.

## Rodar local

Precisa de um servidor HTTP — abrir via `file://` bloqueia a fonte self-hosted.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Deploy

### Git

```bash
git add -A
git commit -m "Landing page Rare Tech"
git remote add origin <URL-DO-SEU-REPO>
git push -u origin main
```

### Vercel

1. vercel.com → **Add New… → Project** → importe o repositório.
2. **Framework Preset: Other.** Build Command e Install Command vazios.
3. **Output Directory:** deixe em branco (a raiz já é o site).
4. Deploy.

Alternativa por CLI:

```bash
npx vercel --prod
```

## Comportamento garantido

- Sem scroll horizontal em 1440 / 1024 / 768 / 375.
- `prefers-reduced-motion: reduce` — sem preloader, cursor, pin ou scrub; tudo estático e legível.
- Sem JavaScript — todo o conteúdo continua visível; a faixa horizontal da seção 02 rola no gesto nativo.
- Preloader tem teto de 4,2s: se algo travar, ele sai sozinho.

## Onde mexer

| O quê | Onde |
|---|---|
| Cores, container, raios | `css/styles.css`, bloco `:root` |
| Número e mensagens do WhatsApp | `index.html`, `href` dos `.btn` |
| Perguntas e respostas do FAQ | `index.html`, `.faq-list` |
| Colunas da seção Processo | `index.html`, `.s2-cols` **e** o fallback `.s2-stack` (o conteúdo é duplicado: um para desktop com pin, outro para mobile) |
| Velocidade do preloader | `js/main.js`, `runPreloader()` |
