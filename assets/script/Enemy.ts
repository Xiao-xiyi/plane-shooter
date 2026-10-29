import { _decorator, Animation, animation, AnimationClip, Collider2D, Component, Contact2DType, find, instantiate, Label, log, Node, Prefab } from 'cc';
import { GameStore } from './GameStore';
import { AudioMgr } from './AudioMgr';
import { player } from './player';
const { ccclass, property } = _decorator;


@ccclass('Enemy')
export class Enemy extends Component {
    @property(Animation)
    anim: Animation = null
    @property
    speed: number = 30
    @property({ tooltip: '1 号敌人血量' })
    public hp1: number = 2
    @property({ tooltip: '2 号敌人血量' })
    public hp2: number = 3
    @property({ tooltip: '3 号敌人血量' })
    public hp3: number = 5
    @property({ tooltip: '血量成长：每隔多少秒乘一次' })
    growthInterval: number = 10
    @property({ tooltip: '每次乘的系数（1.055 = 每次 +5.5%，指数成长）' })
    growthFactor: number = 1.055
    @property({ tooltip: '血量成长上限（倍数）' })
    growthCap: number = 12

    @property({ tooltip: '是否停驻攻击：飞入 → 停在 stopY → 开火 → 离场' })
    stayAndAttack: boolean = false
    @property({ tooltip: '停驻高度（y 坐标，越大越靠上）' })
    stopY: number = 200
    @property({ tooltip: '停驻多久后离场（秒）' })
    stayTime: number = 6
    @property({ tooltip: '开火间隔（秒）' })
    fireInterval: number = 1.5
    @property(Prefab)
    enemyBulletPrefab: Prefab = null

    private phase: 'enter' | 'stay' | 'leave' = 'enter'
    private stayTimer = 0
    private fireTimer = 0
    private _warnedNoPrefab = false
    private dead = false
    @property(Label)
    df: Label = null



    safeDestroy(node: Node) {
        if (!node || !node.isValid) return;
        node.active = false;                       // 立刻退出物理世界
        setTimeout(() => {                         // 下一轮事件循环再真正销毁
            if (node && node.isValid) node.destroy();
        }, 0);
    }
    start() {
        this.applyGrowth()
        this.phase = 'enter'
        this.stayTimer = 0
        this.fireTimer = 0

        let collider = this.getComponentInChildren(Collider2D)
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this)
        }
        //  console.log(collider);
    }

    /**
     * 按存活时间给血量加成（出生时算一次，之后不再变）
     * 指数成长：每 growthInterval 秒乘 growthFactor，最多 growthCap 倍
     * 用指数而不是线性，是因为玩家的输出是乘法叠加的（弹道×伤害×射速）
     */
    private applyGrowth() {
        const steps = Math.floor(GameStore.time / this.growthInterval)
        const mult = Math.min(this.growthCap, Math.pow(this.growthFactor, steps))
        if (mult <= 1) return
        this.hp1 = Math.max(1, Math.round(this.hp1 * mult))
        this.hp2 = Math.max(1, Math.round(this.hp2 * mult))
        this.hp3 = Math.max(1, Math.round(this.hp3 * mult))
    }

    update(deltaTime: number) {
        if (this.dead) return

        // 没开停驻攻击的敌人（小/中飞机）走原来的直线下落
        if (!this.stayAndAttack) {
            this.moveDown(deltaTime)
            return
        }

        const p = this.node.position

        if (this.phase === 'enter') {
            const nextY = p.y - this.speed * deltaTime
            if (nextY <= this.stopY) {
                // 吸附到停驻点，避免不同帧率下停的位置不一致
                this.node.setPosition(p.x, this.stopY, p.z)
                this.phase = 'stay'
                this.stayTimer = 0
                this.fireTimer = Math.max(0, this.fireInterval - 0.4)   // 停稳后很快开第一炮
                return
            }
            this.node.setPosition(p.x, nextY, p.z)
            return
        }

        if (this.phase === 'stay') {
            this.stayTimer += deltaTime
            this.fireTimer += deltaTime

            if (this.fireTimer >= this.fireInterval) {
                this.fireTimer = 0
                this.fire()
            }
            if (this.stayTimer >= this.stayTime) {
                this.phase = 'leave'
            }
            return
        }

        this.moveDown(deltaTime)
    }

    /** 直线下落，飞出屏幕底部就扣玩家一滴血并销毁 */
    private moveDown(dt: number) {
        const p = this.node.position
        const nextY = p.y - this.speed * dt
        this.node.setPosition(p.x, nextY, p.z)
        if (nextY < -450) {
            find('Canvas/player')?.getComponent(player)?.takeDamage(1);
            this.safeDestroy(this.node);
        }
    }

    /** 停驻期间开火 */
    private fire() {
        if (!this.enemyBulletPrefab) {
            if (!this._warnedNoPrefab) {
                this._warnedNoPrefab = true
                console.warn('[Enemy] 没绑定 enemyBulletPrefab，无法开火：' +
                    '请在 Enemy2.prefab 的 Enemy 组件里把 enemyBullet 预制体拖进 Enemy Bullet Prefab')
            }
            return
        }

        const parent = this.node.parent
        if (!parent || !parent.isValid) return

        const b = instantiate(this.enemyBulletPrefab)
        parent.addChild(b)
        b.setWorldPosition(this.node.worldPosition)
    }
    onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D) {
        if (!selfCollider.tag) return

        const bulletNode = otherCollider.node

        // ① 不管敌人死没死，撞上来的子弹都要被吃掉
        //    用 setTimeout 而不是 this.scheduleOnce —— scheduleOnce 挂在敌人身上，
        //    敌人一旦销毁，它身上的调度器跟着没了，回调就不会执行，子弹会永远留着
        //    【穿透弹】强化生效期间，子弹不吃掉，可以继续往后打
        if (otherCollider.tag !== 4 && GameStore.pierceTime <= 0) {
            setTimeout(() => {
                if (bulletNode && bulletNode.isValid) {
                    bulletNode.active = false
                    bulletNode.destroy()
                }
            }, 0)
        }

        // ② 撞上来的是玩家（tag 4）：玩家掉血，但敌人不掉血，直接返回
        if (otherCollider.tag === 4) return

        // ③ 已经死了：只吃子弹，不再计算伤害
        if (this.dead) return

        const n = selfCollider.tag
        let dath: string
        let die: string
        switch (n) {
            case 1:
                dath = 'dath1'
                die = 'hit1'
                this.hp1 -= GameStore.bulletDamage
                if (this.hp1 > 0) this.die(this.hp1, dath, die, n)
                else this.die(0, dath, die, n)
                break;
            case 2:
                dath = 'dath2'
                die = 'hit2'
                this.hp2 -= GameStore.bulletDamage
                if (this.hp2 > 0) this.die(this.hp2, dath, die, n)
                else this.die(0, dath, die, n)
                break
            case 3:
                dath = 'dath3'
                die = 'hit3'
                this.hp3 -= GameStore.bulletDamage
                if (this.hp3 > 0) this.die(this.hp3, dath, die, n)
                else this.die(0, dath, die, n)
                break
        }
    }
    kill() {
        if (this.dead) return;
        const tag = this.getComponentInChildren(Collider2D)?.tag;
        let dath = 'dath1', die = 'hit1';
        if (tag === 2) { dath = 'dath2'; die = 'hit2'; }
        if (tag === 3) { dath = 'dath3'; die = 'hit3'; }
        this.die(0, dath, die, tag);
    }
    die(num: number, dath, die, n: number) {
        if (num <= 0) {
            this.dead = true;
            AudioMgr.I?.enemyDeath()

            // 下一帧摘掉碰撞体：尸体不再挡子弹，也不会再撞掉玩家的血
            // 不能直接写 col.enabled = false —— 在物理回调里销毁 fixture 有崩溃风险
            this.scheduleOnce(() => {
                const col = this.getComponentInChildren(Collider2D);
                if (col && col.isValid) col.enabled = false;
            }, 0);

            this.anim.play(dath)
            this.anim.once(Animation.EventType.FINISHED, () => { this.safeDestroy(this.node) }, this)

            // 掉落交给 EnemyManagers 统一处理（按敌人类型数击杀数）
            const mgr: any = find('Canvas/EnemyManagers')?.getComponent('EnemyManagers');
            mgr?.onEnemyKilled(n);

            this.sendValue(n)


        } else {
            this.anim.play(die)
            AudioMgr.I?.enemyHit()
        }
    }
    sendValue(n: number) {

        switch (n) {
            case 1: GameStore.df += 10; break;
            case 2: GameStore.df += 30; break;
            case 3: GameStore.df += 50; break;
        }

    }
}
