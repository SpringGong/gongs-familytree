// pages/index/index.js
const treeLayout = require('../../utils/treeLayout');
const json5 = require('../../utils/json5Compat');
const { NODE_W, NODE_H, COUPLE_W, SPOUSE_GAP, V_GAP } = treeLayout;

const LS_DATA = 'gongs_data';
const LS_DESC = 'gongs_desc';
const SEARCH_HIGHLIGHT = '#f59e0b';

Page({
  data: {
    menuVisible: false,
    searchText: '',
    selectedNode: null,
    detailVisible: false,
    loading: true,
    loadingText: '正在加载族谱数据...',
    toastMsg: '',
    toastVisible: false,
  },

  _treeData: [],
  _layout: null,
  _canvas: null,
  _ctx: null,
  _canvasW: 0,
  _canvasH: 0,
  _offsetX: 20,
  _offsetY: 20,
  _selectedKey: null,
  _searchResults: [],
  _searchIdx: 0,
  _touchStartX: 0,
  _touchStartY: 0,
  _touchStartTime: 0,
  _isPanning: false,
  _panStartOffX: 0,
  _panStartOffY: 0,
  _canvasTop: 0,
  _toastTimer: null,
  _dataChanged: false,

  onReady() {
    const query = wx.createSelectorQuery().in(this);
    query.select('#treeCanvas').fields({ node: true, size: true, rect: true }).exec((res) => {
      if (!res[0] || !res[0].node) return;
      const info = res[0];
      const pr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : wx.getSystemInfoSync().pixelRatio;
      const canvas = info.node;
      canvas.width = Math.round(info.width * pr);
      canvas.height = Math.round(info.height * pr);
      const ctx = canvas.getContext('2d');
      ctx.scale(pr, pr);
      this._canvas = canvas;
      this._ctx = ctx;
      this._canvasW = info.width;
      this._canvasH = info.height;
      this._canvasTop = info.top || 0;
      this._loadData();
    });
  },

  onShow() {
    if (this._dataChanged && this._ctx) {
      this._dataChanged = false;
      const saved = wx.getStorageSync(LS_DATA);
      if (saved) {
        try { this._treeData = JSON.parse(saved); } catch (_) {}
      }
      this._buildAndDraw();
    }
  },

  _loadData() {
    try {
      let data;
      const saved = wx.getStorageSync(LS_DATA);
      if (saved) {
        data = JSON.parse(saved);
      } else {
        // Read and parse the bundled JSON5 template
        const text = wx.getFileSystemManager().readFileSync('data/data-template.json5', 'utf8');
        wx.setStorageSync(LS_DESC, json5.extractDesc(text));
        data = json5.parse(text);
        wx.setStorageSync(LS_DATA, JSON.stringify(data));
      }
      this._treeData = data;
      this._buildAndDraw();
      this.setData({ loading: false });
      this._showToast('族谱数据加载成功 ✓');
    } catch (e) {
      this.setData({ loading: false });
      this._showToast('数据加载失败，请导入数据文件');
    }
  },

  _buildAndDraw() {
    if (!this._ctx) return;
    this._layout = treeLayout.computeLayout(this._treeData);
    // Center horizontally
    const treeW = this._layout.bounds.width;
    if (treeW < this._canvasW) {
      this._offsetX = (this._canvasW - treeW) / 2;
    } else {
      this._offsetX = 20;
    }
    this._offsetY = 20;
    this._draw();
  },

  _draw() {
    if (!this._ctx || !this._layout) return;
    const ctx = this._ctx;
    const { nodeMap, couples, childParentCouple } = this._layout;
    const W = this._canvasW;
    const H = this._canvasH;
    const ox = this._offsetX;
    const oy = this._offsetY;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(ox, oy);

    const midV = V_GAP / 2;

    // Marriage lines
    ctx.strokeStyle = '#5d8cc1';
    ctx.lineWidth = 2.5;
    couples.forEach(c => {
      const h = nodeMap.get(c.hKey);
      const w = nodeMap.get(c.wKey);
      if (!h || !w || h.x == null) return;
      ctx.beginPath();
      ctx.moveTo(h.x + NODE_W, h.y + NODE_H / 2);
      ctx.lineTo(w.x, w.y + NODE_H / 2);
      ctx.stroke();
    });

    // Parent-child lines
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    couples.forEach(c => {
      if (c.children.length === 0) return;
      const h = nodeMap.get(c.hKey);
      const w = nodeMap.get(c.wKey);
      if (!h || !w || h.x == null) return;

      const parentMidX = h.x + NODE_W + SPOUSE_GAP / 2;
      const parentBottomY = h.y + NODE_H;
      const midLineY = parentBottomY + midV;

      ctx.beginPath();
      ctx.moveTo(parentMidX, parentBottomY);
      ctx.lineTo(parentMidX, midLineY);
      ctx.stroke();

      const childXs = c.children
        .map(ck => nodeMap.get(ck))
        .filter(n => n && n.x != null)
        .map(n => n.x + NODE_W / 2);

      if (childXs.length > 1) {
        ctx.beginPath();
        ctx.moveTo(Math.min(...childXs), midLineY);
        ctx.lineTo(Math.max(...childXs), midLineY);
        ctx.stroke();
      }

      c.children.forEach(ck => {
        const child = nodeMap.get(ck);
        if (!child || child.x == null) return;
        ctx.beginPath();
        ctx.moveTo(child.x + NODE_W / 2, midLineY);
        ctx.lineTo(child.x + NODE_W / 2, child.y);
        ctx.stroke();
      });
    });

    // Nodes
    nodeMap.forEach((n, key) => {
      if (n.x == null) return;
      const { x, y } = n;
      const isSelected = key === this._selectedKey;

      // Fill color
      if (isSelected) {
        ctx.fillStyle = SEARCH_HIGHLIGHT;
      } else {
        ctx.fillStyle = n.gender === 'M' ? '#5d8cc1' : '#f9a8d4';
      }
      this._roundRect(ctx, x, y, NODE_W, NODE_H, 8);
      ctx.fill();

      // Generation badge above node
      if (n.generation != null) {
        ctx.fillStyle = '#475569';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(n.generation), x + NODE_W / 2, y - 2);
      }

      // Name text
      ctx.fillStyle = n.gender === 'M' ? 'white' : '#1e293b';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const name = n.name || '';
      const displayName = name.length > 5 ? name.slice(0, 4) + '…' : name;
      ctx.fillText(displayName, x + NODE_W / 2, y + NODE_H / 2);
    });

    ctx.restore();
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  },

  _hitTest(canvasX, canvasY) {
    if (!this._layout) return null;
    const cx = canvasX - this._offsetX;
    const cy = canvasY - this._offsetY;
    let hitKey = null;
    this._layout.nodeMap.forEach((n, key) => {
      if (n.x == null) return;
      if (cx >= n.x && cx <= n.x + NODE_W && cy >= n.y && cy <= n.y + NODE_H) {
        hitKey = key;
      }
    });
    return hitKey;
  },

  onTouchStart(e) {
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY - this._canvasTop;
    this._touchStartTime = Date.now();
    this._isPanning = false;
    this._panStartOffX = this._offsetX;
    this._panStartOffY = this._offsetY;
  },

  onTouchMove(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const curX = touch.clientX;
    const curY = touch.clientY - this._canvasTop;
    const dx = curX - this._touchStartX;
    const dy = curY - this._touchStartY;
    if (!this._isPanning && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      this._isPanning = true;
    }
    if (this._isPanning) {
      this._offsetX = this._panStartOffX + dx;
      this._offsetY = this._panStartOffY + dy;
      this._draw();
    }
  },

  onTouchEnd(e) {
    const elapsed = Date.now() - this._touchStartTime;
    if (!this._isPanning && elapsed < 300) {
      const hitKey = this._hitTest(this._touchStartX, this._touchStartY);
      if (hitKey !== null) {
        this._selectedKey = hitKey;
        const node = Object.assign({}, this._layout.nodeMap.get(hitKey));
        this.setData({ selectedNode: node, detailVisible: true });
      } else {
        this._selectedKey = null;
        this.setData({ selectedNode: null, detailVisible: false });
      }
      this._draw();
    }
  },

  closeDetail() {
    this._selectedKey = null;
    this.setData({ selectedNode: null, detailVisible: false });
    this._draw();
  },

  editNode() {
    const node = this.data.selectedNode;
    if (!node) return;
    this.setData({ detailVisible: false });
    this._selectedKey = null;
    this._dataChanged = true;
    wx.navigateTo({ url: `/pages/edit/edit?mode=edit&key=${node.key}` });
  },

  addSpouse() {
    const node = this.data.selectedNode;
    if (!node) return;
    this.setData({ detailVisible: false });
    this._selectedKey = null;
    this._dataChanged = true;
    wx.navigateTo({ url: `/pages/edit/edit?mode=add-spouse&key=${node.key}` });
  },

  addChild() {
    const node = this.data.selectedNode;
    if (!node) return;
    let husbandKey = null;
    if (this._layout) {
      this._layout.couples.forEach(c => {
        if (c.wKey === node.key) husbandKey = c.hKey;
      });
    }
    if (husbandKey == null) {
      this._showToast('请先为该成员添加配偶');
      return;
    }
    this.setData({ detailVisible: false });
    this._selectedKey = null;
    this._dataChanged = true;
    wx.navigateTo({ url: `/pages/edit/edit?mode=add-child&key=${node.key}&fatherKey=${husbandKey}` });
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
  },

  doSearch() {
    const text = this.data.searchText.trim();
    if (!text) { this._showToast('请输入搜索内容'); return; }
    const results = [];
    if (this._layout) {
      this._layout.nodeMap.forEach((n, key) => {
        const fields = [n.name, n.alias, n.birthplace, n.buryplace];
        if (fields.some(f => f && f.includes(text))) results.push(key);
      });
    }
    this._searchResults = results;
    this._searchIdx = 0;
    if (results.length > 0) {
      this._showToast(`找到 ${results.length} 个结果`);
      this._centerOnNode(results[0]);
    } else {
      this._showToast('未找到匹配内容');
    }
  },

  searchNext() {
    if (this._searchResults.length === 0) { this._showToast('请先搜索'); return; }
    this._searchIdx = (this._searchIdx + 1) % this._searchResults.length;
    this._centerOnNode(this._searchResults[this._searchIdx]);
  },

  _centerOnNode(key) {
    const n = this._layout && this._layout.nodeMap.get(key);
    if (!n || n.x == null) return;
    this._offsetX = this._canvasW / 2 - (n.x + NODE_W / 2);
    this._offsetY = this._canvasH / 2 - (n.y + NODE_H / 2);
    this._selectedKey = key;
    this._draw();
  },

  toggleMenu() {
    this.setData({ menuVisible: !this.data.menuVisible });
  },

  hideMenu() {
    this.setData({ menuVisible: false });
  },

  exportData() {
    this.setData({ menuVisible: false });
    if (!this._treeData || this._treeData.length === 0) {
      this._showToast('族谱尚未加载');
      return;
    }
    const jsonStr = JSON.stringify(this._treeData, null, 2);
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/族谱备份.json`;
    fs.writeFile({
      filePath,
      data: jsonStr,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath,
          fileName: '族谱备份.json',
          success: () => this._showToast('导出成功 ✓'),
          fail: (err) => {
            if (err && err.errMsg && err.errMsg.includes('cancel')) return;
            this._showToast('分享失败，请检查权限');
          },
        });
      },
      fail: () => this._showToast('文件写入失败'),
    });
  },

  importData() {
    this.setData({ menuVisible: false });
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'json5'],
      success: (res) => {
        const file = res.tempFiles[0];
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: ({ data: text }) => {
            try {
              const parsed = json5.parse(text);
              if (!Array.isArray(parsed)) throw new Error('not array');
              wx.setStorageSync(LS_DESC, json5.extractDesc(text));
              this._treeData = parsed;
              wx.setStorageSync(LS_DATA, JSON.stringify(parsed));
              this._buildAndDraw();
              this._showToast('数据已更新 ✓');
            } catch (_) {
              this._showToast('JSON/JSON5 格式错误，请检查文件');
            }
          },
          fail: () => this._showToast('文件读取失败'),
        });
      },
      fail: () => {},
    });
  },

  showDesc() {
    this.setData({ menuVisible: false });
    wx.navigateTo({ url: '/pages/desc/desc' });
  },

  goAbout() {
    this.setData({ menuVisible: false });
    wx.navigateTo({ url: '/pages/about/about' });
  },

  _showToast(msg, duration = 2800) {
    this.setData({ toastMsg: msg, toastVisible: true });
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.setData({ toastVisible: false });
    }, duration);
  },
});
