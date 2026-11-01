# Click Black

A front-end-only recreation of the White Tile 2 mode shown in the supplied donttap.com gameplay video. Plain HTML, CSS, and JavaScript: no backend, external assets, frameworks, or runtime dependencies.

## Play

- Tap any of the three black tiles in the fixed 4×4 grid. Each hit adds one point and creates a new black tile elsewhere.
- Start with 10 seconds. Every 40 correct taps adds another 10 seconds to the remaining time.
- Tapping white or running out of time ends the run.
- Your eight best scores are saved in this browser using localStorage. No account or network connection is needed while playing.

Mouse and touch are supported. Keyboard rows are `1 2 3 4`, `Q W E R`, `A S D F`, and `Z X C V`. Press Enter on Play / Play again to start, or Escape during the countdown to return to the menu. Optional synthesized sound starts muted, with six random pitches for successful taps, no consecutive repeats, and a volume slider beside the sound toggle. The timer keeps running when the tab is in the background.

## Local development

Install Node.js 22 or newer, then run:

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. There are no dependencies to install. `npm run dev` is equivalent when npm is available.

```sh
node --test
node scripts/build.mjs
```

The build copies only public game assets into `dist/`. Relative asset URLs support both a domain root and a GitHub Pages repository path such as `/click-black/`.

## GitHub Pages

The included `.github/workflows/pages.yml` tests, builds, and deploys pushes to `main`. Pull requests run tests and build without deploying.

1. In the repository's **Settings → Pages**, choose **GitHub Actions** as the source.
2. Push to `main`, or run **Deploy to GitHub Pages** from the Actions tab.
3. The expected URL for this repository is https://kihiralove.github.io/click-black/.

The workflow uses GitHub's built-in Pages authentication. No secrets or backend services are required. Alternatively, the root files can be served directly by any static host.

## Project structure

- `src/game.js`: pure tile, score, and deadline rules.
- `src/app.js`: rendering, input, audio, countdown, and results.
- `src/scores.js`: validation and local score persistence.
- `test/game.test.js`: deterministic rule and persistence tests using Node's built-in test runner.

The supplied video is reference material and is not included in the published site. This is an independent recreation; it does not include the original site's code, branding illustrations, social integrations, or score data. The bonus-time rule is inferred from the video's “10 seconds for every 40 taps” instruction; the recorded runs do not reach that threshold.
