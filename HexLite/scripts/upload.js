require('dotenv').config();
const fs = require('fs');
const path = require('path');
const COS = require('cos-nodejs-sdk-v5');
const glob = require('glob');
const { version } = require('../package.json');

// 1. 初始化 COS
const cos = new COS({
    SecretId: process.env.COS_SECRET_ID,
    SecretKey: process.env.COS_SECRET_KEY
});

const BUCKET = process.env.COS_BUCKET;
const REGION = process.env.COS_REGION;
const DIST_DIR = path.join(__dirname, '../release');

// 2. 定义上传函数
function uploadFile(filePath, key) {
    return new Promise((resolve, reject) => {
        const fileSize = fs.statSync(filePath).size;
        console.log(`🚀 开始上传: ${path.basename(filePath)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        cos.sliceUploadFile({
            Bucket: BUCKET,
            Region: REGION,
            Key: 'updates/' + key, // 上传到 updates 文件夹
            FilePath: filePath,
            onProgress: function (info) {
                const percent = parseInt(info.percent * 100);
                process.stdout.write(`   ⏳ 进度: ${percent}%\r`);
            }
        }, function (err, data) {
            if (err) {
                console.error(`\n❌ 上传失败: ${key}`, err);
                reject(err);
            } else {
                console.log(`\n✅ 上传成功: ${key}`);
                resolve(data);
            }
        });
    });
}

// 3. 执行主逻辑
(async () => {
    console.log(`\n📦 准备发布 HexLite v${version} 到腾讯云 COS...`);

    try {
        // 查找最新的 exe 文件 (因为版本号变了，文件名也会变)
        const exeFiles = glob.sync(`${DIST_DIR}/*.exe`);
        const ymlFiles = glob.sync(`${DIST_DIR}/latest.yml`);
        
        if (exeFiles.length === 0) throw new Error('未找到 .exe 文件，请先执行 npm run build');
        if (ymlFiles.length === 0) throw new Error('未找到 latest.yml 文件');

        // 这里的逻辑是：只上传最新的那个 exe 和 latest.yml
        // 如果你 dist 里有很多旧文件，建议每次打包前清理一下 dist
        const latestExe = exeFiles[0]; 
        const latestYml = ymlFiles[0];

        // 上传 .exe
        await uploadFile(latestExe, path.basename(latestExe));
        
        // 上传 latest.yml (这个必须最后传，或者传完立刻刷新缓存)
        await uploadFile(latestYml, 'latest.yml');

        console.log(`\n🎉🎉🎉 自动发布完成！用户重启软件即可检测到 v${version}`);

    } catch (error) {
        console.error('\n💥 发布过程中止:', error.message);
        process.exit(1);
    }
})();