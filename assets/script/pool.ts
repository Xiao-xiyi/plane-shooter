import { instantiate, Node, NodePool, Prefab } from 'cc';

/**
 * 极简对象池
 *
 * 按「节点名」分池：同一个 Prefab 实例化出来的节点都叫这个名字，
 * 所以等价于“每种 Prefab 一个池子”。
 * 规矩：不要在运行时给被池化的节点改名，否则会分错池。
 */

const pools = new Map<string, NodePool>()

/** 统计：新建了几个 / 复用了多少次（用来给面试讲数字） */
export const PoolStat = { created: 0, reused: 0 }

/** 取一个节点：池里有就复用，没有才新建 */
export function getNode(prefab: Prefab): Node {
    if (!prefab) return null

    let pool = pools.get(prefab.name)
    if (!pool) {
        pool = new NodePool()
        pools.set(prefab.name, pool)
    }

    let node: Node
    if (pool.size() > 0) {
        node = pool.get()
        PoolStat.reused++
    } else {
        node = instantiate(prefab)
        PoolStat.created++
        if (PoolStat.created % 50 === 0) {
            console.log(`[Pool] 已新建 ${PoolStat.created} 个，复用 ${PoolStat.reused} 次`)
        }
    }

    node.active = true
    return node
}

/** 还一个节点：先脱离场景树，再放进池子 */
export function putNode(node: Node) {
    if (!node || !node.isValid) return
    node.destroy()      // ← 临时：不回收，直接销毁
}