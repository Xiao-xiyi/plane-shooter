import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('out')
export class out extends Component {
    @property
    speed:number=200
    start() {

    }

    update(deltaTime: number) {
         const p = this.node.position
            this.node.setPosition(p.x, p.y - this.speed * deltaTime, p.z)
            if (this.node.position.y < -450) {
                this.schedule(()=>{this.node.destroy()},0)
            }
    }
}


