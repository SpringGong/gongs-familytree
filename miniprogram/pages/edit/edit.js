// pages/edit/edit.js
const LS_DATA = 'gongs_data';

const EMPTY_FORM = {
  name: '', alias: '', order: '', birthtime: '',
  birthplace: '', deathtime: '', buryplace: '', comment: ''
};

Page({
  data: {
    mode: 'edit',        // 'edit' | 'add-spouse' | 'add-child'
    genderOptions: ['男', '女'],
    genderIdx: 0,        // 0=M, 1=F
    genderDisabled: false,
    form: Object.assign({}, EMPTY_FORM),
  },

  _nodeKey: null,
  _fatherKey: null,
  _treeData: [],

  onLoad(options) {
    const mode = options.mode || 'edit';
    const key = options.key ? Number(options.key) : null;
    const fatherKey = options.fatherKey ? Number(options.fatherKey) : null;

    this._nodeKey = key;
    this._fatherKey = fatherKey;

    // Load tree data
    try {
      const saved = wx.getStorageSync(LS_DATA);
      this._treeData = saved ? JSON.parse(saved) : [];
    } catch (_) { this._treeData = []; }

    if (mode === 'edit') {
      wx.setNavigationBarTitle({ title: '编辑成员信息' });
      const node = this._treeData.find(n => n.key === key);
      if (node) {
        this.setData({
          mode,
          genderIdx: node.gender === 'F' ? 1 : 0,
          form: {
            name: node.name || '',
            alias: node.alias || '',
            order: node.order || '',
            birthtime: node.birthtime || '',
            birthplace: node.birthplace || '',
            deathtime: node.deathtime || '',
            buryplace: node.buryplace || '',
            comment: node.comment || '',
          }
        });
      }
    } else if (mode === 'add-spouse') {
      wx.setNavigationBarTitle({ title: '添加配偶' });
      this.setData({ mode, genderIdx: 1, genderDisabled: true, form: Object.assign({}, EMPTY_FORM) });
    } else if (mode === 'add-child') {
      wx.setNavigationBarTitle({ title: '添加儿女' });
      this.setData({ mode, genderIdx: 0, genderDisabled: false, form: Object.assign({}, EMPTY_FORM) });
    }
  },

  onGenderChange(e) {
    this.setData({ genderIdx: Number(e.detail.value) });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form);
    form[field] = e.detail.value;
    this.setData({ form });
  },

  onCancel() {
    wx.navigateBack();
  },

  onSave() {
    const { mode, genderIdx, form } = this.data;
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    const gender = genderIdx === 0 ? 'M' : 'F';
    const buildProps = () => ({
      name: form.name.trim() || undefined,
      gender,
      alias: form.alias.trim() || undefined,
      order: form.order.trim() || undefined,
      birthtime: form.birthtime.trim() || undefined,
      birthplace: form.birthplace.trim() || undefined,
      deathtime: form.deathtime.trim() || undefined,
      buryplace: form.buryplace.trim() || undefined,
      comment: form.comment.trim() || undefined,
    });

    if (mode === 'edit') {
      const idx = this._treeData.findIndex(n => n.key === this._nodeKey);
      if (idx === -1) { wx.navigateBack(); return; }
      const existing = this._treeData[idx];
      const updated = Object.assign({}, existing, buildProps());
      updated.Modified = 'X';
      this._treeData[idx] = updated;

    } else if (mode === 'add-spouse') {
      const husbandNode = this._treeData.find(n => n.key === this._nodeKey);
      if (!husbandNode) { wx.navigateBack(); return; }
      const newKey = this._generateKey();
      const props = buildProps();
      const wifeData = Object.assign({ key: newKey, gender: 'F', husband: this._nodeKey, New_created: 'X' }, props);
      if (husbandNode.generation != null) wifeData.generation = husbandNode.generation;
      this._treeData.push(wifeData);

    } else if (mode === 'add-child') {
      const motherKey = this._nodeKey;
      const fatherKey = this._fatherKey;
      if (motherKey == null || fatherKey == null) { wx.navigateBack(); return; }
      const motherNode = this._treeData.find(n => n.key === motherKey);
      const newKey = this._generateKey();
      const props = buildProps();
      const childData = Object.assign({ key: newKey, mother: motherKey, father: fatherKey, New_created: 'X' }, props);
      if (motherNode && motherNode.generation != null) childData.generation = motherNode.generation + 1;
      this._treeData.push(childData);
    }

    // Remove undefined fields
    this._treeData = this._treeData.map(n =>
      Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined))
    );

    try {
      wx.setStorageSync(LS_DATA, JSON.stringify(this._treeData));
      wx.showToast({ title: '保存成功 ✓', icon: 'success', duration: 1500 });
      setTimeout(() => wx.navigateBack(), 1600);
    } catch (_) {
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  _generateKey() {
    let max = 0;
    this._treeData.forEach(n => { if (typeof n.key === 'number' && n.key > max) max = n.key; });
    return max + 1;
  },
});
