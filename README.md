# Happy Dance Party 3D — AHOU 四果冰版

3D 卡通多人公开舞池，基于 Three.js + Socket.IO。

## 功能
- 仅公开房间；每间最多 30 人，满员自动创建下一间公开房间
- 3D 舞池、DJ 台、灯光、音响、镜面球和 AHOU 四果冰摊位、Miuing 婚介公司摊位
- 多人实时移动、玩家列表、实时聊天
- 12 种舞蹈动作：蹦蹦跳、转圈圈、挥手、摇摆舞、比爱心、拍手、太空步、机械舞、街舞、高跳、欢呼、休息
- 人物换装：服装颜色、4 种发型、4 种肤色、4 种服装款式、皇冠/眼镜/耳机
- 原创 Web Audio 合成电子舞曲，点击播放后启动，可调音量
- 电脑键盘和手机摇杆操作；拖动画面旋转视角，滚轮缩放

## 部署（Render Web Service）
- Build Command: `npm install`
- Start Command: `npm start`
- Node.js 18 或更新版本

Three.js 由 Node 服务从本项目安装的依赖本地提供，不需要玩家浏览器访问第三方 CDN。

## 更新
把本压缩包中的 `server.js`、`package.json`、`README.md` 和整个 `public` 文件夹上传覆盖 GitHub 仓库原文件，保持 `public/index.html`、`public/style.css`、`public/game.js` 的目录结构。提交后让 Render 部署最新 commit。


修复说明：新版通过 Three.js ES Module（/vendor/three/three.module.js）加载 3D 引擎，避免旧版 three.min.js 文件在部分 npm 版本中不存在而造成空白舞池。
