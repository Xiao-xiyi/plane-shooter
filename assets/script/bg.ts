import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('bg')
export class bg extends Component {
    @property(Node)
    public bg1:Node=null
    @property(Node)
    public bg2:Node=null
    @property
    speed:number=100

    start() {

    }

    update(deltaTime: number) {
        let pos1=this.bg1.position
        this.bg1.setPosition(pos1.x, pos1.y-this.speed*deltaTime,pos1.z)
        let pos2=this.bg2.position
        this.bg2.setPosition(pos2.x, pos2.y-this.speed*deltaTime,pos2.z)
        let p1=this.bg1.position
         let p2=this.bg2.position
        if(this.bg1.position.y<-850){
        this.bg1.setPosition(p2.x,p2.y+850  ,p2.z)
    } if(this.bg2.position.y<-850){
        this.bg2.setPosition(p1.x,p1.y+850,p1.z)
    }
    
    }
}


