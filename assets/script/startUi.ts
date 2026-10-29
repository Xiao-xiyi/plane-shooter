import { _decorator, Component, director, Label, Node } from 'cc';
const { ccclass, property } = _decorator;
import { GameStore, formatTime } from './GameStore';

@ccclass('startUi')
export class startUi extends Component {
    @property(Node)
    Panel: Node = null
    @property(Node)
    bg: Node = null
    @property(Node)
    startgame: Node = null
    @property(Node)
    btnReastart: Node = null
    @property(Node)
    BtnHome: Node = null

    @property(Label)
    lbScore: Label | null = null;
    @property(Label)
    lbTimer: Label | null = null;

    onstartbuttonclick() {
        GameStore.df = 0
        GameStore.time = 0
        GameStore.isover = false
        director.loadScene("02_gamescence")
    }

    home() {
        GameStore.df = 0
        GameStore.time = 0
        GameStore.isover = false
        // 关掉结算面板
        this.btnReastart.active = false;
        this.BtnHome.active = false;
        this.Panel.active = false;
        // 把首页的 logo / 开始按钮还原回来，否则返回主页后是一片空白
        this.bg.active = true;
        this.startgame.active = true;
    }

    /** 上一局死过，就切到结算界面 */
    over() {
        if (!GameStore.isover) return;

        this.btnReastart.active = true;
        this.BtnHome.active = true;
        this.Panel.active = true;
        this.bg.active = false;
        this.startgame.active = false;

        GameStore.isover = false;
    }
    restart(){
         GameStore.df = 0
        GameStore.time = 0
        GameStore.isover = false
        director.loadScene("02_gamescence")
    }

    start() {
        // 1) 先把界面恢复到「开局前」的状态
        //    场景文件里这几个节点保存的 _active 都是 true，不主动关掉的话
        //    结算面板一开始就是显示着的，over() 再设 true 也看不出变化
        this.Panel.active = false;
        this.btnReastart.active = false;
        this.BtnHome.active = false;
        this.bg.active = true;
        this.startgame.active = true;

        // 2) 刷新分数和生存时间
        if (this.lbScore) {
            this.lbScore.string = GameStore.df.toString()
        } else {
            console.error('lbScore 为空，请检查 Inspector 中的绑定！');
        }

        if (this.lbTimer) {
            this.lbTimer.string = formatTime(GameStore.time)
        } else {
            console.error('lbTimer 为空，请检查 Inspector 中的绑定！');
        }

        // 3) 上一局死过才弹结算面板
        this.over();
    }

    // ⚠️ 不要在 onLoad 里写 GameStore.isover = false
    //    onLoad 比 start 先执行，会把 player 写进去的 true 清掉，
    //    导致 start() 里调用 over() 时判断为 false，结算面板永远不弹。
}
