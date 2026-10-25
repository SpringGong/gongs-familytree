// miniprogram/utils/treeLayout.js
// Computes x,y positions for a genogram family tree

const NODE_W = 110;
const NODE_H = 55;
const SPOUSE_GAP = 20;
const COUPLE_W = NODE_W * 2 + SPOUSE_GAP;
const H_GAP = 40;
const V_GAP = 90;

function computeLayout(data) {
  if (!data || data.length === 0) {
    return { nodeMap: new Map(), couples: [], coupleByPair: new Map(), childParentCouple: new Map(), personFirstCouple: new Map(), bounds: { width: 400, height: 200 } };
  }

  const nodeMap = new Map(data.map(n => [n.key, Object.assign({}, n, { x: null, y: null })]));

  // Build couples
  const couples = [];
  const coupleByPair = new Map();
  const personFirstCouple = new Map();

  data.forEach(n => {
    if (n.gender !== 'M') return;
    let wives = n.wife;
    if (wives === undefined || wives === null) return;
    if (!Array.isArray(wives)) wives = [wives];
    wives.forEach(wk => {
      if (!nodeMap.has(wk)) return;
      const id = `${n.key}_${wk}`;
      if (coupleByPair.has(id)) return;
      const couple = { id, hKey: n.key, wKey: wk, children: [], subtreeW: 0, x: 0, y: 0, midX: 0 };
      coupleByPair.set(id, couple);
      couples.push(couple);
      if (!personFirstCouple.has(n.key)) personFirstCouple.set(n.key, couple);
      if (!personFirstCouple.has(wk)) personFirstCouple.set(wk, couple);
    });
  });

  // Assign children to couples; build child→parentCouple map
  const childParentCouple = new Map();
  data.forEach(n => {
    if (n.father == null || n.mother == null) return;
    const id = `${n.father}_${n.mother}`;
    const c = coupleByPair.get(id);
    if (c) {
      c.children.push(n.key);
      childParentCouple.set(n.key, c);
    }
  });

  // Root couples: neither member is a child of another couple
  const rootCouples = couples.filter(c => !childParentCouple.has(c.hKey) && !childParentCouple.has(c.wKey));

  // Single root nodes (not in any couple, not a child)
  const inCoupleSet = new Set();
  couples.forEach(c => { inCoupleSet.add(c.hKey); inCoupleSet.add(c.wKey); });
  const singleRoots = data.filter(n => !inCoupleSet.has(n.key) && !childParentCouple.has(n.key));

  // Compute subtree widths (bottom-up)
  const widthComputed = new Set();
  function computeSubtreeWidth(couple) {
    if (widthComputed.has(couple.id)) return couple.subtreeW;
    widthComputed.add(couple.id);

    if (couple.children.length === 0) {
      couple.subtreeW = COUPLE_W;
      return COUPLE_W;
    }

    let totalChildW = 0;
    couple.children.forEach((ck, i) => {
      const childCouple = personFirstCouple.get(ck);
      const childW = childCouple ? computeSubtreeWidth(childCouple) : NODE_W;
      totalChildW += childW + (i > 0 ? H_GAP : 0);
    });

    couple.subtreeW = Math.max(COUPLE_W, totalChildW);
    return couple.subtreeW;
  }

  rootCouples.forEach(computeSubtreeWidth);

  // Assign positions (top-down)
  const placed = new Set();
  function placeCouple(couple, leftX, y) {
    if (placed.has(couple.id)) return;
    placed.add(couple.id);

    couple.x = leftX;
    couple.y = y;
    couple.midX = leftX + couple.subtreeW / 2;

    const husbandX = couple.midX - COUPLE_W / 2;
    const h = nodeMap.get(couple.hKey);
    const w = nodeMap.get(couple.wKey);
    if (h) { h.x = husbandX; h.y = y; }
    if (w) { w.x = husbandX + NODE_W + SPOUSE_GAP; w.y = y; }

    if (couple.children.length === 0) return;

    const childY = y + NODE_H + V_GAP;
    let totalChildW = 0;
    const childWidths = couple.children.map((ck, i) => {
      const cc = personFirstCouple.get(ck);
      const cw = cc ? cc.subtreeW : NODE_W;
      totalChildW += cw + (i > 0 ? H_GAP : 0);
      return cw;
    });

    let childLeftX = couple.midX - totalChildW / 2;
    couple.children.forEach((ck, i) => {
      const childCouple = personFirstCouple.get(ck);
      if (childCouple) {
        placeCouple(childCouple, childLeftX, childY);
      } else {
        const cn = nodeMap.get(ck);
        if (cn) { cn.x = childLeftX; cn.y = childY; }
      }
      childLeftX += childWidths[i] + H_GAP;
    });
  }

  let startX = 20;
  rootCouples.forEach(c => {
    placeCouple(c, startX, 20);
    startX += c.subtreeW + H_GAP;
  });

  singleRoots.forEach(n => {
    const node = nodeMap.get(n.key);
    if (node) { node.x = startX; node.y = 20; }
    startX += NODE_W + H_GAP;
  });

  // Compute bounding box
  let maxX = 0, maxY = 0;
  nodeMap.forEach(n => {
    if (n.x != null) {
      maxX = Math.max(maxX, n.x + NODE_W);
      maxY = Math.max(maxY, n.y + NODE_H);
    }
  });

  return { nodeMap, couples, coupleByPair, childParentCouple, personFirstCouple, bounds: { width: maxX + 40, height: maxY + 40 } };
}

module.exports = { computeLayout, NODE_W, NODE_H, COUPLE_W, SPOUSE_GAP, H_GAP, V_GAP };
