/**
 * 极简事件总线（发布 / 订阅）
 *
 * 解决的问题：两个模块要互相通知，但不想互相 import，也不想靠节点路径 find。
 * 用法：
 *   Bus.on(Evt.xxx, this.someMethod, this)     订阅
 *   Bus.off(Evt.xxx, this.someMethod, this)    退订（onDestroy 里必须调）
 *   Bus.emit(Evt.xxx, 参数1, 参数2)            发出
 */

type Handler = (...args: any[]) => void

interface Slot {
    fn: Handler
    ctx: any
}

class EventBus {
    private map = new Map<string, Slot[]>()

    on(key: string, fn: Handler, ctx?: any) {
        let list = this.map.get(key)
        if (!list) {
            list = []
            this.map.set(key, list)
        }
        // 同一个方法重复订阅会触发两次，这里挡掉
        if (list.some(s => s.fn === fn && s.ctx === ctx)) return
        list.push({ fn, ctx })
    }

    off(key: string, fn: Handler, ctx?: any) {
        const list = this.map.get(key)
        if (!list) return
        const i = list.findIndex(s => s.fn === fn && s.ctx === ctx)
        if (i >= 0) list.splice(i, 1)
    }

    emit(key: string, ...args: any[]) {
        const list = this.map.get(key)
        if (!list) return
        // 拷贝一份再遍历：回调里可能退订自己，直接遍历原数组会漏掉后面的
        for (const s of [...list]) {
            s.fn.apply(s.ctx, args)
        }
    }
}

/** 全局唯一的总线实例 */
export const Bus = new EventBus()

/** 事件名集中登记，避免各处手写字符串拼错 */
export const Evt = {
    /** 敌人被击杀，参数：tag(number) */
    EnemyKilled: 'enemy-killed',
    /** 使用清屏道具 */
    ClearScreen: 'clear-screen',
        /** 敌人漏过防线飞出屏幕底部（玩家扣血），无参数 */
    EnemyEscaped: 'enemy-escaped',
}