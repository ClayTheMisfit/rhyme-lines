import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generate/validate/build need no database. Migration commands require this URL.
  datasource: { url: process.env.DATABASE_URL },
})
