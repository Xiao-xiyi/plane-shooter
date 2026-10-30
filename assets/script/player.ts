import { _decorator, Animation, Canvas, Collider, Collider2D, Component, Contact2DType, director, EventTouch, find, Input, input, instantiate, log, math, Node, Prefab, Vec3, warnID } from 'cc';
const { ccclass, property } = _decorator;
import { GameStore } from './GameStore';
import { Bus, Evt } from './GameEvent';
import { HpBar } from './HpBar';
import { AudioMgr } from './AudioMgr';


@ccclass('player')
export class player extends Component {




    @property
    invincibleTime: number = 1

    @property(Node)
    bullets: Node = null
    @property(Node)
    Position1: Node = null
    @property
    shootRate: number = 0.5
    @property(Prefab)
    bullet1Prefab = null
    @property(Prefab)
    bullet2Prefab = null
    @property(Node)
    Position2: Node = null
    @property(Node)
    Position3: Node = null
    shootTimer: number = 0.5
    s: boolean = false
    shieldActive: boolean = false;
    @property
    public hp: number = 10
    maxHp = 10
    @property
    minShootRate: number = 0.18;
    @property({ tooltip: '单发伤害上限（吃满强化后的最高伤害）' })
    maxBulletDamage: number = 3;
    public gameTime: number = 0
    @property(Node)
    hpBar: Node = null;

    private _hpBarComp: HpBar = null;
    private _hpBarTried = false;
    private getHpBar(): HpBar {
        if (!this._hpBarComp && !this._hpBarTried) {
            this._hpBarTried = true;
            const n = this.hpBar || find('Canvas/UI/hpbar');
            if (!n) {
                console.warn('[player] 没找到 Canvas/UI/hpbar 节点');
                return null;
            }
            this._hpBarComp = n.getComponent(HpBar);
            if (!this._hpBarComp) console.warn('[player] hpbar 节点上没有挂 HpBar 组件');
        }
        return this._hpBarComp;
    }


    takeDamage(n: number = 1) {
        if (this.s || this.shieldActive) return;
        this.hp = Math.max(0, this.hp - n);
        GameStore.hp = this.hp;                       // 同步给掉落逻辑
        this.getHpBar()?.damage(n, this.maxHp);
        if (this.hp <= 0) { this.s = true; this.playerdeath(); }
        else this.playerhit();
    }
        /** 有敌人漏过防线：扣一滴血 */
    private onEnemyEscaped() {
        this.takeDamage(1)
    }
    outs(name) {
        // 回血用专属音效，其它道具用通用拾取音
        if (name === 'heal') AudioMgr.I?.heal()
        else AudioMgr.I?.pickup()

        switch (name) {
            case 'heal':
                this.hp = Math.min(this.hp + 1, this.maxHp)
                GameStore.hp = this.hp
                this.getHpBar()?.heal(1, this.maxHp)
                break
            case 'rapid': this.shootRate = Math.max(this.minShootRate, this.shootRate * 0.75);
                break
            case 'pierce':
                GameStore.pierceTime = 8
                break
            case 'damage':
                GameStore.bulletDamage = Math.min(GameStore.bulletDamage + 1, this.maxBulletDamage)
                break
            case 'multi':
                GameStore.bulletCount = Math.min(GameStore.bulletCount + 1, 4)
                break
            case 'clear':
                Bus.emit(Evt.ClearScreen)
                break
            case 'shield': {
                const anim = this.getComponentInChildren(Animation);
                this.shieldActive = true;
                if (anim) anim.play('player-wd')
                this.unschedule(this.frame)
                this.scheduleOnce(this.frame, 10)
                break;

            }



        }
    }
    frame() {
        const anim = this.getComponentInChildren(Animation);
        this.shieldActive = false;
        if (anim) anim.play('gamer');
    }

    protected start(): void {
        Bus.on(Evt.EnemyEscaped, this.onEnemyEscaped, this)
        let collider = this.getComponentInChildren(Collider2D)
        if (collider) {
            collider.on(Contact2DType.BEGIN_CONTACT, this.onBEginContact, this)

        }
        
        this.getHpBar()?.setHp(this.hp, this.maxHp);
        GameStore.pierceTime = 0;      // 新一局清掉上一局的强化状态
        GameStore.bulletDamage = 1;
        GameStore.bulletCount = 1;
        GameStore.hp = this.hp;
        GameStore.time = 0;            // 敌人血量成长依赖它，必须清零
        this.shootTimer = 0;
    }
    onBEginContact(selfCollider: Collider2D, otherCollider: Collider2D) {

        const t = otherCollider.tag
        if (t === 5) {
            const itemNode = otherCollider.node as any
            // 同一个道具只结算一次：
            // 物理引擎可能因为多个接触点 / 相邻两帧重复触发 BEGIN_CONTACT，
            // 不拦的话一次拾取会加好几次（多重射击尤其明显）
            if (itemNode.__picked) return
            itemNode.__picked = true

            this.outs(itemNode.name)
            this.scheduleOnce(() => {
                if (itemNode && itemNode.isValid) itemNode.destroy()
            }, 0);
            return;
        }
        if (t === 6) {                       // 敌弹
            this.takeDamage(1)
            const b = otherCollider.node
            this.scheduleOnce(() => { if (b && b.isValid) b.destroy() }, 0)
            return
        }
        if (t !== 1 && t !== 2 && t !== 3) return
        this.takeDamage(1)          // 统一走 takeDamage：血条 / 音效 / 无敌 / 死亡都在里面

    }
    playerdeath() {
        GameStore.isover = true
        AudioMgr.I?.playerDeath()
        const anim = this.getComponentInChildren(Animation);
        if (anim) {
            anim.play('player-death');
            anim.once(Animation.EventType.FINISHED, () => {

                director.loadScene('scene');

            }, this);

        } else {
            director.loadScene('scene');
        }
    }
    playerhit() {
        this.s = true
        AudioMgr.I?.hit()
        this.unschedule(this.resetInvincible)                     // 防止连续受击叠加计时
        this.scheduleOnce(this.resetInvincible, this.invincibleTime)
        let anim = this.getComponentInChildren(Animation)
        if (anim) {
            anim.once(Animation.EventType.FINISHED, () => {
                anim.play('gamer')
            }, this)
            if (this.shieldActive) return;
            anim.play('player-hit')

        }
    }
    resetInvincible() {
        this.s = false
    }
    protected onLoad(): void {

        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMOve, this)
    }
    onTouchMOve(event: EventTouch) {
        const p = this.node.position
        let targetposition = new Vec3(p.x + event.getDeltaX(), p.y + event.getDeltaY(), p.z)
        if (targetposition.x < -215) {
            targetposition.x = -215
        }
        if (targetposition.x > 215) {
            targetposition.x = 215
        }
        if (targetposition.y < -390) {
            targetposition.y = -390
        }
        if (targetposition.y > 380) {
            targetposition.y = 380
        }
        this.node.setPosition(targetposition)
    }
    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMOve, this)
           Bus.off(Evt.EnemyEscaped, this.onEnemyEscaped, this) 
    }
    protected update(dt: number): void {
        // 生存时间只累加数字，格式化交给 formatTime()
        this.gameTime += dt
        GameStore.time = this.gameTime

        // 穿透弹倒计时
        if (GameStore.pierceTime > 0) {
            GameStore.pierceTime = Math.max(0, GameStore.pierceTime - dt)
        }
        this.fire(dt)
    }

    /** 当前弹道数：1~4，只由永久强化决定 */
    private currentBulletCount(): number {
        return Math.min(Math.max(GameStore.bulletCount, 1), 4)
    }

    /**
     * 按弹道数给出每个枪口的世界坐标
     * 1 条：中间
     * 2 条：左右两个枪口
     * 3 条：左 + 中 + 右
     * 4 条：外侧两条 + 中间两条（中间两条由中心与外侧插值得到）
     */
    private bulletSpots(count: number): { pos: Vec3, isCenter: boolean }[] {
        // 枪口没配全时退回单发，避免空引用
        const p1 = this.Position1 ? this.Position1.worldPosition : Vec3.ZERO
        const p2 = this.Position2 ? this.Position2.worldPosition : p1
        const p3 = this.Position3 ? this.Position3.worldPosition : p1

        const mix = (a: Vec3, b: Vec3, t: number) =>
            new Vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)

        switch (count) {
            case 2:
                return [
                    { pos: p2.clone(), isCenter: false },
                    { pos: p3.clone(), isCenter: false },
                ]
            case 3:
                return [
                    { pos: p2.clone(), isCenter: false },
                    { pos: p1.clone(), isCenter: true },
                    { pos: p3.clone(), isCenter: false },
                ]
            case 4:
                return [
                    { pos: p2.clone(), isCenter: false },
                    { pos: mix(p1, p2, 0.45), isCenter: true },
                    { pos: mix(p1, p3, 0.45), isCenter: true },
                    { pos: p3.clone(), isCenter: false },
                ]
            default:
                return [{ pos: p1.clone(), isCenter: true }]
        }
    }

    /** 每帧开火 */
    private fire(dt: number) {
        this.shootTimer += dt
        if (this.shootTimer < this.shootRate) return
        this.shootTimer = 0

        const spots = this.bulletSpots(this.currentBulletCount())
        for (const spot of spots) {
            const prefab = spot.isCenter ? this.bullet1Prefab : this.bullet2Prefab
            if (!prefab) continue
            const b = instantiate(prefab)
            this.bullets.addChild(b)
            b.setWorldPosition(spot.pos)
        }
        AudioMgr.I?.shoot()
    }
}


