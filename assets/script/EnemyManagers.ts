import { _decorator, CCFloat, Component, instantiate, log, Node, Prefab, view } from 'cc';
const { ccclass, property } = _decorator;
import { GameStore } from './GameStore';
import { Enemy } from './Enemy';
import { Bus, Evt } from './GameEvent';
@ccclass('EnemyManagers')
export class EnemyManagers extends Component {

    /** 存活时间（秒） */
    private _elapsed = 0;
    /** 距离下一次刷新的计时 */
    private _timer = 0;

    @property({ tooltip: '开局时平均多少秒刷一架' })
    baseInterval: number = 0.9

    @property({ tooltip: '多少秒后难度升到最快' })
    rampSeconds: number = 60

    @property({ tooltip: '最快时的刷新速度倍率' })
    maxSpeed: number = 2.0

    @property({ type: [CCFloat], tooltip: '开局时 小 / 中 / 大 的刷新权重' })
    weightStart: number[] = [70, 22, 8]

    @property({ type: [CCFloat], tooltip: '难度封顶后 小 / 中 / 大 的刷新权重' })
    weightEnd: number[] = [30, 48, 22]

    @property(Prefab)
    enemy0Prefab: Prefab = null
    @property(Prefab)
    enemy1Prefab: Prefab = null
    @property(Prefab)
    enemy2Prefab: Prefab = null

    @property(Prefab)
    enemy3Prefab: Prefab = null
    @property(Prefab)
    enemy4Prefab: Prefab = null
    @property(Prefab)
    enemy5Prefab: Prefab = null
    @property(Prefab)
    enemy6Prefab: Prefab = null
    @property(Prefab)
    enemy8Prefab: Prefab = null
    @property(Prefab)
    enemy9Prefab: Prefab = null
    @property(Prefab)
    enemy10Prefab: Prefab = null
       protected onDestroy(): void {
        Bus.off(Evt.EnemyKilled, this.onEnemyKilled, this)
        Bus.off(Evt.ClearScreen, this.onClearScreen, this)
    }
    start() {
     Bus.on(Evt.EnemyKilled, this.onEnemyKilled, this)
        Bus.on(Evt.ClearScreen, this.onClearScreen, this)
    }

    update(deltaTime: number) {
        this._elapsed += deltaTime

        // t：难度进度 0 → 1（rampSeconds 秒后到达 1 并保持）
        const t = Math.min(1, this._elapsed / this.rampSeconds)

        // 刷新间隔随时间缩短
        const interval = this.baseInterval / (1 + (this.maxSpeed - 1) * t)

        this._timer += deltaTime
        if (this._timer < interval) return
        this._timer = 0
        this.spawnOne(t)
    }
    private onClearScreen() {
        for (const n of [...this.node.children]) {
            n.getComponent(Enemy)?.kill()
        }
    }
    /** 按当前权重抽一种敌人刷出来 */
    private spawnOne(t: number) {
        // 权重从 weightStart 线性过渡到 weightEnd
        const w = [
            this.weightStart[0] + (this.weightEnd[0] - this.weightStart[0]) * t,
            this.weightStart[1] + (this.weightEnd[1] - this.weightStart[1]) * t,
            this.weightStart[2] + (this.weightEnd[2] - this.weightStart[2]) * t,
        ]

        let r = Math.random() * (w[0] + w[1] + w[2])
        let idx = 0
        for (let i = 0; i < 3; i++) {
            r -= w[i]
            if (r <= 0) { idx = i; break }
        }

        const prefab = [this.enemy0Prefab, this.enemy1Prefab, this.enemy2Prefab][idx]
        if (!prefab) return

        const size = view.getVisibleSize()
        const enemy = instantiate(prefab)
        this.node.addChild(enemy)
        const x = (Math.random() - 0.5) * (size.width - 50)
        enemy.setPosition(x, 480, 0)
    }
    out() {

        this.scheduleOnce(() => this.spawnItem(), 0);
    }

    @property({ tooltip: '小飞机（tag 1）：击杀多少个掉一个道具' })
    dropSmall: number = 8

    @property({ tooltip: '中飞机（tag 2）：击杀多少个掉一个道具' })
    dropMedium: number = 15

    @property({ tooltip: '大飞机（tag 3）：击杀多少个掉一个道具' })
    dropBig: number = 10

    /** 三种敌人各自的累计击杀数（下标 0/1/2 对应 tag 1/2/3） */
    private _kills: number[] = [0, 0, 0]

    /**
     * 敌人被击杀时调用（由 Enemy.die 传入自己的 tag）
     * 每种敌人各自数击杀数，数够了就掉一个，三种互不干扰
     */
    onEnemyKilled(tag: number = 1) {
        const i = Math.max(0, Math.min(2, (tag || 1) - 1))
        const need = [this.dropSmall, this.dropMedium, this.dropBig][i]
        if (need <= 0) return

        this._kills[i]++
        if (this._kills[i] < need) return

        this._kills[i] = 0      // 只重置自己，别的类型不受影响
        this.out()
    }

    /** 道具权重表：数值越大越容易掉；残血时大幅提高回血权重 */
    private itemPool() {
        const lowHp = GameStore.hp <= 3
        return [
            { p: this.enemy3Prefab, w: 6 },                    // clear  清屏
            { p: this.enemy4Prefab, w: lowHp ? 60 : 22 },      // heal   回血
            { p: this.enemy5Prefab, w: 14 },                   // rapid  速射
            { p: this.enemy6Prefab, w: 12 },                   // shield 护盾
            { p: this.enemy8Prefab, w: 12 },                   // pierce 穿透
            { p: this.enemy9Prefab, w: 14 },                   // damage 强化
            { p: this.enemy10Prefab, w: 14 },                  // multi  多重射击
        ].filter(x => !!x.p);
    }

    private spawnItem() {
        const size = view.getVisibleSize();
        const pool = this.itemPool();

        if (pool.length === 0) {
            console.warn('[EnemyManagers] 道具 prefab 一个都没配置');
            return;
        }

        // 按权重抽一个
        const total = pool.reduce((s, x) => s + x.w, 0);
        let r = Math.random() * total;
        let prefab = pool[0].p;
        for (const x of pool) {
            r -= x.w;
            if (r <= 0) { prefab = x.p; break; }
        }

        const node = instantiate(prefab);
        this.node.addChild(node);

        const x = (Math.random() - 0.5) * (size.width - 50);
        node.setPosition(x, size.height / 2 + 30, 0);
    }
}


