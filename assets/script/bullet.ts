import { _decorator, Component, find, Vec3 } from 'cc';
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

    start() {
        this._dx = 0;
        this._dy = this.dirY >= 0 ? 1 : -1;

        if (!this.aimAtPlayer) return;
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
        const p = this.node.position
        const nx = p.x + this._dx * this.speed * deltaTime
        const ny = p.y + this._dy * this.speed * deltaTime
        this.node.setPosition(nx, ny, p.z)

        // 飞出画面就销毁
        if (ny > 520 || ny < -520 || nx < -340 || nx > 340) {
            this.node.destroy()
        }
    }
}
