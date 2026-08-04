import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  out: './src/infrastructure/database/product/migrations',
  schema: './src/infrastructure/database/product/schema/index.ts'
});
