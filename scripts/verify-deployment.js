// 部署验证脚本 - 检查构建输出
const fs = require('fs');
const path = require('path');

console.log('🔍 验证部署配置...\n');

// 检查关键文件
const checks = [
  { path: 'frontend/out/index.html', name: '主页HTML' },
  { path: 'frontend/out/_next', name: 'Next.js资源目录' },
  { path: 'vercel.json', name: 'Vercel配置' },
  { path: 'frontend/next.config.mjs', name: 'Next.js配置' },
  { path: 'scripts/build-worker.js', name: 'Worker构建脚本' },
  { path: 'frontend/src/lib/workers/workerFactory.ts', name: 'Worker工厂' },
  { path: 'frontend/src/lib/workers/inlineWorkerCode.generated.ts', name: '内联Worker代码' }
];

let allPassed = true;

checks.forEach(check => {
  const fullPath = path.join(__dirname, '..', check.path);
  const exists = fs.existsSync(fullPath);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${check.path}`);
  if (!exists) allPassed = false;
});

console.log('\n📊 验证结果:');
if (allPassed) {
  console.log('✅ 所有检查通过！部署配置正确。');
  console.log('\n📝 部署说明:');
  console.log('1. Vercel部署: 连接GitHub仓库，Vercel会自动检测配置');
  console.log('2. GitHub Pages: 使用 frontend/out 目录作为静态站点');
  console.log('3. 本地测试: npm run dev (开发) 或 npm run build (生产)');
  process.exit(0);
} else {
  console.log('❌ 部分检查失败！请先运行 npm run build');
  process.exit(1);
}
