# api-gentag

![og_image_v2](https://user-images.githubusercontent.com/9079480/161362800-deb39a89-c579-4c8f-a19a-f274d5246405.png)

This is the source code repository for the GenTag back-end web API.

## Requirements

- Node.js v18 LTS+
- PNPM package manager `(npm i -g pnpm)`

## Setup

- Create an `.env` file and configure based on `.env.example`
- You will need to configure your own `/resources` folder. Copy the `/resources_example` folder, rename it to `/resources`, and edit to your requirements.
- Install dependencies with `pnpm i`
- Build with `pnpm build`
- Start with `node dist/index.js`
