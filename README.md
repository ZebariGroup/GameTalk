# Minevine

Minevine is a fun, safe, and easy-to-use audio chat app designed specifically for kids playing games like Minecraft and Roblox.

## Features
- **Safe Audio Chat**: Kids can join rooms with short, fun codes.
- **Mom Mode**: Parents can join as invisible observers to monitor the chat.
- **Voice Changer**: Fun voice effects like Robot, Cave, Radio, Chipmunk, Monster, and Alien.
- **Reactions & stickers**: Send emojis and floating stickers in the room.
- **Minigames**: Play word guess games while chatting.

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase project

### Database & security
Room rows and membership are accessed through **server API routes** using `SUPABASE_SERVICE_ROLE_KEY`. Apply all migrations under `supabase/migrations/` (including RLS hardening and `room_members`) so anonymous clients cannot read or insert `rooms` directly.

### Environment Variables
Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
```bash
cp .env.example .env.local
```

### Installation
```bash
npm install
# or
yarn install
# or
pnpm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Scripts
- `npm run dev`: Starts the development server.
- `npm run build`: Builds the app for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint.
- `npm run typecheck`: Runs TypeScript compiler check.
- `npm run test`: Runs unit tests (Vitest).

## Deployment
The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new).

Make sure to set the `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` environment variables in your deployment settings.
