# Contributing to VividHanzi

Thanks for wanting to help. Bug reports, ideas, data corrections and pull
requests are all welcome.

## Reporting a bug or suggesting an idea

Open an [issue](https://github.com/ItsCogo-lab/VividHanzi/issues). For a bug,
say what you did, what you expected and what happened, plus your browser and
device. A screenshot helps a lot.

Wrong meaning or pinyin? Mention the word and where you saw it. The data comes
from open sources, so the fix usually goes in the dataset script rather than
in the generated files (see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)).

## Setting up

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # types + lint + tests, the same as CI
```

Accounts are optional: without a Supabase project the app works with
localStorage only. See [`docs/ACCOUNTS.md`](docs/ACCOUNTS.md).

## Conventions

- **Keep it simple.** Prefer a plain solution over a clever one and avoid new
  dependencies unless they clearly pay for themselves.
- **Logic outside components.** Rules (exercises, spaced repetition, progress)
  are plain TypeScript functions with unit tests next to them.
- **English everywhere** in code, comments, docs, commits and pull requests.
  Interface texts go through `t()` in `src/i18n/`.
- **No hand-written linguistic data.** Generated files in `src/data/`,
  `public/strokes/` and `public/examples/` come from `npm run data:build`.
- **Small, focused commits** with a clear message.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change and add or update tests for any logic you touch.
3. Run `npm run check` and make sure it passes.
4. Open a pull request describing what changes for the user and why.

## License of contributions

By submitting a contribution, you agree that it is licensed under the
[MIT License](LICENSE) of this project and that the maintainer may also
include it in future versions of VividHanzi released under a different
license.
