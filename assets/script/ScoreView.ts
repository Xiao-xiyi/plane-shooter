import { _decorator, Component, Label } from 'cc';
const { ccclass, property } = _decorator;
import { GameStore } from './GameStore';

@ccclass('ScoreView')
export class ScoreView extends Component {
    private _last = -1;

    update() {
        if (GameStore.df === this._last) return;   // 值没变就不刷，省性能
        this._last = GameStore.df;
        const lb = this.getComponent(Label);
        if (lb) lb.string = GameStore.df.toString();
    }
}