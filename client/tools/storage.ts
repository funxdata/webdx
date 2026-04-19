import type { ObjType,StorageType } from './types.ts'
export const Storage:StorageType = {
    // 存
    // deno-lint-ignore no-explicit-any
    set(key: string, val: any, expired?: number) {
        // 创建对象
        const obj: ObjType = {
            data: val,
            time: Date.now(),
            expired
        }
        // 存数据，使用JSON.stringify将对象或值转成JSON字符串
        localStorage.setItem(key, JSON.stringify(obj))
    },
    // 取
    get(key: string) {
        // 取回数据
        // deno-lint-ignore prefer-const
        let val = localStorage.getItem(key)
        // 数据不存在时,返回数据
        if (!val) {
            return val
        }
        // 把JSON字符串转回对象或值
        const parseVal = JSON.parse(val) as ObjType
        // 有设置失效时间时，进行判断处理
        if (parseVal.expired) {
            if (Date.now() - parseVal.time > parseVal.expired) {
                localStorage.removeItem(key)
                return null
            }
        }
        // 未设置失效时间，直接返回值
        return parseVal.data
    },
    // 单独删除
    remove(key: string) {
        localStorage.removeItem(key)
    },
    // 全部删除
    clear(){
        localStorage.clear()
    }
}