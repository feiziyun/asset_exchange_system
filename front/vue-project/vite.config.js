import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => {
  // Vite does not put .env values in process.env while loading this file.
  // Read them explicitly so the proxy target is the same as the server config.
  const env = loadEnv(mode, process.cwd(), '')
  const shouldUseHttps = env.VITE_DEV_HTTPS !== '0'
  const sslKeyPath = env.VITE_SSL_KEY || '/home/super/ssl/server.key'
  const sslCertPath = env.VITE_SSL_CERT || '/home/super/ssl/server.crt'
  const backendBaseUrl =
    env.VITE_BACKEND_BASE_URL ||
    process.env.VITE_BACKEND_BASE_URL ||
    'http://127.0.0.1:3007'

  const httpsOptions = shouldUseHttps
    ? {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath),
      }
    : undefined

  const backendProxy = {
    target: backendBaseUrl,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('error', (error, request) => {
        console.error('[vite proxy] backend unavailable', {
          target: backendBaseUrl,
          method: request?.method,
          url: request?.url,
          code: error?.code,
          message: error?.message,
        })
      })
    },
  }
  const certificateProxy = {
    ...backendProxy,
    proxyTimeout: 35 * 60 * 1000,
    timeout: 35 * 60 * 1000,
  }
  const transactionSupervisionTarget = env.VITE_TRANSACTION_SUPERVISION_API_TARGET || ''

  return {
    plugins: [
      vue(),
      vueDevTools(),
      createSvgIconsPlugin({
        iconDirs: [resolve(process.cwd(), 'src/assets/svg')],
        symbolId: 'icon-[dir]-[name]',
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.VITE_DEV_HOST || process.env.VITE_DEV_HOST || '0.0.0.0',
      port: Number(env.VITE_DEV_PORT || process.env.VITE_DEV_PORT || 8082),
      open: false,
      cors: true,
      https: httpsOptions,
      proxy: {
        ...(transactionSupervisionTarget ? {
          '/api/transaction-supervision': {
            target: transactionSupervisionTarget,
            changeOrigin: true,
            secure: false,
          },
        } : {}),
        '/asset/certificate': certificateProxy,
        '/api': backendProxy,
        '/asset': backendProxy,
        '/userInfo': backendProxy,
        '/admin': backendProxy,
        '/audit': backendProxy,
      },
    },
  }
})
