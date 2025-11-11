## Setup

- Clone this repository
- Run `npm run sync:mods` to bring submodules
- Run `npm install` to install all dependencies
- Configure the service in `.env` and run `npm start`

## Maintain

- Run `npm run sync:mods` to sync with ejs
- Run `npm run sync:deps` to bring any new dependencies from ejs
- Run `npm run build` to build and ensure changes were compatible
- The built file would be under `lib`
