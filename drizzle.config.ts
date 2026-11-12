import { defineConfig } from 'drizzle-kit'
import { mkdirSync } from 'node:fs'

mkdirSync('data', { recursive: true })

export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: './data/app.db',
  },
})
