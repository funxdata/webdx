import { GetStore } from "./store.ts"

// 获取token信息
export const getTokenInfo = async () => {
    const token_info = await GetStore("token_info");
    return token_info;
}