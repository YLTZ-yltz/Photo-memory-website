// 简单的Vite配置
// 简化的Vite配置，确保GitHub Pages正确加载资源
export default {
  base: '/Photo-memory-website/',
  build: {
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
}