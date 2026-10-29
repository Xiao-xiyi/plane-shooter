/**
 * 敌人数值表 —— 纯数据，不依赖任何引擎 API
 * 加一种新敌人 = 这里加一行，逻辑代码一行都不用改
 */
export interface EnemyData {
    /** 碰撞体 tag，必须和 prefab 上 Collider2D 的 Tag 一致 */
    tag: number
    /** 调试用名字 */
    name: string
    /** 基础血量（会再乘时间成长系数） */
    baseHp: number
    /** 击杀得分 */
    score: number
    /** 死亡动画名 */
    deathAnim: string
    /** 受击动画名 */
    hitAnim: string
}

export const ENEMY_TABLE: Record<number, EnemyData> = {
    1: { tag: 1, name: '小飞机', baseHp: 2, score: 10, deathAnim: 'dath1', hitAnim: 'hit1' },
    2: { tag: 2, name: '中飞机', baseHp: 3, score: 30, deathAnim: 'dath2', hitAnim: 'hit2' },
    3: { tag: 3, name: '大飞机', baseHp: 5, score: 50, deathAnim: 'dath3', hitAnim: 'hit3' },
}