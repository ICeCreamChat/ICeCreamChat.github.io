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
- `assets/js/dynamics.js`：切换螺旋波、图灵斑图与集群行为的模型动画。默认显示静态预览，点击视频控件播放。

页面采用浅色背景、个人照片和简洁的项目目录。三段动画是模型示意，不作为论文数值结果展示：螺旋波使用解析相位场，图灵斑图使用 Schnakenberg 反应扩散模型，集群行为使用 Vicsek 模型。MP4 与预览图直接随站点发布，不依赖在线计算服务。

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
