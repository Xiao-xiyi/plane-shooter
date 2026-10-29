import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/**
 * 这个组件原本在 onLoad 里给所有子 Button 注册 CLICK 监听，
 * 和 scene.scene 里 BtnRestart / BtnHome 的 cc.ClickEvent 重复了，
 * 点一次会执行两次 director.loadScene，所以这里不再注册监听。
 *
 * 按钮行为统一由场景里的 ClickEvent 驱动：
 *   BtnRestart -> Canvas 上的 startUi.onstartbuttonclick
 *   BtnHome    -> Canvas 上的 startUi.home
 */
@ccclass('react')
export class react extends Component {
}
