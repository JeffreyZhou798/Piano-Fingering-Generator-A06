// 构建脚本 - 自动提取Worker代码为内联版本
const fs = require('fs');
const path = require('path');

console.log('🔨 Building inline Worker code...');

// 读取Worker文件
const workerPath = path.join(__dirname, '../frontend/src/workers/dynaQ.worker.ts');
let workerCode = fs.readFileSync(workerPath, 'utf-8');

// 读取依赖文件
const dynaQPath = path.join(__dirname, '../frontend/src/lib/algorithm/dynaQ.ts');
const typesPath = path.join(__dirname, '../frontend/src/lib/algorithm/types.ts');
const mdpPath = path.join(__dirname, '../frontend/src/lib/algorithm/mdp.ts');
const constPath = path.join(__dirname, '../frontend/src/lib/algorithm/const.ts');

const dynaQCode = fs.readFileSync(dynaQPath, 'utf-8');
const typesCode = fs.readFileSync(typesPath, 'utf-8');
const mdpCode = fs.readFileSync(mdpPath, 'utf-8');
const constCode = fs.readFileSync(constPath, 'utf-8');

// 移除import语句
const removeImports = (code) => {
  return code.replace(/^import\s+.+?;?\s*$/gm, '');
};

const cleanDynaQCode = removeImports(dynaQCode);
const cleanTypesCode = removeImports(typesCode);
const cleanMdpCode = removeImports(mdpCode);
const cleanConstCode = removeImports(constCode);
const cleanWorkerCode = removeImports(workerCode);

// 合并所有代码
const inlineCode = `
// ============================================
// Auto-generated inline Worker code
// DO NOT EDIT - Generated from multiple source files
// Build time: ${new Date().toISOString()}
// ============================================

// Types
${cleanTypesCode}

// Constants
${cleanConstCode}

// MDP
${cleanMdpCode}

// Dyna-Q Solver
${cleanDynaQCode}

// Worker Logic
${cleanWorkerCode}
`;

// 转义反引号和${}
const escapedCode = inlineCode
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\${/g, '\\${');

// 生成输出文件
const output = `// Auto-generated file - DO NOT EDIT
// Generated from: src/workers/dynaQ.worker.ts and dependencies
// Build time: ${new Date().toISOString()}

export const INLINE_WORKER_CODE = \`${escapedCode}\`;
`;

// 确保目录存在
const outputDir = path.join(__dirname, '../frontend/src/lib/workers');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 写入生成文件
const outputPath = path.join(outputDir, 'inlineWorkerCode.generated.ts');
fs.writeFileSync(outputPath, output);

console.log('✅ Inline Worker code generated successfully');
console.log(`   Output: ${outputPath}`);
console.log(`   Size: ${(output.length / 1024).toFixed(2)} KB`);
