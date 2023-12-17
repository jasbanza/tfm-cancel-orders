# tfm-cancel-orders

#### dApp to cancel missing limit orders on TFM - https://pro.osmosis.zone/

#### 👉 **[click here to use the dApp](https://jasbanza.github.io/tfm-cancel-orders/)**

_📌 don't forget to bookmark!_

### Features:

- Pull list of open orders
- Cancel specific order
- ✅ Keplr
- ✅ Ledger

## Custom Hosting:

Everything in the ./dist folder is ready to be hosted on a web server. Simply copy and paste and it should work.

## Development Setup

#### Install project and dev dependencies:

```bash
npm install
```

#### For development:

```bash
npm run dev
```

- Deploys a localhost HTTP server ()
- Monitors JS, CSS & HTML and bundles changes (outputs to ./preview which is included in .gitignore)

#### Compile:

```bash
npm run compile
```

- Bundles js for browser, outputs to:

  - ./dist (included in .gitignore)
  - ./docs (use for github pages)
