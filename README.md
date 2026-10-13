# 许斌 / Bin Xu

高中数学教师、数学硕士，持续开展非线性动力学研究。

个人主页：**https://icecreamchat.github.io/**

主 GitHub 账号：https://github.com/ICeCreamChat

ORCID：https://orcid.org/0009-0009-6216-2201

主页展示教学与研究方向、开源项目、期刊论文、专利、荣誉和教育经历。项目按最近提交时间排序，论文按出版年份及刊期排序，荣誉与教育经历按年份倒序排列。年份相同且没有具体日期的荣誉保留录入顺序。

## 修改内容

- `data/profile.json`：个人介绍、教育经历和荣誉。
- `data/publications.json`：论文标题、完整作者顺序、期刊及 DOI。记录来源为 ORCID 与 Crossref。刊期可能晚于论文上线日期，页面明确显示为“刊期”。
- `data/projects.json`：原创项目的介绍、技术和最近提交日期。GitHub 个人资料仓库、当前主页仓库及 Fork 项目不作为原创工具展示；完整仓库列表可从页面访问。
- `templates/index.html`：页面结构。
- `assets/css/site.css`：视觉样式。
- `assets/js/dynamics.js`：数学实验的参数控件、Canvas 绘制、启动/暂停、步进与重置。
- `assets/js/models.js`：螺旋相位场、Schnakenberg 反应扩散模型及 Vicsek 粒子模型。
- `assets/js/dynamics-worker.js`：在 Web Worker 中计算反应扩散，避免阻塞页面交互。
- `assets/js/theme-init.js`：首次绘制前恢复主题；主题切换逻辑在 `site.js` 中。

页面默认浅色，可以切换深色或跟随系统。选择保存在浏览器本地；存储不可用时仍可在当前页面切换。数学实验默认暂停，支持调参、开始/暂停演化、前进一步和重置；离开演示区域或隐藏页面会自动暂停。螺旋波波心可通过点击、触摸或方向键移动。

实验用于模型示意，不作为论文数值结果展示。图灵模型在 96 × 96 周期网格上用步长 0.04 计算；改参数后，从相同扰动演化到 t = 264 进行比较，“重新扰动”从 t = 0 开始。浓度色阶固定，避免把均匀状态的小幅数值波动误显示成斑点。集群模型在周期正方形内采用局部平均朝向及均匀方向噪声，改参数后演化 240 步，并显示实际方向一致度。无 JavaScript 或反应扩散计算不可用时，可观看随站点托管的 MP4 视频，不依赖在线计算服务。

重新生成动画需要 Python、NumPy、Pillow 和 FFmpeg：

```sh
python scripts/render-dynamics.py
```

使用 Node.js 22 或更新版本，不需要安装 npm 依赖：

```sh
npm run build
npm run preview
```

本地预览地址为 `http://127.0.0.1:4173`。更新数据后运行构建，并把数据、模板及生成后的 `index.html` 一起提交。

## 更新论文与项目

```sh
npm run sync:publications
npm run sync:projects
npm run build
```

论文同步从公开 ORCID 记录读取 DOI，并用 Crossref 补全作者与期刊信息。同步失败时保留原有数据；ORCID 暂时隐藏的已核对论文也保留。项目同步刷新已收录仓库的最近提交日期，介绍由人工维护；新增项目请在 `data/projects.json` 中添加条目。

## 发布

`main` 分支的每次提交会运行 `.github/workflows/pages.yml`，构建并发布 GitHub Pages。Pages 的发布来源设置为 **GitHub Actions**。部署仅包含页面、字体、图片及 BibTeX，不需要运行后端，也不需要配置 API 密钥。

迁移内容以旧站 https://ice0330.github.io/ 的最新记录为基础，论文已按 ORCID 更新，身份与荣誉已按本人提供的信息修订。原目标仓库的提交历史继续保留。

## 字体与许可

Space Grotesk 字体随站点托管，其 SIL Open Font License 位于 `assets/fonts/OFL.txt`。旧主页的 MIT 许可保留于 `LICENSE`。
