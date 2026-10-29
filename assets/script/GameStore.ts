import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('GameStore')
export class GameStore {
    /** 生存时间（秒，浮点，只存数字） */
    static time: number = 0
    /** 分数 */
    static df: number = 0
    /*是否结束*/
    static isover:boolean=false
    /** 穿透弹剩余时间（秒），>0 时子弹打中敌人不消失 */
    static pierceTime: number = 0
    /** 子弹单发伤害，吃「攻击强化」道具后累加，整局有效 */
    static bulletDamage: number = 1
    /** 玩家当前血量（同步一份给掉落逻辑判断残血用） */
    static hp: number = 10
    /** 弹道数量（1~4），吃「多重射击」道具后累加，整局有效 */
    static bulletCount: number = 1

}

/**
 * 把秒数格式化成 MM:SS（超过 1 小时自动变成 H:MM:SS）
 * 只负责“显示”，不要往 GameStore.time 里塞字符串。
 */
export function formatTime(sec: number): string {
    const t = Math.max(0, Math.floor(sec))
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const s = t % 60
    const mm = m < 10 ? '0' + m : String(m)
    const ss = s < 10 ? '0' + s : String(s)
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
