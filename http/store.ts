// 获取浏览器存储信息
// deno-lint-ignore require-await
export const GetStore = async (key:string) => {
    const str = localStorage.getItem(key);
    const str_value = JSON.parse(str || "{}");
    return str_value;
}

// 获取浏览器存储信息
// deno-lint-ignore no-explicit-any
export const SetStore =  (key:string,value:any) => {
    const str_value = JSON.stringify(value);
    return localStorage.setItem(key, str_value);
}