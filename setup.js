// 这个文件是项目初始化脚本，用来确保依赖正确安装
console.log('正在检查Three.js依赖...');
try {
  require.resolve('three');
  console.log('Three.js已正确安装');
} catch (e) {
  console.error('未找到Three.js，请执行 npm install');
  process.exit(1);
}
console.log('依赖检查完成，可以启动项目了'); 