import { _decorator, Component, Node, Sprite, SpriteFrame, UITransform, tween, Vec3, UIOpacity } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 分格血量条 —— 一次掉血正好掉一格
 *
 * 节点结构（建议）：
 *   HpBar                ← 挂这个脚本
 *    ├─ Track           ← Sprite：血条_底槽.png
 *    ├─ Fill            ← Sprite：血条_填充条_青.png（Type = FILLED / FillType = HORIZONTAL）
 *    ├─ Tip             ← Sprite：血条_前端光效_青.png（可空）
 *    └─ Flash           ← Sprite：纯白 1x1 贴图（可空，用于受击闪白）
 *
 * 用法：
 *   this.hpBar.setHp(this.hp, this.maxHp);   // 直接同步
 *   this.hpBar.damage(1, this.maxHp);        // 掉一格（带闪白 + 抖动）
 *   this.hpBar.heal(1, this.maxHp);
 */
@ccclass('HpBar')
export class HpBar extends Component {

    @property({ type: Node, tooltip: '填充条节点（Sprite 必须是 FILLED / HORIZONTAL）' })
    fill: Node = null;

    @property({ type: Node, tooltip: '前端光效节点，跟着血条断口走，可留空' })
    tip: Node = null;

    @property({ type: Node, tooltip: '受击闪白节点，可留空' })
    flash: Node = null;

    @property({ tooltip: '总格数，要和素材上画的刻度一致' })
    segments: number = 10;

    @property({ tooltip: '一次掉血动画时长（秒）' })
    animTime: number = 0.12;

    @property({ tooltip: '闪白时长（秒）' })
    flashTime: number = 0.18;

    @property({ tooltip: '低血量阈值（格），低于等于该值时换成红色素材' })
    lowSegments: number = 3;

    @property({ type: SpriteFrame, tooltip: '满血/正常填充图' })
    fillNormal: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '低血量填充图' })
    fillLow: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '正常前端光效' })
    tipNormal: SpriteFrame = null;
    @property({ type: SpriteFrame, tooltip: '低血量前端光效' })
    tipLow: SpriteFrame = null;

    // ---- 和素材对齐的参数（换素材尺寸时改这两个） ----
    private readonly TEX_W = 720;      // 血条素材宽度
    private readonly INSET = 4.75;     // 填充条相对外框的左右内缩像素

    private _maxHp = 10;
    private _hp = 10;
    private _shown = 1;                // 当前显示的填充比例（0~1，已吸附到格线）
    private _tweenProxy = { v: 1 };
    private _flashOp: UIOpacity = null;

    onLoad() {
        if (this.flash) {
            this._flashOp = this.flash.getComponent(UIOpacity) || this.flash.addComponent(UIOpacity);
            this._flashOp.opacity = 0;
        }
        if (this.fill) {
            const sp = this.fill.getComponent(Sprite);
            if (sp) {
                sp.type = Sprite.Type.FILLED;
                sp.fillType = Sprite.FillType.HORIZONTAL;
                sp.fillStart = 0;
                sp.fillRange = 1;
            }
        }
    }

    // ============ 对外接口 ============

    /** 直接设置血量（不播动画） */
    setHp(hp: number, maxHp: number) {
        this._hp = Math.max(0, Math.min(hp, maxHp));
        this._maxHp = Math.max(1, maxHp);
        this._shown = this.snap(this._hp / this._maxHp);
        this.apply(this._shown, true);
    }

    /** 掉血：一次调用只掉 n 格，动画也只走 n 格 */
    damage(n: number = 1, maxHp?: number) {
        if (maxHp) this._maxHp = maxHp;
        const before = this._hp;
        this._hp = Math.max(0, this._hp - n);
        if (this._hp === before) return;

        this.playFlash(this.snap(before / this._maxHp), this.snap(this._hp / this._maxHp));
        this.shake();
        this.tweenTo(this.snap(this._hp / this._maxHp));
    }

    /** 回血 */
    heal(n: number = 1, maxHp?: number) {
        if (maxHp) this._maxHp = maxHp;
        const before = this._hp;
        this._hp = Math.min(this._maxHp, this._hp + n);
        if (this._hp === before) return;
        this.tweenTo(this.snap(this._hp / this._maxHp));
    }

    get hp() { return this._hp; }
    get maxHp() { return this._maxHp; }
    /** 当前是第几格（0~segments） */
    get segment() { return Math.round(this._shown * this.segments); }

    // ============ 内部实现 ============

    /** 把连续比例吸附到格线上：0.83 → 0.8（10 格时） */
    private snap(f: number) {
        return Math.round(Math.max(0, Math.min(1, f)) * this.segments) / this.segments;
    }

    /** 比例 → 填充条实际要显示的 fillRange（要跳过外框内缩的那几像素） */
    private fillRangeOf(f: number) {
        if (f <= 0) return 0;
        return (this.INSET + (this.TEX_W - this.INSET * 2) * f) / this.TEX_W;
    }

    private apply(f: number, instant: boolean) {
        const sp = this.fill && this.fill.getComponent(Sprite);
        if (!sp) return;

        sp.fillRange = this.fillRangeOf(f);

        // 低血量换色
        const low = Math.round(f * this.segments) <= this.lowSegments;
        if (this.fillNormal && this.fillLow) sp.spriteFrame = low ? this.fillLow : this.fillNormal;

        // 光效跟着断口走
        if (this.tip) {
            const tsp = this.tip.getComponent(Sprite);
            if (tsp && this.tipNormal && this.tipLow) tsp.spriteFrame = low ? this.tipLow : this.tipNormal;
            const x = this.INSET + (this.TEX_W - this.INSET * 2) * f - this.TEX_W / 2;
            this.tip.setPosition(new Vec3(x, this.tip.position.y, 0));
            const op = this.tip.getComponent(UIOpacity) || this.tip.addComponent(UIOpacity);
            op.opacity = (f > 0.001 && f < 0.999) ? 255 : 0;
        }
    }

    private tweenTo(target: number) {
        const from = this._shown;
        this._shown = target;
        if (Math.abs(from - target) < 1e-4) { this.apply(target, true); return; }

        this._tweenProxy.v = from;
        tween(this._tweenProxy)
            .to(this.animTime, { v: target }, {
                easing: 'quadOut',
                onUpdate: () => this.apply(this._tweenProxy.v, false),
            })
            .call(() => this.apply(target, true))
            .start();
    }

    /** 被扣掉的那一格闪白 */
    private playFlash(fromF: number, toF: number) {
        if (!this.flash || !this._flashOp) return;

        const ut = this.flash.getComponent(UITransform);
        const w = Math.abs(fromF - toF) * (this.TEX_W - this.INSET * 2);
        if (ut && w > 0) ut.width = w;
        const x = this.INSET + (this.TEX_W - this.INSET * 2) * Math.min(fromF, toF) - this.TEX_W / 2 + w / 2;
        this.flash.setPosition(new Vec3(x, this.flash.position.y, 0));

        this._flashOp.opacity = 235;
        tween(this._flashOp).to(this.flashTime, { opacity: 0 }, { easing: 'quadOut' }).start();
    }

    private shake() {
        const p = this.node.position.clone();
        tween(this.node)
            .to(0.05, { position: new Vec3(p.x - 4, p.y, p.z) })
            .to(0.05, { position: new Vec3(p.x + 3, p.y, p.z) })
            .to(0.05, { position: p })
            .start();
    }
}
