## Setup

- Clone this repository
- Run `git config submodule.recurse true`
- Run `git pull` to clone the ejs subdmodule
- Run `npm install` to install all dependencies
- Configure the service in `.env`

## Maintain

- A workflow keeps the branch up-to-date
- You can run `git submodule update --remote` to update manually
- Run `npm run sync:deps` after update to sync all dependencies
- Run `npm run build` to build and ensure changes were compatible
- The built files would be under `lib`
