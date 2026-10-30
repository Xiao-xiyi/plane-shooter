import { _decorator, Animation, animation, AnimationClip, Collider2D, Component, Contact2DType, Label, log, Node, Prefab } from 'cc';
import { GameStore } from './GameStore';
import { AudioMgr } from './AudioMgr';
import { ENEMY_TABLE, EnemyData } from './EnemyConfig';
import { Bus, Evt } from './GameEvent';
import { getNode, putNode } from './pool';
const { ccclass, property } = _decorator;


@ccclass('Enemy')
export class Enemy extends Component {
    @property(Animation)
    anim: Animation = null
    @property
    speed: number = 30
    /** 这个敌人的静态数值（从 ENEMY_TABLE 按 tag 查出来） */
    private data: EnemyData = null
    /** 当前血量（会被子弹扣，会被时间成长放大） */
    private hp = 0
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
        const col = this.getComponentInChildren(Collider2D)
        this.data = ENEMY_TABLE[col?.tag ?? 0]
        if (!this.data) {
            console.warn('[Enemy] 未知敌人 tag：' + (col?.tag ?? 'null'))
            return
        }
        this.hp = this.data.baseHp
        this.applyGrowth()

        this.phase = 'enter'
        this.stayTimer = 0
        this.fireTimer = 0

        if (col) {
            col.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this)
        }
    }
    private applyGrowth() {
        const steps = Math.floor(GameStore.time / this.growthInterval)
        const mult = Math.min(this.growthCap, Math.pow(this.growthFactor, steps))
        if (mult <= 1) return
        this.hp = Math.max(1, Math.round(this.data.baseHp * mult))
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
            Bus.emit(Evt.EnemyEscaped)
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

               const b = getNode(this.enemyBulletPrefab)
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
                       setTimeout(() => putNode(bulletNode), 0)
        }

        // ② 撞上来的是玩家（tag 4）：玩家掉血，但敌人不掉血，直接返回
        if (otherCollider.tag === 4) return

        // ③ 已经死了：只吃子弹，不再计算伤害
        if (this.dead) return


        // ③ 命中：扣血，没死播受击，死了走死亡流程
        this.hp = Math.max(0, this.hp - GameStore.bulletDamage)
        if (this.hp > 0) this.hurt()
        else this.die()
    }
    kill() {
        this.die()
    }
    /** 受击：播动画 + 响一声，不动血量判定 */
    private hurt() {
        this.anim.play(this.data.hitAnim)
        AudioMgr.I?.enemyHit()
    }

    /** 死亡：动画、音效、掉落、加分、销毁 */
    private die() {
        if (this.dead) return
        this.dead = true
        AudioMgr.I?.enemyDeath()

        this.scheduleOnce(() => {
            const col = this.getComponentInChildren(Collider2D)
            if (col && col.isValid) col.enabled = false
        }, 0)

        this.anim.play(this.data.deathAnim)
        this.anim.once(Animation.EventType.FINISHED, () => { this.safeDestroy(this.node) }, this)

        Bus.emit(Evt.EnemyKilled, this.data.tag)

        GameStore.df += this.data.score
    }
}
