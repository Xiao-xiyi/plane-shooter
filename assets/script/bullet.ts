import { _decorator, Component, find, Vec3 } from 'cc';
import { putNode } from './pool';
const { ccclass, property } = _decorator;

@ccclass('bullet')
export class bullet extends Component {
    @property
    speed: number = 200;
    @property({ tooltip: '飞行方向：1 = 向上（玩家子弹），-1 = 向下（敌弹）' })
    dirY: number = 1;
    @property({ tooltip: '是否朝玩家发射（敌弹用，开了就忽略 dirY）' })
    aimAtPlayer: boolean = false;

    private _dx = 0;
    private _dy = 1;
    private _aimed = false;

    /** 每次从池子里被取出来时执行（start 一个组件一生只跑一次，复用不会重跑） */
    onEnable() {
        this._dx = 0;
        this._dy = this.dirY >= 0 ? 1 : -1;
        this._aimed = false;
    }

    /** 朝玩家瞄准：必须等位置设好之后才能算，所以推迟到第一帧 */
    private aimAtPlayerNode() {
        const pb = find('Canvas/player');
        if (!pb) return;

        const d = new Vec3();
        Vec3.subtract(d, pb.worldPosition, this.node.worldPosition);
        if (d.lengthSqr() < 0.0001) return;
        d.normalize();
        this._dx = d.x;
        this._dy = d.y;
    }

    update(deltaTime: number) {
        // 复用出来的节点，位置是调用方在 addChild 之后才设的，
        // 所以瞄准要等到这一帧再算
        if (!this._aimed) {
            this._aimed = true;
            if (this.aimAtPlayer) this.aimAtPlayerNode();
        }

        const p = this.node.position
        const nx = p.x + this._dx * this.speed * deltaTime
        const ny = p.y + this._dy * this.speed * deltaTime
        this.node.setPosition(nx, ny, p.z)

        // 飞出画面就还回池子（不再是 destroy）
        if (ny > 520 || ny < -520 || nx < -340 || nx > 340) {
            putNode(this.node)
        }
    }
}